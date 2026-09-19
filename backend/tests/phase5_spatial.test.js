const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../config/database');
const { reloadConfig } = require('../config/env');
const Hotspot = require('../models/Hotspot');
const Scan = require('../models/Scan');
const Field = require('../models/Field');
const {
  calculatePixelGeometry,
  normalizeGeometry,
  clusterAnomalousTiles,
  pointInPolygon,
  solveAffineTransform,
  applyAffineTransform,
  extractExifGps,
  resolveHotspotGeoRegistration,
} = require('../services/spatialService');
const { processAndSaveHotspots } = require('../services/hotspotService');

console.log('\n--- Running Phase 5: Spatial Geo-Registration & Hotspot Segmentation Tests ---');

async function runPhase5Tests() {
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
  // 1. Pixel Geometry & Deterministic Normalization
  // -------------------------------------------------------------
  test('GEOMETRY: calculatePixelGeometry produces accurate bounding boxes and centers', () => {
    const geom = calculatePixelGeometry(100, 200, 300, 400);
    assert.strictEqual(geom.x, 100);
    assert.strictEqual(geom.y, 200);
    assert.strictEqual(geom.width, 300);
    assert.strictEqual(geom.height, 400);
    assert.strictEqual(geom.centerX, 250);
    assert.strictEqual(geom.centerY, 400);
  });

  test('NORMALIZATION: Normalizes top-left, center, bottom-right within [0, 1] range', () => {
    const imgW = 1000;
    const imgH = 800;

    // Top-left
    const tl = normalizeGeometry({ x: 0, y: 0, width: 100, height: 80 }, imgW, imgH);
    assert.strictEqual(tl.x, 0.0);
    assert.strictEqual(tl.y, 0.0);
    assert.strictEqual(tl.width, 0.1);
    assert.strictEqual(tl.height, 0.1);
    assert.strictEqual(tl.centerX, 0.05);
    assert.strictEqual(tl.centerY, 0.05);

    // Center
    const center = normalizeGeometry({ x: 450, y: 360, width: 100, height: 80 }, imgW, imgH);
    assert.strictEqual(center.centerX, 0.5);
    assert.strictEqual(center.centerY, 0.5);

    // Bottom-right
    const br = normalizeGeometry({ x: 900, y: 720, width: 100, height: 80 }, imgW, imgH);
    assert.strictEqual(br.x, 0.9);
    assert.strictEqual(br.y, 0.9);
    assert.strictEqual(br.centerX, 0.95);
    assert.strictEqual(br.centerY, 0.95);
  });

  test('NORMALIZATION: Clamps out-of-bounds inputs safely within [0, 1]', () => {
    const clamped = normalizeGeometry({ x: -50, y: 1200, width: 2000, height: 100 }, 1000, 1000);
    assert.strictEqual(clamped.x, 0);
    assert.strictEqual(clamped.y, 1);
    assert.strictEqual(clamped.width, 1);
  });

  // -------------------------------------------------------------
  // 2. 8-Connected Component Hotspot Clustering & Merging
  // -------------------------------------------------------------
  test('CLUSTERING: Groups adjacent and diagonal anomaly tiles into a single merged hotspot', () => {
    // 2x2 cluster at (1,1), (1,2), (2,1), (2,2)
    const anomalyTiles = [
      { tileId: 'R2C2', row: 1, col: 1, pixelX: 100, pixelY: 100, pixelW: 50, pixelH: 50, healthScore: 40, vegetationStressPct: 50 },
      { tileId: 'R2C3', row: 1, col: 2, pixelX: 150, pixelY: 100, pixelW: 50, pixelH: 50, healthScore: 42, vegetationStressPct: 45 },
      { tileId: 'R3C2', row: 2, col: 1, pixelX: 100, pixelY: 150, pixelW: 50, pixelH: 50, healthScore: 38, vegetationStressPct: 55 },
      { tileId: 'R3C3', row: 2, col: 2, pixelX: 150, pixelY: 150, pixelW: 50, pixelH: 50, healthScore: 44, vegetationStressPct: 40 },
    ];

    const clusters = clusterAnomalousTiles(anomalyTiles, 6, 6, 600, 600);
    assert.strictEqual(clusters.length, 1);

    const hs = clusters[0];
    assert.strictEqual(hs.hotspotId, 'HS-01');
    assert.strictEqual(hs.sourceTiles.length, 4);
    assert.strictEqual(hs.pixelGeometry.x, 100);
    assert.strictEqual(hs.pixelGeometry.y, 100);
    assert.strictEqual(hs.pixelGeometry.width, 100);
    assert.strictEqual(hs.pixelGeometry.height, 100);
    assert.strictEqual(hs.pixelGeometry.centerX, 150);
    assert.strictEqual(hs.pixelGeometry.centerY, 150);
    assert.strictEqual(hs.pixelArea, 10000);
    assert.strictEqual(hs.severity, 'CRITICAL'); // avgHealthScore = 41 < 45
  });

  test('CLUSTERING: Separates disjoint isolated anomaly regions into distinct hotspots', () => {
    const anomalyTiles = [
      // Cluster 1: Tile (0, 0)
      { tileId: 'R1C1', row: 0, col: 0, pixelX: 0, pixelY: 0, pixelW: 100, pixelH: 100, healthScore: 50, vegetationStressPct: 35 },
      // Cluster 2: Tile (5, 5) far away
      { tileId: 'R6C6', row: 5, col: 5, pixelX: 500, pixelY: 500, pixelW: 100, pixelH: 100, healthScore: 60, vegetationStressPct: 30 },
    ];

    const clusters = clusterAnomalousTiles(anomalyTiles, 6, 6, 600, 600);
    assert.strictEqual(clusters.length, 2);
    assert.strictEqual(clusters[0].hotspotId, 'HS-01');
    assert.strictEqual(clusters[0].sourceTiles[0].tileId, 'R1C1');
    assert.strictEqual(clusters[1].hotspotId, 'HS-02');
    assert.strictEqual(clusters[1].sourceTiles[0].tileId, 'R6C6');
  });

  test('CLUSTERING: Diagonal connectivity (8-connected) unites diagonally touching anomaly tiles', () => {
    const anomalyTiles = [
      { tileId: 'R2C2', row: 1, col: 1, pixelX: 100, pixelY: 100, pixelW: 100, pixelH: 100, healthScore: 52, vegetationStressPct: 32 },
      { tileId: 'R3C3', row: 2, col: 2, pixelX: 200, pixelY: 200, pixelW: 100, pixelH: 100, healthScore: 54, vegetationStressPct: 30 },
    ];

    const clusters = clusterAnomalousTiles(anomalyTiles, 6, 6, 600, 600);
    assert.strictEqual(clusters.length, 1);
    assert.strictEqual(clusters[0].sourceTiles.length, 2);
    assert.strictEqual(clusters[0].pixelGeometry.width, 200);
    assert.strictEqual(clusters[0].pixelGeometry.height, 200);
  });

  // -------------------------------------------------------------
  // 3. Ray-Casting Field Boundary Containment
  // -------------------------------------------------------------
  test('POLYGON: Point-in-polygon correctly identifies interior, exterior, and boundary points', () => {
    // Rectangle: [10, 70] to [12, 72]
    const polygon = [
      [10.0, 70.0],
      [10.0, 72.0],
      [12.0, 72.0],
      [12.0, 70.0],
    ];

    // Inside
    assert.strictEqual(pointInPolygon([11.0, 71.0], polygon), true);

    // Strictly Outside
    assert.strictEqual(pointInPolygon([9.0, 71.0], polygon), false);
    assert.strictEqual(pointInPolygon([13.0, 71.0], polygon), false);
    assert.strictEqual(pointInPolygon([11.0, 69.0], polygon), false);
    assert.strictEqual(pointInPolygon([11.0, 73.0], polygon), false);

    // On Vertex / Edge
    assert.strictEqual(pointInPolygon([10.0, 70.0], polygon), true);
    assert.strictEqual(pointInPolygon([10.0, 71.0], polygon), true);

    // Invalid coordinates / WGS84 range violations
    assert.strictEqual(pointInPolygon([95.0, 70.0], polygon), false);
    assert.strictEqual(pointInPolygon([10.0, 190.0], polygon), false);
    assert.strictEqual(pointInPolygon([NaN, 70.0], polygon), false);
    assert.strictEqual(pointInPolygon([10.0, 70.0], []), false);
  });

  // -------------------------------------------------------------
  // 4. Affine Transformation Solver from Control Points
  // -------------------------------------------------------------
  test('AFFINE: Solves known 3-point affine transformation and maps coordinates accurately', () => {
    // Synthetic affine mapping:
    // lat = 10.0 + 0.001 * x
    // lng = 77.0 + 0.002 * y
    const controlPoints = [
      { pixelX: 0,   pixelY: 0,   lat: 10.000, lng: 77.000 },
      { pixelX: 100, pixelY: 0,   lat: 10.100, lng: 77.000 },
      { pixelX: 0,   pixelY: 100, lat: 10.000, lng: 77.200 },
    ];

    const transform = solveAffineTransform(controlPoints);
    assert(transform !== null);
    assert(Math.abs(transform.a - 0.001) < 1e-6);
    assert(Math.abs(transform.b - 0.000) < 1e-6);
    assert(Math.abs(transform.c - 10.000) < 1e-6);
    assert(Math.abs(transform.d - 0.000) < 1e-6);
    assert(Math.abs(transform.e - 0.002) < 1e-6);
    assert(Math.abs(transform.f - 77.000) < 1e-6);

    // Test mapping center (50, 50)
    const mapped = applyAffineTransform(transform, 50, 50);
    assert(mapped !== null);
    assert.strictEqual(mapped.latitude, 10.05);
    assert.strictEqual(mapped.longitude, 77.1);
  });

  test('AFFINE: Rejects collinear control points safely without dividing by zero', () => {
    // 3 collinear points along horizontal line
    const collinear = [
      { pixelX: 0,   pixelY: 10, lat: 10.0, lng: 77.0 },
      { pixelX: 50,  pixelY: 10, lat: 10.1, lng: 77.1 },
      { pixelX: 100, pixelY: 10, lat: 10.2, lng: 77.2 },
    ];

    const transform = solveAffineTransform(collinear);
    assert.strictEqual(transform, null);
  });

  // -------------------------------------------------------------
  // 5. Zero Fabricated Coordinates: Strict GPS Hierarchy
  // -------------------------------------------------------------
  test('GPS HIERARCHY: Returns GPS_AVAILABLE when authentic EXIF GPS exists', () => {
    const hotspot = { hotspotId: 'HS-01', centerX: 500, centerY: 400 };
    const context = {
      exifGps: { latitude: 10.585211, longitude: 77.015432, source: 'exif' },
    };

    const resolved = resolveHotspotGeoRegistration(hotspot, context);
    assert.strictEqual(resolved.gpsStatus, 'GPS_AVAILABLE');
    assert.strictEqual(resolved.isGpsEstimated, false);
    assert.strictEqual(resolved.gpsSource, 'exif');
    assert.strictEqual(resolved.latitude, 10.585211);
    assert.strictEqual(resolved.longitude, 77.015432);
    assert.deepStrictEqual(resolved.geoGeometry, {
      type: 'Point',
      coordinates: [77.015432, 10.585211],
    });
  });

  test('GPS HIERARCHY: Returns GPS_ESTIMATED when derived from surveyed control points', () => {
    const hotspot = { hotspotId: 'HS-01', centerX: 100, centerY: 100 };
    const controlPoints = [
      { pixelX: 0,   pixelY: 0,   lat: 10.580, lng: 77.010 },
      { pixelX: 200, pixelY: 0,   lat: 10.590, lng: 77.010 },
      { pixelX: 0,   pixelY: 200, lat: 10.580, lng: 77.020 },
    ];
    const field = {
      boundary: [
        [10.57, 77.00],
        [10.60, 77.00],
        [10.60, 77.03],
        [10.57, 77.03],
      ],
    };

    const resolved = resolveHotspotGeoRegistration(hotspot, { controlPoints, field });
    assert.strictEqual(resolved.gpsStatus, 'GPS_ESTIMATED');
    assert.strictEqual(resolved.isGpsEstimated, true);
    assert.strictEqual(resolved.gpsSource, 'field_control_points');
    assert.strictEqual(resolved.latitude, 10.585);
    assert.strictEqual(resolved.longitude, 77.015);
  });

  test('GPS HIERARCHY: Strictly assigns GPS_UNAVAILABLE (lat: null, lng: null) when no metadata exists', () => {
    const hotspot = { hotspotId: 'HS-01', centerX: 500, centerY: 400 };
    const field = { latitude: 10.585, longitude: 77.015 }; // field has location, but imagery has NO geo-registration

    const resolved = resolveHotspotGeoRegistration(hotspot, { field });
    assert.strictEqual(resolved.gpsStatus, 'GPS_UNAVAILABLE');
    assert.strictEqual(resolved.isGpsEstimated, false);
    assert.strictEqual(resolved.gpsSource, 'none');
    assert.strictEqual(resolved.latitude, null);
    assert.strictEqual(resolved.longitude, null);
    assert.strictEqual(resolved.geoGeometry, null);
  });

  test('GPS HIERARCHY: sample_orthomosaic.jpg extracts authentic EXIF as null without fabricating GPS', async () => {
    const samplePath = path.join(__dirname, '..', 'uploads', 'drone', 'sample_orthomosaic.jpg');
    if (fs.existsSync(samplePath)) {
      const exif = await extractExifGps(samplePath);
      assert.strictEqual(exif, null); // standard test JPEG has no GPS IFD
    }
  });

  // -------------------------------------------------------------
  // 6. Database Persistence & Model Validation
  // -------------------------------------------------------------
  await asyncTest('PERSISTENCE: Hotspot model saves and validates Phase 5 attributes correctly', async () => {
    process.env.APP_MODE = 'DEMO';
    process.env.MONGO_URI = 'mongodb://localhost:27017/agri_drone_ai';
    process.env.JWT_SECRET = 'super_secret_test_key_at_least_16_chars';
    reloadConfig();

    await connectDB();
    try {
      const scanId = new mongoose.Types.ObjectId();
      const fieldId = new mongoose.Types.ObjectId();

      // Clean test slate
      await Hotspot.deleteMany({ scanId });

      // Hotspot with GPS_UNAVAILABLE
      const docUnavailable = new Hotspot({
        scanId,
        fieldId,
        hotspotId: 'HS-01',
        x: 10,
        y: 10,
        width: 20,
        height: 20,
        pixelGeometry: { x: 100, y: 100, width: 200, height: 200, centerX: 200, centerY: 200 },
        normalizedGeometry: { x: 0.1, y: 0.1, width: 0.2, height: 0.2, centerX: 0.2, centerY: 0.2 },
        sourceTiles: [{ tileId: 'R1C1', row: 0, col: 0, healthScore: 40, stressPct: 45 }],
        latitude: null,
        longitude: null,
        gpsStatus: 'GPS_UNAVAILABLE',
        isGpsEstimated: false,
        severity: 'CRITICAL',
        riskLevel: 60,
        executionMode: 'LIVE',
      });

      await docUnavailable.save();
      assert.strictEqual(docUnavailable.gpsStatus, 'GPS_UNAVAILABLE');
      assert.strictEqual(docUnavailable.latitude, null);
      assert.strictEqual(docUnavailable.longitude, null);

      // Hotspot with GPS_AVAILABLE
      const docAvailable = new Hotspot({
        scanId,
        fieldId,
        hotspotId: 'HS-02',
        x: 50,
        y: 50,
        width: 20,
        height: 20,
        pixelGeometry: { x: 500, y: 500, width: 200, height: 200, centerX: 600, centerY: 600 },
        normalizedGeometry: { x: 0.5, y: 0.5, width: 0.2, height: 0.2, centerX: 0.6, centerY: 0.6 },
        latitude: 10.5855,
        longitude: 77.0155,
        geoGeometry: { type: 'Point', coordinates: [77.0155, 10.5855] },
        gpsStatus: 'GPS_AVAILABLE',
        isGpsEstimated: false,
        gpsSource: 'exif',
        severity: 'HIGH',
        riskLevel: 45,
        executionMode: 'LIVE',
      });

      await docAvailable.save();
      assert.strictEqual(docAvailable.gpsStatus, 'GPS_AVAILABLE');
      assert.strictEqual(docAvailable.latitude, 10.5855);
      assert.strictEqual(docAvailable.longitude, 77.0155);
      assert.strictEqual(docAvailable.geoGeometry.type, 'Point');

      // Query by gpsStatus index
      const foundUnavailable = await Hotspot.find({ scanId, gpsStatus: 'GPS_UNAVAILABLE' });
      assert.strictEqual(foundUnavailable.length, 1);
      assert.strictEqual(foundUnavailable[0].hotspotId, 'HS-01');

      const foundAvailable = await Hotspot.find({ scanId, gpsStatus: 'GPS_AVAILABLE' });
      assert.strictEqual(foundAvailable.length, 1);
      assert.strictEqual(foundAvailable[0].hotspotId, 'HS-02');

      // Clean up test documents
      await Hotspot.deleteMany({ scanId });
    } finally {
      await closeDB();
    }
  });

  // -------------------------------------------------------------
  // 7. Determinism: Consecutive runs yield strictly identical outputs
  // -------------------------------------------------------------
  test('DETERMINISM: 5 consecutive spatial clusterings yield identical outputs', () => {
    const anomalyTiles = [
      { tileId: 'R1C1', row: 0, col: 0, pixelX: 0, pixelY: 0, pixelW: 100, pixelH: 100, healthScore: 40, vegetationStressPct: 50 },
      { tileId: 'R1C2', row: 0, col: 1, pixelX: 100, pixelY: 0, pixelW: 100, pixelH: 100, healthScore: 42, vegetationStressPct: 45 },
      { tileId: 'R4C4', row: 3, col: 3, pixelX: 300, pixelY: 300, pixelW: 100, pixelH: 100, healthScore: 52, vegetationStressPct: 35 },
    ];

    const run1 = JSON.stringify(clusterAnomalousTiles(anomalyTiles, 6, 6, 600, 600));
    for (let i = 0; i < 5; i++) {
      const nextRun = JSON.stringify(clusterAnomalousTiles(anomalyTiles, 6, 6, 600, 600));
      assert.strictEqual(run1, nextRun);
    }
  });

  // -------------------------------------------------------------
  // 8. Zero Math.random() Audit in Spatial Service
  // -------------------------------------------------------------
  test('AUDIT: Zero Math.random() calls exist in backend/services/spatialService.js', () => {
    const fileContent = fs.readFileSync(path.join(__dirname, '..', 'services', 'spatialService.js'), 'utf8');
    assert.strictEqual(fileContent.includes('Math.random'), false, 'Found Math.random() in spatialService.js');
  });

  console.log(`\nAll ${passed}/${total} Phase 5 Spatial Geo-Registration & Hotspot Segmentation Tests Passed!`);
}

if (require.main === module) {
  runPhase5Tests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runPhase5Tests;
