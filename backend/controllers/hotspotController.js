const mongoose = require('mongoose');
const Hotspot = require('../models/Hotspot');
const { AppError } = require('../middleware/errorMiddleware');

/**
 * GET /api/hotspots
 * Retrieves hotspots with optional filtering by scanId, fieldId, severity, status, executionMode, or gpsStatus.
 * Supports format=geojson to deliver frontend-ready FeatureCollection.
 */
exports.getHotspots = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.scanId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.scanId)) {
        return next(new AppError(`Invalid scan ID format "${req.query.scanId}".`, 400, 'INVALID_ID'));
      }
      query.scanId = req.query.scanId;
    }
    if (req.query.fieldId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.fieldId)) {
        return next(new AppError(`Invalid field ID format "${req.query.fieldId}".`, 400, 'INVALID_ID'));
      }
      query.fieldId = req.query.fieldId;
    }
    if (req.query.severity) {
      query.severity = req.query.severity.toUpperCase();
    }
    if (req.query.status) {
      query.status = req.query.status.toUpperCase();
    }
    if (req.query.gpsStatus) {
      query.gpsStatus = req.query.gpsStatus.toUpperCase();
    }
    if (req.query.executionMode) {
      query.executionMode = req.query.executionMode.toUpperCase();
    }

    const hotspots = await Hotspot.find(query)
      .populate('fieldId')
      .populate('scanId')
      .sort({ riskLevel: -1 });

    // Support standard GeoJSON format for mapping clients
    if (req.query.format === 'geojson') {
      const features = hotspots
        .filter((h) => h.latitude !== null && h.longitude !== null)
        .map((h) => ({
          type: 'Feature',
          geometry: h.geoGeometry || {
            type: 'Point',
            coordinates: [h.longitude, h.latitude],
          },
          properties: {
            id: h._id,
            hotspotId: h.hotspotId,
            scanId: h.scanId?._id || h.scanId,
            fieldId: h.fieldId?._id || h.fieldId,
            severity: h.severity,
            riskLevel: h.riskLevel,
            gpsStatus: h.gpsStatus,
            isGpsEstimated: h.isGpsEstimated,
            vegetationStressPct: h.vegetationStressPct,
            visualHealthScore: h.visualHealthScore,
            affectedArea: h.affectedArea,
            pixelArea: h.pixelArea,
          },
        }));

      return res.json({
        type: 'FeatureCollection',
        features,
        totalHotspots: hotspots.length,
        mappedHotspots: features.length,
      });
    }

    res.json({ success: true, count: hotspots.length, hotspots });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/hotspots/:id
 * Retrieves a single hotspot by ID.
 */
exports.getHotspotById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError(`Invalid hotspot ID format "${id}".`, 400, 'INVALID_ID'));
    }

    const hotspot = await Hotspot.findById(id)
      .populate('fieldId')
      .populate('scanId');

    if (!hotspot) {
      return next(new AppError('Hotspot not found.', 404, 'HOTSPOT_NOT_FOUND'));
    }

    res.json({ success: true, hotspot });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/hotspots/:id/status
 * Updates hotspot investigation/resolution status.
 */
exports.updateHotspotStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError(`Invalid hotspot ID format "${id}".`, 400, 'INVALID_ID'));
    }

    const { status } = req.body;
    if (!status || !['ACTIVE', 'INVESTIGATED', 'RESOLVED'].includes(status.toUpperCase())) {
      return next(new AppError('Invalid status value. Allowed: ACTIVE, INVESTIGATED, RESOLVED.', 400, 'VALIDATION_ERROR'));
    }

    const hotspot = await Hotspot.findByIdAndUpdate(
      id,
      { status: status.toUpperCase() },
      { new: true, runValidators: true }
    );

    if (!hotspot) {
      return next(new AppError('Hotspot not found.', 404, 'HOTSPOT_NOT_FOUND'));
    }

    res.json({ success: true, hotspot });
  } catch (err) {
    next(err);
  }
};
