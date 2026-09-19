/**
 * Master Test Runner for AgriDrone AI (Phases 1, 2, & 3)
 */

async function main() {
  console.log('===============================================================');
  console.log('  AgriDrone AI — Phase 1, Phase 2 & Phase 3 Verification Tests ');
  console.log('===============================================================');

  const startTime = Date.now();

  try {
    // 1. Env validation tests (synchronous)
    require('./env.test');

    // 2. Database resilience tests (asynchronous)
    const runDatabaseTests = require('./database.test');
    await runDatabaseTests();

    // 3. Server security & API contract tests (asynchronous)
    const runServerSecurityTests = require('./server_security.test');
    await runServerSecurityTests();

    // 4. Phase 2: Database Layer, Schema Audit & Persistence Integrity
    const runPhase2Tests = require('./phase2_database.test');
    await runPhase2Tests();

    // 5. Phase 3: UAV Upload Pipeline & Async Processing State Machine
    const runPhase3Tests = require('./phase3_pipeline.test');
    await runPhase3Tests();

    // 6. Phase 4: Deterministic Computer Vision & Real Vegetation Indices
    const runPhase4Tests = require('./phase4_vision.test');
    await runPhase4Tests();

    // 7. Phase 5: Spatial Geo-Registration & Hotspot Segmentation
    const runPhase5Tests = require('./phase5_spatial.test');
    await runPhase5Tests();

    // 8. Phase 6: AI Diagnostics & Agronomic Rules Engine
    const runPhase6Tests = require('./phase6_diagnostics.test');
    await runPhase6Tests();

    // 9. Phase 6 Corrections Pass (Audit Verification Tests A–I)
    const runPhase6CorrectionTests = require('./phase6_corrections.test');
    await runPhase6CorrectionTests();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n===============================================================');
    console.log(` ✅ ALL PHASE 1–6 & CORRECTION TEST SUITES PASSED in ${elapsed}s`);
    console.log('===============================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n===============================================================');
    console.error(' ❌ TEST SUITES FAILED:', err);
    console.error('===============================================================\n');
    process.exit(1);
  }
}

main();
