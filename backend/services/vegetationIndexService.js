const sharp = require('sharp');

/**
 * Vegetation Index & Canopy Analysis Service
 *
 * Implements deterministic pixel-based computer vision for RGB drone imagery:
 * - ExG (Excess Green Index): 2g - r - b, normalized to [-2, 2]
 * - VARI (Visual Atmospheric Resistance Index): (g - r) / (g + r - b)
 * - GLI (Green Leaf Index): (2g - r - b) / (2g + r + b)
 * - Canopy Coverage: % of valid pixels classified as vegetation
 * - Vegetation Stress: % of vegetation pixels showing chlorosis / degradation
 * - Visual Health Score: clamp(100 - vegetationStressPct, 0, 100)
 */

const EPSILON = 1e-5;

/**
 * Clamps a number to [min, max] range.
 */
function clamp(val, min, max) {
  if (typeof val !== 'number' || isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}

/**
 * Numerically safe division protecting against division by zero, NaN, or Infinity.
 */
function safeDivide(numerator, denominator, fallback = 0) {
  if (!isFinite(numerator) || !isFinite(denominator) || Math.abs(denominator) < EPSILON) {
    return fallback;
  }
  const result = numerator / denominator;
  return isFinite(result) ? result : fallback;
}

/**
 * Processes a raw RGB buffer and calculates deterministic vegetation metrics.
 *
 * @param {Buffer} buffer - Raw RGB pixel buffer (3 bytes per pixel: R, G, B)
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @param {number} channels - Number of channels (must be 3 or 4)
 * @returns {Object} Deterministic vegetation and canopy metrics
 */
function calculateBufferVegetationMetrics(buffer, width, height, channels = 3) {
  if (!buffer || buffer.length === 0 || width <= 0 || height <= 0) {
    throw new Error('Invalid image buffer or dimensions for vegetation index analysis.');
  }

  const totalPixels = width * height;
  let validPixels = 0;
  let shadowPixels = 0;
  let bareSoilPixels = 0;
  let vegetationPixels = 0;
  let stressedVegetationPixels = 0;
  let invalidVariPixels = 0;
  let invalidGliPixels = 0;

  let exgSum = 0;
  let variRawSum = 0;
  let variClampedSum = 0;
  let gliSum = 0;

  let exgMin = Infinity;
  let exgMax = -Infinity;
  let variRawMin = Infinity;
  let variRawMax = -Infinity;
  let variClampedMin = Infinity;
  let variClampedMax = -Infinity;
  let gliMin = Infinity;
  let gliMax = -Infinity;

  const stride = channels;
  const bufferLength = buffer.length;

  for (let i = 0; i + 2 < bufferLength; i += stride) {
    const R = buffer[i];
    const G = buffer[i + 1];
    const B = buffer[i + 2];

    // Standardized channel normalization: r, g, b in [0, 1]
    const r = R / 255.0;
    const g = G / 255.0;
    const b = B / 255.0;

    const sumRgb = r + g + b;
    validPixels++;

    // 1. Shadow check: very low total luminance
    if (sumRgb < 0.12) {
      shadowPixels++;
      continue;
    }

    // 2. Excess Green Index (ExG): range [-2.0, 2.0]
    const exg = 2.0 * g - r - b;
    exgSum += exg;
    if (exg < exgMin) exgMin = exg;
    if (exg > exgMax) exgMax = exg;

    // 3. VARI Index: (g - r) / (g + r - b)
    // Singularity protection: If |g + r - b| < EPSILON, treated as invalid denominator
    // SCIENTIFIC ACCURACY: Raw mathematical VARI is preserved after epsilon validation
    // without silent clamping to [-1, 1]. A separate derived variClamped is computed
    // for bounded visualization and proxy calculations.
    const variDenominator = g + r - b;
    let variRaw = 0;
    let variValid = false;

    if (Math.abs(variDenominator) >= EPSILON) {
      const rawVal = (g - r) / variDenominator;
      if (isFinite(rawVal)) {
        variRaw = rawVal;
        const variClamped = clamp(variRaw, -1.0, 1.0);
        variRawSum += variRaw;
        variClampedSum += variClamped;
        if (variRaw < variRawMin) variRawMin = variRaw;
        if (variRaw > variRawMax) variRawMax = variRaw;
        if (variClamped < variClampedMin) variClampedMin = variClamped;
        if (variClamped > variClampedMax) variClampedMax = variClamped;
        variValid = true;
      } else {
        invalidVariPixels++;
      }
    } else {
      invalidVariPixels++;
    }

    // 4. GLI Index: (2g - r - b) / (2g + r + b)
    const gliDenominator = 2.0 * g + r + b;
    let gli = 0;

    if (Math.abs(gliDenominator) >= EPSILON) {
      const rawGli = (2.0 * g - r - b) / gliDenominator;
      if (isFinite(rawGli)) {
        gli = clamp(rawGli, -1.0, 1.0);
        gliSum += gli;
        if (gli < gliMin) gliMin = gli;
        if (gli > gliMax) gliMax = gli;
      } else {
        invalidGliPixels++;
      }
    } else {
      invalidGliPixels++;
    }

    // 5. Explicit Vegetation Classification:
    // ExG must be positive, green strictly exceeds red and blue, and luminance exceeds shadow threshold
    //
    // SCIENTIFIC LIMITATION NOTICE:
    // In visible RGB imagery (lacking Near-Infrared or Red-Edge bands), strongly brown or senescent crop
    // residue/foliage exhibits r >= g and ExG <= 0.04, which is spectrally indistinguishable from bare brown soil.
    // The deterministic RGB classifier intentionally classifies r >= g as bare soil / non-vegetation to prevent
    // false positive canopy detection on bare earth.
    // The stress classifier primarily detects visible green-to-yellow chlorosis, foliar lesions, and early stage leaf
    // degradation where g > r and g > b still hold. Strongly brown/dead vegetation may be classified as bare ground.
    // Comprehensive botanical diagnosis cannot be made from visible RGB color alone.
    const isVegetation = exg > 0.04 && g > r && g > b;

    if (isVegetation) {
      vegetationPixels++;

      // Stressed vegetation: chlorosis / yellowing / degradation exhibits low VARI (< 0.05) or low GLI (< 0.05)
      const isStressed = (variValid && variRaw < 0.05) || gli < 0.05 || (g - r) < 0.03;
      if (isStressed) {
        stressedVegetationPixels++;
      }
    } else {
      // Non-vegetation: bare soil, gravel, mulch, or structures
      bareSoilPixels++;
    }
  }

  // Aggregate distribution metrics with numeric safeguards
  const analyzedNonShadowCount = validPixels - shadowPixels;
  const exgMean = analyzedNonShadowCount > 0 ? Number((exgSum / analyzedNonShadowCount).toFixed(4)) : 0;
  
  const validVariCount = analyzedNonShadowCount - invalidVariPixels;
  const variRawMean = validVariCount > 0 ? Number((variRawSum / validVariCount).toFixed(4)) : 0;
  const variClampedMean = validVariCount > 0 ? Number((variClampedSum / validVariCount).toFixed(4)) : 0;
  const variMean = variRawMean; // Preserves un-clamped raw mathematical VARI mean

  const validGliCount = analyzedNonShadowCount - invalidGliPixels;
  const gliMean = validGliCount > 0 ? Number((gliSum / validGliCount).toFixed(4)) : 0;

  // Canopy Cover Percentage:
  // DEFINITION: canopyCoverPct = (vegetationPixels / validPixels) * 100
  // where validPixels (analysisPixels) represents all valid source pixels used for spatial canopy estimation.
  // Mutual exclusivity: validPixels === shadowPixels + bareSoilPixels + vegetationPixels.
  const canopyCoverPct = validPixels > 0
    ? Number(clamp((vegetationPixels / validPixels) * 100, 0, 100).toFixed(1))
    : 0;

  // Vegetation Stress Percentage: proportion of vegetation pixels showing visual degradation
  // Note: If no vegetation is detected, vegetationStressPct is 0 (bare ground is NOT stressed crop)
  const vegetationStressPct = vegetationPixels > 0
    ? Number(clamp((stressedVegetationPixels / vegetationPixels) * 100, 0, 100).toFixed(1))
    : 0;

  // Overall visual health score (0 - 100)
  // DEFINITION: visualHealthScore = Math.round(clamp(100 - vegetationStressPct, 0, 100))
  // A visual crop health estimate, not a biological laboratory assay.
  const visualHealthScore = Math.round(clamp(100 - vegetationStressPct, 0, 100));

  // RGB Vegetation Proxy for UI compatibility (VARI mapping to [0, 1], using bounded variClampedMean)
  const ndviProxy = Number(clamp(0.5 + 0.5 * variClampedMean, 0, 1).toFixed(4));

  return {
    totalPixels,
    validPixels,
    analysisPixels: validPixels,
    shadowPixels,
    bareSoilPixels,
    vegetationPixels,
    stressedVegetationPixels,
    invalidVariPixels,
    invalidVariPixelCount: invalidVariPixels,
    invalidGliPixels,
    invalidGliPixelCount: invalidGliPixels,
    canopyCoverPct,
    vegetationStressPct,
    stressPct: vegetationStressPct,
    visualHealthScore,
    exgMean,
    variMean,
    variRawMean,
    variClampedMean,
    variRaw: variRawMean,
    variClamped: variClampedMean,
    gliMean,
    ndviProxy,
    exgRange: {
      min: exgMin === Infinity ? 0 : Number(exgMin.toFixed(4)),
      max: exgMax === -Infinity ? 0 : Number(exgMax.toFixed(4)),
    },
    variRange: {
      min: variRawMin === Infinity ? 0 : Number(variRawMin.toFixed(4)),
      max: variRawMax === -Infinity ? 0 : Number(variRawMax.toFixed(4)),
    },
    variClampedRange: {
      min: variClampedMin === Infinity ? 0 : Number(variClampedMin.toFixed(4)),
      max: variClampedMax === -Infinity ? 0 : Number(variClampedMax.toFixed(4)),
    },
    gliRange: {
      min: gliMin === Infinity ? 0 : Number(gliMin.toFixed(4)),
      max: gliMax === -Infinity ? 0 : Number(gliMax.toFixed(4)),
    },
  };
}

/**
 * Analyzes an image file on disk using Sharp to extract raw RGB pixels and compute vegetation indices.
 *
 * @param {string} imagePath - Absolute path to image file
 * @param {Object} [options] - Analysis options
 * @param {number} [options.maxDimension=2048] - Max dimension for analysis sampling
 * @returns {Promise<Object>} Comprehensive image metrics
 */
async function analyzeImageVegetation(imagePath, options = {}) {
  const maxDim = options.maxDimension || parseInt(process.env.CV_ANALYSIS_MAX_DIMENSION, 10) || 2048;

  const image = sharp(imagePath);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Corrupted image metadata: unable to read dimensions of "${imagePath}".`);
  }

  // Calculate target downsampling dimensions for analysis resolution if needed
  let targetWidth = metadata.width;
  let targetHeight = metadata.height;

  if (targetWidth > maxDim || targetHeight > maxDim) {
    if (targetWidth >= targetHeight) {
      targetHeight = Math.round((targetHeight / targetWidth) * maxDim);
      targetWidth = maxDim;
    } else {
      targetWidth = Math.round((targetWidth / targetHeight) * maxDim);
      targetHeight = maxDim;
    }
  }

  // Extract raw RGB buffer at analysis resolution (original file on disk remains completely untouched)
  const { data: rawBuffer, info } = await image
    .resize(targetWidth, targetHeight, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const metrics = calculateBufferVegetationMetrics(rawBuffer, info.width, info.height, info.channels);

  return {
    sourceDimensions: { width: metadata.width, height: metadata.height },
    analysisDimensions: { width: info.width, height: info.height },
    channels: info.channels,
    format: metadata.format,
    ...metrics,
  };
}

module.exports = {
  clamp,
  safeDivide,
  calculateBufferVegetationMetrics,
  analyzeImageVegetation,
  EPSILON,
};
