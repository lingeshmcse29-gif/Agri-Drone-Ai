const logger = require('../utils/logger');

/**
 * Custom Application Error
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Centralized 404 Not Found Middleware
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested API route "${req.method} ${req.originalUrl}" was not found.`,
    },
  });
}

/**
 * Global Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An internal server error occurred.';
  let safeDetails = null;

  // 1. JSON Parse Error (Malformed body)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Malformed JSON request body.';
  }

  // 2. Request Payload Too Large
  else if (err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request payload exceeds the configured size limit.';
  }

  // 3. Multer errors
  else if (err.name === 'MulterError') {
    statusCode = 400;
    code = 'UPLOAD_ERROR';
    message = `File upload error: ${err.message}`;
  }

  // 4. Mongoose Validation Error
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Database validation failed.';
    if (err.errors) {
      safeDetails = Object.keys(err.errors).map((key) => ({
        field: key,
        message: err.errors[key].message,
      }));
    }
  }

  // 5. Mongoose CastError (e.g. invalid ObjectId)
  else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid identifier format for field "${err.path}".`;
  }

  // 6. JWT Authentication / Token Errors
  else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
    message = err.name === 'TokenExpiredError' ? 'Authentication token has expired.' : 'Invalid authentication token.';
  }

  // 7. CORS Error
  else if (err.code === 'CORS_ERROR' || (err.message && err.message.includes('CORS'))) {
    statusCode = 403;
    code = 'CORS_ERROR';
    message = 'Cross-Origin Request Blocked: Origin not permitted.';
  }

  // 8. Explicit AppError instances
  else if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    if (err.details && (process.env.NODE_ENV !== 'production' || typeof err.details === 'string')) {
      safeDetails = err.details;
    }
  }

  // 9. Unhandled 500 in Production: Sanitize sensitive details
  else {
    if (process.env.NODE_ENV === 'production') {
      message = 'An unexpected internal server error occurred.';
    }
  }

  // Log error with structured logger
  logger.error(`Error processing request: ${message}`, {
    requestId: req.id,
    route: req.originalUrl || req.url,
    statusCode,
    code,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });

  const responsePayload = {
    success: false,
    error: {
      code,
      message,
      ...(safeDetails ? { details: safeDetails } : {}),
    },
  };

  res.status(statusCode).json(responsePayload);
}

module.exports = {
  AppError,
  notFoundHandler,
  errorHandler,
};
