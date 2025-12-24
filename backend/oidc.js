import * as client from 'openid-client';
import { createChildLogger } from './utils/logger.js';

const logger = createChildLogger({ module: 'oidc-client' });

/**
 * Simple LRU Cache implementation for PKCE code verifiers
 * Prevents unbounded memory growth by limiting the number of stored entries
 */
class LRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }
    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    // Remove if already exists (to move to end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // Evict oldest entry if at capacity
    else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  delete(key) {
    return this.cache.delete(key);
  }

  has(key) {
    return this.cache.has(key);
  }

  get size() {
    return this.cache.size;
  }

  clear() {
    this.cache.clear();
  }
}

// OIDC Configuration - will be loaded from database
let OIDC_CONFIG = {
  enabled: false,
  issuerUrl: null,
  clientId: null,
  clientSecret: null,
  redirectUri: 'http://localhost:3000/auth/callback',
  scope: 'openid email profile',
  roleClaimPath: 'roles',
  roleMapping: {
    admin: 'admin',
    manager: 'manager',
    employee: 'employee',
    attestation_coordinator: 'attestation_coordinator',
  },
  defaultRole: 'employee',
};

// Timeout duration for PKCE code verifiers (10 minutes)
const PKCE_VERIFIER_TIMEOUT_MS = 10 * 60 * 1000;
// Maximum number of concurrent OIDC flows (prevents memory exhaustion)
const MAX_VERIFIER_STORE_SIZE = 1000;

let config = null;
// Use LRU cache to prevent unbounded memory growth under heavy load
let codeVerifierStore = new LRUCache(MAX_VERIFIER_STORE_SIZE);
let timeoutStore = new Map(); // Store timeout IDs to prevent memory leaks

/**
 * Initialize OIDC client with settings from database
 */
async function initializeOIDC(settings = null) {
  // If settings provided, use them; otherwise keep existing config
  if (settings) {
    OIDC_CONFIG = {
      enabled: settings.enabled === 1 || settings.enabled === true,
      issuerUrl: settings.issuer_url,
      clientId: settings.client_id,
      clientSecret: settings.client_secret,
      redirectUri: settings.redirect_uri || 'http://localhost:3000/auth/callback',
      scope: settings.scope || 'openid email profile',
      roleClaimPath: settings.role_claim_path || 'roles',
      roleMapping: {
        admin: 'admin',
        manager: 'manager',
        employee: 'employee',
        attestation_coordinator: 'attestation_coordinator',
      },
      defaultRole: settings.default_role || 'employee',
    };
  }

  if (!OIDC_CONFIG.enabled) {
    logger.info('OIDC is disabled');
    config = null;
    return null;
  }

  if (!OIDC_CONFIG.issuerUrl || !OIDC_CONFIG.clientId) {
    logger.error('OIDC configuration missing: issuer_url and client_id are required');
    config = null;
    return null;
  }

  try {
    logger.info({ issuer: OIDC_CONFIG.issuerUrl }, 'Initializing OIDC');

    // Discover the issuer configuration
    const issuerUrl = new URL(OIDC_CONFIG.issuerUrl);
    config = await client.discovery(issuerUrl, OIDC_CONFIG.clientId, OIDC_CONFIG.clientSecret);

    logger.info('OIDC client initialized successfully');
    return config;
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize OIDC');
    config = null;
    return null;
  }
}

/**
 * Generate authorization URL for OIDC login
 */
async function getAuthorizationUrl(state) {
  if (!config) {
    throw new Error('OIDC client not initialized');
  }

  const code_verifier = client.randomPKCECodeVerifier();
  const code_challenge = await client.calculatePKCECodeChallenge(code_verifier);

  // Clear any existing timeout for this state to prevent memory leaks
  const existingTimeout = timeoutStore.get(state);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  // Store code verifier for later use in callback
  // LRU cache automatically evicts oldest entries if size exceeds MAX_VERIFIER_STORE_SIZE
  codeVerifierStore.set(state, code_verifier);

  // Clean up old verifiers after timeout period
  const timeoutId = setTimeout(() => {
    codeVerifierStore.delete(state);
    timeoutStore.delete(state);
  }, PKCE_VERIFIER_TIMEOUT_MS);
  
  // Store timeout ID to allow cleanup
  timeoutStore.set(state, timeoutId);

  const authUrl = client.buildAuthorizationUrl(config, {
    scope: OIDC_CONFIG.scope,
    state: state,
    code_challenge,
    code_challenge_method: 'S256',
  });

  return authUrl.href;
}

/**
 * Handle OIDC callback and exchange code for tokens
 */
async function handleCallback(callbackParams, state) {
  if (!config) {
    throw new Error('OIDC client not initialized');
  }

  const code_verifier = codeVerifierStore.get(state);
  if (!code_verifier) {
    throw new Error('Invalid state or code verifier expired');
  }

  try {
    const currentUrl = new URL(OIDC_CONFIG.redirectUri);
    currentUrl.search = new URLSearchParams(callbackParams).toString();

    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: code_verifier,
      expectedState: state,
    });

    // Clean up used code verifier and its timeout
    codeVerifierStore.delete(state);
    const timeoutId = timeoutStore.get(state);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutStore.delete(state);
    }

    return tokens;
  } catch (error) {
    // Clean up on error as well
    codeVerifierStore.delete(state);
    const timeoutId = timeoutStore.get(state);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutStore.delete(state);
    }
    throw error;
  }
}

/**
 * Get user info from OIDC provider
 */
async function getUserInfo(tokens) {
  if (!config) {
    throw new Error('OIDC client not initialized');
  }

  // Extract the subject from the ID token claims for validation
  const claims = tokens.claims();
  const sub = claims?.sub;

  if (!sub) {
    throw new Error('No subject (sub) claim found in ID token');
  }

  const userinfo = await client.fetchUserInfo(config, tokens.access_token, sub);
  return userinfo;
}

/**
 * Extract and map user data from OIDC claims
 */
function extractUserData(claims) {
  // Extract email
  const email = claims.email || claims.preferred_username;

  if (!email) {
    throw new Error('No email found in OIDC claims');
  }

  // Extract name
  const firstName = claims.given_name || claims.name?.split(' ')[0] || '';
  const lastName = claims.family_name || claims.name?.split(' ').slice(1).join(' ') || '';
  const fullName = claims.name || `${firstName} ${lastName}`.trim() || email.split('@')[0];

  // Extract roles from claims
  const roles = extractRoles(claims);
  const role = mapRole(roles);

  // Extract manager information from various common OIDC claim paths
  let managerFirstName = null;
  let managerLastName = null;
  let managerEmail = null;

  // Try to get manager email
  managerEmail = claims.manager_email || claims.manager || claims.managerId || claims.manager_id || null;

  // Try to get manager name (split or separate fields)
  if (claims.manager_first_name || claims.managerFirstName) {
    managerFirstName = claims.manager_first_name || claims.managerFirstName;
  }
  if (claims.manager_last_name || claims.managerLastName) {
    managerLastName = claims.manager_last_name || claims.managerLastName;
  }
  
  // If we have manager_name but not split fields, try to split it
  if (!managerFirstName && !managerLastName && claims.manager_name) {
    const nameParts = claims.manager_name.trim().split(/\s+/);
    managerFirstName = nameParts[0] || null;
    managerLastName = nameParts.slice(1).join(' ') || null;
  }

  return {
    email,
    firstName,
    lastName,
    fullName,
    role,
    oidcSub: claims.sub, // Store OIDC subject for linking
    managerFirstName,
    managerLastName,
    managerEmail,
  };
}

/**
 * Extract roles from OIDC claims
 */
function extractRoles(claims) {
  const rolePath = OIDC_CONFIG.roleClaimPath;

  // Support nested paths like "https://myapp.com/roles" or "resource_access.myapp.roles"
  const paths = rolePath.split('.');
  let roles = claims;

  for (const path of paths) {
    if (roles && typeof roles === 'object') {
      roles = roles[path];
    } else {
      roles = null;
      break;
    }
  }

  // Ensure roles is an array
  if (Array.isArray(roles)) {
    return roles;
  } else if (typeof roles === 'string') {
    return [roles];
  }

  return [];
}

/**
 * Map OIDC roles to application roles
 */
function mapRole(oidcRoles) {
  const mapping = OIDC_CONFIG.roleMapping;

  // Check for admin role first (highest priority)
  if (oidcRoles.some(r => mapping.admin && r.toLowerCase() === mapping.admin.toLowerCase())) {
    return 'admin';
  }

  // Check for attestation_coordinator role (second priority)
  if (oidcRoles.some(r => mapping.attestation_coordinator && r.toLowerCase() === mapping.attestation_coordinator.toLowerCase())) {
    return 'attestation_coordinator';
  }

  // Check for manager role
  if (oidcRoles.some(r => mapping.manager && r.toLowerCase() === mapping.manager.toLowerCase())) {
    return 'manager';
  }

  // Check for employee role
  if (oidcRoles.some(r => mapping.employee && r.toLowerCase() === mapping.employee.toLowerCase())) {
    return 'employee';
  }

  // Return default role if no mapping found
  return OIDC_CONFIG.defaultRole;
}

/**
 * Check if OIDC is enabled
 */
function isOIDCEnabled() {
  return OIDC_CONFIG.enabled && config !== null;
}

export {
  initializeOIDC,
  getAuthorizationUrl,
  handleCallback,
  getUserInfo,
  extractUserData,
  isOIDCEnabled,
  OIDC_CONFIG,
  PKCE_VERIFIER_TIMEOUT_MS,
  MAX_VERIFIER_STORE_SIZE,
  LRUCache,
};
