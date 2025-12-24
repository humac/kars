import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { assetDb, companyDb, auditDb, userDb, oidcSettingsDb, brandingSettingsDb, passkeySettingsDb, databaseSettings, databaseEngine, importSqliteDatabase, passkeyDb, hubspotSettingsDb, hubspotSyncLogDb, smtpSettingsDb, passwordResetTokenDb, syncAssetOwnership, attestationCampaignDb, attestationRecordDb, attestationAssetDb, attestationNewAssetDb, assetTypeDb, emailTemplateDb, sanitizeDateValue, attestationPendingInviteDb, systemSettingsDb } from './database.js';
import { authenticate, authorize, hashPassword, comparePassword, generateToken } from './auth.js';
import { initializeOIDC, getAuthorizationUrl, handleCallback, getUserInfo, extractUserData, isOIDCEnabled } from './oidc.js';
import { generateMFASecret, verifyTOTP, generateBackupCodes, formatBackupCode } from './mfa.js';
import { testHubSpotConnection, syncCompaniesToACS } from './hubspot.js';
import { encryptValue } from './utils/encryption.js';
import { safeJsonParse, safeJsonParseArray } from './utils/json.js';
import { VALID_ROLES } from './utils/constants.js';
import { sendTestEmail, sendPasswordResetEmail } from './services/smtpMailer.js';
import { webcrypto as nodeWebcrypto } from 'crypto';
import multer from 'multer';
import { readFile } from 'fs/promises';
import os from 'os';
import { mountRoutes } from './routes/index.js';
import logger from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 3001;
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 25 * 1024 * 1024 } });

if (!globalThis.crypto) {
  globalThis.crypto = nodeWebcrypto;
}

// Passkey configuration - will be loaded from database or environment variables
let passkeyConfig = {
  rpID: process.env.PASSKEY_RP_ID || 'localhost',
  rpName: process.env.PASSKEY_RP_NAME || 'ACS - Asset Compliance System',
  defaultOrigin: process.env.PASSKEY_ORIGIN || 'http://localhost:5173'
};

const parseBooleanEnv = (value, defaultValue = true) => {
  if (value === undefined || value === null) return defaultValue;
  const normalized = String(value).toLowerCase();
  return !['false', '0', 'no', 'off'].includes(normalized);
};

/**
 * Get system configuration with environment variable defaults and database overrides
 * @returns {Promise<Object>} System configuration object
 */
const getSystemConfig = async () => {
  // Environment variable defaults
  const envDefaults = {
    trust_proxy: parseBooleanEnv(process.env.TRUST_PROXY, true),
    proxy_type: process.env.PROXY_TYPE || 'cloudflare',
    proxy_trust_level: parseInt(process.env.PROXY_TRUST_LEVEL || '1', 10),
    rate_limit_enabled: parseBooleanEnv(process.env.RATE_LIMIT_ENABLED, true),
    rate_limit_window_ms: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    rate_limit_max_requests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
  };

  // Try to get database overrides
  let dbSettings = null;
  try {
    dbSettings = await systemSettingsDb.get();
  } catch (err) {
    console.error('Failed to load system settings from database:', err);
  }

  // Merge with database overrides taking precedence (only if not null)
  const config = {
    proxy: {
      enabled: dbSettings?.trust_proxy !== null && dbSettings?.trust_proxy !== undefined ? !!dbSettings.trust_proxy : envDefaults.trust_proxy,
      type: dbSettings?.proxy_type || envDefaults.proxy_type,
      trustLevel: dbSettings?.proxy_trust_level !== null && dbSettings?.proxy_trust_level !== undefined ? dbSettings.proxy_trust_level : envDefaults.proxy_trust_level
    },
    rateLimiting: {
      enabled: dbSettings?.rate_limit_enabled !== null && dbSettings?.rate_limit_enabled !== undefined ? !!dbSettings.rate_limit_enabled : envDefaults.rate_limit_enabled,
      windowMs: dbSettings?.rate_limit_window_ms || envDefaults.rate_limit_window_ms,
      maxRequests: dbSettings?.rate_limit_max_requests || envDefaults.rate_limit_max_requests
    }
  };

  return config;
};

// Helper function to get current passkey configuration
const getPasskeyConfig = async () => {
  // Environment variables take precedence
  if (process.env.PASSKEY_RP_ID || process.env.PASSKEY_RP_NAME || process.env.PASSKEY_ORIGIN) {
    return {
      rpID: process.env.PASSKEY_RP_ID || 'localhost',
      rpName: process.env.PASSKEY_RP_NAME || 'ACS - Asset Compliance System',
      defaultOrigin: process.env.PASSKEY_ORIGIN || 'http://localhost:5173'
    };
  }

  // Otherwise, use database settings
  try {
    const dbSettings = await passkeySettingsDb.get();
    if (dbSettings) {
      return {
        rpID: dbSettings.rp_id || 'localhost',
        rpName: dbSettings.rp_name || 'ACS - Asset Compliance System',
        defaultOrigin: dbSettings.origin || 'http://localhost:5173'
      };
    }
  } catch (err) {
    logger.error({ err }, 'Failed to load passkey settings from database');
  }

  // Fallback to defaults
  return passkeyConfig;
};

const isPasskeyEnabled = async () => {
  if (process.env.PASSKEY_ENABLED !== undefined) {
    return parseBooleanEnv(process.env.PASSKEY_ENABLED, true);
  }

  try {
    const dbSettings = await passkeySettingsDb.get();
    return dbSettings?.enabled !== 0;
  } catch (err) {
    logger.error({ err }, 'Failed to read passkey enabled state');
    return true;
  }
};

const parseCSVFile = async (filePath) => {
  const content = await readFile(filePath, 'utf8');
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((value) => value.trim());
    const record = {};

    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });

    return record;
  });
};

// Middleware
// Configure CORS with origin whitelist (uses ALLOWED_ORIGINS from .env)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3000']; // Default dev origins

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.) in development
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting configuration
// Note: These are basic rate limiters. System-wide config is applied during server startup.
// Using Cloudflare-friendly settings to avoid X-Forwarded-For validation errors

// Get client IP based on proxy type
const getClientIp = (req) => {
  // Check for Cloudflare header first (most reliable when behind Cloudflare)
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return cfIp;
  
  // Fall back to Express req.ip (respects trust proxy setting)
  return req.ip;
};

// Common rate limiter validation config
const rateLimiterValidation = {
  // Disable X-Forwarded-For validation - we use CF-Connecting-IP or trust proxy
  xForwardedForHeader: false,
  // Disable IPv6 fallback validation since we use custom keyGenerator
  keyGeneratorIpFallback: false
};

// Rate limiting for authentication endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: 'Too many attempts, please try again later' },
  keyGenerator: getClientIp,
  validate: rateLimiterValidation,
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for password reset (prevent email spam)
const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: { error: 'Too many password reset requests, please try again later' },
  keyGenerator: getClientIp,
  validate: rateLimiterValidation,
  standardHeaders: true,
  legacyHeaders: false,
});

const pendingMFALogins = new Map();
const pendingPasskeyRegistrations = new Map();
const pendingPasskeyLogins = new Map();
const stateStore = new Map(); // For OIDC state tokens

const getExpectedOrigin = (req) => process.env.PASSKEY_ORIGIN || req.get('origin') || passkeyConfig.defaultOrigin;

// Initialize OIDC from database settings (async)
const initializeOIDCFromSettings = async () => {
  try {
    const settings = await oidcSettingsDb.get();
    if (settings && settings.enabled === 1) {
      await initializeOIDC(settings);
    } else {
      logger.info('OIDC is disabled in settings');
    }
  } catch (err) {
    logger.error({ err }, 'OIDC initialization failed');
  }
};

// Store for pending MFA logins (in production, use Redis)

// Cleanup expired MFA sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, data] of pendingMFALogins.entries()) {
    if (now - data.timestamp > 5 * 60 * 1000) { // 5 minutes
      pendingMFALogins.delete(sessionId);
    }
  }
}, 5 * 60 * 1000);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'KARS API is running' });
});

// ===== Helper Functions =====

const serializePasskey = (passkey) => ({
  ...passkey,
  transports: safeJsonParseArray(passkey?.transports),
});

/**
 * Auto-assign manager role to a user if they have employees reporting to them
 * (i.e., they are listed as manager_email on any asset)
 * @param {string} email - The email of the user to potentially assign manager role to
 * @param {string} triggeredBy - Email of the user who triggered this action (for audit log)
 * @returns {Promise<boolean>} - Returns true if role was updated, false otherwise
 */
const autoAssignManagerRole = async (email, triggeredBy) => {
  try {
    const user = await userDb.getByEmail(email);

    // If user doesn't exist, nothing to do
    if (!user) {
      return false;
    }

    // If user is already a manager or admin, no need to update
    if (user.role === 'manager' || user.role === 'admin') {
      return false;
    }

    // Check if this user is listed as manager on any assets
    const assetsAsManager = await assetDb.getByManagerEmail(email);
    if (!assetsAsManager || assetsAsManager.length === 0) {
      // User is not a manager on any assets, keep as employee
      logger.debug({ email }, 'User has no assets as manager, keeping employee role');
      return false;
    }

    // User has assets where they are the manager - upgrade to manager role
    await userDb.updateRole(user.id, 'manager');
    logger.info({ email, assetCount: assetsAsManager.length }, 'Auto-assigned manager role based on asset manager assignments');

    // Log the role change in audit
    await auditDb.log(
      'update',
      'user',
      user.id,
      user.email,
      {
        old_role: user.role,
        new_role: 'manager',
        auto_assigned: true,
        triggered_by: triggeredBy || 'system',
        assets_as_manager: assetsAsManager.length
      },
      triggeredBy || 'system'
    );

    return true;
  } catch (error) {
    logger.error({ err: error, email }, 'Error auto-assigning manager role');
    return false;
  }
};

// ===== Mount Route Modules =====
// Routes extracted to separate modules for maintainability
mountRoutes(app, {
  // Database
  assetDb,
  companyDb,
  auditDb,
  userDb,
  passkeyDb,
  assetTypeDb,
  passwordResetTokenDb,
  attestationCampaignDb,
  attestationRecordDb,
  attestationAssetDb,
  attestationNewAssetDb,
  attestationPendingInviteDb,
  oidcSettingsDb,
  brandingSettingsDb,
  passkeySettingsDb,
  databaseSettings,
  databaseEngine,
  importSqliteDatabase,
  hubspotSettingsDb,
  hubspotSyncLogDb,
  smtpSettingsDb,
  emailTemplateDb,
  systemSettingsDb,
  // Auth middleware
  authenticate,
  authorize,
  hashPassword,
  comparePassword,
  generateToken,
  // Rate limiters
  authRateLimiter,
  passwordResetRateLimiter,
  // File upload
  upload,
  parseCSVFile,
  // OIDC
  initializeOIDC,
  isOIDCEnabled,
  getAuthorizationUrl,
  handleCallback,
  getUserInfo,
  extractUserData,
  // MFA
  generateMFASecret,
  verifyTOTP,
  generateBackupCodes,
  formatBackupCode,
  // HubSpot
  testHubSpotConnection,
  syncCompaniesToACS,
  // Email
  sendTestEmail,
  sendPasswordResetEmail,
  encryptValue,
  // Helpers
  syncAssetOwnership,
  parseBooleanEnv,
  sanitizeDateValue,
  getPasskeyConfig,
  isPasskeyEnabled,
  getExpectedOrigin,
  getSystemConfig,
  serializePasskey,
  autoAssignManagerRole,
  autoAssignManagerRoleIfNeeded: autoAssignManagerRole,
  // In-memory stores
  mfaSessions: pendingMFALogins,
  pendingMFAEnrollments: pendingMFALogins,
  pendingPasskeyRegistrations,
  pendingPasskeyLogins,
  stateStore,
  // Utils
  safeJsonParse,
  safeJsonParseArray,
  // Constants
  VALID_ROLES,
});

// Start server after database initialization
const startServer = async () => {
  try {
    await assetDb.init();
    
    // Load system configuration and apply proxy settings
    const systemConfig = await getSystemConfig();
    
    // Configure trust proxy for reverse proxy/Cloudflare support
    if (systemConfig.proxy.enabled) {
      app.set('trust proxy', systemConfig.proxy.trustLevel);
      console.log(`Trust proxy enabled: level ${systemConfig.proxy.trustLevel}, type: ${systemConfig.proxy.type}`);
    }
    
    await initializeOIDCFromSettings();
    logger.info({ engine: databaseEngine.toUpperCase() }, 'Database backend initialized');

    app.listen(PORT, () => {
      logger.info({ port: PORT, healthCheck: '/api/health' }, 'ACS API server started');
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();
