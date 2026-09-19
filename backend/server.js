const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { getConfig } = require('./config/env');
const { connectDB, closeDB, getDatabaseStatus } = require('./config/database');
const logger = require('./utils/logger');
const requestIdMiddleware = require('./middleware/requestIdMiddleware');
const requestLogger = require('./middleware/requestLogger');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

// 1. Validate and load configuration (Fails fast on missing or invalid env)
const config = getConfig();

const app = express();

// 2. Security Headers (via Helmet)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", ...config.CORS_ORIGINS],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    hsts: config.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  })
);

// 3. Request ID middleware (attaches req.id & X-Request-ID header)
app.use(requestIdMiddleware);

// 4. Request tracing and structured logging
app.use(requestLogger);

// 5. Configuration-driven Restrictive CORS
const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server, health checks)
    if (!origin) {
      return callback(null, true);
    }
    if (config.CORS_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    const corsErr = new Error(`Origin "${origin}" is not allowed by CORS`);
    corsErr.code = 'CORS_ERROR';
    corsErr.statusCode = 403;
    return callback(corsErr, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: false,
  maxAge: 86400, // 24 hours preflight cache
};

app.use(cors(corsOptions));
// Explicitly support preflight OPTIONS across all routes
app.options('*', cors(corsOptions));

// 6. Request Body Size Limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 7. Static file serving for uploads (safe relative path)
const uploadsStaticPath = path.isAbsolute(config.UPLOAD_DIR)
  ? config.UPLOAD_DIR
  : path.resolve(__dirname, config.UPLOAD_DIR);
app.use('/uploads', express.static(uploadsStaticPath));

// 8. Health Monitoring Endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = getDatabaseStatus();
  const isHealthy = dbStatus === 'connected';

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    data: {
      status: isHealthy ? 'healthy' : 'degraded',
      mode: config.APP_MODE,
      database: dbStatus,
      uptime: Math.floor(process.uptime()),
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
  });
});

// 9. Root Route
app.get('/', (req, res) => {
  const dbStatus = getDatabaseStatus();
  res.json({
    message: 'Agri-Drone AI Precision Agriculture API',
    mode: config.APP_MODE,
    version: '1.0.0',
    database: dbStatus,
    ollamaModel: config.OLLAMA_MODEL,
    timestamp: new Date().toISOString(),
  });
});

// 10. Core Application API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/fields', require('./routes/fieldRoutes'));
app.use('/api/scans', require('./routes/scanRoutes'));
app.use('/api/hotspots', require('./routes/hotspotRoutes'));
app.use('/api/weather', require('./routes/weatherRoutes'));
app.use('/api/alerts', require('./routes/alertRoutes'));
app.use('/api/recommendations', require('./routes/recommendationRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));

// 11. Centralized 404 Route Not Found Handler
app.use(notFoundHandler);

// 12. Centralized Global Error Handler
app.use(errorHandler);

// HTTP Server instance handle for graceful shutdown
let server = null;

const { startWorker, stopWorker } = require('./services/pipelineWorker');

/**
 * Initializes database, starts the background worker, and starts the HTTP server.
 */
const startServer = async (port = config.PORT) => {
  try {
    // Controlled database connection
    await connectDB();

    // Initialize background pipeline worker and recover any unfinished jobs
    await startWorker();

    return new Promise((resolve) => {
      server = app.listen(port, () => {
        logger.info(`AgriDrone AI Backend started`, {
          port,
          mode: config.APP_MODE,
          env: config.NODE_ENV,
          corsAllowed: config.CORS_ORIGINS,
          ollamaModel: config.OLLAMA_MODEL,
        });
        resolve(server);
      });
    });
  } catch (err) {
    logger.error(`Fatal server startup error: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }
};

/**
 * Graceful Shutdown Handler
 */
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);
  stopWorker();

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      await closeDB();
      logger.info('Shutdown complete.');
      process.exit(0);
    });
  } else {
    await closeDB();
    process.exit(0);
  }

  // Safety fallback: force exit if shutdown hangs over 10s
  setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// If executed directly from command line, start server
if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
  gracefulShutdown,
};
