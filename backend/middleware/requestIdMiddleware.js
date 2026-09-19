const crypto = require('crypto');

/**
 * Request ID Middleware
 * Assigns or propagates a unique request identifier (UUIDv4)
 * and attaches it to request and response headers.
 */
function requestIdMiddleware(req, res, next) {
  // Check incoming header, validate alphanumeric and hyphen only (up to 64 chars) to prevent injection
  const incoming = req.headers['x-request-id'];
  let requestId;
  if (incoming && typeof incoming === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(incoming)) {
    requestId = incoming;
  } else {
    requestId = crypto.randomUUID();
  }

  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

module.exports = requestIdMiddleware;
