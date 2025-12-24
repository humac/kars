/**
 * Validation middleware for Express routes
 * Reduces boilerplate validation code in route handlers
 */

import { EMAIL_REGEX, VALID_STATUSES, VALID_ROLES } from '../utils/constants.js';

/**
 * Middleware that requires specific fields to be present in request body
 * @param {...string} fields - Field names that must be present and non-empty
 * @returns {Function} Express middleware function
 *
 * @example
 * app.post('/api/login', requireFields('email', 'password'), handler);
 */
export const requireFields = (...fields) => (req, res, next) => {
  const missing = fields.filter(field => {
    const value = req.body[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      error: `Missing required fields: ${missing.join(', ')}`,
      required: fields,
    });
  }

  next();
};

/**
 * Middleware that validates email format in request body
 * @param {string} [fieldName='email'] - The field name containing the email
 * @returns {Function} Express middleware function
 *
 * @example
 * app.post('/api/users', validateEmail(), handler);
 * app.post('/api/invite', validateEmail('recipient_email'), handler);
 */
export const validateEmail = (fieldName = 'email') => (req, res, next) => {
  const email = req.body[fieldName];

  if (!email) {
    // If email is not provided, let requireFields handle it
    return next();
  }

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({
      success: false,
      error: `Invalid email format for field: ${fieldName}`,
    });
  }

  // Normalize email to lowercase and trimmed
  req.body[fieldName] = email.trim().toLowerCase();
  next();
};

/**
 * Middleware that validates status value in request body
 * @param {string} [fieldName='status'] - The field name containing the status
 * @returns {Function} Express middleware function
 *
 * @example
 * app.patch('/api/assets/:id/status', validateStatus(), handler);
 */
export const validateStatus = (fieldName = 'status') => (req, res, next) => {
  const status = req.body[fieldName];

  if (!status) {
    return next();
  }

  const normalizedStatus = String(status).toLowerCase();
  if (!VALID_STATUSES.includes(normalizedStatus)) {
    return res.status(400).json({
      success: false,
      error: `Invalid status: '${status}'. Valid statuses: ${VALID_STATUSES.join(', ')}`,
      validStatuses: VALID_STATUSES,
    });
  }

  req.body[fieldName] = normalizedStatus;
  next();
};

/**
 * Middleware that validates role value in request body
 * @param {string} [fieldName='role'] - The field name containing the role
 * @returns {Function} Express middleware function
 *
 * @example
 * app.put('/api/users/:id/role', validateRole(), handler);
 */
export const validateRole = (fieldName = 'role') => (req, res, next) => {
  const role = req.body[fieldName];

  if (!role) {
    return next();
  }

  const normalizedRole = String(role).toLowerCase();
  if (!VALID_ROLES.includes(normalizedRole)) {
    return res.status(400).json({
      success: false,
      error: `Invalid role: '${role}'. Valid roles: ${VALID_ROLES.join(', ')}`,
      validRoles: VALID_ROLES,
    });
  }

  req.body[fieldName] = normalizedRole;
  next();
};

/**
 * Middleware that validates an array of IDs in request body
 * @param {string} [fieldName='ids'] - The field name containing the array
 * @returns {Function} Express middleware function
 *
 * @example
 * app.delete('/api/assets/bulk', validateIdArray('assetIds'), handler);
 */
export const validateIdArray = (fieldName = 'ids') => (req, res, next) => {
  const ids = req.body[fieldName];

  if (!ids) {
    return res.status(400).json({
      success: false,
      error: `Missing required field: ${fieldName}`,
    });
  }

  if (!Array.isArray(ids)) {
    return res.status(400).json({
      success: false,
      error: `Field '${fieldName}' must be an array`,
    });
  }

  if (ids.length === 0) {
    return res.status(400).json({
      success: false,
      error: `Field '${fieldName}' cannot be empty`,
    });
  }

  // Validate all IDs are numbers or can be converted to numbers
  const invalidIds = ids.filter(id => isNaN(Number(id)));
  if (invalidIds.length > 0) {
    return res.status(400).json({
      success: false,
      error: `Invalid IDs in '${fieldName}': ${invalidIds.join(', ')}`,
    });
  }

  // Normalize IDs to numbers
  req.body[fieldName] = ids.map(id => Number(id));
  next();
};

/**
 * Middleware that validates pagination parameters in query string
 * @param {Object} options - Pagination options
 * @param {number} [options.defaultLimit=50] - Default page size
 * @param {number} [options.maxLimit=1000] - Maximum allowed page size
 * @returns {Function} Express middleware function
 *
 * @example
 * app.get('/api/assets', validatePagination({ maxLimit: 100 }), handler);
 */
export const validatePagination = (options = {}) => (req, res, next) => {
  const { defaultLimit = 50, maxLimit = 1000 } = options;

  let page = parseInt(req.query.page, 10);
  let limit = parseInt(req.query.limit, 10);

  // Default values
  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  // Attach normalized values to request
  req.pagination = {
    page,
    limit,
    offset: (page - 1) * limit,
  };

  next();
};
