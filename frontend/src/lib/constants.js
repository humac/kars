/**
 * Shared constants for the KARS application
 * These values must match the backend validation in server.js
 */

/**
 * Valid asset status options
 * Must match backend validStatuses array in server.js
 */
export const ASSET_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'returned', label: 'Returned' },
  { value: 'lost', label: 'Lost' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'retired', label: 'Retired' },
];
