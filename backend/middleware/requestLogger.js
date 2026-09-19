const logger = require('../utils/logger');

/**
 * Structured Request Logging Middleware
 * Records request metadata, timing, and response status.
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const userId = req.user ? (req.user.id || req.user._id) : undefined;
    const scanId = req.params?.scanId || req.params?.id || req.query?.scanId || undefined;

    logger.info(`HTTP ${req.method} ${req.originalUrl || req.url} ${res.statusCode} (${durationMs}ms)`, {
      requestId: req.id,
      method: req.method,
      route: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs,
      ...(userId ? { userId: String(userId) } : {}),
      ...(scanId ? { scanId: String(scanId) } : {}),
    });
  });

  next();
}

module.exports = requestLogger;
