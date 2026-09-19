const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getConfig } = require('../config/env');
const { AppError } = require('./errorMiddleware');

// Ensure base upload and drone directories exist safely
function getDroneUploadDir() {
  const config = getConfig();
  const baseUploadDir = path.isAbsolute(config.UPLOAD_DIR)
    ? config.UPLOAD_DIR
    : path.resolve(__dirname, '..', config.UPLOAD_DIR);

  const droneDir = path.join(baseUploadDir, 'drone');
  if (!fs.existsSync(droneDir)) {
    fs.mkdirSync(droneDir, { recursive: true });
  }
  return droneDir;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const dir = getDroneUploadDir();
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    // Generate safe, cryptographically random filename with sanitized extension
    const randomHex = crypto.randomBytes(12).toString('hex');
    const rawExt = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const safeExt = rawExt && rawExt.startsWith('.') ? rawExt : '.jpg';
    cb(null, `drone_${Date.now()}_${randomHex}${safeExt}`);
  },
});

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif']);
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/x-tiff',
  'application/octet-stream',
]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(
      new AppError(
        `Unsupported file extension: "${ext}". Allowed types: JPG, PNG, WEBP, TIFF.`,
        400,
        'INVALID_FILE_TYPE'
      ),
      false
    );
  }

  if (mime && !ALLOWED_MIME_TYPES.has(mime) && !mime.startsWith('image/')) {
    return cb(
      new AppError(
        `Unsupported MIME type: "${mime}". Only valid image formats are allowed.`,
        400,
        'INVALID_MIME_TYPE'
      ),
      false
    );
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: (getConfig()?.MAX_UPLOAD_SIZE_MB || 50) * 1024 * 1024,
    files: 10,
  },
});

module.exports = upload;
