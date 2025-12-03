import { Issuer, generators } from 'openid-client';

// OIDC Configuration
const OIDC_CONFIG = {
  enabled: process.env.OIDC_ENABLED === 'true',
  issuerUrl: process.env.OIDC_ISSUER_URL,
  clientId: process.env.OIDC_CLIENT_ID,
  clientSecret: process.env.OIDC_CLIENT_SECRET,
  redirectUri: process.env.OIDC_REDIRECT_URI || 'http://localhost:3000/auth/callback',
  scope: process.env.OIDC_SCOPE || 'openid email profile',
  // Role mapping from OIDC claims
  roleClaimPath: process.env.OIDC_ROLE_CLAIM_PATH || 'roles', // e.g., "roles" or "https://myapp.com/roles"
  roleMapping: {
    // Map OIDC roles to app roles
    admin: 'admin',
    manager: 'manager',
    employee: 'employee',
  },
  defaultRole: process.env.OIDC_DEFAULT_ROLE || 'employee',
};

let oidcClient = null;
let codeVerifierStore = new Map(); // Store PKCE code verifiers temporarily

/**
 * Initialize OIDC client
 */
async function initializeOIDC() {
  if (!OIDC_CONFIG.enabled) {
    console.log('OIDC is disabled');
    return null;
  }

  if (!OIDC_CONFIG.issuerUrl || !OIDC_CONFIG.clientId) {
    console.error('OIDC configuration missing: OIDC_ISSUER_URL and OIDC_CLIENT_ID are required');
    return null;
  }

  try {
    console.log(`Initializing OIDC with issuer: ${OIDC_CONFIG.issuerUrl}`);
    const issuer = await Issuer.discover(OIDC_CONFIG.issuerUrl);

    oidcClient = new issuer.Client({
      client_id: OIDC_CONFIG.clientId,
      client_secret: OIDC_CONFIG.clientSecret,
      redirect_uris: [OIDC_CONFIG.redirectUri],
      response_types: ['code'],
    });

    console.log('OIDC client initialized successfully');
    return oidcClient;
  } catch (error) {
    console.error('Failed to initialize OIDC:', error.message);
    return null;
  }
}

/**
 * Generate authorization URL for OIDC login
 */
function getAuthorizationUrl(state) {
  if (!oidcClient) {
    throw new Error('OIDC client not initialized');
  }

  const code_verifier = generators.codeVerifier();
  const code_challenge = generators.codeChallenge(code_verifier);

  // Store code verifier for later use in callback
  codeVerifierStore.set(state, code_verifier);

  // Clean up old verifiers (older than 10 minutes)
  setTimeout(() => {
    codeVerifierStore.delete(state);
  }, 10 * 60 * 1000);

  const authUrl = oidcClient.authorizationUrl({
    scope: OIDC_CONFIG.scope,
    state: state,
    code_challenge,
    code_challenge_method: 'S256',
  });

  return authUrl;
}

/**
 * Handle OIDC callback and exchange code for tokens
 */
async function handleCallback(callbackParams, state) {
  if (!oidcClient) {
    throw new Error('OIDC client not initialized');
  }

  const code_verifier = codeVerifierStore.get(state);
  if (!code_verifier) {
    throw new Error('Invalid state or code verifier expired');
  }

  try {
    const tokenSet = await oidcClient.callback(
      OIDC_CONFIG.redirectUri,
      callbackParams,
      { code_verifier, state }
    );

    // Clean up used code verifier
    codeVerifierStore.delete(state);

    return tokenSet;
  } catch (error) {
    codeVerifierStore.delete(state);
    throw error;
  }
}

/**
 * Get user info from OIDC provider
 */
async function getUserInfo(tokenSet) {
  if (!oidcClient) {
    throw new Error('OIDC client not initialized');
  }

  const userinfo = await oidcClient.userinfo(tokenSet.access_token);
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
  return OIDC_CONFIG.enabled && oidcClient !== null;
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
