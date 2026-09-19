const http = require('http');
const assert = require('assert');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { reloadConfig, getConfig } = require('../config/env');
const { connectDB, closeDB } = require('../config/database');
const Scan = require('../models/Scan');
const Field = require('../models/Field');
const User = require('../models/User');
const {
  enqueueScan,
  processScanJob,
  startWorker,
  stopWorker,
  isJobActive,
} = require('../services/pipelineWorker');
const { app } = require('../server');

console.log('\n--- Running Phase 3: UAV Upload Pipeline & Async Processing State Machine Tests ---');

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

// Sleep helper
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runPhase3Tests() {
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

  process.env.APP_MODE = 'DEMO';
  process.env.MONGO_URI = 'mongodb://localhost:27017/agri_drone_ai';
  process.env.JWT_SECRET = 'super_secret_test_key_at_least_16_chars';
  process.env.PIPELINE_CONCURRENCY = '2';
  reloadConfig();

  await connectDB();

  // Spin up test server on ephemeral port
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  try {
    // -------------------------------------------------------------
    // 1. Model Validation
    // -------------------------------------------------------------
    await test('MODEL: Valid processing states accepted', async () => {
      const validStates = ['UPLOADED', 'TILED', 'PROCESSING', 'ANALYZING', 'COMPLETED', 'FAILED'];
      const schemaStates = Scan.schema.paths.processingStatus.enumValues;
      validStates.forEach((state) => {
        assert(schemaStates.includes(state), `Scan model should include state "${state}"`);
      });
    });

    await test('MODEL: Invalid processing state rejected', async () => {
      const testScan = new Scan({
        fieldId: new mongoose.Types.ObjectId(),
        processingStatus: 'INVALID_STATE_XYZ',
      });
      const err = testScan.validateSync();
      assert(err && err.errors.processingStatus, 'Should reject invalid processingStatus enum');
    });

    await test('MODEL: Asynchronous processing timestamps and error fields supported', async () => {
      const paths = Scan.schema.paths;
      assert(paths.processingStartedAt, 'Missing processingStartedAt path');
      assert(paths.processingCompletedAt, 'Missing processingCompletedAt path');
      assert(paths.processingError, 'Missing processingError path');
    });

    // -------------------------------------------------------------
    // 2. Decoupled Upload & Scan Creation (Returns immediately)
    // -------------------------------------------------------------
    const testField = await Field.create({
      fieldName: 'Phase 3 Pipeline Isolated Test Field',
      cropType: 'Tomato',
      area: 5.0,
      location: 'Test Basin',
      latitude: 10.585,
      longitude: 77.015,
      executionMode: 'LIVE',
    });

    let uploadedScanId = null;

    await test('UPLOAD: POST /api/scans creates scan with UPLOADED status and returns 201 immediately', async () => {
      const startTime = Date.now();
      const res = await makeRequest(server, {
        method: 'POST',
        path: '/api/scans',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldId: testField._id.toString() }),
      });

      const durationMs = Date.now() - startTime;
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.json.success, true);
      assert.strictEqual(res.json.data.processingStatus, 'UPLOADED');
      assert(res.json.data.scanId, 'Missing scanId in response data');
      assert(durationMs < 1000, `Upload response must be immediate (< 1000ms), took ${durationMs}ms`);

      uploadedScanId = res.json.data.scanId;
    });

    // -------------------------------------------------------------
    // 3. Status Polling API & Authentication
    // -------------------------------------------------------------
    const testAuthUser = await User.create({
      name: 'Status Test User',
      email: `status_user_${Date.now()}@agridrone.ai`,
      passwordHash: 'dummy_hash',
    });
    const testAuthToken = jwt.sign({ id: testAuthUser._id, role: 'farmer' }, getConfig().JWT_SECRET);

    await test('STATUS API: Rejects unauthenticated status requests with 401 UNAUTHORIZED', async () => {
      const res = await makeRequest(server, {
        path: `/api/scans/${uploadedScanId}/status`,
      });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.json.success, false);
      assert.strictEqual(res.json.error.code, 'UNAUTHORIZED');
    });

    await test('STATUS API: Rejects invalid JWT token with 401 UNAUTHORIZED', async () => {
      const res = await makeRequest(server, {
        path: `/api/scans/${uploadedScanId}/status`,
        headers: { Authorization: 'Bearer invalid_tampered_token_xyz' },
      });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.json.success, false);
      assert.strictEqual(res.json.error.code, 'UNAUTHORIZED');
    });

    await test('STATUS API: GET /api/scans/:id/status returns persisted processing status when authenticated', async () => {
      const res = await makeRequest(server, {
        path: `/api/scans/${uploadedScanId}/status`,
        headers: { Authorization: `Bearer ${testAuthToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json.success, true);
      assert.strictEqual(res.json.data.scanId, uploadedScanId);
      assert(res.json.data.processingStatus, 'Missing processingStatus');
      assert(typeof res.json.data.progress === 'number', 'Progress must be a number');
    });

    await test('STATUS API: Safely rejects invalid ObjectId with 400 INVALID_ID', async () => {
      const res = await makeRequest(server, {
        path: '/api/scans/invalid_id_not_hex/status',
        headers: { Authorization: `Bearer ${testAuthToken}` },
      });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.json.success, false);
      assert.strictEqual(res.json.error.code, 'INVALID_ID');
    });

    // -------------------------------------------------------------
    // 4. Security & User Ownership
    // -------------------------------------------------------------
    await test('SECURITY: Unauthorized user rejected with 403 when accessing another user’s scan', async () => {
      const user1 = await User.create({
        name: 'Owner User',
        email: `owner_${Date.now()}@agridrone.ai`,
        passwordHash: 'dummy_hash',
      });

      const user2 = await User.create({
        name: 'Attacker User',
        email: `attacker_${Date.now()}@agridrone.ai`,
        passwordHash: 'dummy_hash',
      });

      const ownedField = await Field.create({
        fieldName: 'User 1 Private Field',
        cropType: 'Corn',
        area: 3.0,
        location: 'Private Sector',
        latitude: 10.0,
        longitude: 77.0,
        owner: user1._id,
        executionMode: 'DEMO',
      });

      const ownedScan = await Scan.create({
        fieldId: ownedField._id,
        processingStatus: 'UPLOADED',
        executionMode: 'DEMO',
      });

      // User 2 tries to access User 1's scan
      const tokenUser2 = jwt.sign({ id: user2._id, role: 'farmer' }, getConfig().JWT_SECRET);
      const res = await makeRequest(server, {
        path: `/api/scans/${ownedScan._id}/status`,
        headers: { Authorization: `Bearer ${tokenUser2}` },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.json.success, false);
      assert.strictEqual(res.json.error.code, 'FORBIDDEN');

      // Cleanup security test records immediately
      await Scan.findByIdAndDelete(ownedScan._id);
      await Field.findByIdAndDelete(ownedField._id);
      await User.findByIdAndDelete(user1._id);
      await User.findByIdAndDelete(user2._id);
    });

    // -------------------------------------------------------------
    // 5. Worker Execution & State Progression
    // -------------------------------------------------------------
    await test('WORKER: Processes scan through TILED, PROCESSING, ANALYZING to COMPLETED', async () => {
      const workerScan = await Scan.create({
        fieldId: testField._id,
        droneImages: ['/uploads/drone/sample_orthomosaic.jpg'],
        processingStatus: 'UPLOADED',
        executionMode: 'DEMO',
      });

      // Execute worker processing
      await processScanJob(workerScan._id.toString());

      const finishedScan = await Scan.findById(workerScan._id);
      assert.strictEqual(finishedScan.processingStatus, 'COMPLETED');
      assert.strictEqual(finishedScan.progress, 100);
      assert(finishedScan.processingStartedAt, 'processingStartedAt must be recorded');
      assert(finishedScan.processingCompletedAt, 'processingCompletedAt must be recorded');
      assert.strictEqual(finishedScan.processingError, null);
      assert(finishedScan.healthyPercentage > 0, 'healthyPercentage must be populated');
    });

    // -------------------------------------------------------------
    // 6. Worker Failure Handling
    // -------------------------------------------------------------
    await test('WORKER: Sets FAILED state and records processingError upon failure', async () => {
      // Create scan pointing to a non-existent field to trigger a genuine pipeline error
      const nonExistentFieldId = new mongoose.Types.ObjectId();
      const failingScan = await Scan.create({
        fieldId: nonExistentFieldId,
        processingStatus: 'UPLOADED',
        executionMode: 'DEMO',
      });

      await processScanJob(failingScan._id.toString());

      const failedDoc = await Scan.findById(failingScan._id);
      assert.strictEqual(failedDoc.processingStatus, 'FAILED');
      assert.strictEqual(failedDoc.progress, 0);
      assert(failedDoc.processingError && failedDoc.processingError.includes('not found'));
      assert(failedDoc.processingCompletedAt, 'Failure completion timestamp must be set');
    });

    // -------------------------------------------------------------
    // 7. Active Job Concurrency Lock
    // -------------------------------------------------------------
    await test('WORKER LOCK: In-memory activeJobs guard prevents duplicate concurrent execution', async () => {
      const lockScan = await Scan.create({
        fieldId: testField._id,
        processingStatus: 'UPLOADED',
        executionMode: 'DEMO',
      });

      const idStr = lockScan._id.toString();

      // Start first execution without await
      const p1 = processScanJob(idStr);
      assert.strictEqual(isJobActive(idStr), true, 'Job should be active in set');

      // Second execution of the exact same scan while active
      const p2 = processScanJob(idStr);

      await Promise.all([p1, p2]);
      assert.strictEqual(isJobActive(idStr), false, 'Job should be cleared from active set');
    });

    // -------------------------------------------------------------
    // 8. Startup Recovery
    // -------------------------------------------------------------
    await test('RECOVERY: startWorker() recovers unfinished scans on startup', async () => {
      const recoveredScan = await Scan.create({
        fieldId: testField._id,
        droneImages: ['/uploads/drone/sample_orthomosaic.jpg'],
        processingStatus: 'PROCESSING',
        executionMode: 'DEMO',
      });

      await startWorker();

      // Poll until the recovered scan is processed to completion
      let resolvedScan = null;
      for (let i = 0; i < 30; i++) {
        await sleep(300);
        resolvedScan = await Scan.findById(recoveredScan._id);
        if (resolvedScan.processingStatus === 'COMPLETED' || resolvedScan.processingStatus === 'FAILED') {
          break;
        }
      }

      assert.strictEqual(resolvedScan.processingStatus, 'COMPLETED');
    });

    await test('RECOVERY: COMPLETED scans are never automatically reprocessed', async () => {
      const completedScan = await Scan.create({
        fieldId: testField._id,
        processingStatus: 'COMPLETED',
        healthyPercentage: 88,
        executionMode: 'DEMO',
      });

      const initialUpdated = completedScan.updatedAt;
      await startWorker();
      await sleep(500);

      const checkScan = await Scan.findById(completedScan._id);
      assert.strictEqual(checkScan.processingStatus, 'COMPLETED');
      assert.strictEqual(checkScan.healthyPercentage, 88);
    });

    console.log(`\nAll ${passed}/${total} Phase 3 Pipeline & Async Processing Tests Passed!`);
  } finally {
    stopWorker();
    try {
      if (testAuthUser && testAuthUser._id) {
        await User.findByIdAndDelete(testAuthUser._id);
      }
      if (testField && testField._id) {
        await Scan.deleteMany({ fieldId: testField._id });
        await Field.findByIdAndDelete(testField._id);
      }
    } catch {}
    await new Promise((resolve) => server.close(resolve));
    await closeDB();
  }
}

module.exports = runPhase3Tests;

if (require.main === module) {
  runPhase3Tests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
