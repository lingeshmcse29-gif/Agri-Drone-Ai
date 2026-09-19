const mongoose = require('mongoose');
const Scan = require('../models/Scan');
const Field = require('../models/Field');
const Hotspot = require('../models/Hotspot');
const { getFieldWeather } = require('../services/weatherService');
const { enqueueScan } = require('../services/pipelineWorker');
const { getConfig } = require('../config/env');
const { AppError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');

/**
 * GET /api/scans
 * Retrieves scans without automatic seeding.
 */
exports.getScans = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.fieldId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.fieldId)) {
        return next(new AppError(`Invalid field ID format "${req.query.fieldId}".`, 400, 'INVALID_ID'));
      }
      query.fieldId = req.query.fieldId;
    }
    if (req.query.status) {
      query.processingStatus = req.query.status.toUpperCase();
    }
    if (req.query.executionMode) {
      query.executionMode = req.query.executionMode.toUpperCase();
    }

    const scans = await Scan.find(query).populate('fieldId').sort({ createdAt: -1 });
    res.json({ success: true, count: scans.length, scans });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/scans/:id
 * Retrieves a single scan with associated hotspots.
 */
exports.getScanById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError(`Invalid scan ID format "${id}".`, 400, 'INVALID_ID'));
    }

    const scan = await Scan.findById(id).populate('fieldId');
    if (!scan) {
      return next(new AppError('Scan not found.', 404, 'SCAN_NOT_FOUND'));
    }

    const hotspots = await Hotspot.find({ scanId: scan._id }).sort({ riskLevel: -1 });
    res.json({ success: true, scan, hotspots });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/scans/:id/status
 * Asynchronous polling endpoint: retrieves current persisted processing state.
 */
exports.getScanStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError(`Invalid scan ID format "${id}".`, 400, 'INVALID_ID'));
    }

    const scan = await Scan.findById(id).populate('fieldId');
    if (!scan) {
      return next(new AppError('Scan not found.', 404, 'SCAN_NOT_FOUND'));
    }

    if (!req.user || !req.user.id) {
      return next(new AppError('Authentication required to access scan status.', 401, 'UNAUTHORIZED'));
    }

    // Verify ownership if field has a designated owner
    if (scan.fieldId && scan.fieldId.owner) {
      const ownerId = scan.fieldId.owner._id ? scan.fieldId.owner._id.toString() : scan.fieldId.owner.toString();
      if (ownerId !== req.user.id.toString()) {
        return next(new AppError('Access forbidden: You do not own the field for this scan.', 403, 'FORBIDDEN'));
      }
    }

    res.json({
      success: true,
      data: {
        scanId: scan._id,
        processingStatus: scan.processingStatus,
        progress: scan.progress,
        processingStartedAt: scan.processingStartedAt,
        processingCompletedAt: scan.processingCompletedAt,
        processingError: scan.processingError,
        stressScore: scan.stressScore,
        healthyPercentage: scan.healthyPercentage,
        affectedPercentage: scan.affectedPercentage,
        overallRisk: scan.overallRisk,
        hotspotCount: scan.hotspotCount,
        indexMetrics: scan.indexMetrics || {
          exgMean: 0,
          variMean: 0,
          gliMean: 0,
          canopyCoverPct: 0,
          stressPct: 0,
          ndviProxy: 0,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/scans
 * Uploads drone imagery, creates Scan document with UPLOADED status,
 * queues background worker, and returns HTTP 201 IMMEDIATELY.
 */
exports.createScan = async (req, res, next) => {
  try {
    const { fieldId } = req.body;
    if (!fieldId) {
      return next(new AppError('fieldId is required to initialize a scan.', 400, 'VALIDATION_ERROR'));
    }
    if (!mongoose.Types.ObjectId.isValid(fieldId)) {
      return next(new AppError(`Invalid field ID format "${fieldId}".`, 400, 'INVALID_ID'));
    }

    const field = await Field.findById(fieldId);
    if (!field) {
      return next(new AppError('Field not found.', 404, 'FIELD_NOT_FOUND'));
    }

    // Check ownership if user is authenticated and field has an owner
    if (req.user && req.user.id && field.owner) {
      const ownerId = field.owner._id ? field.owner._id.toString() : field.owner.toString();
      if (ownerId !== req.user.id.toString()) {
        return next(new AppError('Access forbidden: You do not own this field.', 403, 'FORBIDDEN'));
      }
    }

    const config = getConfig();
    const uploadedFiles = req.files || [];
    const droneImagePaths = uploadedFiles.map((file) => `/uploads/drone/${file.filename}`);

    // Create scan document with initial UPLOADED status (weather fetched asynchronously by worker)
    const scan = new Scan({
      fieldId: field._id,
      droneImages: droneImagePaths,
      weatherSnapshot: { temperature: 0, humidity: 0, rainProbability: 0, windSpeed: 0, condition: 'Pending' },
      processingStatus: 'UPLOADED',
      progress: 10,
      executionMode: config.APP_MODE,
      processingStartedAt: null,
      processingCompletedAt: null,
      processingError: null,
    });

    await scan.save();

    // Enqueue to background worker asynchronously — does NOT block response
    enqueueScan(scan._id);

    logger.info(`[ScanController] Created scan ${scan._id} in UPLOADED state and enqueued to worker.`, {
      scanId: scan._id,
      fieldId: field._id,
    });

    res.status(201).json({
      success: true,
      data: {
        scanId: scan._id,
        processingStatus: 'UPLOADED',
        scan,
      },
      scan, // Preserved for backward-compatibility
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/scans/demo
 * Creates a demo scan. Strictly blocked in LIVE mode.
 */
exports.createDemoScan = async (req, res, next) => {
  try {
    const config = getConfig();
    if (config.isLive) {
      return next(new AppError('Demo scan creation is strictly disabled in LIVE mode.', 403, 'LIVE_MODE_RESTRICTION'));
    }

    let field = await Field.findOne({ executionMode: 'DEMO' });
    if (!field) {
      field = await Field.findOne();
    }
    if (!field) {
      return next(new AppError('No existing field found to attach demo scan. Run the demo seeder first.', 400, 'NO_FIELD_AVAILABLE'));
    }

    let weatherSnapshot = {
      temperature: 29,
      humidity: 78,
      rainProbability: 65,
      windSpeed: 12,
      condition: 'Humid & Overcast',
    };
    try {
      weatherSnapshot = await getFieldWeather(field.latitude, field.longitude);
    } catch {
      // Keep deterministic demo snapshot
    }

    const scan = new Scan({
      fieldId: field._id,
      droneImages: ['/uploads/drone/sample_orthomosaic.jpg'],
      reconstructedMap: '/uploads/drone/sample_orthomosaic.jpg',
      weatherSnapshot,
      processingStatus: 'UPLOADED',
      progress: 10,
      executionMode: 'DEMO',
      processingStartedAt: null,
      processingCompletedAt: null,
      processingError: null,
    });

    await scan.save();

    // Enqueue to background worker asynchronously
    enqueueScan(scan._id);

    res.status(201).json({
      success: true,
      data: {
        scanId: scan._id,
        processingStatus: 'UPLOADED',
        scan,
      },
      scan,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/scans/:id/process
 * Enqueues an existing scan for asynchronous processing.
 */
exports.processScan = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError(`Invalid scan ID format "${id}".`, 400, 'INVALID_ID'));
    }

    const scan = await Scan.findById(id);
    if (!scan) {
      return next(new AppError('Scan not found.', 404, 'SCAN_NOT_FOUND'));
    }

    enqueueScan(scan._id);

    res.json({
      success: true,
      message: 'Scan processing enqueued to background worker.',
      data: {
        scanId: scan._id,
        processingStatus: scan.processingStatus,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/scans/compare
 * Compares two scans.
 */
exports.compareScans = async (req, res, next) => {
  try {
    const { scan1Id, scan2Id } = req.query;
    if (!scan1Id || !scan2Id) {
      return next(new AppError('Both scan1Id and scan2Id query parameters are required.', 400, 'VALIDATION_ERROR'));
    }

    if (!mongoose.Types.ObjectId.isValid(scan1Id) || !mongoose.Types.ObjectId.isValid(scan2Id)) {
      return next(new AppError('Invalid ObjectId format provided in comparison parameters.', 400, 'INVALID_ID'));
    }

    const scan1 = await Scan.findById(scan1Id).populate('fieldId');
    const scan2 = await Scan.findById(scan2Id).populate('fieldId');

    if (!scan1 || !scan2) {
      return next(new AppError('One or both scans not found.', 404, 'SCAN_NOT_FOUND'));
    }

    const hotspots1 = await Hotspot.find({ scanId: scan1._id });
    const hotspots2 = await Hotspot.find({ scanId: scan2._id });

    const healthDelta = scan2.healthyPercentage - scan1.healthyPercentage;
    const hotspotDelta = scan2.hotspotCount - scan1.hotspotCount;
    const affectedDelta = scan2.affectedPercentage - scan1.affectedPercentage;

    res.json({
      success: true,
      comparison: {
        scan1: { scan: scan1, hotspots: hotspots1 },
        scan2: { scan: scan2, hotspots: hotspots2 },
        deltas: {
          healthDelta,
          hotspotDelta,
          affectedDelta,
          trend: healthDelta < 0 ? 'DETERIORATING' : healthDelta > 0 ? 'IMPROVING' : 'STABLE',
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/scans/:id/diagnosis
 * Strict JWT protected endpoint returning structured Phase 6 agronomic diagnosis,
 * evidence traceability, and conservative recommendations.
 */
exports.getScanDiagnosis = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError(`Invalid scan ID format "${id}".`, 400, 'INVALID_ID'));
    }

    const scan = await Scan.findById(id).populate('fieldId');
    if (!scan) {
      return next(new AppError('Scan not found.', 404, 'SCAN_NOT_FOUND'));
    }

    // Strict JWT ownership authorization
    if (!req.user || !req.user.id) {
      return next(new AppError('Authentication required to access scan diagnosis.', 401, 'UNAUTHORIZED'));
    }

    if (scan.fieldId && scan.fieldId.owner) {
      const ownerId = scan.fieldId.owner._id ? scan.fieldId.owner._id.toString() : scan.fieldId.owner.toString();
      if (ownerId !== req.user.id.toString()) {
        return next(new AppError('Access forbidden: You do not own the field for this scan.', 403, 'FORBIDDEN'));
      }
    }

    const Recommendation = require('../models/Recommendation');
    const recommendations = await Recommendation.find({ scanId: scan._id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        scanId: scan._id,
        cropType: scan.fieldId?.cropType || 'Tomato',
        processingStatus: scan.processingStatus,
        diagnosticSummary: scan.diagnosticSummary || {
          status: 'INCONCLUSIVE',
          primaryFinding: 'Undetermined',
          confidence: 0,
          confidenceBand: 'INCONCLUSIVE',
          differentialFindings: [],
          recommendationEligibility: 'ELIGIBLE',
          evidence: {},
          limitations: ['Scan has not undergone diagnostic synthesis yet.'],
        },
        indexMetrics: scan.indexMetrics,
        hotspotCount: scan.hotspotCount,
        recommendations,
      },
    });
  } catch (err) {
    next(err);
  }
};
