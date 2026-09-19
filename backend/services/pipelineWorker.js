const path = require('path');
const fs = require('fs');
const Scan = require('../models/Scan');
const Field = require('../models/Field');
const Alert = require('../models/Alert');
const { processDroneScanImage } = require('./imageProcessingService');
const { processAndSaveHotspots } = require('./hotspotService');
const { evaluateAgronomicRules } = require('./agronomicRulesService');
const { getConfig } = require('../config/env');
const logger = require('../utils/logger');

// In-memory active job set to prevent the same scan from running concurrently
const activeJobs = new Set();

// In-memory FIFO queue for background processing
const jobQueue = [];
let runningCount = 0;
let isWorkerRunning = true;

/**
 * Enqueues a scan for asynchronous background processing.
 *
 * @param {string | import('mongoose').Types.ObjectId} scanId
 */
function enqueueScan(scanId) {
  const idStr = scanId.toString();

  if (activeJobs.has(idStr)) {
    logger.warn(`[Worker] Scan ${idStr} is already actively being processed. Skipping enqueue.`, { scanId: idStr });
    return false;
  }

  if (jobQueue.includes(idStr)) {
    logger.info(`[Worker] Scan ${idStr} is already in the queue.`, { scanId: idStr });
    return false;
  }

  jobQueue.push(idStr);
  logger.info(`[Worker] Scan ${idStr} enqueued for processing. Queue depth: ${jobQueue.length}`, {
    scanId: idStr,
    queueDepth: jobQueue.length,
  });

  processNext();
  return true;
}

/**
 * Dispatcher: triggers the next job in the queue up to concurrency limit.
 */
function processNext() {
  if (!isWorkerRunning) return;

  const config = getConfig();
  const concurrencyLimit = config?.PIPELINE_CONCURRENCY || 1;

  while (runningCount < concurrencyLimit && jobQueue.length > 0) {
    const scanId = jobQueue.shift();
    runningCount++;

    processScanJob(scanId)
      .catch((err) => {
        logger.error(`[Worker] Unhandled error during scan job execution for ${scanId}: ${err.message}`, {
          scanId,
          error: err.message,
        });
      })
      .finally(() => {
        runningCount--;
        processNext();
      });
  }
}

/**
 * Core processing pipeline for a single scan.
 * State progression: UPLOADED -> TILED -> PROCESSING -> ANALYZING -> COMPLETED (or FAILED)
 *
 * @param {string} scanId
 */
async function processScanJob(scanId) {
  if (activeJobs.has(scanId)) {
    return;
  }
  activeJobs.add(scanId);

  const startTime = Date.now();
  logger.info(`[Worker] Starting background processing for scan ${scanId}`, { scanId });

  try {
    const scan = await Scan.findById(scanId);
    if (!scan) {
      throw new Error(`Scan ${scanId} not found in database.`);
    }

    // Do not reprocess completed scans
    if (scan.processingStatus === 'COMPLETED') {
      logger.info(`[Worker] Scan ${scanId} is already COMPLETED. Skipping.`, { scanId });
      return;
    }

    const field = await Field.findById(scan.fieldId);
    if (!field) {
      throw new Error(`Field ${scan.fieldId} referenced by scan not found.`);
    }

    // Initialize processing timestamp
    if (!scan.processingStartedAt) {
      scan.processingStartedAt = new Date();
    }

    // Fetch live or fallback weather snapshot asynchronously for field
    try {
      const { getFieldWeather } = require('./weatherService');
      const coords = field.boundary?.coordinates?.[0]?.[0] || field.coordinates?.[0] || [78.9629, 20.5937];
      const weather = await getFieldWeather(coords[1], coords[0]);
      scan.weatherSnapshot = weather;
    } catch (weatherErr) {
      logger.warn(`[Worker] Could not refresh weather snapshot for scan ${scanId}: ${weatherErr.message}`);
    }

    // -------------------------------------------------------------
    // STEP 1: TILED — Reconstructing spatial tile grid
    // -------------------------------------------------------------
    scan.processingStatus = 'TILED';
    scan.progress = 25;
    await scan.save();

    logger.info(`[Worker] State transition -> TILED for scan ${scanId}`, {
      scanId,
      state: 'TILED',
      progress: scan.progress,
    });

    // Locate source image on disk
    let sampleImagePath = null;
    if (scan.droneImages && scan.droneImages.length > 0) {
      const relPath = scan.droneImages[0].replace('/uploads/drone/', '');
      const fullPath = path.join(__dirname, '..', 'uploads', 'drone', relPath);
      if (fs.existsSync(fullPath)) {
        sampleImagePath = fullPath;
      }
    }

    // -------------------------------------------------------------
    // STEP 2: PROCESSING — Tile analysis & anomaly feature extraction
    // -------------------------------------------------------------
    scan.processingStatus = 'PROCESSING';
    scan.progress = 50;
    await scan.save();

    logger.info(`[Worker] State transition -> PROCESSING for scan ${scanId}`, {
      scanId,
      state: 'PROCESSING',
      progress: scan.progress,
    });

    // Execute Sharp tile extraction & vegetation index mapping
    const processedData = await processDroneScanImage(sampleImagePath);

    // -------------------------------------------------------------
    // STEP 3: ANALYZING — Visual AI diagnosis & agronomic synthesis
    // -------------------------------------------------------------
    scan.processingStatus = 'ANALYZING';
    scan.progress = 75;
    await scan.save();

    logger.info(`[Worker] State transition -> ANALYZING for scan ${scanId}`, {
      scanId,
      state: 'ANALYZING',
      progress: scan.progress,
    });

    // Run AI visual diagnostic pipeline on extracted hotspots with Phase 5 spatial geo-registration
    const hotspotResult = await processAndSaveHotspots(scan, field, processedData, scan.weatherSnapshot, {
      imagePath: sampleImagePath,
    });

    // -------------------------------------------------------------
    // STEP 4: COMPLETED — Finalizing scan metrics and alerts
    // -------------------------------------------------------------
    scan.processingStatus = 'COMPLETED';
    scan.progress = 100;
    scan.healthyPercentage = processedData.healthyPercentage;
    scan.affectedPercentage = processedData.affectedPercentage;
    scan.stressScore = processedData.stressScore;
    scan.hotspotCount = hotspotResult.hotspots.length;
    scan.overallRisk = processedData.overallRisk;
    scan.compositeRiskScore = scan.compositeRiskScore || (
      processedData.overallRisk === 'CRITICAL' ? 85 :
      processedData.overallRisk === 'HIGH' ? 68 :
      processedData.overallRisk === 'MEDIUM' ? 45 : 20
    );

    // Persist genuine deterministic index metrics
    if (processedData.indexMetrics) {
      scan.indexMetrics = {
        exgMean: processedData.indexMetrics.exgMean,
        variMean: processedData.indexMetrics.variMean,
        gliMean: processedData.indexMetrics.gliMean,
        canopyCoverPct: processedData.indexMetrics.canopyCoverPct,
        stressPct: processedData.indexMetrics.stressPct,
        ndviProxy: processedData.indexMetrics.ndviProxy,
      };
    }

    // Phase 6 Whole-Scan Agronomic Diagnostic Synthesis
    const scanAgronomicEval = evaluateAgronomicRules({
       cvEvidence: {
         canopyCoverPct: scan.indexMetrics?.canopyCoverPct || processedData.healthyPercentage,
         vegetationStressPct: scan.indexMetrics?.stressPct || processedData.affectedPercentage,
         visualHealthScore: processedData.healthyPercentage,
         exgMean: scan.indexMetrics?.exgMean,
         variMean: scan.indexMetrics?.variMean,
         gliMean: scan.indexMetrics?.gliMean,
       },
       spatialEvidence: {
         hotspotCount: hotspotResult.hotspots.length,
         severity: processedData.overallRisk,
         gpsStatus: hotspotResult.hotspots.some((h) => h.gpsStatus === 'GPS_AVAILABLE') ? 'GPS_AVAILABLE' : 'GPS_UNAVAILABLE',
       },
       aiDiagnosis: {
         diagnosisStatus: hotspotResult.hotspots.length === 0 ? 'NO_VISIBLE_ABNORMALITY' : 'SUSPECTED',
         primaryFinding: {
           name: hotspotResult.hotspots.length > 0 ? (hotspotResult.hotspots[0].stressType || 'Canopy Stress') : 'Healthy Crop Stand',
           confidence: hotspotResult.hotspots.length > 0 ? (hotspotResult.hotspots[0].confidence || 0.8) : 0.95,
         },
         differentialFindings: hotspotResult.hotspots.length > 0 ? hotspotResult.hotspots[0].possibleDiseases : [],
       },
       cropType: field.cropType,
    });

    scan.diagnosticSummary = {
      status: scanAgronomicEval.diagnosisStatus,
      primaryFinding: scanAgronomicEval.primaryCandidate?.name || 'Undetermined Canopy Condition',
      confidence: scanAgronomicEval.primaryCandidate?.confidence || 0,
      confidenceBand: scanAgronomicEval.confidenceBand,
      differentialFindings: scanAgronomicEval.differentialFindings,
      recommendationEligibility: scanAgronomicEval.recommendationEligibility,
      evidence: scanAgronomicEval.evidenceTraceability,
      limitations: scanAgronomicEval.limitations,
      generatedAt: new Date(),
    };

    scan.aiSummary = `Drone Field Pipeline Complete: ${hotspotResult.hotspots.length} crop stress hotspots identified. Canopy cover: ${scan.indexMetrics?.canopyCoverPct || 0}%, Stress: ${scan.indexMetrics?.stressPct || 0}%, Overall field risk rated ${processedData.overallRisk}. Diagnostic status: ${scanAgronomicEval.diagnosisStatus} (${scanAgronomicEval.primaryCandidate?.name || 'Healthy'}).`;
    scan.processingCompletedAt = new Date();
    scan.processingError = null;

    await scan.save();

    // Persist completion alert idempotently
    await Alert.findOneAndUpdate(
      { scanId: scan._id, type: 'SCAN_COMPLETE' },
      {
        fieldId: field._id,
        scanId: scan._id,
        type: 'SCAN_COMPLETE',
        title: `Drone Scan Complete - Field ${field.fieldName}`,
        message: `Field health: ${scan.healthyPercentage}%. Identified ${scan.hotspotCount} hotspots requiring attention.`,
        severity: scan.overallRisk === 'CRITICAL' ? 'CRITICAL' : scan.overallRisk === 'HIGH' ? 'HIGH' : 'LOW',
        compositeRiskScore: scan.compositeRiskScore,
        executionMode: scan.executionMode,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const durationMs = Date.now() - startTime;
    logger.info(`[Worker] Scan ${scanId} successfully processed in ${durationMs}ms`, {
      scanId,
      state: 'COMPLETED',
      durationMs,
      hotspotCount: scan.hotspotCount,
    });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    logger.error(`[Worker] Scan ${scanId} processing failed: ${err.message}`, {
      scanId,
      state: 'FAILED',
      durationMs,
      error: err.message,
    });

    try {
      await Scan.findByIdAndUpdate(scanId, {
        processingStatus: 'FAILED',
        processingError: err.message || 'An unexpected pipeline error occurred during processing.',
        processingCompletedAt: new Date(),
        progress: 0,
      });
    } catch (saveErr) {
      logger.error(`[Worker] Failed to update FAILED status for scan ${scanId}: ${saveErr.message}`);
    }
  } finally {
    activeJobs.delete(scanId);
  }
}

/**
 * Startup recovery: inspects MongoDB for unfinished scans and resumes/restarts them.
 */
async function startWorker() {
  isWorkerRunning = true;
  logger.info('[Worker] Pipeline worker initialized. Scanning for unfinished jobs...');

  try {
    const unfinishedScans = await Scan.find({
      processingStatus: { $in: ['UPLOADED', 'TILED', 'PROCESSING', 'ANALYZING'] },
    }).sort({ createdAt: 1 });

    if (unfinishedScans.length > 0) {
      logger.info(`[Worker] Found ${unfinishedScans.length} unfinished scan(s). Recovering...`, {
        count: unfinishedScans.length,
      });

      for (const scan of unfinishedScans) {
        enqueueScan(scan._id);
      }
    } else {
      logger.info('[Worker] No unfinished scans found. Worker idle.');
    }
  } catch (err) {
    logger.error(`[Worker] Failed during startup scan recovery: ${err.message}`);
  }
}

/**
 * Graceful worker shutdown.
 */
function stopWorker() {
  logger.info('[Worker] Stopping pipeline worker...');
  isWorkerRunning = false;
  jobQueue.length = 0;
}

module.exports = {
  enqueueScan,
  processScanJob,
  startWorker,
  stopWorker,
  getActiveJobCount: () => activeJobs.size,
  getQueueDepth: () => jobQueue.length,
  isJobActive: (scanId) => activeJobs.has(scanId.toString()),
};
