const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  calculateBufferVegetationMetrics,
  analyzeImageVegetation,
  clamp,
  safeDivide,
  EPSILON,
} = require('../services/vegetationIndexService');
const { processDroneScanImage } = require('../services/imageProcessingService');

console.log('\n--- Running Phase 4: Deterministic Computer Vision & Real Vegetation Indices Tests ---');

async function runPhase4Tests() {
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
  // 1. Math Utility Safeguards
  // -------------------------------------------------------------
  test('SAFEGUARD: clamp restricts values strictly within bounds', () => {
    assert.strictEqual(clamp(150, 0, 100), 100);
    assert.strictEqual(clamp(-50, 0, 100), 0);
    assert.strictEqual(clamp(42, 0, 100), 42);
    assert.strictEqual(clamp(NaN, 0, 100), 0);
  });

  test('SAFEGUARD: safeDivide returns fallback on zero or sub-epsilon denominator', () => {
    assert.strictEqual(safeDivide(10, 0, 0), 0);
    assert.strictEqual(safeDivide(10, 1e-7, -1), -1);
    assert.strictEqual(safeDivide(10, 2, 0), 5);
  });

  // -------------------------------------------------------------
  // 2. Synthetic Pixel Mathematics: ExG
  // -------------------------------------------------------------
  test('EXG: Pure Green pixel (R=0, G=255, B=0) yields maximum positive ExG (2.0)', () => {
    // 1 pixel buffer: R=0, G=255, B=0
    const buffer = Buffer.from([0, 255, 0]);
    const metrics = calculateBufferVegetationMetrics(buffer, 1, 1, 3);
    assert.strictEqual(metrics.exgMean, 2.0);
    assert.strictEqual(metrics.canopyCoverPct, 100.0);
    assert.strictEqual(metrics.vegetationStressPct, 0.0);
  });

  test('EXG: Pure Red pixel (R=255, G=0, B=0) yields negative ExG (-1.0) and 0% canopy', () => {
    const buffer = Buffer.from([255, 0, 0]);
    const metrics = calculateBufferVegetationMetrics(buffer, 1, 1, 3);
    assert.strictEqual(metrics.exgMean, -1.0);
    assert.strictEqual(metrics.canopyCoverPct, 0.0);
    assert.strictEqual(metrics.bareSoilPixels, 1);
  });

  test('EXG: Pure Blue pixel (R=0, G=0, B=255) yields negative ExG (-1.0) and 0% canopy', () => {
    const buffer = Buffer.from([0, 0, 255]);
    const metrics = calculateBufferVegetationMetrics(buffer, 1, 1, 3);
    assert.strictEqual(metrics.exgMean, -1.0);
    assert.strictEqual(metrics.canopyCoverPct, 0.0);
  });

  // -------------------------------------------------------------
  // 3. Synthetic Pixel Mathematics: VARI & GLI with Denominator Protection
  // -------------------------------------------------------------
  test('VARI: Handles singularity (G + R - B = 0) without NaN or Infinity', () => {
    // Pixel where G=128, R=0, B=128 -> g=128/255, r=0, b=128/255 -> g + r - b = 0
    const buffer = Buffer.from([0, 128, 128]);
    const metrics = calculateBufferVegetationMetrics(buffer, 1, 1, 3);
    assert.strictEqual(metrics.invalidVariPixels, 1);
    assert(!isNaN(metrics.variMean));
    assert(isFinite(metrics.variMean));
  });

  test('VARI RAW ACCURACY: Mathematical VARI exceeding [-1, 1] is preserved as finite raw value without silent clamping', () => {
    // Pixel R=50, G=100, B=130 -> r=50/255, g=100/255, b=130/255
    // g - r = 50/255, g + r - b = 20/255 -> VARI = 50 / 20 = 2.5
    const buffer = Buffer.from([50, 100, 130]);
    const metrics = calculateBufferVegetationMetrics(buffer, 1, 1, 3);
    assert.strictEqual(metrics.variRawMean, 2.5, 'Raw VARI should be mathematically 2.5');
    assert.strictEqual(metrics.variMean, 2.5, 'variMean must preserve un-clamped raw value');
    assert(isFinite(metrics.variMean), 'Raw VARI must be finite');
    assert.notStrictEqual(metrics.variMean, 1.0, 'Raw VARI must not be silently clamped to 1.0');
    assert.strictEqual(metrics.variClampedMean, 1.0, 'Derived variClampedMean must be explicitly bounded to 1.0');
    assert.strictEqual(metrics.variClamped, 1.0, 'variClamped alias matches variClampedMean');
    assert.strictEqual(metrics.variRange.max, 2.5, 'variRange preserves raw mathematical bound');
    assert.strictEqual(metrics.variClampedRange.max, 1.0, 'variClampedRange bound is 1.0');
  });

  test('GLI: Evaluates (2g - r - b) / (2g + r + b) safely without division by zero', () => {
    // Pixel with healthy green foliage
    const buffer = Buffer.from([40, 200, 30]);
    const metrics = calculateBufferVegetationMetrics(buffer, 1, 1, 3);
    assert(metrics.gliMean > 0.3, `Expected GLI > 0.3 for lush foliage, got ${metrics.gliMean}`);
    assert(!isNaN(metrics.gliMean));
    assert(isFinite(metrics.gliMean));
  });

  // -------------------------------------------------------------
  // 4. Canopy Coverage & Denominator Scenarios
  // -------------------------------------------------------------
  test('CANOPY SCENARIO 1: 100% Green foliage yields exactly 100.0% canopyCoverPct', () => {
    // 2 pixels: both lush green
    const buffer = Buffer.from([30, 210, 40, 30, 210, 40]);
    const metrics = calculateBufferVegetationMetrics(buffer, 2, 1, 3);
    assert.strictEqual(metrics.validPixels, 2);
    assert.strictEqual(metrics.vegetationPixels, 2);
    assert.strictEqual(metrics.canopyCoverPct, 100.0);
  });

  test('CANOPY SCENARIO 2: 50% Green foliage / 50% Bare soil image produces exactly 50.0% canopyCoverPct', () => {
    // 2 pixels: pixel 1 = lush green (30, 210, 40), pixel 2 = dry soil (180, 120, 80)
    const buffer = Buffer.from([30, 210, 40, 180, 120, 80]);
    const metrics = calculateBufferVegetationMetrics(buffer, 2, 1, 3);
    assert.strictEqual(metrics.validPixels, 2);
    assert.strictEqual(metrics.vegetationPixels, 1);
    assert.strictEqual(metrics.bareSoilPixels, 1);
    assert.strictEqual(metrics.canopyCoverPct, 50.0);
  });

  test('CANOPY SCENARIO 3: 50% Green foliage / 50% Shadow produces exactly 50.0% canopyCoverPct with validPixels denominator', () => {
    // 2 pixels: pixel 1 = lush green (30, 210, 40), pixel 2 = deep shadow (5, 5, 5)
    const buffer = Buffer.from([30, 210, 40, 5, 5, 5]);
    const metrics = calculateBufferVegetationMetrics(buffer, 2, 1, 3);
    assert.strictEqual(metrics.validPixels, 2);
    assert.strictEqual(metrics.vegetationPixels, 1);
    assert.strictEqual(metrics.shadowPixels, 1);
    assert.strictEqual(metrics.canopyCoverPct, 50.0, 'Canopy denominator is validPixels (spatial analysis pixels)');
  });

  test('CANOPY SCENARIO 4: Vegetation + invalid-index pixel preserves unambiguous validPixels denominator', () => {
    // 2 pixels: pixel 1 = lush green (30, 210, 40), pixel 2 = invalid VARI singularity (0, 128, 128)
    const buffer = Buffer.from([30, 210, 40, 0, 128, 128]);
    const metrics = calculateBufferVegetationMetrics(buffer, 2, 1, 3);
    assert.strictEqual(metrics.validPixels, 2);
    assert.strictEqual(metrics.vegetationPixels, 1);
    assert.strictEqual(metrics.invalidVariPixels, 1);
    assert.strictEqual(metrics.canopyCoverPct, 50.0, 'Invalid VARI pixel does not alter spatial canopy denominator');
  });

  test('CANOPY SCENARIO 5 (ZERO VEGETATION): Bare soil field yields 0.0% canopy, 0.0% vegetationStressPct and finite metrics', () => {
    // 4 pixels of dry sand/gravel
    const buffer = Buffer.from([
      160, 120, 80,
      170, 130, 90,
      150, 110, 70,
      180, 140, 100,
    ]);
    const metrics = calculateBufferVegetationMetrics(buffer, 2, 2, 3);
    assert.strictEqual(metrics.validPixels, 4);
    assert.strictEqual(metrics.vegetationPixels, 0);
    assert.strictEqual(metrics.bareSoilPixels, 4);
    assert.strictEqual(metrics.canopyCoverPct, 0.0);
    assert.strictEqual(metrics.vegetationStressPct, 0.0);
    assert.strictEqual(metrics.stressPct, 0.0);
    assert(!isNaN(metrics.exgMean));
    assert(!isNaN(metrics.variMean));
    assert(!isNaN(metrics.gliMean));
  });

  test('STRESS: Chlorotic yellow vegetation correctly classified as stressed without misclassifying soil', () => {
    // Pixel 1: Chlorotic/yellowing crop (R=200, G=205, B=40) -> g only slightly > r, low VARI
    // Pixel 2: Bare brown soil (R=150, G=100, B=60)
    const buffer = Buffer.from([200, 205, 40, 150, 100, 60]);
    const metrics = calculateBufferVegetationMetrics(buffer, 2, 1, 3);
    assert.strictEqual(metrics.vegetationPixels, 1);
    assert.strictEqual(metrics.stressedVegetationPixels, 1);
    assert.strictEqual(metrics.vegetationStressPct, 100.0);
    assert.strictEqual(metrics.bareSoilPixels, 1);
  });

  // -------------------------------------------------------------
  // 6. Strict Determinism Check (Same Pixels -> Same Metrics)
  // -------------------------------------------------------------
  test('DETERMINISM: 5 consecutive executions on synthetic image produce strictly identical (===) outputs', () => {
    // Generate a fixed pseudo-pattern synthetic buffer (10x10)
    const size = 10;
    const buf = Buffer.alloc(size * size * 3);
    for (let i = 0; i < size * size; i++) {
      buf[i * 3] = (i * 37) % 256;
      buf[i * 3 + 1] = (i * 73) % 256;
      buf[i * 3 + 2] = (i * 19) % 256;
    }

    const firstRun = calculateBufferVegetationMetrics(buf, size, size, 3);

    for (let run = 2; run <= 5; run++) {
      const currentRun = calculateBufferVegetationMetrics(buf, size, size, 3);
      assert.strictEqual(currentRun.exgMean, firstRun.exgMean, `ExG mismatch on run ${run}`);
      assert.strictEqual(currentRun.variMean, firstRun.variMean, `VARI mismatch on run ${run}`);
      assert.strictEqual(currentRun.gliMean, firstRun.gliMean, `GLI mismatch on run ${run}`);
      assert.strictEqual(currentRun.canopyCoverPct, firstRun.canopyCoverPct, `Canopy mismatch on run ${run}`);
      assert.strictEqual(currentRun.vegetationStressPct, firstRun.vegetationStressPct, `Stress mismatch on run ${run}`);
      assert.strictEqual(currentRun.visualHealthScore, firstRun.visualHealthScore, `Health score mismatch on run ${run}`);
    }
  });

  // -------------------------------------------------------------
  // 7. Image Robustness & File Preservation
  // -------------------------------------------------------------
  await asyncTest('ROBUSTNESS: Rejects unreadable or corrupted image files cleanly', async () => {
    const corruptPath = path.join(__dirname, 'temp_corrupt.jpg');
    fs.writeFileSync(corruptPath, Buffer.from('NOT_AN_IMAGE_DATA_XYZ'));

    let threw = false;
    try {
      await analyzeImageVegetation(corruptPath);
    } catch (err) {
      threw = true;
      assert(err.message.includes('Input file is missing') || err.message.includes('unsupported') || err.message.includes('Corrupted') || err.message.includes('VipsForeignLoad'));
    } finally {
      if (fs.existsSync(corruptPath)) fs.unlinkSync(corruptPath);
    }
    assert.strictEqual(threw, true, 'Corrupt image should throw an error');
  });

  await asyncTest('PRESERVATION: Original sample UAV image remains untouched after analysis', async () => {
    const samplePath = path.join(__dirname, '..', 'uploads', 'drone', 'sample_orthomosaic.jpg');
    if (fs.existsSync(samplePath)) {
      const statsBefore = fs.statSync(samplePath);
      await analyzeImageVegetation(samplePath);
      const statsAfter = fs.statSync(samplePath);

      assert.strictEqual(statsBefore.size, statsAfter.size, 'Source image file size must not change');
      assert.strictEqual(statsBefore.mtimeMs, statsAfter.mtimeMs, 'Source image modification time must not change');
    }
  });

  // -------------------------------------------------------------
  // 8. Real UAV Image Pipeline Verification
  // -------------------------------------------------------------
  await asyncTest('REAL UAV IMAGE: Processes sample_orthomosaic.jpg with genuine pixel metrics', async () => {
    const samplePath = path.join(__dirname, '..', 'uploads', 'drone', 'sample_orthomosaic.jpg');
    if (fs.existsSync(samplePath)) {
      const result = await processDroneScanImage(samplePath);

      assert(result.indexMetrics, 'Expected indexMetrics in result');
      assert(typeof result.indexMetrics.exgMean === 'number', 'exgMean must be numeric');
      assert(typeof result.indexMetrics.variMean === 'number', 'variMean must be numeric');
      assert(typeof result.indexMetrics.gliMean === 'number', 'gliMean must be numeric');
      assert(result.indexMetrics.canopyCoverPct >= 0 && result.indexMetrics.canopyCoverPct <= 100, 'canopyCoverPct must be 0-100');
      assert(result.indexMetrics.stressPct >= 0 && result.indexMetrics.stressPct <= 100, 'stressPct must be 0-100');

      // Verify each tile contains deterministic pixel metrics
      assert(result.tiles.length > 0, 'Tiles array must not be empty');
      result.tiles.forEach((tile) => {
        assert(typeof tile.exgMean === 'number', 'Tile missing exgMean');
        assert(typeof tile.canopyCoverPct === 'number', 'Tile missing canopyCoverPct');
        assert(typeof tile.vegetationStressPct === 'number', 'Tile missing vegetationStressPct');
        assert(tile.healthScore >= 0 && tile.healthScore <= 100, 'Tile healthScore out of bounds');
      });

      console.log(`     [Real UAV Measurement] Canopy: ${result.indexMetrics.canopyCoverPct}%, Stress: ${result.indexMetrics.stressPct}%, ExG: ${result.indexMetrics.exgMean}, VARI: ${result.indexMetrics.variMean}, GLI: ${result.indexMetrics.gliMean}`);
    }
  });

  // -------------------------------------------------------------
  // 9. Repeated Real Image Determinism
  // -------------------------------------------------------------
  await asyncTest('DETERMINISM: Three full runs on sample_orthomosaic.jpg yield identical results', async () => {
    const samplePath = path.join(__dirname, '..', 'uploads', 'drone', 'sample_orthomosaic.jpg');
    if (fs.existsSync(samplePath)) {
      const run1 = await processDroneScanImage(samplePath);
      const run2 = await processDroneScanImage(samplePath);
      const run3 = await processDroneScanImage(samplePath);

      [run2, run3].forEach((run, idx) => {
        const runNum = idx + 2;
        assert.strictEqual(run.healthyPercentage, run1.healthyPercentage, `Healthy % mismatch on run ${runNum}`);
        assert.strictEqual(run.stressScore, run1.stressScore, `Stress score mismatch on run ${runNum}`);
        assert.strictEqual(run.indexMetrics.exgMean, run1.indexMetrics.exgMean, `ExG mismatch on run ${runNum}`);
        assert.strictEqual(run.indexMetrics.variMean, run1.indexMetrics.variMean, `VARI mismatch on run ${runNum}`);
        assert.strictEqual(run.indexMetrics.gliMean, run1.indexMetrics.gliMean, `GLI mismatch on run ${runNum}`);
        assert.strictEqual(run.indexMetrics.canopyCoverPct, run1.indexMetrics.canopyCoverPct, `Canopy % mismatch on run ${runNum}`);
        assert.strictEqual(run.indexMetrics.stressPct, run1.indexMetrics.stressPct, `Stress % mismatch on run ${runNum}`);
      });
    }
  });

  // -------------------------------------------------------------
  // 10. Verification of Zero Math.random in Backend Codebase
  // -------------------------------------------------------------
  test('AUDIT: Zero Math.random() calls exist in backend services/controllers', () => {
    function scanCode(dir) {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        if (file.name === 'node_modules' || file.name === '.git' || file.name === 'tests') continue;
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          scanCode(fullPath);
        } else if (file.name.endsWith('.js')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          assert(!content.includes('Math.random()'), `Forbidden Math.random() found in ${fullPath}`);
        }
      }
    }
    scanCode(path.join(__dirname, '..'));
  });

  console.log(`\nAll ${passed}/${total} Phase 4 Computer Vision & Vegetation Index Tests Passed!`);
}

module.exports = runPhase4Tests;

if (require.main === module) {
  runPhase4Tests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
