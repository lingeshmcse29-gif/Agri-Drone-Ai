const mongoose = require('mongoose');

const FieldSchema = new mongoose.Schema(
  {
    fieldName: {
      type: String,
      required: [true, 'Field name is required'],
      trim: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    cropType: {
      type: String,
      required: [true, 'Crop type is required'],
      trim: true,
      default: 'Tomato',
    },
    area: {
      type: Number,
      required: [true, 'Area in hectares is required'],
      min: [0.01, 'Area must be at least 0.01 hectares'],
      default: 4.8,
    },
    location: {
      type: String,
      required: [true, 'Location description is required'],
      trim: true,
      default: 'Pollachi Farmlands',
    },
    latitude: {
      type: Number,
      required: [true, 'Latitude is required'],
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90'],
      default: 10.585,
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required'],
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180'],
      default: 77.015,
    },
    boundary: {
      type: [[Number]], // Array of [latitude, longitude] pairs
      default: [
        [10.587, 77.012],
        [10.587, 77.018],
        [10.583, 77.018],
        [10.583, 77.012],
      ],
    },
    executionMode: {
      type: String,
      enum: ['LIVE', 'DEMO'],
      default: 'DEMO',
      index: true,
    },
    compositeRiskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast lookups
FieldSchema.index({ owner: 1, createdAt: -1 });
FieldSchema.index({ executionMode: 1, createdAt: -1 });

module.exports = mongoose.model('Field', FieldSchema);
