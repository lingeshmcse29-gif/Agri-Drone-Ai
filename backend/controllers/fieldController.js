const mongoose = require('mongoose');
const Field = require('../models/Field');
const Scan = require('../models/Scan');
const Hotspot = require('../models/Hotspot');
const Alert = require('../models/Alert');
const Recommendation = require('../models/Recommendation');
const { getConfig } = require('../config/env');
const { AppError } = require('../middleware/errorMiddleware');

/**
 * GET /api/fields
 * Retrieves agricultural fields without automatic seeding.
 */
exports.getFields = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.executionMode) {
      query.executionMode = req.query.executionMode.toUpperCase();
    }
    if (req.user && req.user.id) {
      // If user scoped, can filter by owner
      // query.owner = req.user.id;
    }

    const fields = await Field.find(query).sort({ createdAt: -1 });
    res.json({ success: true, count: fields.length, fields });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/fields/:id
 * Retrieves a single field by ID.
 */
exports.getFieldById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError(`Invalid field ID format "${id}".`, 400, 'INVALID_ID'));
    }

    const field = await Field.findById(id);
    if (!field) {
      return next(new AppError('Field not found.', 404, 'FIELD_NOT_FOUND'));
    }

    res.json({ success: true, field });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/fields
 * Creates a new agricultural field.
 */
exports.createField = async (req, res, next) => {
  try {
    const { fieldName, cropType, area, location, latitude, longitude, boundary, executionMode } = req.body;
    if (!fieldName || !cropType || area === undefined || !location) {
      return next(new AppError('Missing required field information (fieldName, cropType, area, location).', 400, 'VALIDATION_ERROR'));
    }

    const config = getConfig();
    const mode = executionMode && ['LIVE', 'DEMO'].includes(executionMode.toUpperCase())
      ? executionMode.toUpperCase()
      : config.APP_MODE;

    const field = new Field({
      fieldName: fieldName.trim(),
      cropType: cropType.trim(),
      area: Number(area),
      location: location.trim(),
      latitude: latitude !== undefined ? Number(latitude) : 10.585,
      longitude: longitude !== undefined ? Number(longitude) : 77.015,
      boundary: Array.isArray(boundary) ? boundary : [],
      owner: req.user ? req.user.id : undefined,
      executionMode: mode,
    });

    await field.save();
    res.status(201).json({ success: true, field });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/fields/:id
 * Updates an existing agricultural field.
 */
exports.updateField = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError(`Invalid field ID format "${id}".`, 400, 'INVALID_ID'));
    }

    // Disallow overriding _id or createdAt
    const updates = { ...req.body };
    delete updates._id;
    delete updates.createdAt;

    const field = await Field.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!field) {
      return next(new AppError('Field not found.', 404, 'FIELD_NOT_FOUND'));
    }

    res.json({ success: true, field });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/fields/:id
 * Deletes a field and cascades deletion to associated scans, hotspots, alerts, and recommendations.
 */
exports.deleteField = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError(`Invalid field ID format "${id}".`, 400, 'INVALID_ID'));
    }

    const field = await Field.findByIdAndDelete(id);
    if (!field) {
      return next(new AppError('Field not found.', 404, 'FIELD_NOT_FOUND'));
    }

    // Maintain referential integrity: cascade delete child records
    await Promise.all([
      Scan.deleteMany({ fieldId: field._id }),
      Hotspot.deleteMany({ fieldId: field._id }),
      Alert.deleteMany({ fieldId: field._id }),
      Recommendation.deleteMany({ fieldId: field._id }),
    ]);

    res.json({
      success: true,
      message: 'Field and all associated scans, hotspots, alerts, and recommendations deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
};
