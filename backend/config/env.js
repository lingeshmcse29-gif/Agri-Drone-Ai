const path = require('path');
const dotenv = require('dotenv');

// Load .env file from the backend root directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Validates and normalizes environment configuration.
 * Can be called with a custom dictionary for isolated unit testing.
 *
 * @param {Object} [customSource] - Optional environment variable dictionary
 * @returns {Readonly<Object>} Validated and normalized configuration
 */
function validateAndLoadConfig(customSource) {
  const source = customSource || process.env;

  // 1. APP_MODE validation (strictly LIVE or DEMO)
  const rawAppMode = (source.APP_MODE || '').trim().toUpperCase();
  if (!rawAppMode) {
    throw new Error('Configuration Error: APP_MODE is required. Allowed values are LIVE or DEMO.');
  }
  if (rawAppMode !== 'LIVE' && rawAppMode !== 'DEMO') {
    throw new Error(`Configuration Error: Invalid APP_MODE "${source.APP_MODE}". Allowed values are LIVE or DEMO.`);
  }

  // 2. NODE_ENV validation
  const nodeEnv = (source.NODE_ENV || 'development').trim().toLowerCase();
  const validNodeEnvs = ['development', 'production', 'test'];
  if (!validNodeEnvs.includes(nodeEnv)) {
    throw new Error(`Configuration Error: Invalid NODE_ENV "${source.NODE_ENV}". Allowed values are development, production, test.`);
  }

  // 3. PORT validation
  const rawPort = source.PORT !== undefined && source.PORT !== null && String(source.PORT).trim() !== ''
    ? String(source.PORT).trim()
    : '5000';
  const port = parseInt(rawPort, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Configuration Error: Invalid PORT "${source.PORT}". Must be an integer between 1 and 65535.`);
  }

  // 4. MONGO_URI validation (canonical name with MONGODB_URI fallback migration support)
  const mongoUri = (source.MONGO_URI || source.MONGODB_URI || '').trim();
  if (!mongoUri) {
    throw new Error('Configuration Error: MONGO_URI is required.');
  }
  if (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
    throw new Error('Configuration Error: MONGO_URI must begin with "mongodb://" or "mongodb+srv://".');
  }

  // 5. JWT_SECRET validation
  const jwtSecret = (source.JWT_SECRET || '').trim();
  if (!jwtSecret) {
    throw new Error('Configuration Error: JWT_SECRET is mandatory.');
  }
  const knownWeakSecrets = [
    'secret',
    'jwt_secret',
    'your_jwt_secret_here',
    'replace_with_a_strong_secret',
    'change_this_secret',
    '123456',
    'password',
    'admin'
  ];
  if (rawAppMode === 'LIVE') {
    if (jwtSecret.length < 16) {
      throw new Error('Configuration Error: In LIVE mode, JWT_SECRET must be at least 16 characters long.');
    }
    if (knownWeakSecrets.includes(jwtSecret.toLowerCase())) {
      throw new Error('Configuration Error: In LIVE mode, JWT_SECRET cannot be a known weak or placeholder secret.');
    }
  }

  // 6. OLLAMA_URL validation
  const rawOllamaUrl = (source.OLLAMA_URL || '').trim();
  if (!rawOllamaUrl) {
    throw new Error('Configuration Error: OLLAMA_URL is required.');
  }
  try {
    const parsedOllamaUrl = new URL(rawOllamaUrl);
    if (!['http:', 'https:'].includes(parsedOllamaUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    throw new Error(`Configuration Error: Invalid OLLAMA_URL "${source.OLLAMA_URL}". Must be a valid HTTP/HTTPS URL.`);
  }

  // 7. OLLAMA_MODEL validation
  const ollamaModel = (source.OLLAMA_MODEL || '').trim();
  if (!ollamaModel) {
    throw new Error('Configuration Error: OLLAMA_MODEL is required.');
  }

  // 8. UPLOAD_DIR validation
  const uploadDir = (source.UPLOAD_DIR || '').trim();
  if (!uploadDir) {
    throw new Error('Configuration Error: UPLOAD_DIR is required.');
  }
  // Prevent relative traversal attacks like ../../etc
  if (uploadDir.includes('..') && !path.isAbsolute(uploadDir)) {
    const resolved = path.resolve(__dirname, '..', uploadDir);
    const backendRoot = path.resolve(__dirname, '..');
    if (!resolved.startsWith(backendRoot)) {
      throw new Error(`Configuration Error: Invalid UPLOAD_DIR "${source.UPLOAD_DIR}". Path traversal outside backend is prohibited.`);
    }
  }

  // 9. FRONTEND_URL validation
  const frontendUrl = (source.FRONTEND_URL || '').trim();
  if (!frontendUrl) {
    throw new Error('Configuration Error: FRONTEND_URL is required.');
  }
  try {
    const parsedFrontendUrl = new URL(frontendUrl);
    if (!['http:', 'https:'].includes(parsedFrontendUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    throw new Error(`Configuration Error: Invalid FRONTEND_URL "${source.FRONTEND_URL}". Must be a valid HTTP/HTTPS URL.`);
  }

  // 10. CORS_ORIGINS parsing & validation
  const rawCorsOrigins = source.CORS_ORIGINS
    ? String(source.CORS_ORIGINS).split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const corsOriginsSet = new Set(rawCorsOrigins);
  corsOriginsSet.add(frontendUrl);
  // Support 127.0.0.1 variant for local development convenience
  if (frontendUrl === 'http://localhost:5173') {
    corsOriginsSet.add('http://127.0.0.1:5173');
  }
  const corsOrigins = Array.from(corsOriginsSet);
  if (corsOrigins.includes('*')) {
    throw new Error('Configuration Error: Wildcard "*" is strictly forbidden in CORS_ORIGINS for authenticated APIs.');
  }

  // 11. Auxiliary configurations
  const maxUploadSizeMb = parseInt(source.MAX_UPLOAD_SIZE_MB || '50', 10);
  if (isNaN(maxUploadSizeMb) || maxUploadSizeMb <= 0) {
    throw new Error('Configuration Error: MAX_UPLOAD_SIZE_MB must be a positive integer.');
  }

  const ollamaTimeoutMs = parseInt(source.OLLAMA_TIMEOUT_MS || '60000', 10);
  if (isNaN(ollamaTimeoutMs) || ollamaTimeoutMs <= 0) {
    throw new Error('Configuration Error: OLLAMA_TIMEOUT_MS must be a positive integer.');
  }

  const ollamaMaxRetries = parseInt(source.OLLAMA_MAX_RETRIES || '3', 10);
  if (isNaN(ollamaMaxRetries) || ollamaMaxRetries < 0) {
    throw new Error('Configuration Error: OLLAMA_MAX_RETRIES must be a non-negative integer.');
  }

  const ollamaMaxConcurrency = parseInt(source.OLLAMA_MAX_CONCURRENCY || '2', 10);
  if (isNaN(ollamaMaxConcurrency) || ollamaMaxConcurrency <= 0) {
    throw new Error('Configuration Error: OLLAMA_MAX_CONCURRENCY must be a positive integer.');
  }

  const pipelineConcurrency = parseInt(source.PIPELINE_CONCURRENCY || '1', 10);
  if (isNaN(pipelineConcurrency) || pipelineConcurrency <= 0) {
    throw new Error('Configuration Error: PIPELINE_CONCURRENCY must be a positive integer.');
  }

  const logLevel = (source.LOG_LEVEL || 'info').trim().toLowerCase();
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(logLevel)) {
    throw new Error(`Configuration Error: Invalid LOG_LEVEL "${source.LOG_LEVEL}". Must be one of: debug, info, warn, error.`);
  }

  // 12. Memory DB usage flag
  // In LIVE mode, memory DB is strictly forbidden regardless of USE_MEMORY_DB flag
  const rawUseMemoryDb = String(source.USE_MEMORY_DB || '').trim().toLowerCase() === 'true';
  const useMemoryDb = rawAppMode === 'LIVE' ? false : rawUseMemoryDb;

  return Object.freeze({
    APP_MODE: rawAppMode,
    NODE_ENV: nodeEnv,
    PORT: port,
    MONGO_URI: mongoUri,
    JWT_SECRET: jwtSecret,
    OLLAMA_URL: rawOllamaUrl,
    OLLAMA_MODEL: ollamaModel,
    UPLOAD_DIR: uploadDir,
    FRONTEND_URL: frontendUrl,
    CORS_ORIGINS: corsOrigins,
    MAX_UPLOAD_SIZE_MB: maxUploadSizeMb,
    OLLAMA_TIMEOUT_MS: ollamaTimeoutMs,
    OLLAMA_MAX_RETRIES: ollamaMaxRetries,
    OLLAMA_MAX_CONCURRENCY: ollamaMaxConcurrency,
    PIPELINE_CONCURRENCY: pipelineConcurrency,
    LOG_LEVEL: logLevel,
    USE_MEMORY_DB: useMemoryDb,
    isLive: rawAppMode === 'LIVE',
    isDemo: rawAppMode === 'DEMO',
  });
}

// Instantiate default config from active process.env
let config;
try {
  config = validateAndLoadConfig();
} catch (err) {
  // If running in test runner or before .env is prepared, allow config to be lazy loaded
  config = null;
}

function reloadConfig(customSource) {
  config = validateAndLoadConfig(customSource);
  return config;
}

module.exports = {
  getConfig: () => {
    if (!config) {
      config = validateAndLoadConfig();
    }
    return config;
  },
  validateAndLoadConfig,
  reloadConfig,
};
