const mongoose = require('mongoose');

const RecommendationSchema = new mongoose.Schema(
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
    cropType: {
      type: String,
      required: [true, 'Crop type is required'],
      trim: true,
    },
    issueName: {
      type: String,
      required: [true, 'Issue name is required'],
      trim: true,
    },
    // Phase 6 Diagnostic & Evidence Attributes
    diagnosisStatus: {
      type: String,
      enum: ['SUSPECTED', 'INCONCLUSIVE', 'NO_VISIBLE_ABNORMALITY'],
      default: 'SUSPECTED',
      index: true,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.75,
    },
    confidenceBand: {
      type: String,
      enum: ['HIGH', 'MODERATE', 'LOW', 'INCONCLUSIVE'],
      default: 'MODERATE',
    },
    recommendationEligibility: {
      type: String,
      enum: ['ELIGIBLE', 'CAUTION', 'NOT_ELIGIBLE'],
      default: 'ELIGIBLE',
    },
    reasoning: {
      type: String,
      default: '',
      trim: true,
    },
    evidence: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    actionSteps: [
      {
        type: String,
        trim: true,
      },
    ],
    urgency: {
      type: String,
      enum: ['ROUTINE', 'MODERATE', 'URGENT', 'CRITICAL'],
      default: 'MODERATE',
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPLIED', 'DISMISSED'],
      default: 'PENDING',
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
RecommendationSchema.index({ fieldId: 1, urgency: 1 });
RecommendationSchema.index({ scanId: 1, status: 1 });
RecommendationSchema.index({ executionMode: 1, fieldId: 1 });
RecommendationSchema.index({ scanId: 1, diagnosisStatus: 1 });

module.exports = mongoose.model('Recommendation', RecommendationSchema);
