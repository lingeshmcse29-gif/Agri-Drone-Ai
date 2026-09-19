const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { getConfig } = require('./env');
const logger = require('../utils/logger');

let mongoMemoryServer = null;
let isMemoryDb = false;

/**
 * Sanitizes MongoDB connection URI to mask credentials in log messages.
 */
function sanitizeMongoUri(uri) {
  if (!uri) return '';
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
}

/**
 * Returns current database connectivity status.
 * @returns {'connected' | 'connecting' | 'disconnecting' | 'disconnected'}
 */
function getDatabaseStatus() {
  switch (mongoose.connection.readyState) {
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    case 0:
    default:
      return 'disconnected';
  }
}

/**
 * Helper delay function
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Connects to MongoDB with retry logic, exponential backoff,
 * and strict LIVE vs DEMO environment isolation.
 */
const connectDB = async ({ maxRetries = 3, initialDelayMs = 1000 } = {}) => {
  const config = getConfig();
  const uri = config.MONGO_URI;
  const sanitizedUri = sanitizeMongoUri(uri);

  logger.info(`[Database] Initializing connection in ${config.APP_MODE} mode...`);

  // If DEMO mode explicitly requests memory DB upfront without attempting local connection:
  if (config.isDemo && config.USE_MEMORY_DB) {
    logger.info('[Database] DEMO mode with USE_MEMORY_DB=true: starting in-memory MongoMemoryServer...');
    mongoMemoryServer = await MongoMemoryServer.create();
    const memoryUri = mongoMemoryServer.getUri();
    await mongoose.connect(memoryUri);
    isMemoryDb = true;
    logger.info(`[Database] Connected to in-memory database at ${memoryUri}`);
    return;
  }

  // Controlled retry loop with exponential backoff for real MongoDB connection
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`[Database] Connection attempt ${attempt}/${maxRetries} to ${sanitizedUri}...`);
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 3000,
      });
      isMemoryDb = false;
      logger.info(`[Database] Successfully connected to MongoDB at ${sanitizedUri}`);
      return;
    } catch (err) {
      lastError = err;
      logger.warn(`[Database] Connection attempt ${attempt} failed: ${err.message}`);

      if (attempt < maxRetries) {
        const delay = initialDelayMs * Math.pow(2, attempt - 1);
        logger.info(`[Database] Retrying connection in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  logger.error(`[Database] Exhausted all ${maxRetries} connection attempts to ${sanitizedUri}. Error: ${lastError?.message}`);

  // In LIVE mode: NEVER fall back to in-memory DB. Fail fast and clearly.
  if (config.isLive) {
    const liveError = new Error(
      `[Database] FATAL: Real MongoDB connection failed in LIVE mode (${lastError?.message}). ` +
      `Fallback to in-memory database is strictly prohibited in LIVE mode.`
    );
    throw liveError;
  }

  // In DEMO mode: Permitted to fallback to in-memory DB ONLY for local demonstration
  if (config.isDemo) {
    logger.warn('[Database] Local MongoDB unavailable in DEMO mode. Falling back to in-memory MongoMemoryServer for demonstration...');
    try {
      mongoMemoryServer = await MongoMemoryServer.create();
      const memoryUri = mongoMemoryServer.getUri();
      await mongoose.connect(memoryUri);
      isMemoryDb = true;
      logger.info(`[Database] Connected to DEMO in-memory database at ${memoryUri}`);
      return;
    } catch (memErr) {
      logger.error(`[Database] In-memory database initialization error: ${memErr.message}`);
      throw memErr;
    }
  }

  throw lastError;
};

/**
 * Gracefully closes MongoDB connection and any in-memory instance.
 */
const closeDB = async () => {
  logger.info('[Database] Closing database connections...');
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.info('[Database] Mongoose connection closed.');
    }
    if (mongoMemoryServer) {
      await mongoMemoryServer.stop();
      mongoMemoryServer = null;
      logger.info('[Database] MongoMemoryServer stopped.');
    }
    isMemoryDb = false;
  } catch (err) {
    logger.error(`[Database] Error during database shutdown: ${err.message}`);
  }
};

module.exports = {
  connectDB,
  closeDB,
  getDatabaseStatus,
  isMemoryDb: () => isMemoryDb,
  sanitizeMongoUri,
};
