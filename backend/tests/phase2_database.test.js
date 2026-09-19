const assert = require('assert');
const mongoose = require('mongoose');
const { reloadConfig, getConfig } = require('../config/env');
const { connectDB, closeDB, getDatabaseStatus } = require('../config/database');
const Field = require('../models/Field');
const Scan = require('../models/Scan');
const Hotspot = require('../models/Hotspot');
const Alert = require('../models/Alert');
const Recommendation = require('../models/Recommendation');
const User = require('../models/User');
const { seedDemoData } = require('../scripts/seedDemoData');
const fieldController = require('../controllers/fieldController');
const scanController = require('../controllers/scanController');

console.log('\n--- Running Phase 2: Database Layer & Persistence Integrity Tests ---');

async function runPhase2Tests() {
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
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

  // Set DEMO mode for seeder and database tests
  process.env.APP_MODE = 'DEMO';
  process.env.MONGO_URI = 'mongodb://localhost:27017/agri_drone_ai';
  process.env.JWT_SECRET = 'super_secret_test_key_at_least_16_chars';
  process.env.USE_MEMORY_DB = 'false';
  reloadConfig();

  await connectDB();

  // Ensure clean test baseline by clearing any leftover DEMO test data
  await Field.deleteMany({ executionMode: 'DEMO' });
  await Scan.deleteMany({ executionMode: 'DEMO' });
  await Hotspot.deleteMany({ executionMode: 'DEMO' });
  await Alert.deleteMany({ executionMode: 'DEMO' });
  await Recommendation.deleteMany({ executionMode: 'DEMO' });

  try {
    // 1. Schema Validation & Roadmap Fields
    await test('SCHEMA AUDIT: Field model contains executionMode & compositeRiskScore', async () => {
      const paths = Field.schema.paths;
      assert(paths.executionMode, 'Field schema missing executionMode');
      assert(paths.compositeRiskScore, 'Field schema missing compositeRiskScore');
      assert.strictEqual(paths.executionMode.enumValues.includes('LIVE'), true);
      assert.strictEqual(paths.executionMode.enumValues.includes('DEMO'), true);
    });

    await test('SCHEMA AUDIT: Scan model contains indexMetrics, isGpsEstimated & executionMode', async () => {
      const paths = Scan.schema.paths;
      assert(paths.isGpsEstimated, 'Scan schema missing isGpsEstimated');
      assert(paths.executionMode, 'Scan schema missing executionMode');
      assert(paths.compositeRiskScore, 'Scan schema missing compositeRiskScore');
      assert(paths['indexMetrics.exgMean'], 'Scan schema missing indexMetrics.exgMean');
      assert(paths['indexMetrics.variMean'], 'Scan schema missing indexMetrics.variMean');
      assert(paths['indexMetrics.gliMean'], 'Scan schema missing indexMetrics.gliMean');
      assert(paths['indexMetrics.canopyCoverPct'], 'Scan schema missing indexMetrics.canopyCoverPct');
    });

    await test('SCHEMA AUDIT: Hotspot model contains isGpsEstimated, executionMode & coordinates', async () => {
      const paths = Hotspot.schema.paths;
      assert(paths.isGpsEstimated, 'Hotspot schema missing isGpsEstimated');
      assert(paths.executionMode, 'Hotspot schema missing executionMode');
      assert(paths.severity, 'Hotspot schema missing severity');
      assert(paths.riskLevel, 'Hotspot schema missing riskLevel');
    });

    await test('SCHEMA AUDIT: Alert and Recommendation models contain executionMode and references', async () => {
      assert(Alert.schema.paths.executionMode, 'Alert schema missing executionMode');
      assert(Alert.schema.paths.fieldId, 'Alert schema missing fieldId reference');
      assert(Recommendation.schema.paths.executionMode, 'Recommendation schema missing executionMode');
      assert(Recommendation.schema.paths.fieldId, 'Recommendation schema missing fieldId reference');
    });

    // 2. Indexes check
    await test('INDEX AUDIT: Required indexes exist on models', async () => {
      const fieldIndexes = Field.schema.indexes();
      const hasFieldIndex = fieldIndexes.some((idx) => idx[0].owner || idx[0].executionMode);
      assert(hasFieldIndex, 'Field missing compound indexes');

      const scanIndexes = Scan.schema.indexes();
      const hasScanIndex = scanIndexes.some((idx) => idx[0].fieldId);
      assert(hasScanIndex, 'Scan missing fieldId index');

      const hotspotIndexes = Hotspot.schema.indexes();
      const hasHotspotIndex = hotspotIndexes.some((idx) => idx[0].scanId);
      assert(hasHotspotIndex, 'Hotspot missing scanId index');
    });

    // 3. LIVE mode does not auto-seed
    await test('LIVE ISOLATION: LIVE mode never auto-seeds fields or scans', async () => {
      process.env.APP_MODE = 'LIVE';
      reloadConfig();

      // Mock Express req, res, next
      let responseJson = null;
      const mockReq = { query: { executionMode: 'NON_EXISTENT_MODE_FOR_TEST' } };
      const mockRes = {
        json: (data) => {
          responseJson = data;
        },
      };
      let nextError = null;
      const mockNext = (err) => {
        nextError = err;
      };

      await fieldController.getFields(mockReq, mockRes, mockNext);
      assert.strictEqual(nextError, null);
      assert(responseJson, 'Expected json response');
      assert.strictEqual(responseJson.count, 0, 'LIVE mode getFields must not auto-seed when no matching records exist');

      // Restore DEMO mode
      process.env.APP_MODE = 'DEMO';
      reloadConfig();
    });

    // 4. LIVE mode rejects DEMO seeder
    await test('LIVE ISOLATION: seedDemoData throws fatal error in LIVE mode', async () => {
      process.env.APP_MODE = 'LIVE';
      reloadConfig();

      let threw = false;
      try {
        await seedDemoData();
      } catch (err) {
        threw = true;
        assert(err.message.includes('strictly prohibited when APP_MODE=LIVE'));
      }

      assert.strictEqual(threw, true, 'Seeder should have thrown when APP_MODE=LIVE');

      // Restore DEMO mode
      process.env.APP_MODE = 'DEMO';
      reloadConfig();
    });

    // 5. Deterministic Seeder execution
    await test('DEMO SEEDER: Seeds deterministic records with executionMode=DEMO', async () => {
      const summary = await seedDemoData();
      assert.strictEqual(summary.users, 1);
      assert.strictEqual(summary.fields, 3);
      assert.strictEqual(summary.scans, 1);
      assert.strictEqual(summary.hotspots, 3);
      assert.strictEqual(summary.recommendations, 3);
      assert.strictEqual(summary.alerts, 2);

      const demoField = await Field.findOne({ fieldName: 'North Farm (Block A)' });
      assert(demoField, 'North Farm field should exist');
      assert.strictEqual(demoField.executionMode, 'DEMO');
      assert.strictEqual(demoField.compositeRiskScore, 68);

      const demoScan = await Scan.findOne({ fieldId: demoField._id });
      assert(demoScan, 'Demo scan should exist');
      assert.strictEqual(demoScan.executionMode, 'DEMO');
      assert.strictEqual(demoScan.indexMetrics.canopyCoverPct, 82.5);
      assert.strictEqual(demoScan.indexMetrics.ndviProxy, 0.64);
    });

    // 6. Seeder Idempotency (running twice produces same counts, no duplicates)
    await test('DEMO SEEDER IDEMPOTENCY: Repeated runs do not create uncontrolled duplicates', async () => {
      // Second run
      const summary2 = await seedDemoData();
      assert.strictEqual(summary2.fields, 3);
      assert.strictEqual(summary2.scans, 1);
      assert.strictEqual(summary2.hotspots, 3);

      const totalFields = await Field.countDocuments({ executionMode: 'DEMO' });
      assert.strictEqual(totalFields, 3, 'Total demo fields should remain exactly 3');

      const totalScans = await Scan.countDocuments({ executionMode: 'DEMO' });
      assert.strictEqual(totalScans, 1, 'Total demo scans should remain exactly 1');

      const totalHotspots = await Hotspot.countDocuments({ executionMode: 'DEMO' });
      assert.strictEqual(totalHotspots, 3, 'Total demo hotspots should remain exactly 3');
    });

    // 7. Referential Integrity & Relationships
    await test('DATA RELATIONSHIPS: Field -> Scan -> Hotspot -> Alert relationships valid', async () => {
      const field = await Field.findOne({ fieldName: 'North Farm (Block A)' });
      const scan = await Scan.findOne({ fieldId: field._id });
      const hotspots = await Hotspot.find({ scanId: scan._id });
      const alerts = await Alert.find({ scanId: scan._id });
      const recs = await Recommendation.find({ scanId: scan._id });

      assert.strictEqual(scan.fieldId.toString(), field._id.toString());
      assert.strictEqual(hotspots.length, 3);
      hotspots.forEach((h) => {
        assert.strictEqual(h.fieldId.toString(), field._id.toString());
        assert.strictEqual(h.scanId.toString(), scan._id.toString());
      });
      assert(alerts.length >= 1);
      assert(recs.length >= 1);
    });

    // 8. Invalid ObjectId handling
    await test('PERSISTENCE INTEGRITY: Controllers safely reject invalid ObjectId format', async () => {
      let errorThrown = null;
      const mockReq = { params: { id: 'not_a_valid_mongo_id_123' } };
      const mockRes = { json: () => {} };
      const mockNext = (err) => {
        errorThrown = err;
      };

      await fieldController.getFieldById(mockReq, mockRes, mockNext);
      assert(errorThrown, 'Expected an error passed to next()');
      assert.strictEqual(errorThrown.code, 'INVALID_ID');
      assert.strictEqual(errorThrown.statusCode, 400);
    });

    // 9. Cascade deletion integrity
    await test('PERSISTENCE INTEGRITY: Deleting a field cascades to scans, hotspots, alerts, recs', async () => {
      // Create a temporary field with children
      const tempField = await Field.create({
        fieldName: 'Temporary Field For Deletion Test',
        cropType: 'Soybean',
        area: 2.5,
        location: 'Test Zone',
        latitude: 10.0,
        longitude: 77.0,
        executionMode: 'DEMO',
      });

      const tempScan = await Scan.create({
        fieldId: tempField._id,
        executionMode: 'DEMO',
      });

      const tempHotspot = await Hotspot.create({
        fieldId: tempField._id,
        scanId: tempScan._id,
        hotspotId: 'HS-TEMP',
        x: 10,
        y: 10,
        width: 20,
        height: 20,
        executionMode: 'DEMO',
      });

      const tempAlert = await Alert.create({
        fieldId: tempField._id,
        scanId: tempScan._id,
        title: 'Temp Alert',
        message: 'Temp Message',
        executionMode: 'DEMO',
      });

      const tempRec = await Recommendation.create({
        fieldId: tempField._id,
        scanId: tempScan._id,
        cropType: 'Soybean',
        issueName: 'Temp Issue',
        executionMode: 'DEMO',
      });

      // Delete the field using controller
      let response = null;
      await fieldController.deleteField(
        { params: { id: tempField._id.toString() } },
        { json: (d) => (response = d) },
        (err) => {
          if (err) throw err;
        }
      );

      assert(response && response.success);

      // Verify no orphaned records exist
      const remainingScan = await Scan.findById(tempScan._id);
      const remainingHotspot = await Hotspot.findById(tempHotspot._id);
      const remainingAlert = await Alert.findById(tempAlert._id);
      const remainingRec = await Recommendation.findById(tempRec._id);

      assert.strictEqual(remainingScan, null, 'Orphaned scan was not deleted');
      assert.strictEqual(remainingHotspot, null, 'Orphaned hotspot was not deleted');
      assert.strictEqual(remainingAlert, null, 'Orphaned alert was not deleted');
      assert.strictEqual(remainingRec, null, 'Orphaned recommendation was not deleted');
    });

    console.log(`\nAll ${passed}/${total} Phase 2 Database & Persistence Tests Passed!`);
  } finally {
    await closeDB();
  }
}

module.exports = runPhase2Tests;

if (require.main === module) {
  runPhase2Tests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
