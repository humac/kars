/**
 * Standardized API response helpers
 * Ensures consistent response format across all endpoints
 */

import { createChildLogger } from './logger.js';

const logger = createChildLogger({ module: 'responses' });

/**
 * Send a success response
 * @param {Object} res - Express response object
 * @param {*} data - Response data (can be object, array, or primitive)
 * @param {Object} options - Additional options
 * @param {string} [options.message] - Optional success message
 * @param {number} [options.statusCode=200] - HTTP status code
 *
 * @example
 * // Simple data response
 * successResponse(res, { user: userData });
 *
 * // With message
 * successResponse(res, { asset }, { message: 'Asset created successfully' });
 *
 * // With 201 status
 * successResponse(res, { user }, { statusCode: 201, message: 'User registered' });
 */
export const successResponse = (res, data, options = {}) => {
  const { message = null, statusCode = 200 } = options;

  const response = {
    success: true,
    ...data,
  };

  if (message) {
    response.message = message;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send an error response
 * @param {Object} res - Express response object
 * @param {string} message - User-friendly error message
 * @param {Object} options - Additional options
 * @param {number} [options.statusCode=500] - HTTP status code
 * @param {string} [options.code] - Machine-readable error code
 * @param {Object} [options.details] - Additional error details (dev only)
 *
 * @example
 * // Simple error
 * errorResponse(res, 'Asset not found', { statusCode: 404 });
 *
 * // With error code
 * errorResponse(res, 'Invalid credentials', {
 *   statusCode: 401,
 *   code: 'INVALID_CREDENTIALS'
 * });
 *
 * // Validation error with details
 * errorResponse(res, 'Validation failed', {
 *   statusCode: 400,
 *   code: 'VALIDATION_ERROR',
 *   details: { required: ['email', 'password'] }
 * });
 */
export const errorResponse = (res, message, options = {}) => {
  const { statusCode = 500, code = null, details = null } = options;

  const response = {
    success: false,
    error: message,
  };

  if (code) {
    response.code = code;
  }

  if (details && process.env.NODE_ENV !== 'production') {
    response.details = details;
  }

  return res.status(statusCode).json(response);
};

/**
 * Common error response shortcuts
 */

export const badRequest = (res, message, details = null) =>
  errorResponse(res, message, { statusCode: 400, code: 'BAD_REQUEST', details });

export const unauthorized = (res, message = 'Authentication required') =>
  errorResponse(res, message, { statusCode: 401, code: 'UNAUTHORIZED' });

export const forbidden = (res, message = 'You do not have permission to perform this action') =>
  errorResponse(res, message, { statusCode: 403, code: 'FORBIDDEN' });

export const notFound = (res, resource = 'Resource') =>
  errorResponse(res, `${resource} not found`, { statusCode: 404, code: 'NOT_FOUND' });

export const conflict = (res, message) =>
  errorResponse(res, message, { statusCode: 409, code: 'CONFLICT' });

export const serverError = (res, error = null) => {
  // Log the actual error for debugging
  if (error) {
    logger.error({ err: error }, 'Server error');
  }

  return errorResponse(res, 'An internal server error occurred', {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
  });
};

/**
 * Pagination helper for list responses
 * @param {Object} res - Express response object
 * @param {Array} items - Array of items
 * @param {Object} pagination - Pagination info
 * @param {number} pagination.page - Current page
 * @param {number} pagination.limit - Items per page
 * @param {number} pagination.total - Total items count
 *
 * @example
 * paginatedResponse(res, assets, {
 *   page: 1,
 *   limit: 50,
 *   total: 150
 * });
 */
export const paginatedResponse = (res, items, pagination) => {
  const { page, limit, total } = pagination;
  const totalPages = Math.ceil(total / limit);

  return successResponse(res, {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  });
};
