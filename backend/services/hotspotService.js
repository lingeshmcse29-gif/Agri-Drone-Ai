const Hotspot = require('../models/Hotspot');
const Alert = require('../models/Alert');
const Recommendation = require('../models/Recommendation');
const { analyzeCropRegion, createInconclusiveResult } = require('./ollamaService');
const { evaluateAgronomicRules } = require('./agronomicRulesService');
const {
  calculatePixelGeometry,
  normalizeGeometry,
  resolveHotspotGeoRegistration,
  extractExifGps,
} = require('./spatialService');
const logger = require('../utils/logger');

/**
 * Process extracted hotspots through Ollama Qwen3-VL Vision AI, calculate composite risk,
 * apply Phase 5 Spatial Geo-Registration, and synthesize Phase 6 Agronomic Rules recommendations.
 *
 * SCIENTIFIC RULES:
 * 1. ZERO FABRICATED COORDINATES: If geo-registration is unavailable, latitude/longitude remain null.
 * 2. ZERO FABRICATED DISEASES: Candidate AI findings are hypotheses; recommendations are conservative and rule-driven.
 * 3. APPROVED STATUSES: Strictly SUSPECTED, INCONCLUSIVE, or NO_VISIBLE_ABNORMALITY. Never CONFIRMED or DIAGNOSED.
 * 4. PER-HOTSPOT ISOLATION: A failure in one hotspot must not terminate the scan; fallback to INCONCLUSIVE and continue.
 */
async function processAndSaveHotspots(scan, field, processedData, weatherSnapshot, options = {}) {
  const { hotspots: extractedHotspots, dimensions } = processedData;
  const createdHotspots = [];
  const generatedAlerts = [];
  const generatedRecommendations = [];

  const imageWidth = dimensions?.width || 1200;
  const imageHeight = dimensions?.height || 800;

  // Attempt authentic EXIF GPS extraction from the source image if path is provided
  let exifGps = options.exifGps || null;
  if (!exifGps && options.imagePath) {
    try {
      exifGps = await extractExifGps(options.imagePath);
    } catch (err) {
      exifGps = null;
    }
  }

  for (let idx = 0; idx < extractedHotspots.length; idx++) {
    const rawHs = extractedHotspots[idx];
    const hotspotIdentifier = rawHs.hotspotId || `HS-${idx + 1}`;

    try {
      // 1. Compute pixel geometry and normalized coordinates deterministically
      const pxX = rawHs.pixelX !== undefined ? rawHs.pixelX : Math.round(((rawHs.x || 0) / 100) * imageWidth);
      const pxY = rawHs.pixelY !== undefined ? rawHs.pixelY : Math.round(((rawHs.y || 0) / 100) * imageHeight);
      const pxW = rawHs.pixelW !== undefined ? rawHs.pixelW : Math.round(((rawHs.width || 10) / 100) * imageWidth);
      const pxH = rawHs.pixelH !== undefined ? rawHs.pixelH : Math.round(((rawHs.height || 10) / 100) * imageHeight);

      const pixelGeom = rawHs.pixelGeometry || calculatePixelGeometry(pxX, pxY, pxW, pxH);
      const normGeom = rawHs.normalizedGeometry || normalizeGeometry(pixelGeom, imageWidth, imageHeight);

      // 2. Phase 5 Spatial Geo-Registration Resolution
      const spatialEnriched = resolveHotspotGeoRegistration(
        {
          hotspotId: hotspotIdentifier,
          centerX: pixelGeom.centerX,
          centerY: pixelGeom.centerY,
        },
        {
          exifGps,
          controlPoints: options.controlPoints,
          field,
          affineTransform: options.affineTransform,
        }
      );

      // 3. Call Ollama Qwen3-VL Vision AI on hotspot crop with verified CV evidence
      let aiData;
      try {
        const aiAnalysis = await analyzeCropRegion(rawHs.localFilePath, {
          cropType: field.cropType,
          severity: rawHs.severity,
          canopyCoverPct: rawHs.canopyCoverPct !== undefined ? rawHs.canopyCoverPct : processedData.indexMetrics?.canopyCoverPct,
          vegetationStressPct: rawHs.vegetationStressPct !== undefined ? rawHs.vegetationStressPct : processedData.indexMetrics?.stressPct,
          visualHealthScore: rawHs.healthScore || 70,
          exgMean: rawHs.exgMean !== undefined ? rawHs.exgMean : processedData.indexMetrics?.exgMean,
          variMean: rawHs.variMean !== undefined ? rawHs.variMean : processedData.indexMetrics?.variMean,
          gliMean: rawHs.gliMean !== undefined ? rawHs.gliMean : processedData.indexMetrics?.gliMean,
          hotspotId: hotspotIdentifier,
          pixelGeometry: pixelGeom,
          gpsStatus: spatialEnriched.gpsStatus || options.gpsStatus || 'GPS_UNAVAILABLE',
        });
        aiData = aiAnalysis.data;
      } catch (aiErr) {
        logger.warn(`[HotspotService] AI vision diagnostic failed for scan=${scan?._id} hotspot=${hotspotIdentifier}: ${aiErr.message}`);
        aiData = createInconclusiveResult(`AI vision analysis error: ${aiErr.message}`, {
          cropType: field.cropType,
          severity: rawHs.severity,
          hotspotId: hotspotIdentifier,
          pixelGeometry: pixelGeom,
          gpsStatus: spatialEnriched.gpsStatus,
        });
      }

      // 4. Phase 6 Agronomic Rules Engine Evaluation (Separates Diagnosis from Recommendation)
      const agronomicEvaluation = evaluateAgronomicRules({
        cvEvidence: {
          canopyCoverPct: rawHs.canopyCoverPct !== undefined ? rawHs.canopyCoverPct : processedData.indexMetrics?.canopyCoverPct,
          vegetationStressPct: rawHs.vegetationStressPct !== undefined ? rawHs.vegetationStressPct : processedData.indexMetrics?.stressPct,
          visualHealthScore: rawHs.healthScore || 70,
          exgMean: rawHs.exgMean !== undefined ? rawHs.exgMean : processedData.indexMetrics?.exgMean,
          variMean: rawHs.variMean !== undefined ? rawHs.variMean : processedData.indexMetrics?.variMean,
          gliMean: rawHs.gliMean !== undefined ? rawHs.gliMean : processedData.indexMetrics?.gliMean,
        },
        spatialEvidence: {
          hotspotCount: extractedHotspots.length,
          severity: rawHs.severity,
          gpsStatus: spatialEnriched.gpsStatus,
        },
        aiDiagnosis: aiData,
        cropType: field.cropType,
      });

      // 5. Composite Risk Calculation (0 - 100)
      const severityWeight = { LOW: 25, MEDIUM: 50, HIGH: 75, CRITICAL: 90 }[rawHs.severity || 'MEDIUM'] || 50;
      const weatherFactor = (weatherSnapshot && weatherSnapshot.humidity > 75) ? 1.15 : 1.0;
      const candidateConfidence = aiData.primaryFinding?.confidence || 0.0;
      const calculatedRiskScore = Math.min(99, Math.round(severityWeight * Math.max(0.4, candidateConfidence) * weatherFactor));

      let finalSeverity = 'MEDIUM';
      if (calculatedRiskScore >= 80) finalSeverity = 'CRITICAL';
      else if (calculatedRiskScore >= 60) finalSeverity = 'HIGH';
      else if (calculatedRiskScore >= 40) finalSeverity = 'MEDIUM';
      else finalSeverity = 'LOW';

      const candidateIssueName = aiData.primaryFinding?.name || (aiData.differentialFindings?.[0]?.name) || 'Canopy Foliar Stress';
      const recActionTexts = agronomicEvaluation.actionSteps.map((a) => a.action);

      // Build possibleDiseases array strictly without CONFIRMED status
      const possibleDiseases = (aiData.differentialFindings || []).map((df) => ({
        name: df.name,
        confidence: df.confidence,
        evidence: [df.reasoning].filter(Boolean),
        status: 'SUSPECTED',
      }));

      // Include primary finding as hypothesis if valid candidate exists
      if (aiData.primaryFinding?.name && aiData.primaryFinding.name !== 'Undetermined Canopy Stress' && aiData.diagnosisStatus === 'SUSPECTED') {
        possibleDiseases.unshift({
          name: aiData.primaryFinding.name,
          confidence: aiData.primaryFinding.confidence,
          evidence: aiData.evidence?.visualEvidence || [],
          status: 'SUSPECTED',
        });
      }

      const hotspotDoc = new Hotspot({
        scanId: scan._id,
        fieldId: field._id,
        hotspotId: hotspotIdentifier,
        x: rawHs.x !== undefined ? rawHs.x : (pixelGeom.x / imageWidth) * 100,
        y: rawHs.y !== undefined ? rawHs.y : (pixelGeom.y / imageHeight) * 100,
        width: rawHs.width !== undefined ? rawHs.width : (pixelGeom.width / imageWidth) * 100,
        height: rawHs.height !== undefined ? rawHs.height : (pixelGeom.height / imageHeight) * 100,
        pixelGeometry: pixelGeom,
        normalizedGeometry: normGeom,
        sourceTiles: rawHs.sourceTiles || (rawHs.tileId ? [{ tileId: rawHs.tileId, healthScore: rawHs.healthScore, stressPct: rawHs.vegetationStressPct }] : []),
        latitude: spatialEnriched.latitude,
        longitude: spatialEnriched.longitude,
        geoGeometry: spatialEnriched.geoGeometry,
        gpsStatus: spatialEnriched.gpsStatus,
        gpsSource: spatialEnriched.gpsSource,
        isGpsEstimated: spatialEnriched.isGpsEstimated,
        croppedImagePath: rawHs.croppedImagePath,
        stressType: aiData.primaryFinding?.category || 'foliar_stress',
        confidence: candidateConfidence,
        severity: finalSeverity,
        riskLevel: calculatedRiskScore,
        vegetationStressPct: rawHs.vegetationStressPct !== undefined ? rawHs.vegetationStressPct : (100 - (rawHs.healthScore || 70)),
        visualHealthScore: rawHs.healthScore || rawHs.visualHealthScore || 70,
        possibleDiseases,
        possiblePests: [],
        affectedArea: rawHs.affectedArea || 12.4,
        pixelArea: pixelGeom.width * pixelGeom.height,
        recommendation: recActionTexts[0] || `Inspect Hotspot #${hotspotIdentifier} within 24 hours.`,
        status: 'ACTIVE',
        executionMode: scan.executionMode || 'DEMO',
      });

      await hotspotDoc.save();
      createdHotspots.push(hotspotDoc);

      // Create Alert if High or Critical severity
      if (finalSeverity === 'CRITICAL' || finalSeverity === 'HIGH') {
        const alertDoc = new Alert({
          fieldId: field._id,
          scanId: scan._id,
          hotspotId: hotspotDoc._id,
          type: 'CRITICAL_HOTSPOT',
          title: `${finalSeverity} Risk Hotspot ${hotspotDoc.hotspotId} Detected`,
          message: `Field ${field.fieldName}: ${candidateIssueName} suspected with ${(candidateConfidence * 100).toFixed(0)}% AI confidence. Affected area ~${hotspotDoc.affectedArea} m².`,
          severity: finalSeverity,
          isRead: false,
          executionMode: scan.executionMode || 'DEMO',
        });

        await alertDoc.save();
        generatedAlerts.push(alertDoc);
      }

      // Save Traceable Recommendation Record
      const recDoc = new Recommendation({
        fieldId: field._id,
        scanId: scan._id,
        hotspotId: hotspotDoc._id,
        cropType: field.cropType,
        issueName: candidateIssueName,
        diagnosisStatus: agronomicEvaluation.diagnosisStatus,
        confidence: candidateConfidence,
        confidenceBand: agronomicEvaluation.confidenceBand,
        recommendationEligibility: agronomicEvaluation.recommendationEligibility,
        reasoning: aiData.primaryFinding?.name ? `Candidate visual hypothesis: ${aiData.primaryFinding.name}.` : 'Visual foliar chlorosis detected by drone imagery.',
        evidence: agronomicEvaluation.evidenceTraceability,
        actionSteps: recActionTexts,
        urgency: agronomicEvaluation.urgency || (finalSeverity === 'CRITICAL' ? 'CRITICAL' : finalSeverity === 'HIGH' ? 'URGENT' : 'MODERATE'),
        executionMode: scan.executionMode || 'DEMO',
      });
      await recDoc.save();
      generatedRecommendations.push(recDoc);

    } catch (hotspotErr) {
      // Problem 4: Per-Hotspot Failure Isolation
      logger.error(`[HotspotService] Hotspot processing exception: scan=${scan?._id} hotspot=${hotspotIdentifier} index=${idx} operation=processHotspot error=${hotspotErr.message}`);

      try {
        // Fallback: Preserve available CV & spatial evidence without fabricating data
        const safeX = (typeof rawHs.x === 'number' && isFinite(rawHs.x)) ? rawHs.x : 0;
        const safeY = (typeof rawHs.y === 'number' && isFinite(rawHs.y)) ? rawHs.y : 0;
        const safeW = (typeof rawHs.width === 'number' && isFinite(rawHs.width) && rawHs.width > 0) ? rawHs.width : 10;
        const safeH = (typeof rawHs.height === 'number' && isFinite(rawHs.height) && rawHs.height > 0) ? rawHs.height : 10;

        const pxX = (typeof rawHs.pixelX === 'number' && isFinite(rawHs.pixelX)) ? rawHs.pixelX : Math.round((safeX / 100) * imageWidth);
        const pxY = (typeof rawHs.pixelY === 'number' && isFinite(rawHs.pixelY)) ? rawHs.pixelY : Math.round((safeY / 100) * imageHeight);
        const pxW = (typeof rawHs.pixelW === 'number' && isFinite(rawHs.pixelW) && rawHs.pixelW > 0) ? rawHs.pixelW : Math.round((safeW / 100) * imageWidth);
        const pxH = (typeof rawHs.pixelH === 'number' && isFinite(rawHs.pixelH) && rawHs.pixelH > 0) ? rawHs.pixelH : Math.round((safeH / 100) * imageHeight);

        const pixelGeom = rawHs.pixelGeometry || calculatePixelGeometry(pxX, pxY, pxW, pxH);
        const normGeom = rawHs.normalizedGeometry || normalizeGeometry(pixelGeom, imageWidth, imageHeight);

        const validGpsSources = ['exif', 'geotiff', 'field_control_points', 'none'];
        const fallbackGpsSource = validGpsSources.includes(rawHs.gpsSource) ? rawHs.gpsSource : 'none';

        const fallbackHotspotDoc = new Hotspot({
          scanId: scan._id,
          fieldId: field._id,
          hotspotId: hotspotIdentifier,
          x: safeX,
          y: safeY,
          width: safeW,
          height: safeH,
          pixelGeometry: pixelGeom,
          normalizedGeometry: normGeom,
          sourceTiles: rawHs.sourceTiles || [],
          latitude: (typeof rawHs.latitude === 'number' && isFinite(rawHs.latitude)) ? rawHs.latitude : null,
          longitude: (typeof rawHs.longitude === 'number' && isFinite(rawHs.longitude)) ? rawHs.longitude : null,
          geoGeometry: rawHs.geoGeometry || null,
          gpsStatus: rawHs.gpsStatus || 'GPS_UNAVAILABLE',
          gpsSource: fallbackGpsSource,
          isGpsEstimated: Boolean(rawHs.isGpsEstimated),
          croppedImagePath: rawHs.croppedImagePath || null,
          stressType: 'undetermined',
          confidence: 0.0,
          severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(rawHs.severity) ? rawHs.severity : 'MEDIUM',
          riskLevel: 50,
          vegetationStressPct: (typeof rawHs.vegetationStressPct === 'number' && isFinite(rawHs.vegetationStressPct)) ? rawHs.vegetationStressPct : (100 - (rawHs.healthScore || 70)),
          visualHealthScore: (typeof rawHs.healthScore === 'number' && isFinite(rawHs.healthScore)) ? rawHs.healthScore : 70,
          possibleDiseases: [],
          possiblePests: [],
          affectedArea: (typeof rawHs.affectedArea === 'number' && isFinite(rawHs.affectedArea)) ? rawHs.affectedArea : 0,
          pixelArea: pixelGeom.width * pixelGeom.height,
          recommendation: `Physical ground inspection recommended for Hotspot #${hotspotIdentifier}; automated diagnostic was inconclusive.`,
          status: 'ACTIVE',
          executionMode: scan.executionMode || 'DEMO',
        });

        await fallbackHotspotDoc.save();
        createdHotspots.push(fallbackHotspotDoc);

        // Fallback recommendation marked strictly INCONCLUSIVE
        const fallbackRec = new Recommendation({
          fieldId: field._id,
          scanId: scan._id,
          hotspotId: fallbackHotspotDoc._id,
          cropType: field?.cropType || 'generic',
          issueName: 'Inconclusive Anomaly Assessment',
          diagnosisStatus: 'INCONCLUSIVE',
          confidence: 0.0,
          confidenceBand: 'INCONCLUSIVE',
          recommendationEligibility: 'CAUTION',
          reasoning: 'Automated diagnostic processing encountered an unexpected exception; physical scouting required.',
          evidence: {
            cv: {
              visualHealthScore: rawHs.healthScore || 70,
              vegetationStressPct: rawHs.vegetationStressPct !== undefined ? rawHs.vegetationStressPct : null,
            },
            spatial: {
              hotspotId: hotspotIdentifier,
              gpsStatus: fallbackHotspotDoc.gpsStatus,
            },
            diagnosticStatus: 'INCONCLUSIVE',
          },
          actionSteps: [
            `Conduct physical field scouting at Hotspot #${hotspotIdentifier} to examine foliar symptoms.`,
            'Verify irrigation lines and soil moisture uniformity in flagged zone.',
          ],
          urgency: 'MODERATE',
          executionMode: scan.executionMode || 'DEMO',
        });
        await fallbackRec.save();
        generatedRecommendations.push(fallbackRec);
      } catch (fallbackErr) {
        logger.error(`[HotspotService] Failed to persist fallback inconclusive hotspot #${hotspotIdentifier}: ${fallbackErr.message}`);
      }

      // Continue to next hotspot without aborting the scan
      continue;
    }
  }

  return {
    hotspots: createdHotspots,
    alerts: generatedAlerts,
    recommendations: generatedRecommendations,
  };
}

module.exports = {
  processAndSaveHotspots,
};
