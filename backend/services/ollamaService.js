const axios = require('axios');
const fs = require('fs');
const { getCropProfile } = require('../config/cropProfiles');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3-vl:8b';

/**
 * Check if Ollama service and configured model are available.
 */
async function checkOllamaHealth() {
  try {
    const res = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 3000 });
    if (res.status === 200 && res.data && res.data.models) {
      const hasModel = res.data.models.some(
        (m) => m.name === OLLAMA_MODEL || m.model === OLLAMA_MODEL
      );
      return {
        online: true,
        model: OLLAMA_MODEL,
        modelAvailable: hasModel,
        modelsList: res.data.models.map((m) => m.name),
      };
    }
    return { online: false, error: 'Invalid response format' };
  } catch (err) {
    return { online: false, error: err.message };
  }
}

/**
 * Extract and parse JSON strictly from Ollama model response text.
 * Handles clean JSON, markdown code-fenced JSON, and extracts balanced braces if surrounded by prose.
 *
 * @param {string} rawText
 * @returns {Object|null}
 */
function extractAndParseJson(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  let cleaned = rawText.trim();

  // Strip markdown code fences (```json ... ``` or ``` ...)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // First try direct JSON parse
  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    // Attempt to locate first '{' and last '}'
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx !== -1 && endIdx > startIdx) {
      const substring = cleaned.substring(startIdx, endIdx + 1);
      try {
        return JSON.parse(substring);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

/**
 * Validate and normalize AI diagnostic output according to Phase 6 schema.
 * Rejects invalid confidence, unknown statuses, and ensures clean structured format.
 *
 * @param {Object} rawData
 * @param {Object} context
 * @returns {Object} Normalized structured diagnostic result
 */
function normalizeDiagnosticOutput(rawData, context = {}) {
  const cropProfile = getCropProfile(context.cropType);
  const validStatuses = ['SUSPECTED', 'INCONCLUSIVE', 'NO_VISIBLE_ABNORMALITY'];
  const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  if (!rawData || typeof rawData !== 'object') {
    return createInconclusiveResult('Unparseable or empty model output', context);
  }

  // 1. Validate status (Strictly SUSPECTED, INCONCLUSIVE, or NO_VISIBLE_ABNORMALITY)
  let status = String(rawData.diagnosisStatus || rawData.status || '').toUpperCase();
  if (!validStatuses.includes(status)) {
    status = 'INCONCLUSIVE';
  }

  // 2. Validate confidence (Must be finite number in [0, 1])
  let confidence = Number(rawData.confidence);
  if (isNaN(confidence) || !isFinite(confidence) || confidence < 0 || confidence > 1) {
    confidence = 0.0;
    status = 'INCONCLUSIVE';
  }

  // 3. Primary Finding
  const rawFinding = rawData.primaryFinding || {};
  const findingName = String(rawFinding.name || rawData.primarySuspectedIssue || rawData.stressType || 'Unspecified Crop Stress').trim();
  let severity = String(rawFinding.severity || rawData.severity || context.severity || 'MEDIUM').toUpperCase();
  if (!validSeverities.includes(severity)) {
    severity = 'MEDIUM';
  }

  // 4. Differential Findings
  const rawDifferentials = Array.isArray(rawData.differentialFindings)
    ? rawData.differentialFindings
    : (Array.isArray(rawData.possibleDiseases) ? rawData.possibleDiseases : []);

  const differentialFindings = rawDifferentials
    .filter((d) => d && typeof d === 'object')
    .slice(0, 4)
    .map((d) => {
      let conf = Number(d.confidence);
      if (isNaN(conf) || !isFinite(conf)) conf = 0.5;
      conf = Math.max(0, Math.min(1, conf));
      return {
        name: String(d.name || d.issue || 'Alternative Hypothesis').trim(),
        confidence: Number(conf.toFixed(2)),
        reasoning: String(d.reasoning || d.evidence?.[0] || 'Visual foliar chlorosis or lesion overlap').trim(),
      };
    });

  // 5. Evidence Extraction
  const visualEvidence = Array.isArray(rawData.evidence?.visualEvidence)
    ? rawData.evidence.visualEvidence.map(String)
    : (Array.isArray(rawData.visualEvidence) ? rawData.visualEvidence.map(String) : []);

  const cvEvidence = {
    canopyCoverPct: context.canopyCoverPct !== undefined ? context.canopyCoverPct : null,
    vegetationStressPct: context.vegetationStressPct !== undefined ? context.vegetationStressPct : null,
    visualHealthScore: context.visualHealthScore !== undefined ? context.visualHealthScore : null,
    exgMean: context.exgMean !== undefined ? context.exgMean : null,
    variMean: context.variMean !== undefined ? context.variMean : null,
    gliMean: context.gliMean !== undefined ? context.gliMean : null,
  };

  const spatialEvidence = {
    hotspotId: context.hotspotId || null,
    hotspotSeverity: context.severity || null,
    gpsStatus: context.gpsStatus || 'GPS_UNAVAILABLE',
    isGpsEstimated: context.isGpsEstimated || false,
    pixelGeometry: context.pixelGeometry || null,
  };

  // 6. Limitations (Mandatory Scientific Transparency)
  const limitations = [
    'RGB drone imagery cannot verify pathogen identity without laboratory assay or field tissue test.',
    'Visual foliar stress reflects symptoms, which may stem from moisture, nutrient, or biotic causes.',
    ...(cropProfile.diagnosticLimitations || []),
  ];

  return {
    diagnosisStatus: status,
    cropType: cropProfile.displayName,
    primaryFinding: {
      category: rawFinding.category || 'foliar_stress',
      name: findingName,
      confidence: Number(confidence.toFixed(2)),
      severity,
    },
    differentialFindings,
    evidence: {
      visualEvidence: visualEvidence.slice(0, 5),
      cvEvidence,
      spatialEvidence,
    },
    limitations,
    model: {
      provider: 'ollama',
      model: OLLAMA_MODEL,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Creates a deterministic, scientifically safe INCONCLUSIVE diagnostic result.
 * Used when Ollama is offline, times out, or produces invalid output.
 * ZERO FABRICATED DISEASES.
 *
 * @param {string} reason
 * @param {Object} context
 * @returns {Object} Structured diagnostic assessment marked INCONCLUSIVE
 */
function createInconclusiveResult(reason, context = {}) {
  const cropProfile = getCropProfile(context.cropType);

  return {
    diagnosisStatus: 'INCONCLUSIVE',
    cropType: cropProfile.displayName,
    primaryFinding: {
      category: 'foliar_stress',
      name: 'Undetermined Canopy Stress',
      confidence: 0.0,
      severity: context.severity || 'MEDIUM',
    },
    differentialFindings: (cropProfile.commonVisualStressPatterns?.[0]?.differentialHypotheses || []).map((hypo) => ({
      name: hypo,
      confidence: 0.35,
      reasoning: 'Candidate hypothesis pending field inspection; visual evidence alone is inconclusive.',
    })),
    evidence: {
      visualEvidence: [
        'Visible spectral variation detected in RGB drone imagery',
        `Diagnostic note: ${reason}`,
      ],
      cvEvidence: {
        canopyCoverPct: context.canopyCoverPct !== undefined ? context.canopyCoverPct : null,
        vegetationStressPct: context.vegetationStressPct !== undefined ? context.vegetationStressPct : null,
        visualHealthScore: context.visualHealthScore !== undefined ? context.visualHealthScore : null,
        exgMean: context.exgMean !== undefined ? context.exgMean : null,
        variMean: context.variMean !== undefined ? context.variMean : null,
        gliMean: context.gliMean !== undefined ? context.gliMean : null,
      },
      spatialEvidence: {
        hotspotId: context.hotspotId || null,
        hotspotSeverity: context.severity || null,
        gpsStatus: context.gpsStatus || 'GPS_UNAVAILABLE',
        isGpsEstimated: context.isGpsEstimated || false,
        pixelGeometry: context.pixelGeometry || null,
      },
    },
    limitations: [
      'AI diagnostic model unavailable or inconclusive; no automated disease diagnosis is asserted.',
      'Physical field scouting is required to ascertain stress cause.',
      ...(cropProfile.diagnosticLimitations || []),
    ],
    model: {
      provider: 'ollama-fallback',
      model: OLLAMA_MODEL,
      status: 'offline_or_inconclusive',
      reason,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Analyze a crop field region image using Qwen3-VL vision model.
 * Produces structured diagnostic evaluation strictly without fabricated diseases.
 *
 * @param {string|null} imagePath
 * @param {Object} context
 * @returns {Promise<{ source: string, data: Object }>}
 */
async function analyzeCropRegion(imagePath, context = {}) {
  const health = await checkOllamaHealth();

  // Constrained prompt supplying ONLY verified measurements
  const cropName = context.cropType || 'Crop';
  const cvContextText = [
    `Crop Type: ${cropName}`,
    context.canopyCoverPct !== undefined ? `Canopy Cover: ${context.canopyCoverPct}%` : '',
    context.vegetationStressPct !== undefined ? `Vegetation Stress: ${context.vegetationStressPct}%` : '',
    context.visualHealthScore !== undefined ? `Visual Health Score: ${context.visualHealthScore}/100` : '',
    context.exgMean !== undefined ? `Excess Green Index (ExG): ${context.exgMean}` : '',
    context.variMean !== undefined ? `VARI (RGB Proxy): ${context.variMean}` : '',
    context.gliMean !== undefined ? `GLI: ${context.gliMean}` : '',
    context.severity ? `Spatial Anomaly Severity: ${context.severity}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `You are an agricultural visual diagnostic assistant.
Analyze ONLY the evidence provided and the visible foliar patch.
DO NOT invent measurements.
DO NOT claim true NDVI or multispectral data.
DO NOT assume a definitive disease solely because visual vegetation stress exists.
If visual evidence is insufficient or ambiguous, set diagnosisStatus to "INCONCLUSIVE".
Treat disease names as candidate hypotheses ("SUSPECTED"), not unquestionable truth.
DO NOT prescribe chemical pesticide dosages or commercial brand names.

Verified Measurements:
${cvContextText}

Return ONLY a raw, valid JSON object matching this schema:
{
  "diagnosisStatus": "SUSPECTED" | "INCONCLUSIVE" | "NO_VISIBLE_ABNORMALITY",
  "primaryFinding": {
    "category": "foliar_disease" | "water_stress" | "nutrient_deficiency" | "pest_damage" | "senescence" | "undetermined",
    "name": "Candidate condition name or Undetermined Stress",
    "confidence": number between 0.0 and 1.0,
    "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  },
  "differentialFindings": [
    { "name": "Alternative diagnosis name", "confidence": number between 0.0 and 1.0, "reasoning": "Differentiating observation" }
  ],
  "visualEvidence": [
    "Specific visual foliar symptom observed in patch"
  ]
}`;

  if (health.online && health.modelAvailable) {
    try {
      let imageBase64 = null;
      if (imagePath && fs.existsSync(imagePath)) {
        imageBase64 = fs.readFileSync(imagePath).toString('base64');
      }

      const payload = {
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
      };

      if (imageBase64) {
        payload.images = [imageBase64];
      }

      const timeoutMs = process.env.NODE_ENV === 'test'
        ? (parseInt(process.env.OLLAMA_TIMEOUT, 10) || 500)
        : (parseInt(process.env.OLLAMA_TIMEOUT, 10) || 6000);

      const response = await axios.post(`${OLLAMA_URL}/api/generate`, payload, {
        timeout: timeoutMs,
      });

      if (response.data && response.data.response) {
        const rawText = response.data.response;
        const parsed = extractAndParseJson(rawText);

        if (parsed) {
          const normalized = normalizeDiagnosticOutput(parsed, context);
          return {
            source: 'ollama-qwen3-vl',
            data: normalized,
          };
        } else {
          console.warn('[Ollama] Malformed JSON from model. Utilizing safe INCONCLUSIVE fallback.');
          return {
            source: 'agronomic-engine-fallback',
            data: createInconclusiveResult('Malformed JSON returned by visual AI model', context),
          };
        }
      }
    } catch (apiErr) {
      console.warn('[Ollama] API call failed or timed out:', apiErr.message);
    }
  }

  // Safe Fallback: INCONCLUSIVE status with verified CV evidence preserved. Zero fabricated diseases.
  return {
    source: 'agronomic-engine-fallback',
    data: createInconclusiveResult(health.online ? 'Model response timeout' : 'Ollama visual service offline', context),
  };
}

module.exports = {
  checkOllamaHealth,
  extractAndParseJson,
  normalizeDiagnosticOutput,
  createInconclusiveResult,
  analyzeCropRegion,
};
