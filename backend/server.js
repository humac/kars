import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { assetDb, companyDb, auditDb, userDb, oidcSettingsDb, brandingSettingsDb, passkeySettingsDb, databaseSettings, databaseEngine, importSqliteDatabase, passkeyDb, hubspotSettingsDb, hubspotSyncLogDb, smtpSettingsDb, passwordResetTokenDb, syncAssetOwnership, attestationCampaignDb, attestationRecordDb, attestationAssetDb, attestationNewAssetDb, assetTypeDb, emailTemplateDb, sanitizeDateValue, attestationPendingInviteDb } from './database.js';
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
    console.error('Failed to load passkey settings from database:', err);
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
    console.error('Failed to read passkey enabled state:', err);
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

// Rate limiting for authentication endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for password reset (prevent email spam)
const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: { error: 'Too many password reset requests, please try again later' },
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
      console.log('OIDC is disabled in settings');
    }
  } catch (err) {
    console.error('OIDC initialization failed:', err.message);
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

    // Update user role to manager
    await userDb.updateRole(user.id, 'manager');
    console.log(`Auto-assigned manager role to ${email}`);

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
        triggered_by: triggeredBy
      },
      triggeredBy
    );

    return true;
  } catch (error) {
    console.error(`Error auto-assigning manager role to ${email}:`, error);
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
    await initializeOIDCFromSettings();
    console.log(`Using ${databaseEngine.toUpperCase()} database backend`);

    app.listen(PORT, () => {
    console.log(`ACS API running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
