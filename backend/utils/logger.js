/**
 * Structured Logger for AgriDrone AI Backend
 * Logs JSON-formatted structured messages in production,
 * and clean formatted messages in development.
 * Automatically redacts sensitive fields like passwords, tokens, and authorization headers.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'jwt_secret',
  'authorization',
  'token',
  'secret',
  'apikey',
  'api_key',
  'base64',
  'imagebase64'
]);

/**
 * Recursively redacts sensitive keys from an object.
 */
function sanitize(obj, depth = 0) {
  if (depth > 4 || !obj || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitize(item, depth + 1));
  }
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitize(value, depth + 1);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getActiveLogLevel() {
  const envLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return LOG_LEVELS[envLevel] !== undefined ? LOG_LEVELS[envLevel] : LOG_LEVELS.info;
}

function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const cleanMeta = sanitize(meta);
  return JSON.stringify({
    timestamp,
    level: level.toUpperCase(),
    message,
    ...cleanMeta,
  });
}

const logger = {
  debug: (message, meta) => {
    if (getActiveLogLevel() <= LOG_LEVELS.debug) {
      console.debug(formatLog('debug', message, meta));
    }
  },
  info: (message, meta) => {
    if (getActiveLogLevel() <= LOG_LEVELS.info) {
      console.log(formatLog('info', message, meta));
    }
  },
  warn: (message, meta) => {
    if (getActiveLogLevel() <= LOG_LEVELS.warn) {
      console.warn(formatLog('warn', message, meta));
    }
  },
  error: (message, meta) => {
    if (getActiveLogLevel() <= LOG_LEVELS.error) {
      console.error(formatLog('error', message, meta));
    }
  },
  sanitize,
};

module.exports = logger;
