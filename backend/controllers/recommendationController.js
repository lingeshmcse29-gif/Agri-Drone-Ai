const mongoose = require('mongoose');
const Recommendation = require('../models/Recommendation');
const { AppError } = require('../middleware/errorMiddleware');

/**
 * GET /api/recommendations
 * Retrieves recommendations with optional filtering.
 */
exports.getRecommendations = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.fieldId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.fieldId)) {
        return next(new AppError(`Invalid field ID format "${req.query.fieldId}".`, 400, 'INVALID_ID'));
      }
      query.fieldId = req.query.fieldId;
    }
    if (req.query.hotspotId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.hotspotId)) {
        return next(new AppError(`Invalid hotspot ID format "${req.query.hotspotId}".`, 400, 'INVALID_ID'));
      }
      query.hotspotId = req.query.hotspotId;
    }
    if (req.query.status) {
      query.status = req.query.status.toUpperCase();
    }
    if (req.query.urgency) {
      query.urgency = req.query.urgency.toUpperCase();
    }
    if (req.query.executionMode) {
      query.executionMode = req.query.executionMode.toUpperCase();
    }

    const recommendations = await Recommendation.find(query)
      .populate('fieldId')
      .populate('hotspotId')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: recommendations.length, recommendations });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/recommendations/:id/status
 * Updates recommendation status (PENDING, APPLIED, DISMISSED).
 */
exports.updateRecommendationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError(`Invalid recommendation ID format "${id}".`, 400, 'INVALID_ID'));
    }

    const { status } = req.body;
    if (!status || !['PENDING', 'APPLIED', 'DISMISSED'].includes(status.toUpperCase())) {
      return next(new AppError('Invalid status value. Allowed: PENDING, APPLIED, DISMISSED.', 400, 'VALIDATION_ERROR'));
    }

    const recommendation = await Recommendation.findByIdAndUpdate(
      id,
      { status: status.toUpperCase() },
      { new: true, runValidators: true }
    );

    if (!recommendation) {
      return next(new AppError('Recommendation not found.', 404, 'RECOMMENDATION_NOT_FOUND'));
    }

    res.json({ success: true, recommendation });
  } catch (err) {
    next(err);
  }
};
