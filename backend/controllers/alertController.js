const mongoose = require('mongoose');
const Alert = require('../models/Alert');
const { AppError } = require('../middleware/errorMiddleware');

/**
 * GET /api/alerts
 * Retrieves alerts with optional filtering.
 */
exports.getAlerts = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.fieldId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.fieldId)) {
        return next(new AppError(`Invalid field ID format "${req.query.fieldId}".`, 400, 'INVALID_ID'));
      }
      query.fieldId = req.query.fieldId;
    }
    if (req.query.scanId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.scanId)) {
        return next(new AppError(`Invalid scan ID format "${req.query.scanId}".`, 400, 'INVALID_ID'));
      }
      query.scanId = req.query.scanId;
    }
    if (req.query.isRead !== undefined) {
      query.isRead = req.query.isRead === 'true';
    }
    if (req.query.severity) {
      query.severity = req.query.severity.toUpperCase();
    }
    if (req.query.executionMode) {
      query.executionMode = req.query.executionMode.toUpperCase();
    }

    const alerts = await Alert.find(query)
      .populate('fieldId')
      .populate('scanId')
      .sort({ createdAt: -1 });

    const unreadCount = alerts.filter((a) => !a.isRead).length;

    res.json({ success: true, count: alerts.length, unreadCount, alerts });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/alerts/:id/read
 * Marks an alert as read.
 */
exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError(`Invalid alert ID format "${id}".`, 400, 'INVALID_ID'));
    }

    const alert = await Alert.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true, runValidators: true }
    );
    if (!alert) {
      return next(new AppError('Alert not found.', 404, 'ALERT_NOT_FOUND'));
    }

    res.json({ success: true, alert });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/alerts/:id
 * Dismisses/deletes an alert.
 */
exports.dismissAlert = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError(`Invalid alert ID format "${id}".`, 400, 'INVALID_ID'));
    }

    const alert = await Alert.findByIdAndDelete(id);
    if (!alert) {
      return next(new AppError('Alert not found.', 404, 'ALERT_NOT_FOUND'));
    }

    res.json({ success: true, message: 'Alert dismissed successfully' });
  } catch (err) {
    next(err);
  }
};
