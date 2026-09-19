const mongoose = require('mongoose');

const HotspotSchema = new mongoose.Schema(
  {
    scanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scan',
      required: [true, 'Scan reference (scanId) is required'],
      index: true,
    },
    fieldId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Field',
      required: [true, 'Field reference (fieldId) is required'],
      index: true,
    },
    hotspotId: {
      type: String,
      required: [true, 'Hotspot unique identifier is required'],
      trim: true,
      index: true,
    },
    // Image-space geometry (retained for backward compatibility and pixel precision)
    x: {
      type: Number,
      required: [true, 'Bounding box X coordinate is required'],
    },
    y: {
      type: Number,
      required: [true, 'Bounding box Y coordinate is required'],
    },
    width: {
      type: Number,
      required: [true, 'Bounding box width is required'],
      min: [1, 'Width must be greater than zero'],
    },
    height: {
      type: Number,
      required: [true, 'Bounding box height is required'],
      min: [1, 'Height must be greater than zero'],
    },
    // Phase 5 Structured Pixel & Normalized Geometry
    pixelGeometry: {
      x: { type: Number },
      y: { type: Number },
      width: { type: Number },
      height: { type: Number },
      centerX: { type: Number },
      centerY: { type: Number },
    },
    normalizedGeometry: {
      x: { type: Number, min: 0, max: 1 },
      y: { type: Number, min: 0, max: 1 },
      width: { type: Number, min: 0, max: 1 },
      height: { type: Number, min: 0, max: 1 },
      centerX: { type: Number, min: 0, max: 1 },
      centerY: { type: Number, min: 0, max: 1 },
    },
    // Phase 5 Anomaly Tile Membership
    sourceTiles: [
      {
        tileId: { type: String, trim: true },
        row: { type: Number },
        col: { type: Number },
        healthScore: { type: Number },
        stressPct: { type: Number },
      },
    ],
    // Geographic coordinates: nullable when GPS is unavailable (no fabricated GPS)
    latitude: {
      type: Number,
      required: false,
      default: null,
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90'],
    },
    longitude: {
      type: Number,
      required: false,
      default: null,
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180'],
    },
    // Phase 5 GeoJSON point geometry when GPS coordinates are valid
    geoGeometry: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },
    // Phase 5 GPS State & Provenance Tracking
    gpsStatus: {
      type: String,
      enum: ['GPS_AVAILABLE', 'GPS_ESTIMATED', 'GPS_UNAVAILABLE'],
      default: 'GPS_UNAVAILABLE',
      index: true,
    },
    gpsSource: {
      type: String,
      enum: ['exif', 'geotiff', 'field_control_points', 'none'],
      default: 'none',
    },
    isGpsEstimated: {
      type: Boolean,
      default: false,
    },
    croppedImagePath: {
      type: String,
      trim: true,
    },
    stressType: {
      type: String,
      trim: true,
      default: 'leaf_discoloration',
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.85,
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      index: true,
    },
    riskLevel: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },
    // Deterministic CV metrics associated with this hotspot region
    vegetationStressPct: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    visualHealthScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 70,
    },
    possibleDiseases: [
      {
        name: { type: String, trim: true },
        confidence: { type: Number, min: 0, max: 1 },
        evidence: [{ type: String, trim: true }],
        status: {
          type: String,
          enum: ['SUSPECTED', 'INCONCLUSIVE', 'NO_VISIBLE_ABNORMALITY', 'POSSIBLE', 'UNCERTAIN'],
          default: 'SUSPECTED',
        },
      },
    ],
    possiblePests: [
      {
        name: { type: String, trim: true },
        confidence: { type: Number, min: 0, max: 1 },
      },
    ],
    // In m² if scale known, or fallback estimate
    affectedArea: {
      type: Number,
      min: 0,
      default: 12.4,
    },
    pixelArea: {
      type: Number,
      min: 0,
      default: 0,
    },
    recommendation: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INVESTIGATED', 'RESOLVED'],
      default: 'ACTIVE',
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

// Compound indexes for rapid lookups
HotspotSchema.index({ scanId: 1, severity: 1 });
HotspotSchema.index({ scanId: 1, gpsStatus: 1 });
HotspotSchema.index({ fieldId: 1, status: 1 });
HotspotSchema.index({ executionMode: 1, scanId: 1 });

module.exports = mongoose.model('Hotspot', HotspotSchema);
