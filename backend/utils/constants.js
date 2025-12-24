/**
 * Shared constants for the ACS backend
 * Centralizes validation values and configuration constants
 */

/**
 * Valid asset statuses
 * Used in: CSV import, status updates, bulk status changes
 */
export const VALID_STATUSES = ['active', 'returned', 'lost', 'damaged', 'retired'];

/**
 * Default asset types (used when dynamic asset types not configured)
 * Note: The app supports dynamic asset types via assetTypeDb
 * These are fallback defaults for validation
 */
export const DEFAULT_ASSET_TYPES = ['laptop', 'mobile_phone'];

/**
 * Valid user roles in the system
 * Ordered from lowest to highest privilege
 */
export const VALID_ROLES = ['employee', 'manager', 'attestation_coordinator', 'admin'];

/**
 * Role hierarchy for permission checks
 * Higher number = more privileges
 */
export const ROLE_HIERARCHY = {
  employee: 1,
  manager: 2,
  attestation_coordinator: 3,
  admin: 4,
};

/**
 * Roles that can view all assets (not just their own)
 */
export const ASSET_VIEW_ALL_ROLES = ['admin', 'manager', 'attestation_coordinator'];

/**
 * Roles that can manage users
 */
export const USER_MANAGEMENT_ROLES = ['admin'];

/**
 * Roles that can view audit logs
 */
export const AUDIT_VIEW_ROLES = ['admin', 'manager', 'attestation_coordinator'];

/**
 * Roles that can manage attestation campaigns
 */
export const ATTESTATION_ADMIN_ROLES = ['admin', 'attestation_coordinator'];

/**
 * Roles that can view attestation campaigns
 */
export const ATTESTATION_VIEW_ROLES = ['admin', 'attestation_coordinator', 'manager'];

/**
 * Required fields for asset creation
 */
export const ASSET_REQUIRED_FIELDS = [
  'employee_first_name',
  'employee_last_name',
  'employee_email',
  'company_name',
  'asset_type',
  'serial_number',
  'asset_tag',
];

/**
 * Required fields for CSV import columns
 */
export const CSV_IMPORT_REQUIRED_COLUMNS = [
  'employee_first_name',
  'employee_last_name',
  'employee_email',
  'company',
  'asset_type',
  'serial_number',
  'asset_tag',
];

/**
 * Email validation regex
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate an email address
 * @param {string} email - Email address to validate
 * @returns {boolean} - Whether the email is valid
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
};

/**
 * Validate a status value
 * @param {string} status - Status to validate
 * @returns {boolean} - Whether the status is valid
 */
export const isValidStatus = (status) => {
  if (!status || typeof status !== 'string') return false;
  return VALID_STATUSES.includes(status.toLowerCase());
};

/**
 * Validate a role value
 * @param {string} role - Role to validate
 * @returns {boolean} - Whether the role is valid
 */
export const isValidRole = (role) => {
  if (!role || typeof role !== 'string') return false;
  return VALID_ROLES.includes(role.toLowerCase());
};

/**
 * Check if a user has a specific role or higher
 * @param {string} userRole - The user's current role
 * @param {string} requiredRole - The minimum required role
 * @returns {boolean} - Whether the user has sufficient privileges
 */
export const hasRoleOrHigher = (userRole, requiredRole) => {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
};
