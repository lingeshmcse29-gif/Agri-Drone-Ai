const jwt = require('jsonwebtoken');
const { getConfig } = require('../config/env');
const { AppError } = require('./errorMiddleware');

/**
 * Authentication middleware that requires a valid JWT Bearer token.
 */
function protect(req, res, next) {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Authentication required. Missing Bearer token.', 401, 'UNAUTHORIZED'));
  }

  try {
    const config = getConfig();
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return next(new AppError('Invalid or expired authentication token.', 401, 'UNAUTHORIZED'));
  }
}

/**
 * Optional authentication middleware: populates req.user if valid token present,
 * but does not reject unauthenticated requests.
 */
function optionalAuth(req, res, next) {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const config = getConfig();
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
  } catch {
    req.user = null;
  }

  next();
}

module.exports = {
  protect,
  optionalAuth,
};
