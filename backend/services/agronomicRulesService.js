/**
 * AgriDrone AI — Agronomic Rules Engine Service
 *
 * Implements Phase 6 core capabilities:
 * 1. Evidence synthesis: CV metrics + Spatial hotspot clusters + AI visual diagnostic hypotheses
 * 2. Deterministic agronomic rule evaluation
 * 3. Confidence banding: HIGH (>=0.80), MODERATE (0.60–0.79), LOW (0.40–0.59), INCONCLUSIVE (<0.40)
 * 4. Distinct separation between visual stress observation and disease hypothesis
 * 5. Conservative, crop-aware management recommendations (e.g. INSPECT_FIELD, VERIFY_IRRIGATION)
 * 6. Recommendation eligibility classification (ELIGIBLE, CAUTION, NOT_ELIGIBLE)
 *
 * SCIENTIFIC RULE: ZERO FABRICATED DISEASES. ZERO FABRICATED DOSAGES.
 */

const { getCropProfile } = require('../config/cropProfiles');

/**
 * Classify a validated confidence value into a standardized confidence band.
 *
 * @param {number} confidence Number in [0, 1]
 * @returns {'HIGH' | 'MODERATE' | 'LOW' | 'INCONCLUSIVE'}
 */
function getConfidenceBand(confidence) {
  const val = Number(confidence);
  if (isNaN(val) || !isFinite(val) || val < 0.40) {
    return 'INCONCLUSIVE';
  }
  if (val >= 0.80) return 'HIGH';
  if (val >= 0.60) return 'MODERATE';
  return 'LOW';
}

/**
 * Deterministic Agronomic Rules Engine
 *
 * Synthesizes Computer Vision metrics, spatial geometry, and candidate AI hypotheses
 * to generate conservative agronomic guidance without unverified chemical prescriptions.
 *
 * @param {Object} input
 * @param {Object} input.cvEvidence Whole-image or tile CV metrics (canopyCoverPct, vegetationStressPct, etc.)
 * @param {Object} input.spatialEvidence Hotspot geometry, count, severity, GPS status
 * @param {Object} input.aiDiagnosis Output from analyzeCropRegion
 * @param {string} [input.cropType]
 * @returns {Object} Comprehensive agronomic evaluation and recommendations
 */
function evaluateAgronomicRules(input = {}) {
  const {
    cvEvidence = {},
    spatialEvidence = {},
    aiDiagnosis = {},
    cropType = 'generic',
  } = input;

  const profile = getCropProfile(cropType);

  // 1. Extract and sanitize CV metrics
  const canopy = Number(cvEvidence.canopyCoverPct) || 0;
  const stressPct = Number(cvEvidence.vegetationStressPct) || 0;
  const healthScore = Number(cvEvidence.visualHealthScore) || 70;
  const exg = cvEvidence.exgMean !== undefined ? Number(cvEvidence.exgMean) : null;
  const vari = cvEvidence.variMean !== undefined ? Number(cvEvidence.variMean) : null;

  // 2. Extract spatial metrics
  const hotspotCount = Number(spatialEvidence.hotspotCount) || 0;
  const hotspotSeverity = spatialEvidence.severity || (healthScore < 45 ? 'CRITICAL' : healthScore < 55 ? 'HIGH' : 'MEDIUM');
  const gpsStatus = spatialEvidence.gpsStatus || 'GPS_UNAVAILABLE';

  // 3. Extract AI diagnostic candidate
  const validStatuses = ['SUSPECTED', 'INCONCLUSIVE', 'NO_VISIBLE_ABNORMALITY'];
  const rawStatus = aiDiagnosis.diagnosisStatus || 'INCONCLUSIVE';
  const candidateName = aiDiagnosis.primaryFinding?.name || 'Unspecified Canopy Anomaly';
  const rawConfidence = Number(aiDiagnosis.primaryFinding?.confidence) || 0;
  const confidenceBand = getConfidenceBand(rawConfidence);

  // Reconcile status with confidence: strictly SUSPECTED, INCONCLUSIVE, or NO_VISIBLE_ABNORMALITY
  let reconciledStatus = validStatuses.includes(rawStatus) ? rawStatus : 'INCONCLUSIVE';
  if (confidenceBand === 'INCONCLUSIVE' && reconciledStatus === 'SUSPECTED') {
    reconciledStatus = 'INCONCLUSIVE';
  }

  // 4. Rule Evaluation Engine
  const triggeredRules = [];
  const actionSteps = [];
  let recommendationEligibility = 'ELIGIBLE';

  // RULE A: Zero or Near-Zero Canopy (Bare soil / Non-vegetated area)
  if (canopy < 5.0) {
    triggeredRules.push({
      ruleId: 'RULE_MINIMAL_CANOPY',
      description: 'Canopy coverage is below 5.0%. Foliar disease analysis is not applicable to bare soil or fallow land.',
      severity: 'LOW',
    });
    reconciledStatus = 'NO_VISIBLE_ABNORMALITY';
    recommendationEligibility = 'NOT_ELIGIBLE';
    actionSteps.push({
      type: 'MONITOR',
      action: 'Confirm field planting stage; minimal foliage detected for foliar diagnosis.',
      urgency: 'ROUTINE',
    });
  }
  // RULE B: Healthy Foliage (High Health Score, Low Stress)
  else if (healthScore >= 80 && stressPct < 15) {
    triggeredRules.push({
      ruleId: 'RULE_CANOPY_HEALTHY',
      description: 'Vegetation indices indicate uniform, vigorous canopy coverage without acute spectral anomalies.',
      severity: 'LOW',
    });
    reconciledStatus = 'NO_VISIBLE_ABNORMALITY';
    actionSteps.push({
      type: 'MONITOR',
      action: 'Continue standard agronomic monitoring and routine scouting schedule.',
      urgency: 'ROUTINE',
    });
  }
  // RULE C: Severe Localized Stress (Health < 45, Stress > 40)
  else if (healthScore < 45 || stressPct > 40 || hotspotSeverity === 'CRITICAL') {
    triggeredRules.push({
      ruleId: 'RULE_SEVERE_CANOPY_STRESS',
      description: 'Acute foliar chlorosis or canopy density drop detected in flagged coordinates.',
      severity: 'CRITICAL',
    });

    recommendationEligibility = 'CAUTION';

    actionSteps.push({
      type: 'INSPECT_FIELD',
      action: `Perform physical ground inspection of flagged hotspot coordinates within 24 hours.`,
      urgency: 'CRITICAL',
    });

    actionSteps.push({
      type: 'VERIFY_IRRIGATION',
      action: 'Check root-zone soil moisture and inspect drip emitters or irrigation nozzles for clogging or flooding.',
      urgency: 'URGENT',
    });

    actionSteps.push({
      type: 'COLLECT_CLOSE_RANGE_IMAGES',
      action: 'Collect close-range under-canopy photography or send symptomatic leaf tissue for laboratory assay before chemical intervention.',
      urgency: 'URGENT',
    });
  }
  // RULE D: Moderate Foliar Stress (Health 45–65, Stress 20–40)
  else {
    triggeredRules.push({
      ruleId: 'RULE_MODERATE_CANOPY_STRESS',
      description: 'Moderate foliar stress detected. Symptoms may reflect moisture deficit, early infection, or nutrient imbalance.',
      severity: 'MEDIUM',
    });

    actionSteps.push({
      type: 'INSPECT_FIELD',
      action: 'Inspect flagged hotspot zones within 48 hours to examine leaf margins and underside foliage.',
      urgency: 'MODERATE',
    });

    actionSteps.push({
      type: 'CHECK_NUTRIENT_STATUS',
      action: 'Review recent fertilization schedule and check for localized nutrient chlorosis patterns.',
      urgency: 'MODERATE',
    });
  }

  // Add crop-specific conservative guidance from profile when stress is observed
  const isHealthyOrBare = reconciledStatus === 'NO_VISIBLE_ABNORMALITY';
  if (profile && Array.isArray(profile.conservativeActions) && !isHealthyOrBare) {
    profile.conservativeActions.forEach((action) => {
      if (!actionSteps.some((a) => a.action === action.description)) {
        actionSteps.push({
          type: action.type,
          action: action.description,
          urgency: 'MODERATE',
        });
      }
    });
  }

  // Determine overall agronomic urgency
  const highestUrgency = actionSteps.some((a) => a.urgency === 'CRITICAL') ? 'CRITICAL'
    : actionSteps.some((a) => a.urgency === 'URGENT') ? 'URGENT'
    : actionSteps.some((a) => a.urgency === 'MODERATE') ? 'MODERATE' : 'ROUTINE';

  return {
    cropType: profile.displayName,
    diagnosisStatus: reconciledStatus,
    confidenceBand,
    primaryCandidate: {
      name: candidateName,
      confidence: rawConfidence,
      confidenceBand,
      severity: hotspotSeverity,
    },
    differentialFindings: aiDiagnosis.differentialFindings || [],
    recommendationEligibility,
    urgency: highestUrgency,
    triggeredRules,
    actionSteps: actionSteps.slice(0, 5),
    evidenceTraceability: {
      cv: {
        canopyCoverPct: canopy,
        vegetationStressPct: stressPct,
        visualHealthScore: healthScore,
        exgMean: exg,
        variMean: vari,
      },
      spatial: {
        hotspotCount,
        hotspotSeverity,
        gpsStatus,
      },
      ai: {
        model: aiDiagnosis.model?.model || 'qwen3-vl:8b',
        rawConfidence,
        status: reconciledStatus,
      },
    },
    limitations: [
      'RGB imagery cannot confirm pathogen identity; ground assay or lab testing is required before chemical application.',
      'Recommendations serve as decision support and must be validated against field conditions and extension guidelines.',
    ],
  };
}

module.exports = {
  getConfidenceBand,
  evaluateAgronomicRules,
};
