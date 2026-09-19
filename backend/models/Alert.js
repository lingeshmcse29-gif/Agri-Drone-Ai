const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema(
  {
    fieldId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Field',
      required: [true, 'Field reference (fieldId) is required'],
      index: true,
    },
    scanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scan',
      index: true,
    },
    hotspotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotspot',
      index: true,
    },
    type: {
      type: String,
      enum: ['CRITICAL_HOTSPOT', 'CROP_STRESS', 'WEATHER_RISK', 'SCAN_COMPLETE'],
      default: 'CRITICAL_HOTSPOT',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Alert title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Alert message is required'],
      trim: true,
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      index: true,
    },
    compositeRiskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    executionMode: {
      type: String,
      enum: ['LIVE', 'DEMO'],
      default: 'DEMO',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
AlertSchema.index({ fieldId: 1, isRead: 1 });
AlertSchema.index({ severity: 1, createdAt: -1 });
AlertSchema.index({ executionMode: 1, fieldId: 1 });

module.exports = mongoose.model('Alert', AlertSchema);
