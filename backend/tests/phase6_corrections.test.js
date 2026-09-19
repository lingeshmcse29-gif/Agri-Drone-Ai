/**
 * Phase 6 Correction Pass Verification Test Suite
 *
 * Covers:
 * TEST A: DIAGNOSED is rejected / not generated
 * TEST B: CONFIRMED disease status is never generated
 * TEST C: Hotspot with null GPS displays GPS Unavailable rather than fallback coordinates
 * TEST D: Empty possibleDiseases does not display Early Blight or any fabricated disease
 * TEST E: No hardcoded evidence is displayed when backend evidence is absent
 * TEST F: No hardcoded weather is displayed
 * TEST G: One hotspot throws an unexpected processing exception while another succeeds (Per-Hotspot Isolation)
 * TEST H: Demo seed data contains no pesticide dosage/rate and no CONFIRMED/DIAGNOSED state
 * TEST I: Demo Scan diagnosticSummary exists and is consistent with seeded hotspots
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../config/database');
const Scan = require('../models/Scan');
const Hotspot = require('../models/Hotspot');
const Recommendation = require('../models/Recommendation');
const { normalizeDiagnosticOutput } = require('../services/ollamaService');
const { evaluateAgronomicRules } = require('../services/agronomicRulesService');
const { processAndSaveHotspots } = require('../services/hotspotService');

async function runPhase6CorrectionTests() {
  console.log('\n===============================================================');
  console.log('  Running Phase 6 Correction Pass Audit Verification Tests      ');
  console.log('===============================================================');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
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
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
      throw err;
    }
  }

  // -------------------------------------------------------------
  // TEST A: DIAGNOSED is rejected / not generated
  // -------------------------------------------------------------
  test('TEST A1: normalizeDiagnosticOutput rejects DIAGNOSED status and normalizes to INCONCLUSIVE', () => {
    const output = normalizeDiagnosticOutput({
      diagnosisStatus: 'DIAGNOSED',
      confidence: 0.85,
      primaryFinding: { name: 'Early Blight' },
    });
    assert.strictEqual(output.diagnosisStatus, 'INCONCLUSIVE');
    assert.notStrictEqual(output.diagnosisStatus, 'DIAGNOSED');
  });

  test('TEST A2: evaluateAgronomicRules never produces DIAGNOSED status', () => {
    const rulesOutput = evaluateAgronomicRules({
      aiDiagnosis: {
        diagnosisStatus: 'DIAGNOSED',
        primaryFinding: { name: 'Early Blight', confidence: 0.9 },
      },
    });
    assert.strictEqual(['SUSPECTED', 'INCONCLUSIVE', 'NO_VISIBLE_ABNORMALITY'].includes(rulesOutput.diagnosisStatus), true);
    assert.notStrictEqual(rulesOutput.diagnosisStatus, 'DIAGNOSED');
  });

  await asyncTest('TEST A3: Scan and Recommendation models reject DIAGNOSED enum value', async () => {
    await connectDB();
    try {
      const invalidScan = new Scan({
        fieldId: new mongoose.Types.ObjectId(),
        diagnosticSummary: { status: 'DIAGNOSED' },
      });
      const scanErr = invalidScan.validateSync();
      assert(scanErr, 'Scan model should fail validation for status DIAGNOSED');
      assert(scanErr.errors['diagnosticSummary.status'], 'Expected diagnosticSummary.status validation error');

      const invalidRec = new Recommendation({
        fieldId: new mongoose.Types.ObjectId(),
        scanId: new mongoose.Types.ObjectId(),
        cropType: 'Tomato',
        issueName: 'Foliar Stress',
        diagnosisStatus: 'DIAGNOSED',
      });
      const recErr = invalidRec.validateSync();
      assert(recErr, 'Recommendation model should fail validation for diagnosisStatus DIAGNOSED');
      assert(recErr.errors['diagnosisStatus'], 'Expected diagnosisStatus validation error');
    } finally {
      await closeDB();
    }
  });

  // -------------------------------------------------------------
  // TEST B: CONFIRMED disease status is never generated
  // -------------------------------------------------------------
  await asyncTest('TEST B1: Hotspot model schema rejects CONFIRMED status in possibleDiseases', async () => {
    await connectDB();
    try {
      const invalidHotspot = new Hotspot({
        scanId: new mongoose.Types.ObjectId(),
        fieldId: new mongoose.Types.ObjectId(),
        hotspotId: 'HS-TEST-CONFIRMED',
        x: 10,
        y: 10,
        width: 20,
        height: 20,
        possibleDiseases: [
          {
            name: 'Early Blight',
            confidence: 0.95,
            status: 'CONFIRMED',
          },
        ],
      });
      const err = invalidHotspot.validateSync();
      assert(err, 'Hotspot model should fail validation for possibleDiseases status CONFIRMED');
      assert(err.errors['possibleDiseases.0.status'], 'Expected possibleDiseases.0.status validation error');
    } finally {
      await closeDB();
    }
  });

  await asyncTest('TEST B2: hotspotService never assigns CONFIRMED to possibleDiseases', async () => {
    await connectDB();
    try {
      const mockScan = new Scan({
        _id: new mongoose.Types.ObjectId(),
        fieldId: new mongoose.Types.ObjectId(),
        executionMode: 'DEMO',
      });
      const mockField = {
        _id: mockScan.fieldId,
        cropType: 'Tomato',
        fieldName: 'Test Field',
      };
      const processedData = {
        hotspots: [
          {
            hotspotId: 'HS-B2',
            x: 20,
            y: 20,
            width: 50,
            height: 50,
            healthScore: 65,
            vegetationStressPct: 35,
          },
        ],
        dimensions: { width: 1000, height: 800 },
      };

      const result = await processAndSaveHotspots(mockScan, mockField, processedData, null, {});
      assert(result.hotspots.length === 1);
      const hs = result.hotspots[0];
      hs.possibleDiseases.forEach((d) => {
        assert.notStrictEqual(d.status, 'CONFIRMED', 'possibleDiseases must NEVER be CONFIRMED');
        assert(['SUSPECTED', 'INCONCLUSIVE', 'NO_VISIBLE_ABNORMALITY'].includes(d.status));
      });

      // Cleanup
      await Hotspot.deleteMany({ _id: hs._id });
      await Recommendation.deleteMany({ scanId: mockScan._id });
    } finally {
      await closeDB();
    }
  });

  // -------------------------------------------------------------
  // TEST C: Hotspot with null GPS displays GPS Unavailable rather than fallback coordinates
  // -------------------------------------------------------------
  test('TEST C: HotspotDetailModal source code renders "GPS Unavailable" when coordinates are absent', () => {
    const modalPath = path.resolve(__dirname, '../../frontend/src/components/hotspots/HotspotDetailModal.jsx');
    assert(fs.existsSync(modalPath), `HotspotDetailModal must exist at ${modalPath}`);
    const modalCode = fs.readFileSync(modalPath, 'utf8');

    // Confirm fake fallback coordinates are absent
    assert(!modalCode.includes("'10.5850'"), 'HotspotDetailModal must not have fallback 10.5850');
    assert(!modalCode.includes("'77.0150'"), 'HotspotDetailModal must not have fallback 77.0150');
    assert(!modalCode.includes('10.5850'), 'HotspotDetailModal must not have hardcoded 10.5850');
    assert(!modalCode.includes('77.0150'), 'HotspotDetailModal must not have hardcoded 77.0150');

    // Confirm honest GPS Unavailable string is present
    assert(
      modalCode.includes('GPS Unavailable (Pixel-space hotspot)'),
      'HotspotDetailModal must contain "GPS Unavailable (Pixel-space hotspot)"'
    );
  });

  // -------------------------------------------------------------
  // TEST D: Empty possibleDiseases does not display Early Blight or any fabricated disease
  // -------------------------------------------------------------
  test('TEST D: HotspotDetailModal does not display Early Blight or fabricated disease when possibleDiseases is empty', () => {
    const modalPath = path.resolve(__dirname, '../../frontend/src/components/hotspots/HotspotDetailModal.jsx');
    const modalCode = fs.readFileSync(modalPath, 'utf8');

    // Verify fabricated disease and fallback confidence are absent
    assert(!modalCode.includes('Early Blight (Alternaria solani)'), 'Must not contain hardcoded Early Blight');
    assert(!modalCode.includes('0.84'), 'Must not contain hardcoded 0.84 confidence');
    assert(!modalCode.includes('0.89'), 'Must not contain hardcoded 0.89 confidence fallback');

    // Verify honest empty state
    assert(modalCode.includes('No diagnostic finding available.'), 'Must contain honest empty finding message');
    assert(
      modalCode.includes('Visual evidence is insufficient for a reliable diagnosis.'),
      'Must contain honest inconclusive diagnosis message'
    );
  });

  // -------------------------------------------------------------
  // TEST E: No hardcoded evidence is displayed when backend evidence is absent
  // -------------------------------------------------------------
  test('TEST E: HotspotDetailModal does not display hardcoded evidence statements', () => {
    const modalPath = path.resolve(__dirname, '../../frontend/src/components/hotspots/HotspotDetailModal.jsx');
    const modalCode = fs.readFileSync(modalPath, 'utf8');

    assert(!modalCode.includes('Concentric brown leaf lesions'), 'Must not contain static concentric brown leaf lesions');
    assert(!modalCode.includes('Localized leaf yellowing'), 'Must not contain static localized leaf yellowing');
    assert(!modalCode.includes('Canopy density drop (> 15%)'), 'Must not contain static canopy density drop');
    assert(
      modalCode.includes('No additional visual evidence available.'),
      'Must contain fallback message when evidence is unavailable'
    );
  });

  // -------------------------------------------------------------
  // TEST F: No hardcoded weather is displayed
  // -------------------------------------------------------------
  test('TEST F: HotspotDetailModal does not display hardcoded weather statement', () => {
    const modalPath = path.resolve(__dirname, '../../frontend/src/components/hotspots/HotspotDetailModal.jsx');
    const modalCode = fs.readFileSync(modalPath, 'utf8');

    assert(!modalCode.includes('Humidity at 81% accelerates fungal spore germination.'), 'Must not contain hardcoded 81% weather claim');
    assert(
      modalCode.includes('Weather data not available for this scan.'),
      'Must contain neutral message when weather data is unavailable'
    );
  });

  // -------------------------------------------------------------
  // TEST G: Per-Hotspot Failure Isolation
  // -------------------------------------------------------------
  await asyncTest('TEST G: processAndSaveHotspots isolates single hotspot failure and processes remaining hotspots', async () => {
    await connectDB();
    try {
      const mockScan = new Scan({
        _id: new mongoose.Types.ObjectId(),
        fieldId: new mongoose.Types.ObjectId(),
        executionMode: 'DEMO',
      });
      const mockField = {
        _id: mockScan.fieldId,
        cropType: 'Tomato',
        fieldName: 'Isolation Test Field',
      };

      // Hotspot 1 is valid, Hotspot 2 triggers exception by passing invalid localFilePath causing failure or corrupted raw data,
      // Hotspot 3 is valid
      const processedData = {
        hotspots: [
          {
            hotspotId: 'HS-ISO-01',
            x: 10,
            y: 10,
            width: 40,
            height: 40,
            healthScore: 75,
            vegetationStressPct: 25,
            latitude: 10.585,
            longitude: 77.015,
          },
          {
            hotspotId: 'HS-ISO-02',
            // Corrupt geometry structure that causes an unexpected exception in geometry calculation or registration
            pixelX: null,
            x: NaN,
            y: NaN,
            width: NaN,
            height: NaN,
            pixelGeometry: null,
            normalizedGeometry: null,
            // Trigger failure by throwing inside custom property access or invalid parameters
            get localFilePath() {
              throw new Error('Unexpected simulated hotspot disk read failure');
            },
          },
          {
            hotspotId: 'HS-ISO-03',
            x: 60,
            y: 60,
            width: 40,
            height: 40,
            healthScore: 70,
            vegetationStressPct: 30,
            latitude: 10.586,
            longitude: 77.016,
          },
        ],
        dimensions: { width: 1000, height: 800 },
      };

      const result = await processAndSaveHotspots(mockScan, mockField, processedData, null, {});

      // All 3 hotspots must be persisted (Hotspot 2 recovered as INCONCLUSIVE)
      assert.strictEqual(result.hotspots.length, 3, 'All 3 hotspots must be present despite failure in HS-ISO-02');

      const hs1 = result.hotspots.find((h) => h.hotspotId === 'HS-ISO-01');
      const hs2 = result.hotspots.find((h) => h.hotspotId === 'HS-ISO-02');
      const hs3 = result.hotspots.find((h) => h.hotspotId === 'HS-ISO-03');

      assert(hs1, 'HS-ISO-01 must be saved');
      assert(hs2, 'HS-ISO-02 must be saved as fallback');
      assert(hs3, 'HS-ISO-03 must be saved despite HS-ISO-02 exception');

      // HS-ISO-02 verification: marked INCONCLUSIVE, no fabricated disease, confidence 0.0
      assert.strictEqual(hs2.confidence, 0.0, 'Failed hotspot must have 0.0 confidence');
      assert.strictEqual(hs2.possibleDiseases.length, 0, 'Failed hotspot must not fabricate diseases');
      assert.strictEqual(hs2.stressType, 'undetermined', 'Failed hotspot must have undetermined stressType');

      // Clean up
      await Hotspot.deleteMany({ _id: { $in: [hs1._id, hs2._id, hs3._id] } });
      await Recommendation.deleteMany({ scanId: mockScan._id });
    } finally {
      await closeDB();
    }
  });

  // -------------------------------------------------------------
  // TEST H: Demo seed data contains no pesticide dosage/rate and no CONFIRMED/DIAGNOSED state
  // -------------------------------------------------------------
  test('TEST H: seedDemoData.js contains no pesticide dosage/rate and no CONFIRMED/DIAGNOSED state', () => {
    const seederPath = path.resolve(__dirname, '../scripts/seedDemoData.js');
    assert(fs.existsSync(seederPath), `seedDemoData.js must exist at ${seederPath}`);
    const seederCode = fs.readFileSync(seederPath, 'utf8');

    // Forbidden pesticide dosages and rates
    assert(!seederCode.includes('2.5g/L'), 'Must not contain "2.5g/L"');
    assert(!seederCode.includes('25kg/ha'), 'Must not contain "25kg/ha"');
    assert(!seederCode.includes('2% urea'), 'Must not contain "2% urea"');
    assert(!seederCode.includes('0.5% neem oil'), 'Must not contain "0.5% neem oil"');
    assert(!seederCode.includes('Copper Hydroxide (2.5g/L)'), 'Must not contain Copper Hydroxide dosage');

    // Forbidden diagnostic statuses
    assert(!seederCode.includes("'CONFIRMED'"), 'Must not contain status "CONFIRMED"');
    assert(!seederCode.includes('"CONFIRMED"'), 'Must not contain status "CONFIRMED"');
    assert(!seederCode.includes("'DIAGNOSED'"), 'Must not contain status "DIAGNOSED"');
    assert(!seederCode.includes('"DIAGNOSED"'), 'Must not contain status "DIAGNOSED"');
    assert(!seederCode.includes('Early Blight Confirmed'), 'Alert must not claim confirmed disease');
  });

  // -------------------------------------------------------------
  // TEST I: Demo Scan diagnosticSummary exists and is consistent with seeded hotspots
  // -------------------------------------------------------------
  test('TEST I: Demo Scan diagnosticSummary exists and aligns with Phase 6 schema', () => {
    const seederPath = path.resolve(__dirname, '../scripts/seedDemoData.js');
    const seederCode = fs.readFileSync(seederPath, 'utf8');

    assert(seederCode.includes('diagnosticSummary:'), 'Demo Scan must include diagnosticSummary');
    assert(seederCode.includes("status: 'SUSPECTED'"), 'Demo Scan diagnosticSummary must use approved status SUSPECTED');
    assert(seederCode.includes("confidenceBand: 'HIGH'"), 'Demo Scan must include confidenceBand');
    assert(seederCode.includes('limitations:'), 'Demo Scan must include diagnostic limitations');
    assert(seederCode.includes('differentialFindings:'), 'Demo Scan must include differential findings');
  });

  console.log(`\nAll ${passed}/${total} Phase 6 Correction Tests Passed!\n`);
  return { passed, total };
}

if (require.main === module) {
  runPhase6CorrectionTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runPhase6CorrectionTests;
