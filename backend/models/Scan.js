const mongoose = require('mongoose');

const ScanSchema = new mongoose.Schema(
  {
    fieldId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Field',
      required: [true, 'Field reference (fieldId) is required'],
      index: true,
    },
    scanDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    droneImages: [
      {
        type: String,
        trim: true,
      },
    ],
    reconstructedMap: {
      type: String,
      trim: true,
    },
    weatherSnapshot: {
      temperature: { type: Number, default: 0 },
      humidity: { type: Number, default: 0 },
      rainProbability: { type: Number, default: 0 },
      windSpeed: { type: Number, default: 0 },
      condition: { type: String, default: 'Clear' },
    },
    processingStatus: {
      type: String,
      enum: ['UPLOADED', 'TILED', 'PROCESSING', 'ANALYZING', 'COMPLETED', 'FAILED'],
      default: 'UPLOADED',
      index: true,
    },
    processingStartedAt: {
      type: Date,
      default: null,
    },
    processingCompletedAt: {
      type: Date,
      default: null,
    },
    processingError: {
      type: String,
      default: null,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    stressScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    healthyPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },
    affectedPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    hotspotCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    overallRisk: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'LOW',
      index: true,
    },
    compositeRiskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      index: true,
    },
    indexMetrics: {
      exgMean: { type: Number, default: 0 },
      variMean: { type: Number, default: 0 },
      gliMean: { type: Number, default: 0 },
      canopyCoverPct: { type: Number, default: 0 },
      stressPct: { type: Number, default: 0 },
      ndviProxy: { type: Number, default: 0 },
    },
    isGpsEstimated: {
      type: Boolean,
      default: false,
    },
    executionMode: {
      type: String,
      enum: ['LIVE', 'DEMO'],
      default: 'DEMO',
      index: true,
    },
    aiSummary: {
      type: String,
      default: '',
    },
    // Phase 6 Structured Diagnostic Assessment & Evidence Traceability
    diagnosticSummary: {
      status: {
        type: String,
        enum: ['SUSPECTED', 'INCONCLUSIVE', 'NO_VISIBLE_ABNORMALITY'],
        default: 'INCONCLUSIVE',
        index: true,
      },
      primaryFinding: { type: String, default: 'Undetermined' },
      confidence: { type: Number, default: 0 },
      confidenceBand: {
        type: String,
        enum: ['HIGH', 'MODERATE', 'LOW', 'INCONCLUSIVE'],
        default: 'INCONCLUSIVE',
      },
      differentialFindings: [
        {
          name: { type: String, trim: true },
          confidence: { type: Number, min: 0, max: 1 },
          reasoning: { type: String, trim: true },
        },
      ],
      recommendationEligibility: {
        type: String,
        enum: ['ELIGIBLE', 'CAUTION', 'NOT_ELIGIBLE'],
        default: 'ELIGIBLE',
      },
      evidence: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      limitations: [
        { type: String, trim: true },
      ],
      generatedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries & worker processing
ScanSchema.index({ fieldId: 1, createdAt: -1 });
ScanSchema.index({ processingStatus: 1, createdAt: 1 });
ScanSchema.index({ executionMode: 1, fieldId: 1 });

module.exports = mongoose.model('Scan', ScanSchema);
