const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { connectDB, closeDB } = require('../config/database');
const { reloadConfig, getConfig } = require('../config/env');
const Scan = require('../models/Scan');
const Field = require('../models/Field');
const Hotspot = require('../models/Hotspot');
const Recommendation = require('../models/Recommendation');
const User = require('../models/User');
const { getCropProfile, CROP_PROFILES } = require('../config/cropProfiles');
const {
  checkOllamaHealth,
  extractAndParseJson,
  normalizeDiagnosticOutput,
  createInconclusiveResult,
  analyzeCropRegion,
} = require('../services/ollamaService');
const {
  getConfidenceBand,
  evaluateAgronomicRules,
} = require('../services/agronomicRulesService');

console.log('\n--- Running Phase 6: AI Diagnostics & Agronomic Rules Engine Tests ---');

// Helper to make local HTTP requests to Express server
function makeRequest(server, { method = 'GET', path = '/', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(rawData);
          } catch {}
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: rawData,
            json,
          });
        });
      }
    );

    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function runPhase6Tests() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}:`, err.message);
      throw err;
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}:`, err.message);
      throw err;
    }
  }

  // -------------------------------------------------------------
  // 1. Crop Profiles & Evidence Catalog
  // -------------------------------------------------------------
  test('CROP PROFILES: Resolves known crops and falls back safely to generic profile', () => {
    const tomato = getCropProfile('Tomato');
    assert.strictEqual(tomato.displayName.includes('Solanum lycopersicum'), true);
    assert(tomato.commonVisualStressPatterns.length > 0);

    const corn = getCropProfile('Corn');
    assert.strictEqual(corn.displayName.includes('Zea mays'), true);

    const unknown = getCropProfile('dragonfruit_xyz');
    assert.strictEqual(unknown.displayName, 'Generic Agricultural Crop');

    const empty = getCropProfile(null);
    assert.strictEqual(empty.displayName, 'Generic Agricultural Crop');
  });

  // -------------------------------------------------------------
  // 2. JSON Extraction & Resilience
  // -------------------------------------------------------------
  test('AI PARSING: Extracts clean JSON without markdown code fences', () => {
    const raw = '{"diagnosisStatus":"SUSPECTED","primaryFinding":{"name":"Early Blight"},"confidence":0.75}';
    const parsed = extractAndParseJson(raw);
    assert.strictEqual(parsed.diagnosisStatus, 'SUSPECTED');
    assert.strictEqual(parsed.confidence, 0.75);
  });

  test('AI PARSING: Extracts JSON wrapped in markdown code fences', () => {
    const raw = '```json\n{"diagnosisStatus":"SUSPECTED","confidence":0.88}\n```';
    const parsed = extractAndParseJson(raw);
    assert.strictEqual(parsed.diagnosisStatus, 'SUSPECTED');
    assert.strictEqual(parsed.confidence, 0.88);
  });

  test('AI PARSING: Extracts embedded JSON surrounded by conversational prose', () => {
    const raw = 'Here is your agricultural diagnosis:\n{"diagnosisStatus":"SUSPECTED","confidence":0.65}\nHope this helps!';
    const parsed = extractAndParseJson(raw);
    assert.strictEqual(parsed.diagnosisStatus, 'SUSPECTED');
    assert.strictEqual(parsed.confidence, 0.65);
  });

  test('AI PARSING: Returns null safely on completely invalid or non-JSON text', () => {
    assert.strictEqual(extractAndParseJson('Not a JSON string at all'), null);
    assert.strictEqual(extractAndParseJson(null), null);
    assert.strictEqual(extractAndParseJson(''), null);
  });

  // -------------------------------------------------------------
  // 3. AI Diagnostic Output Normalization & Confidence Validation
  // -------------------------------------------------------------
  test('AI NORMALIZATION: Downgrades invalid, negative, or NaN confidence to INCONCLUSIVE', () => {
    const invalidConf = normalizeDiagnosticOutput({
      diagnosisStatus: 'SUSPECTED',
      confidence: 'not_a_number',
    });
    assert.strictEqual(invalidConf.diagnosisStatus, 'INCONCLUSIVE');
    assert.strictEqual(invalidConf.primaryFinding.confidence, 0.0);

    const negativeConf = normalizeDiagnosticOutput({
      diagnosisStatus: 'SUSPECTED',
      confidence: -0.5,
    });
    assert.strictEqual(negativeConf.diagnosisStatus, 'INCONCLUSIVE');
    assert.strictEqual(negativeConf.primaryFinding.confidence, 0.0);
  });

  test('AI NORMALIZATION: Preserves verified CV evidence and attaches mandatory scientific limitations', () => {
    const normalized = normalizeDiagnosticOutput(
      {
        diagnosisStatus: 'SUSPECTED',
        confidence: 0.78,
        primaryFinding: { name: 'Leaf Chlorosis', severity: 'HIGH' },
        visualEvidence: ['Lower leaf yellowing', 'Margin browning'],
      },
      {
        cropType: 'Tomato',
        canopyCoverPct: 75.4,
        vegetationStressPct: 22.1,
        visualHealthScore: 78,
      }
    );

    assert.strictEqual(normalized.diagnosisStatus, 'SUSPECTED');
    assert.strictEqual(normalized.primaryFinding.name, 'Leaf Chlorosis');
    assert.strictEqual(normalized.evidence.cvEvidence.canopyCoverPct, 75.4);
    assert.strictEqual(normalized.evidence.cvEvidence.vegetationStressPct, 22.1);
    assert(normalized.limitations.length >= 2);
    assert(normalized.limitations[0].includes('RGB drone imagery cannot verify pathogen identity'));
  });

  test('AI FALLBACK: Safe INCONCLUSIVE result preserves CV measurements without fabricating diseases', () => {
    const fallback = createInconclusiveResult('Ollama connection timeout', {
      cropType: 'Tomato',
      canopyCoverPct: 82.0,
      vegetationStressPct: 15.0,
      visualHealthScore: 85,
    });

    assert.strictEqual(fallback.diagnosisStatus, 'INCONCLUSIVE');
    assert.strictEqual(fallback.primaryFinding.name, 'Undetermined Canopy Stress');
    assert.strictEqual(fallback.primaryFinding.confidence, 0.0);
    assert.strictEqual(fallback.evidence.cvEvidence.canopyCoverPct, 82.0);
    assert(fallback.differentialFindings.length > 0);
  });

  // -------------------------------------------------------------
  // 4. Agronomic Rules Engine & Confidence Banding
  // -------------------------------------------------------------
  test('CONFIDENCE BANDING: Accurately maps numerical confidence into standard bands', () => {
    assert.strictEqual(getConfidenceBand(0.92), 'HIGH');
    assert.strictEqual(getConfidenceBand(0.80), 'HIGH');
    assert.strictEqual(getConfidenceBand(0.72), 'MODERATE');
    assert.strictEqual(getConfidenceBand(0.60), 'MODERATE');
    assert.strictEqual(getConfidenceBand(0.48), 'LOW');
    assert.strictEqual(getConfidenceBand(0.39), 'INCONCLUSIVE');
    assert.strictEqual(getConfidenceBand(NaN), 'INCONCLUSIVE');
  });

  test('RULES ENGINE: Healthy canopy (Health >= 80, Stress < 15) triggers NO_VISIBLE_ABNORMALITY with MONITOR action', () => {
    const result = evaluateAgronomicRules({
      cvEvidence: { canopyCoverPct: 88, vegetationStressPct: 8, visualHealthScore: 92 },
      spatialEvidence: { hotspotCount: 0, severity: 'LOW' },
      aiDiagnosis: { diagnosisStatus: 'SUSPECTED', primaryFinding: { name: 'Foliar Spot', confidence: 0.7 } },
      cropType: 'Corn',
    });

    assert.strictEqual(result.diagnosisStatus, 'NO_VISIBLE_ABNORMALITY');
    assert.strictEqual(result.recommendationEligibility, 'ELIGIBLE');
    assert(result.actionSteps.some((a) => a.type === 'MONITOR'));
    assert.strictEqual(result.urgency, 'ROUTINE');
  });

  test('RULES ENGINE: Bare soil (Canopy < 5%) triggers NOT_ELIGIBLE recommendation', () => {
    const result = evaluateAgronomicRules({
      cvEvidence: { canopyCoverPct: 2.5, vegetationStressPct: 0, visualHealthScore: 90 },
      cropType: 'Tomato',
    });

    assert.strictEqual(result.diagnosisStatus, 'NO_VISIBLE_ABNORMALITY');
    assert.strictEqual(result.recommendationEligibility, 'NOT_ELIGIBLE');
  });

  test('RULES ENGINE: Severe localized stress triggers CAUTION, INSPECT_FIELD and VERIFY_IRRIGATION', () => {
    const result = evaluateAgronomicRules({
      cvEvidence: { canopyCoverPct: 65, vegetationStressPct: 48, visualHealthScore: 38 },
      spatialEvidence: { hotspotCount: 4, severity: 'CRITICAL', gpsStatus: 'GPS_AVAILABLE' },
      aiDiagnosis: {
        diagnosisStatus: 'SUSPECTED',
        primaryFinding: { name: 'Late Blight (Phytophthora infestans)', confidence: 0.82 },
      },
      cropType: 'Tomato',
    });

    assert.strictEqual(result.diagnosisStatus, 'SUSPECTED');
    assert.strictEqual(result.recommendationEligibility, 'CAUTION');
    assert.strictEqual(result.confidenceBand, 'HIGH');
    assert(result.actionSteps.some((a) => a.type === 'INSPECT_FIELD'));
    assert(result.actionSteps.some((a) => a.type === 'VERIFY_IRRIGATION'));
    assert(result.actionSteps.some((a) => a.type === 'COLLECT_CLOSE_RANGE_IMAGES'));
    assert.strictEqual(result.urgency, 'CRITICAL');
  });

  // -------------------------------------------------------------
  // 5. Determinism: 5 consecutive executions yield identical outputs
  // -------------------------------------------------------------
  test('DETERMINISM: 5 consecutive agronomic rule evaluations yield strictly identical outputs', () => {
    const input = {
      cvEvidence: { canopyCoverPct: 72.5, vegetationStressPct: 28.0, visualHealthScore: 68 },
      spatialEvidence: { hotspotCount: 2, severity: 'HIGH' },
      aiDiagnosis: {
        diagnosisStatus: 'SUSPECTED',
        primaryFinding: { name: 'Target Spot', confidence: 0.74 },
        differentialFindings: [{ name: 'Early Blight', confidence: 0.65, reasoning: 'Concentric ring' }],
      },
      cropType: 'Tomato',
    };

    const run1 = JSON.stringify(evaluateAgronomicRules(input));
    for (let i = 0; i < 5; i++) {
      const nextRun = JSON.stringify(evaluateAgronomicRules(input));
      assert.strictEqual(run1, nextRun);
    }
  });

  // -------------------------------------------------------------
  // 6. Zero Math.random() Audit
  // -------------------------------------------------------------
  test('AUDIT: Zero Math.random() calls exist in Phase 6 services and crop profiles', () => {
    const files = [
      path.join(__dirname, '..', 'services', 'agronomicRulesService.js'),
      path.join(__dirname, '..', 'services', 'ollamaService.js'),
      path.join(__dirname, '..', 'config', 'cropProfiles.js'),
    ];

    files.forEach((f) => {
      const content = fs.readFileSync(f, 'utf8');
      assert.strictEqual(content.includes('Math.random'), false, `Found Math.random in ${path.basename(f)}`);
    });
  });

  // -------------------------------------------------------------
  // 7. Security: JWT Protected GET /api/scans/:id/diagnosis
  // -------------------------------------------------------------
  await asyncTest('SECURITY: GET /api/scans/:id/diagnosis enforces 401 unauthenticated, 403 non-owner, 200 owner', async () => {
    process.env.APP_MODE = 'DEMO';
    process.env.MONGO_URI = 'mongodb://localhost:27017/agri_drone_ai';
    process.env.JWT_SECRET = 'super_secret_test_key_at_least_16_chars';
    reloadConfig();

    await connectDB();

    const { app } = require('../server');
    const server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });

    try {
      const ownerUser = new User({
        name: 'Owner Farmer',
        email: `owner_${Date.now()}@agri.ai`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEF',
        executionMode: 'DEMO',
      });
      await ownerUser.save();

      const otherUser = new User({
        name: 'Other Farmer',
        email: `other_${Date.now()}@agri.ai`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEF',
        executionMode: 'DEMO',
      });
      await otherUser.save();

      const field = new Field({
        fieldName: 'Phase 6 Secure Field',
        cropType: 'Tomato',
        area: 5.0,
        location: 'Field Sector A',
        latitude: 10.585,
        longitude: 77.015,
        owner: ownerUser._id,
        executionMode: 'DEMO',
      });
      await field.save();

      const scan = new Scan({
        fieldId: field._id,
        processingStatus: 'COMPLETED',
        healthyPercentage: 82,
        affectedPercentage: 18,
        diagnosticSummary: {
          status: 'SUSPECTED',
          primaryFinding: 'Early Blight Candidate',
          confidence: 0.78,
          confidenceBand: 'MODERATE',
          differentialFindings: [{ name: 'Nutrient Stress', confidence: 0.45, reasoning: 'Lower leaf chlorosis' }],
        },
        executionMode: 'DEMO',
      });
      await scan.save();

      const ownerToken = jwt.sign({ id: ownerUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      const otherToken = jwt.sign({ id: otherUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

      // 1. Missing Token -> 401
      const resUnauth = await makeRequest(server, {
        method: 'GET',
        path: `/api/scans/${scan._id}/diagnosis`,
      });
      assert.strictEqual(resUnauth.statusCode, 401);

      // 2. Non-owner Token -> 403
      const resForbidden = await makeRequest(server, {
        method: 'GET',
        path: `/api/scans/${scan._id}/diagnosis`,
        headers: { Authorization: `Bearer ${otherToken}` },
      });
      assert.strictEqual(resForbidden.statusCode, 403);

      // 3. Authorized Owner Token -> 200 with structured diagnostic data
      const resOk = await makeRequest(server, {
        method: 'GET',
        path: `/api/scans/${scan._id}/diagnosis`,
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert.strictEqual(resOk.statusCode, 200);
      assert.strictEqual(resOk.json.success, true);
      assert.strictEqual(resOk.json.data.diagnosticSummary.status, 'SUSPECTED');
      assert.strictEqual(resOk.json.data.diagnosticSummary.primaryFinding, 'Early Blight Candidate');
      assert.strictEqual(resOk.json.data.diagnosticSummary.confidenceBand, 'MODERATE');

      // Cleanup
      await Scan.deleteMany({ _id: scan._id });
      await Field.deleteMany({ _id: field._id });
      await User.deleteMany({ _id: { $in: [ownerUser._id, otherUser._id] } });
    } finally {
      server.close();
      await closeDB();
    }
  });

  console.log(`\nAll ${passed}/${total} Phase 6 AI Diagnostics & Agronomic Rules Engine Tests Passed!`);
}

if (require.main === module) {
  runPhase6Tests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runPhase6Tests;
