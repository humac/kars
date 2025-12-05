import * as client from 'openid-client';

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
  },
  defaultRole: 'employee',
};

let config = null;
let codeVerifierStore = new Map(); // Store PKCE code verifiers temporarily

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
      },
      defaultRole: settings.default_role || 'employee',
    };
  }

  if (!OIDC_CONFIG.enabled) {
    console.log('OIDC is disabled');
    config = null;
    return null;
  }

  if (!OIDC_CONFIG.issuerUrl || !OIDC_CONFIG.clientId) {
    console.error('OIDC configuration missing: issuer_url and client_id are required');
    config = null;
    return null;
  }

  try {
    console.log(`Initializing OIDC with issuer: ${OIDC_CONFIG.issuerUrl}`);

    // Discover the issuer configuration
    const issuerUrl = new URL(OIDC_CONFIG.issuerUrl);
    config = await client.discovery(issuerUrl, OIDC_CONFIG.clientId, OIDC_CONFIG.clientSecret);

    console.log('OIDC client initialized successfully');
    return config;
  } catch (error) {
    console.error('Failed to initialize OIDC:', error.message);
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

  // Store code verifier for later use in callback
  codeVerifierStore.set(state, code_verifier);

  // Clean up old verifiers (older than 10 minutes)
  setTimeout(() => {
    codeVerifierStore.delete(state);
  }, 10 * 60 * 1000);

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

    // Clean up used code verifier
    codeVerifierStore.delete(state);

    return tokens;
  } catch (error) {
    codeVerifierStore.delete(state);
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

  return {
    email,
    firstName,
    lastName,
    fullName,
    role,
    oidcSub: claims.sub, // Store OIDC subject for linking
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
};
