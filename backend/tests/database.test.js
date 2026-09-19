const assert = require('assert');
const mongoose = require('mongoose');
const { connectDB, closeDB, getDatabaseStatus } = require('../config/database');
const { reloadConfig } = require('../config/env');

console.log('\n--- Running Database Connection & Resilience Tests ---');

async function runDatabaseTests() {
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

  // 1. Initial state
  await test('DATABASE STATUS: Reports disconnected initially', async () => {
    assert.strictEqual(getDatabaseStatus(), 'disconnected');
  });

  // 2. LIVE mode failure resilience
  await test('LIVE MODE: Fails clearly and rejects in-memory DB when MongoDB is unavailable', async () => {
    // Temporarily point to unreachable port in LIVE mode
    process.env.APP_MODE = 'LIVE';
    process.env.MONGO_URI = 'mongodb://127.0.0.1:59999/unreachable_db';
    process.env.JWT_SECRET = 'secure_long_secret_for_live_testing_12345';

    // Reload active config
    reloadConfig();

    let threw = false;
    try {
      await connectDB({ maxRetries: 2, initialDelayMs: 200 });
    } catch (err) {
      threw = true;
      assert(
        err.message.includes('LIVE mode connection to real MongoDB failed') ||
        err.message.includes('Fallback to in-memory database is strictly prohibited in LIVE mode'),
        `Unexpected error message: ${err.message}`
      );
    }

    assert.strictEqual(threw, true, 'LIVE mode should have thrown when MongoDB is unreachable');
    assert.strictEqual(getDatabaseStatus(), 'disconnected');

    // Clean up and restore DEMO config
    await closeDB();
    process.env.APP_MODE = 'DEMO';
    process.env.MONGO_URI = 'mongodb://localhost:27017/agri_drone_ai';
    reloadConfig();
  });

  console.log(`\nAll ${passed}/${total} Database Resilience Tests Passed!`);
}

module.exports = runDatabaseTests;

if (require.main === module) {
  runDatabaseTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
