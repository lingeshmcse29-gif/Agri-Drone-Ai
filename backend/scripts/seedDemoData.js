const bcrypt = require('bcryptjs');
const { getConfig } = require('../config/env');
const { connectDB, closeDB } = require('../config/database');
const User = require('../models/User');
const Field = require('../models/Field');
const Scan = require('../models/Scan');
const Hotspot = require('../models/Hotspot');
const Recommendation = require('../models/Recommendation');
const Alert = require('../models/Alert');
const logger = require('../utils/logger');

/**
 * Deterministic Demo Seeder
 * Idempotent: Can be executed repeatedly without creating duplicate records.
 * Strictly restricted to APP_MODE=DEMO.
 */
async function seedDemoData() {
  const config = getConfig();

  // 1. Strict LIVE mode guardrail
  if (config.isLive) {
    const errorMsg = '[DemoSeeder] FATAL: Seeding demo data is strictly prohibited when APP_MODE=LIVE.';
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  logger.info('[DemoSeeder] Starting deterministic DEMO data seeding...');

  // 2. Deterministic Demo User
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('demo12345', salt);

  const demoUser = await User.findOneAndUpdate(
    { email: 'farmer@agridrone.ai' },
    {
      name: 'Demo Farmer',
      email: 'farmer@agridrone.ai',
      passwordHash,
      role: 'farmer',
      executionMode: 'DEMO',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // 3. Deterministic Fields
  const fieldDefinitions = [
    {
      fieldName: 'North Farm (Block A)',
      cropType: 'Tomato',
      area: 4.8,
      location: 'Pollachi Farmlands',
      latitude: 10.585,
      longitude: 77.015,
      boundary: [
        [10.587, 77.012],
        [10.587, 77.018],
        [10.583, 77.018],
        [10.583, 77.012],
      ],
      compositeRiskScore: 68,
    },
    {
      fieldName: 'Green Acres Cornfield',
      cropType: 'Corn',
      area: 8.5,
      location: 'Salinas Crop Sector',
      latitude: 36.635,
      longitude: -121.515,
      boundary: [
        [36.637, -121.518],
        [36.637, -121.512],
        [36.633, -121.512],
        [36.633, -121.518],
      ],
      compositeRiskScore: 25,
    },
    {
      fieldName: 'Valley View Wheat Estate',
      cropType: 'Wheat',
      area: 12.2,
      location: 'Ooty Agricultural Basin',
      latitude: 11.4102,
      longitude: 76.695,
      boundary: [
        [11.412, 76.692],
        [11.412, 76.698],
        [11.4085, 76.698],
        [11.4085, 76.692],
      ],
      compositeRiskScore: 12,
    },
  ];

  const seededFields = [];
  for (const f of fieldDefinitions) {
    const fieldDoc = await Field.findOneAndUpdate(
      { fieldName: f.fieldName },
      {
        ...f,
        owner: demoUser._id,
        executionMode: 'DEMO',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    seededFields.push(fieldDoc);
  }

  const primaryField = seededFields[0]; // North Farm (Block A)

  // 4. Deterministic Completed Scan for Primary Field
  const fieldIds = seededFields.map((f) => f._id);
  await Scan.deleteMany({ fieldId: { $in: fieldIds } });
  await Hotspot.deleteMany({ fieldId: { $in: fieldIds } });
  await Alert.deleteMany({ fieldId: { $in: fieldIds } });
  await Recommendation.deleteMany({ fieldId: { $in: fieldIds } });

  const scanDoc = await Scan.create({
    fieldId: primaryField._id,
    scanDate: new Date('2026-09-07T10:00:00.000Z'),
    droneImages: ['/uploads/drone/sample_orthomosaic.jpg'],
    reconstructedMap: '/uploads/drone/sample_orthomosaic.jpg',
    weatherSnapshot: {
      temperature: 29,
      humidity: 78,
      rainProbability: 65,
      windSpeed: 12,
      condition: 'Humid & Overcast',
    },
    processingStatus: 'COMPLETED',
    progress: 100,
    stressScore: 28,
    healthyPercentage: 78,
    affectedPercentage: 22,
    hotspotCount: 3,
    overallRisk: 'HIGH',
    compositeRiskScore: 68,
    indexMetrics: {
      exgMean: 0.28,
      variMean: 0.14,
      gliMean: 0.18,
      canopyCoverPct: 82.5,
      stressPct: 22.0,
      ndviProxy: 0.64,
    },
    isGpsEstimated: false,
    executionMode: 'DEMO',
    // Phase 6 Structured Diagnostic Assessment & Evidence Traceability
    diagnosticSummary: {
      status: 'SUSPECTED',
      primaryFinding: 'Early Blight (Alternaria solani)',
      confidence: 0.92,
      confidenceBand: 'HIGH',
      differentialFindings: [
        {
          name: 'Nitrogen Chlorosis',
          confidence: 0.84,
          reasoning: 'Uniform pale green chlorosis on lower leaves in adjacent zone',
        },
        {
          name: 'Two-Spotted Spider Mite (Tetranychus urticae)',
          confidence: 0.79,
          reasoning: 'Localized foliar stippling on southern field boundary',
        },
      ],
      recommendationEligibility: 'CAUTION',
      evidence: {
        visualEvidence: ['Concentric ring lesions', 'Target board yellowing halo'],
        cvEvidence: {
          canopyCoverPct: 82.5,
          vegetationStressPct: 22.0,
          visualHealthScore: 78,
          exgMean: 0.28,
          variMean: 0.14,
          gliMean: 0.18,
        },
        spatialEvidence: {
          hotspotCount: 3,
          hotspotSeverity: 'HIGH',
          gpsStatus: 'WGS84_VALID',
        },
      },
      limitations: [
        'RGB drone imagery cannot verify pathogen identity without physical laboratory assay.',
        'Foliar stress reflects visual symptoms that must be confirmed by ground scouting before chemical application.',
      ],
      generatedAt: new Date(),
    },
    aiSummary: 'Full field scan completed. 3 active crop stress hotspots identified with suspected foliar stress patterns. Ground scouting recommended.',
  });

  // 5. Deterministic Hotspots for the Scan (clean old demo hotspots for this scan to guarantee idempotency)
  await Hotspot.deleteMany({ scanId: scanDoc._id, executionMode: 'DEMO' });

  const hotspotDefinitions = [
    {
      scanId: scanDoc._id,
      fieldId: primaryField._id,
      hotspotId: 'HS-01',
      x: 240,
      y: 180,
      width: 80,
      height: 80,
      latitude: 10.5862,
      longitude: 77.0145,
      isGpsEstimated: false,
      croppedImagePath: '/uploads/drone/hotspot_hs01.jpg',
      stressType: 'fungal_blight',
      confidence: 0.92,
      severity: 'HIGH',
      riskLevel: 78,
      possibleDiseases: [
        {
          name: 'Early Blight (Alternaria solani)',
          confidence: 0.92,
          evidence: ['Concentric ring lesions', 'Target board yellowing halo'],
          status: 'SUSPECTED',
        },
      ],
      possiblePests: [],
      affectedArea: 14.5,
      recommendation: 'Perform physical ground inspection of flagged hotspot coordinates within 24 hours; suspend overhead sprinkler irrigation to reduce foliar moisture; collect close-range images or tissue samples.',
      status: 'ACTIVE',
      executionMode: 'DEMO',
    },
    {
      scanId: scanDoc._id,
      fieldId: primaryField._id,
      hotspotId: 'HS-02',
      x: 520,
      y: 310,
      width: 110,
      height: 90,
      latitude: 10.5845,
      longitude: 77.016,
      isGpsEstimated: false,
      croppedImagePath: '/uploads/drone/hotspot_hs02.jpg',
      stressType: 'nutrient_deficiency',
      confidence: 0.84,
      severity: 'MEDIUM',
      riskLevel: 54,
      possibleDiseases: [
        {
          name: 'Nitrogen Chlorosis',
          confidence: 0.84,
          evidence: ['Uniform pale green foliage', 'Lower leaf yellowing'],
          status: 'SUSPECTED',
        },
      ],
      possiblePests: [],
      affectedArea: 28.0,
      recommendation: 'Verify irrigation line uniformity and conduct root-zone soil EC / tissue testing in Zone B before nutrient adjustments.',
      status: 'ACTIVE',
      executionMode: 'DEMO',
    },
    {
      scanId: scanDoc._id,
      fieldId: primaryField._id,
      hotspotId: 'HS-03',
      x: 150,
      y: 440,
      width: 65,
      height: 65,
      latitude: 10.5838,
      longitude: 77.0135,
      isGpsEstimated: false,
      croppedImagePath: '/uploads/drone/hotspot_hs03.jpg',
      stressType: 'pest_damage',
      confidence: 0.79,
      severity: 'LOW',
      riskLevel: 32,
      possibleDiseases: [],
      possiblePests: [
        {
          name: 'Two-Spotted Spider Mite (Tetranychus urticae)',
          confidence: 0.79,
        },
      ],
      affectedArea: 8.2,
      recommendation: 'Conduct physical inspection of leaf undersides on southern boundary to assess foliar mite population threshold.',
      status: 'INVESTIGATED',
      executionMode: 'DEMO',
    },
  ];

  const seededHotspots = await Hotspot.insertMany(hotspotDefinitions);

  // 6. Deterministic Recommendations (Zero pesticide dosage recipes, conservative actions only)
  await Recommendation.deleteMany({ fieldId: primaryField._id, executionMode: 'DEMO' });

  const recommendationDefinitions = [
    {
      fieldId: primaryField._id,
      scanId: scanDoc._id,
      hotspotId: seededHotspots[0]._id,
      cropType: 'Tomato',
      issueName: 'Early Blight (Alternaria solani)',
      diagnosisStatus: 'SUSPECTED',
      confidence: 0.92,
      confidenceBand: 'HIGH',
      recommendationEligibility: 'CAUTION',
      reasoning: 'Candidate visual hypothesis: Early Blight (Alternaria solani) based on concentric dark foliar lesions and chlorotic halo.',
      evidence: {
        cv: { canopyCoverPct: 82.5, vegetationStressPct: 22.0, visualHealthScore: 78 },
        spatial: { hotspotId: 'HS-01', gpsStatus: 'WGS84_VALID' },
      },
      actionSteps: [
        'Perform physical ground scouting of the 14.5 m² flagged hotspot perimeter within 24 hours.',
        'Halt overhead sprinkler watering to minimize foliar wetness duration.',
        'Collect close-range under-canopy photography or send symptomatic leaf tissue for laboratory assay before chemical intervention.',
        'Consult regional agricultural extension agronomist for certified intervention thresholds.',
      ],
      urgency: 'CRITICAL',
      status: 'PENDING',
      executionMode: 'DEMO',
    },
    {
      fieldId: primaryField._id,
      scanId: scanDoc._id,
      hotspotId: seededHotspots[1]._id,
      cropType: 'Tomato',
      issueName: 'Nitrogen Chlorosis',
      diagnosisStatus: 'SUSPECTED',
      confidence: 0.84,
      confidenceBand: 'HIGH',
      recommendationEligibility: 'ELIGIBLE',
      reasoning: 'Visual foliar chlorosis observed on older canopy leaves across Zone B.',
      evidence: {
        cv: { canopyCoverPct: 82.5, vegetationStressPct: 22.0, visualHealthScore: 78 },
        spatial: { hotspotId: 'HS-02', gpsStatus: 'WGS84_VALID' },
      },
      actionSteps: [
        'Review recent fertilization schedule and inspect Zone B for localized nutrient leaching.',
        'Verify root-zone soil EC and moisture uniformity across drip irrigation lines.',
        'Perform leaf tissue nutrient analysis before applying supplementary fertilization.',
      ],
      urgency: 'MODERATE',
      status: 'PENDING',
      executionMode: 'DEMO',
    },
    {
      fieldId: primaryField._id,
      scanId: scanDoc._id,
      hotspotId: seededHotspots[2]._id,
      cropType: 'Tomato',
      issueName: 'Two-Spotted Spider Mite (Tetranychus urticae)',
      diagnosisStatus: 'SUSPECTED',
      confidence: 0.79,
      confidenceBand: 'MODERATE',
      recommendationEligibility: 'ELIGIBLE',
      reasoning: 'Candidate hypothesis: localized foliar stippling on southern field boundary.',
      evidence: {
        cv: { canopyCoverPct: 82.5, vegetationStressPct: 22.0, visualHealthScore: 78 },
        spatial: { hotspotId: 'HS-03', gpsStatus: 'WGS84_VALID' },
      },
      actionSteps: [
        'Physically examine leaf undersides with 10x hand lens along southern border rows.',
        'Evaluate predatory beneficial insect presence and crop threshold levels.',
        'Maintain perimeter dust control to discourage mite colony expansion.',
      ],
      urgency: 'ROUTINE',
      status: 'APPLIED',
      executionMode: 'DEMO',
    },
  ];

  await Recommendation.insertMany(recommendationDefinitions);

  // 7. Deterministic Alerts (No confirmed disease claims)
  await Alert.deleteMany({ fieldId: primaryField._id, executionMode: 'DEMO' });

  const alertDefinitions = [
    {
      fieldId: primaryField._id,
      scanId: scanDoc._id,
      hotspotId: seededHotspots[0]._id,
      type: 'CRITICAL_HOTSPOT',
      title: 'Critical Hotspot Alert — Suspected Foliar Blight',
      message: 'Suspected visual stress pattern detected at Hotspot HS-01 (Risk: 78) — field inspection recommended.',
      severity: 'CRITICAL',
      compositeRiskScore: 78,
      isRead: false,
      executionMode: 'DEMO',
    },
    {
      fieldId: primaryField._id,
      scanId: scanDoc._id,
      type: 'WEATHER_RISK',
      title: 'Microclimate High Humidity Alert',
      message: 'Ambient humidity at 78% with 29°C temperature creating optimal fungal incubation conditions.',
      severity: 'HIGH',
      compositeRiskScore: 65,
      isRead: false,
      executionMode: 'DEMO',
    },
  ];

  await Alert.insertMany(alertDefinitions);

  const summary = {
    users: 1,
    fields: seededFields.length,
    scans: 1,
    hotspots: seededHotspots.length,
    recommendations: recommendationDefinitions.length,
    alerts: alertDefinitions.length,
  };

  logger.info('[DemoSeeder] Seeding completed successfully:', summary);
  return summary;
}

// Command-line execution entry point
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      const summary = await seedDemoData();
      console.log('\n✅ DEMO SEEDING COMPLETED SUCCESSFULLY:');
      console.log(JSON.stringify(summary, null, 2));
      await closeDB();
      process.exit(0);
    } catch (err) {
      console.error('\n❌ DEMO SEEDING FAILED:', err.message);
      await closeDB();
      process.exit(1);
    }
  })();
}

module.exports = {
  seedDemoData,
};
