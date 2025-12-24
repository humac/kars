import { createChildLogger } from './logger.js';

const logger = createChildLogger({ module: 'json' });

/**
 * Safely parse JSON with error handling
 * @param {string} value - JSON string to parse
 * @param {*} defaultValue - Value to return if parsing fails (default: null)
 * @returns {*} Parsed JSON or defaultValue
 */
export const safeJsonParse = (value, defaultValue = null) => {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    logger.error({ err: error }, 'JSON parse error');
    return defaultValue;
  }
};

/**
 * Safely parse JSON array
 * @param {string} value - JSON string to parse
 * @returns {Array} Parsed array or empty array
 */
export const safeJsonParseArray = (value) => {
  const result = safeJsonParse(value, []);
  return Array.isArray(result) ? result : [];
};

/**
 * Safely parse JSON object
 * @param {string} value - JSON string to parse
 * @returns {Object} Parsed object or empty object
 */
export const safeJsonParseObject = (value) => {
  const result = safeJsonParse(value, {});
  return result && typeof result === 'object' && !Array.isArray(result) ? result : {};
};
