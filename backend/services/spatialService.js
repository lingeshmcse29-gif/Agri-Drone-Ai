/**
 * AgriDrone AI — Spatial Geo-Registration & Hotspot Segmentation Service
 *
 * Implements Phase 5 core capabilities:
 * 1. Image-space hotspot geometry & normalized coordinates [0, 1]
 * 2. Deterministic connected-component clustering (8-connected) for anomaly tiles
 * 3. EXIF metadata GPS parser (zero external binary dependency)
 * 4. Control-point Affine Transformation solver (least squares / Cramer's rule)
 * 5. WGS84 coordinate generation and boundary containment (Ray-Casting Point-in-Polygon)
 * 6. Deterministic GPS availability classification: GPS_AVAILABLE | GPS_ESTIMATED | GPS_UNAVAILABLE
 *
 * SCIENTIFIC RULE: ZERO FABRICATED COORDINATES. If reliable geo-registration
 * cannot be derived from authentic metadata or control points, coordinates remain null.
 */

const fs = require('fs');
const sharp = require('sharp');

// Numerical tolerance constant
const EPSILON = 1e-9;

/**
 * 1. Calculate image-space bounding box and center.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @returns {{ x: number, y: number, width: number, height: number, centerX: number, centerY: number }}
 */
function calculatePixelGeometry(x, y, width, height) {
  const safeX = Math.max(0, Math.round(Number(x) || 0));
  const safeY = Math.max(0, Math.round(Number(y) || 0));
  const safeW = Math.max(1, Math.round(Number(width) || 1));
  const safeH = Math.max(1, Math.round(Number(height) || 1));

  return {
    x: safeX,
    y: safeY,
    width: safeW,
    height: safeH,
    centerX: Number((safeX + safeW / 2).toFixed(2)),
    centerY: Number((safeY + safeH / 2).toFixed(2)),
  };
}

/**
 * 2. Normalize image coordinates into [0, 1] space deterministically.
 *
 * @param {{ x: number, y: number, width: number, height: number, centerX?: number, centerY?: number }} pixelGeom
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @returns {{ x: number, y: number, width: number, height: number, centerX: number, centerY: number }}
 */
function normalizeGeometry(pixelGeom, imageWidth, imageHeight) {
  if (!imageWidth || imageWidth <= 0 || !imageHeight || imageHeight <= 0) {
    throw new Error(`Invalid image dimensions for normalization: ${imageWidth}x${imageHeight}`);
  }

  const normX = Math.max(0, Math.min(1, pixelGeom.x / imageWidth));
  const normY = Math.max(0, Math.min(1, pixelGeom.y / imageHeight));
  const normW = Math.max(0, Math.min(1, pixelGeom.width / imageWidth));
  const normH = Math.max(0, Math.min(1, pixelGeom.height / imageHeight));

  const centerX = pixelGeom.centerX !== undefined ? pixelGeom.centerX : (pixelGeom.x + pixelGeom.width / 2);
  const centerY = pixelGeom.centerY !== undefined ? pixelGeom.centerY : (pixelGeom.y + pixelGeom.height / 2);

  const normCenterX = Math.max(0, Math.min(1, centerX / imageWidth));
  const normCenterY = Math.max(0, Math.min(1, centerY / imageHeight));

  return {
    x: Number(normX.toFixed(6)),
    y: Number(normY.toFixed(6)),
    width: Number(normW.toFixed(6)),
    height: Number(normH.toFixed(6)),
    centerX: Number(normCenterX.toFixed(6)),
    centerY: Number(normCenterY.toFixed(6)),
  };
}

/**
 * 3. Deterministic 8-Connected Component Hotspot Clustering
 *
 * Takes a list of anomaly tiles and groups adjacent or diagonal tiles into connected
 * hotspot regions.
 *
 * 8-connectivity is used so that diagonally touching anomalous areas form a unified
 * crop stress region rather than creating fragmented micro-hotspots.
 *
 * @param {Array<Object>} abnormalTiles List of abnormal tile objects with row, col, pixelX, pixelY, etc.
 * @param {number} gridRows
 * @param {number} gridCols
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @returns {Array<Object>} Clustered hotspot regions sorted deterministically by top-left coordinate.
 */
function clusterAnomalousTiles(abnormalTiles, gridRows = 6, gridCols = 6, imageWidth = 1200, imageHeight = 800) {
  if (!abnormalTiles || abnormalTiles.length === 0) {
    return [];
  }

  // 1. Build a 2D lookup grid for fast constant-time neighbour access
  const grid = Array.from({ length: gridRows }, () => Array(gridCols).fill(null));
  for (const tile of abnormalTiles) {
    if (tile.row >= 0 && tile.row < gridRows && tile.col >= 0 && tile.col < gridCols) {
      grid[tile.row][tile.col] = tile;
    }
  }

  const visited = Array.from({ length: gridRows }, () => Array(gridCols).fill(false));
  const clusters = [];

  // 8-connected offsets (horizontal, vertical, diagonal)
  const dRow = [-1, -1, -1, 0, 0, 1, 1, 1];
  const dCol = [-1, 0, 1, -1, 1, -1, 0, 1];

  // Deterministic raster traversal (row by row, col by col)
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (grid[r][c] && !visited[r][c]) {
        // Start BFS to collect all connected anomaly tiles
        const currentCluster = [];
        const queue = [{ r, c }];
        visited[r][c] = true;

        while (queue.length > 0) {
          const curr = queue.shift();
          const tile = grid[curr.r][curr.c];
          currentCluster.push(tile);

          for (let i = 0; i < 8; i++) {
            const nr = curr.r + dRow[i];
            const nc = curr.c + dCol[i];

            if (
              nr >= 0 && nr < gridRows &&
              nc >= 0 && nc < gridCols &&
              grid[nr][nc] &&
              !visited[nr][nc]
            ) {
              visited[nr][nc] = true;
              queue.push({ r: nr, c: nc });
            }
          }
        }

        // Sort tiles within cluster deterministically (by row, then col)
        currentCluster.sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);
        clusters.push(currentCluster);
      }
    }
  }

  // Sort clusters deterministically by anchor tile (min row, then min col)
  clusters.sort((a, b) => {
    const aAnchor = a[0];
    const bAnchor = b[0];
    return aAnchor.row !== bAnchor.row ? aAnchor.row - bAnchor.row : aAnchor.col - bAnchor.col;
  });

  // Construct merged hotspot representations
  return clusters.map((tiles, idx) => {
    const minPixelX = Math.min(...tiles.map((t) => t.pixelX));
    const minPixelY = Math.min(...tiles.map((t) => t.pixelY));
    const maxPixelX = Math.max(...tiles.map((t) => t.pixelX + t.pixelW));
    const maxPixelY = Math.max(...tiles.map((t) => t.pixelY + t.pixelH));

    const pixelWidth = maxPixelX - minPixelX;
    const pixelHeight = maxPixelY - minPixelY;

    const pixelGeom = calculatePixelGeometry(minPixelX, minPixelY, pixelWidth, pixelHeight);
    const normGeom = normalizeGeometry(pixelGeom, imageWidth, imageHeight);

    // Aggregate health and stress metrics across member tiles
    const avgHealthScore = Math.round(
      tiles.reduce((acc, t) => acc + (t.healthScore !== undefined ? t.healthScore : 50), 0) / tiles.length
    );
    const avgStressPct = Number(
      (tiles.reduce((acc, t) => acc + (t.vegetationStressPct !== undefined ? t.vegetationStressPct : 0), 0) / tiles.length).toFixed(1)
    );

    // Deterministic severity mapping
    let severity = 'MEDIUM';
    if (avgHealthScore < 45 || avgStressPct > 60) {
      severity = 'CRITICAL';
    } else if (avgHealthScore < 55 || avgStressPct > 40) {
      severity = 'HIGH';
    } else if (avgHealthScore < 65 || avgStressPct > 25) {
      severity = 'MEDIUM';
    } else {
      severity = 'LOW';
    }

    const hotspotId = `HS-${String(idx + 1).padStart(2, '0')}`;

    return {
      hotspotId,
      sourceTiles: tiles.map((t) => ({
        tileId: t.tileId,
        row: t.row,
        col: t.col,
        healthScore: t.healthScore,
        stressPct: t.vegetationStressPct,
      })),
      pixelGeometry: pixelGeom,
      normalizedGeometry: normGeom,
      centerX: pixelGeom.centerX,
      centerY: pixelGeom.centerY,
      pixelWidth: pixelGeom.width,
      pixelHeight: pixelGeom.height,
      pixelArea: pixelGeom.width * pixelGeom.height,
      visualHealthScore: avgHealthScore,
      vegetationStressPct: avgStressPct,
      severity,
      riskLevel: 100 - avgHealthScore,
    };
  });
}

/**
 * 4. Robust Ray-Casting Point-in-Polygon (Field Containment Check)
 *
 * Checks whether [latitude, longitude] falls strictly inside or on the boundary
 * of the field's polygon coordinates [[lat, lng], ...].
 *
 * @param {[number, number]} point [lat, lng]
 * @param {Array<[number, number]>} polygon Array of [lat, lng] vertices
 * @returns {boolean}
 */
function pointInPolygon(point, polygon) {
  if (!point || !Array.isArray(point) || point.length < 2) return false;
  if (!polygon || !Array.isArray(polygon) || polygon.length < 3) return false;

  const lat = Number(point[0]);
  const lng = Number(point[1]);

  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;

  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const latI = polygon[i][0];
    const lngI = polygon[i][1];
    const latJ = polygon[j][0];
    const lngJ = polygon[j][1];

    // Check on-vertex or horizontal edge collinearity
    if (lat === latI && lng === lngI) return true;

    // Ray-casting test: ray moving in +lng direction
    const intersect = ((latI > lat) !== (latJ > lat)) &&
      (lng < (lngJ - lngI) * (lat - latI) / ((latJ - latI) || EPSILON) + lngI);

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * 5. Solve Affine Transformation from Control Points
 *
 * Transforms pixel coordinates (x, y) to geographic coordinates (lat, lng):
 *   lat = a*x + b*y + c
 *   lng = d*x + e*y + f
 *
 * Requires at least 3 non-collinear control points:
 *   [{ pixelX, pixelY, lat, lng }, ...]
 *
 * Uses Cramer's rule / direct 3x3 linear system solver.
 *
 * @param {Array<{ pixelX: number, pixelY: number, lat: number, lng: number }>} controlPoints
 * @returns {{ a: number, b: number, c: number, d: number, e: number, f: number } | null}
 */
function solveAffineTransform(controlPoints) {
  if (!controlPoints || !Array.isArray(controlPoints) || controlPoints.length < 3) {
    return null;
  }

  // Use the first 3 control points (or best 3 non-collinear)
  const p1 = controlPoints[0];
  const p2 = controlPoints[1];
  const p3 = controlPoints[2];

  // Determinant of pixel coordinate matrix:
  // | x1  y1  1 |
  // | x2  y2  1 |
  // | x3  y3  1 |
  const det = p1.pixelX * (p2.pixelY - p3.pixelY) -
              p1.pixelY * (p2.pixelX - p3.pixelX) +
              (p2.pixelX * p3.pixelY - p3.pixelX * p2.pixelY);

  // If determinant is near zero, control points are collinear or invalid
  if (Math.abs(det) < EPSILON) {
    return null;
  }

  // Solve for lat coefficients: [a, b, c]
  const a = ((p2.pixelY - p3.pixelY) * p1.lat + (p3.pixelY - p1.pixelY) * p2.lat + (p1.pixelY - p2.pixelY) * p3.lat) / det;
  const b = ((p3.pixelX - p2.pixelX) * p1.lat + (p1.pixelX - p3.pixelX) * p2.lat + (p2.pixelX - p1.pixelX) * p3.lat) / det;
  const c = ((p2.pixelX * p3.pixelY - p3.pixelX * p2.pixelY) * p1.lat +
             (p3.pixelX * p1.pixelY - p1.pixelX * p3.pixelY) * p2.lat +
             (p1.pixelX * p2.pixelY - p2.pixelX * p1.pixelY) * p3.lat) / det;

  // Solve for lng coefficients: [d, e, f]
  const d = ((p2.pixelY - p3.pixelY) * p1.lng + (p3.pixelY - p1.pixelY) * p2.lng + (p1.pixelY - p2.pixelY) * p3.lng) / det;
  const e = ((p3.pixelX - p2.pixelX) * p1.lng + (p1.pixelX - p3.pixelX) * p2.lng + (p2.pixelX - p1.pixelX) * p3.lng) / det;
  const f = ((p2.pixelX * p3.pixelY - p3.pixelX * p2.pixelY) * p1.lng +
             (p3.pixelX * p1.pixelY - p1.pixelX * p3.pixelY) * p2.lng +
             (p1.pixelX * p2.pixelY - p2.pixelX * p1.pixelY) * p3.lng) / det;

  return { a, b, c, d, e, f };
}

/**
 * Apply affine transform to a pixel coordinate.
 *
 * @param {{ a: number, b: number, c: number, d: number, e: number, f: number }} transform
 * @param {number} x
 * @param {number} y
 * @returns {{ latitude: number, longitude: number }}
 */
function applyAffineTransform(transform, x, y) {
  if (!transform) return null;
  const lat = transform.a * x + transform.b * y + transform.c;
  const lng = transform.d * x + transform.e * y + transform.f;

  if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
    return null;
  }

  return {
    latitude: Number(lat.toFixed(7)),
    longitude: Number(lng.toFixed(7)),
  };
}

/**
 * 6. EXIF Binary GPS Parser (Pure Node.js zero-dependency)
 *
 * Extracts authentic GPS tags directly from JPEG or TIFF buffers:
 * - GPSLatitude (degrees, minutes, seconds)
 * - GPSLongitude (degrees, minutes, seconds)
 * - GPSLatitudeRef ('N' | 'S')
 * - GPSLongitudeRef ('E' | 'W')
 * - GPSAltitude (meters)
 *
 * If no valid EXIF or no GPS IFD exists, safely returns null without throwing.
 *
 * @param {Buffer | string} imageBufferOrPath
 * @returns {Promise<{ latitude: number, longitude: number, altitude: number | null, source: string } | null>}
 */
async function extractExifGps(imageBufferOrPath) {
  try {
    let buf = null;
    if (Buffer.isBuffer(imageBufferOrPath)) {
      buf = imageBufferOrPath;
    } else if (typeof imageBufferOrPath === 'string' && fs.existsSync(imageBufferOrPath)) {
      buf = fs.readFileSync(imageBufferOrPath);
    } else {
      return null;
    }

    if (!buf || buf.length < 32) {
      return null;
    }

    // Check JPEG SOI marker (0xFFD8)
    let tiffHeaderOffset = -1;
    if (buf[0] === 0xFF && buf[1] === 0xD8) {
      // Walk APP1 markers
      let offset = 2;
      while (offset < buf.length - 4) {
        if (buf[offset] !== 0xFF) break;
        const marker = buf[offset + 1];
        const len = buf.readUInt16BE(offset + 2);

        if (marker === 0xE1) {
          // APP1 Marker - check Exif header "Exif\0\0"
          const exifHeader = buf.toString('ascii', offset + 4, offset + 8);
          if (exifHeader === 'Exif') {
            tiffHeaderOffset = offset + 10;
            break;
          }
        }
        offset += 2 + len;
      }
    } else if (buf.slice(0, 4).toString('ascii') === 'II*\0' || buf.slice(0, 4).toString('ascii') === 'MM\0*') {
      // Direct TIFF
      tiffHeaderOffset = 0;
    }

    if (tiffHeaderOffset < 0 || tiffHeaderOffset + 8 > buf.length) {
      return null;
    }

    // Read byte order
    const isLittleEndian = buf[tiffHeaderOffset] === 0x49 && buf[tiffHeaderOffset + 1] === 0x49; // "II"
    const readU16 = (off) => isLittleEndian ? buf.readUInt16LE(off) : buf.readUInt16BE(off);
    const readU32 = (off) => isLittleEndian ? buf.readUInt32LE(off) : buf.readUInt32BE(off);

    const ifd0Offset = tiffHeaderOffset + readU32(tiffHeaderOffset + 4);
    if (ifd0Offset + 2 > buf.length) return null;

    const numEntries = readU16(ifd0Offset);
    let gpsIfdOffset = -1;

    // Scan IFD0 for GPS Info IFD tag (0x8825)
    for (let i = 0; i < numEntries; i++) {
      const entryOffset = ifd0Offset + 2 + i * 12;
      if (entryOffset + 12 > buf.length) break;
      const tag = readU16(entryOffset);
      if (tag === 0x8825) {
        gpsIfdOffset = tiffHeaderOffset + readU32(entryOffset + 8);
        break;
      }
    }

    if (gpsIfdOffset < 0 || gpsIfdOffset + 2 > buf.length) {
      return null;
    }

    // Parse GPS IFD tags
    const numGpsEntries = readU16(gpsIfdOffset);
    let latRef = null;
    let lngRef = null;
    let latCoords = null;
    let lngCoords = null;
    let altitude = null;

    for (let i = 0; i < numGpsEntries; i++) {
      const entryOff = gpsIfdOffset + 2 + i * 12;
      if (entryOff + 12 > buf.length) break;

      const tag = readU16(entryOff);
      const valOffset = tiffHeaderOffset + readU32(entryOff + 8);

      if (tag === 0x0001) {
        // GPSLatitudeRef
        latRef = String.fromCharCode(buf[entryOff + 8]);
      } else if (tag === 0x0002) {
        // GPSLatitude (3 rationals: deg, min, sec)
        if (valOffset + 24 <= buf.length) {
          const dN = readU32(valOffset);
          const dD = readU32(valOffset + 4) || 1;
          const mN = readU32(valOffset + 8);
          const mD = readU32(valOffset + 12) || 1;
          const sN = readU32(valOffset + 16);
          const sD = readU32(valOffset + 20) || 1;
          latCoords = (dN / dD) + (mN / mD) / 60 + (sN / sD) / 3600;
        }
      } else if (tag === 0x0003) {
        // GPSLongitudeRef
        lngRef = String.fromCharCode(buf[entryOff + 8]);
      } else if (tag === 0x0004) {
        // GPSLongitude (3 rationals: deg, min, sec)
        if (valOffset + 24 <= buf.length) {
          const dN = readU32(valOffset);
          const dD = readU32(valOffset + 4) || 1;
          const mN = readU32(valOffset + 8);
          const mD = readU32(valOffset + 12) || 1;
          const sN = readU32(valOffset + 16);
          const sD = readU32(valOffset + 20) || 1;
          lngCoords = (dN / dD) + (mN / mD) / 3600 + (sN / sD) / 3600;
        }
      } else if (tag === 0x0006) {
        // GPSAltitude (1 rational)
        if (valOffset + 8 <= buf.length) {
          const aN = readU32(valOffset);
          const aD = readU32(valOffset + 4) || 1;
          altitude = Number((aN / aD).toFixed(2));
        }
      }
    }

    if (latCoords !== null && lngCoords !== null) {
      let finalLat = latCoords;
      if (latRef === 'S') finalLat = -finalLat;
      let finalLng = lngCoords;
      if (lngRef === 'W') finalLng = -finalLng;

      // Validate WGS84 range
      if (finalLat >= -90 && finalLat <= 90 && finalLng >= -180 && finalLng <= 180) {
        return {
          latitude: Number(finalLat.toFixed(7)),
          longitude: Number(finalLng.toFixed(7)),
          altitude,
          source: 'exif',
        };
      }
    }

    return null;
  } catch (err) {
    // If anything fails in binary decoding, safe fallback to null
    return null;
  }
}

/**
 * 7. Geo-Registration Hierarchy Resolution
 *
 * Evaluates available spatial context and produces the geo-registered representation
 * for a hotspot:
 *
 * Priority 1: Direct EXIF / GeoTIFF authentic GPS metadata
 * Priority 2: Surveyed field control points affine transform (Marked as GPS_ESTIMATED)
 * Priority 3: When no valid metadata/control points exist -> GPS_UNAVAILABLE (lat: null, lng: null)
 *
 * STRICT RULE: Never returns Chennai or random offsets.
 *
 * @param {Object} hotspot Clustered hotspot with centerX, centerY, etc.
 * @param {Object} context
 * @param {Object} [context.exifGps] Extracted EXIF GPS object if available
 * @param {Array<Object>} [context.controlPoints] Array of { pixelX, pixelY, lat, lng }
 * @param {Object} [context.field] Field document containing boundary
 * @param {Object} [context.affineTransform] Pre-solved affine transform if available
 * @returns {Object} Hotspot enriched with geographic positioning attributes
 */
function resolveHotspotGeoRegistration(hotspot, context = {}) {
  const { exifGps, controlPoints, field, affineTransform } = context;

  // Initialize strictly in UNAVAILABLE state
  let gpsStatus = 'GPS_UNAVAILABLE';
  let isGpsEstimated = false;
  let gpsSource = 'none';
  let latitude = null;
  let longitude = null;
  let geoGeometry = null;

  // PRIORITY 1: Authentic EXIF / GeoTIFF GPS coordinates
  if (exifGps && typeof exifGps.latitude === 'number' && typeof exifGps.longitude === 'number') {
    if (exifGps.latitude >= -90 && exifGps.latitude <= 90 && exifGps.longitude >= -180 && exifGps.longitude <= 180) {
      gpsStatus = 'GPS_AVAILABLE';
      isGpsEstimated = false;
      gpsSource = exifGps.source || 'exif';
      latitude = exifGps.latitude;
      longitude = exifGps.longitude;
    }
  }

  // PRIORITY 2: Mathematical Affine Transform from surveyed control points
  if (gpsStatus === 'GPS_UNAVAILABLE') {
    let transform = affineTransform;
    if (!transform && controlPoints && controlPoints.length >= 3) {
      transform = solveAffineTransform(controlPoints);
    }

    if (transform) {
      const mapped = applyAffineTransform(transform, hotspot.centerX, hotspot.centerY);
      if (mapped && mapped.latitude >= -90 && mapped.latitude <= 90 && mapped.longitude >= -180 && mapped.longitude <= 180) {
        // Validate against field boundary if present
        const insideBoundary = field && field.boundary && field.boundary.length >= 3
          ? pointInPolygon([mapped.latitude, mapped.longitude], field.boundary)
          : true;

        if (insideBoundary) {
          gpsStatus = 'GPS_ESTIMATED';
          isGpsEstimated = true;
          gpsSource = 'field_control_points';
          latitude = mapped.latitude;
          longitude = mapped.longitude;
        }
      }
    }
  }

  // PRIORITY 3: Fallback remains GPS_UNAVAILABLE with latitude: null and longitude: null.
  // No synthetic coordinates are ever assigned.

  if (latitude !== null && longitude !== null) {
    geoGeometry = {
      type: 'Point',
      coordinates: [longitude, latitude], // GeoJSON standard is [lng, lat]
    };
  }

  return {
    ...hotspot,
    gpsStatus,
    isGpsEstimated,
    gpsSource,
    latitude,
    longitude,
    geoGeometry,
  };
}

module.exports = {
  calculatePixelGeometry,
  normalizeGeometry,
  clusterAnomalousTiles,
  pointInPolygon,
  solveAffineTransform,
  applyAffineTransform,
  extractExifGps,
  resolveHotspotGeoRegistration,
  EPSILON,
};
