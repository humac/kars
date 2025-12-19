/**
 * Structured logging utility using pino
 * Provides consistent, structured logging across the application
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';

// Create base logger configuration
const loggerConfig = {
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : (isDevelopment ? 'debug' : 'info')),
  // Use pretty printing in development for readability
  ...(isDevelopment && !isTest && {
    transport: {
      target: 'pino/file',
      options: { destination: 1 } // stdout
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
  }),
  // Base context included in all logs
  base: {
    pid: process.pid,
    env: process.env.NODE_ENV || 'development',
  },
  // Custom timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,
};

// Create the logger instance
const logger = pino(loggerConfig);

/**
 * Create a child logger with additional context
 * @param {Object} bindings - Additional context to include in all logs
 * @returns {Object} Child logger instance
 *
 * @example
 * const routeLogger = createChildLogger({ module: 'assets' });
 * routeLogger.info({ assetId: 123 }, 'Asset created');
 */
export const createChildLogger = (bindings) => {
  return logger.child(bindings);
};

/**
 * Log an error with consistent formatting
 * @param {Error|string} error - Error object or message
 * @param {string} message - Description of what was happening
 * @param {Object} context - Additional context
 */
export const logError = (error, message, context = {}) => {
  if (error instanceof Error) {
    logger.error({
      err: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      ...context,
    }, message);
  } else {
    logger.error({ error, ...context }, message);
  }
};

/**
 * Log an info message with context
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 */
export const logInfo = (message, context = {}) => {
  logger.info(context, message);
};

/**
 * Log a debug message with context
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 */
export const logDebug = (message, context = {}) => {
  logger.debug(context, message);
};

/**
 * Log a warning message with context
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 */
export const logWarn = (message, context = {}) => {
  logger.warn(context, message);
};

/**
 * Log an HTTP request (for middleware use)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} message - Optional message
 */
export const logRequest = (req, res, message = 'HTTP Request') => {
  logger.info({
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    userId: req.user?.id,
    userEmail: req.user?.email,
  }, message);
};

/**
 * Log a database operation
 * @param {string} operation - Operation type (CREATE, UPDATE, DELETE, etc.)
 * @param {string} table - Table/resource name
 * @param {Object} context - Additional context (id, user, etc.)
 */
export const logDbOperation = (operation, table, context = {}) => {
  logger.debug({
    operation,
    table,
    ...context,
  }, `Database ${operation} on ${table}`);
};

// Export the base logger for direct use
export default logger;
