import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { assetDb, companyDb, auditDb, userDb, oidcSettingsDb, brandingSettingsDb, passkeySettingsDb, databaseSettings, databaseEngine, importSqliteDatabase, passkeyDb, hubspotSettingsDb, hubspotSyncLogDb, smtpSettingsDb, passwordResetTokenDb, syncAssetOwnership, attestationCampaignDb, attestationRecordDb, attestationAssetDb, attestationNewAssetDb, assetTypeDb, emailTemplateDb, sanitizeDateValue, attestationPendingInviteDb } from './database.js';
import { authenticate, authorize, hashPassword, comparePassword, generateToken } from './auth.js';
import { initializeOIDC, getAuthorizationUrl, handleCallback, getUserInfo, extractUserData, isOIDCEnabled } from './oidc.js';
import { generateMFASecret, verifyTOTP, generateBackupCodes, formatBackupCode } from './mfa.js';
import { testHubSpotConnection, syncCompaniesToKARS } from './hubspot.js';
import { encryptValue, decryptValue } from './utils/encryption.js';
import { sendTestEmail, sendPasswordResetEmail } from './services/smtpMailer.js';
import { randomBytes, webcrypto as nodeWebcrypto } from 'crypto';
import multer from 'multer';
import { readFile, unlink } from 'fs/promises';
import os from 'os';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

const app = express();
const PORT = process.env.PORT || 3001;
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 25 * 1024 * 1024 } });

if (!globalThis.crypto) {
  globalThis.crypto = nodeWebcrypto;
}

// Passkey configuration - will be loaded from database or environment variables
let passkeyConfig = {
  rpID: process.env.PASSKEY_RP_ID || 'localhost',
  rpName: process.env.PASSKEY_RP_NAME || 'KARS - KeyData Asset Registration System',
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
      rpName: process.env.PASSKEY_RP_NAME || 'KARS - KeyData Asset Registration System',
      defaultOrigin: process.env.PASSKEY_ORIGIN || 'http://localhost:5173'
    };
  }

  // Otherwise, use database settings
  try {
    const dbSettings = await passkeySettingsDb.get();
    if (dbSettings) {
      return {
        rpID: dbSettings.rp_id || 'localhost',
        rpName: dbSettings.rp_name || 'KARS - KeyData Asset Registration System',
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
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const pendingMFALogins = new Map();
const pendingPasskeyRegistrations = new Map();
const pendingPasskeyLogins = new Map();

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
  transports: passkey?.transports ? JSON.parse(passkey.transports) : [],
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

// ===== Authentication Endpoints =====

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    let { email, password, name, first_name, last_name, manager_first_name, manager_last_name, manager_name, manager_email } = req.body;

    // Validation - accept either 'name' or 'first_name + last_name'
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    if (!name && (!first_name || !last_name)) {
      return res.status(400).json({
        error: 'Either name or both first_name and last_name are required'
      });
    }

    // Support both split fields and combined field for backward compatibility
    if (manager_first_name && manager_last_name) {
      // Split fields provided - use them
    } else if (manager_name) {
      // Combined field provided - split it
      const nameParts = manager_name.trim().split(/\s+/);
      manager_first_name = nameParts[0] || '';
      manager_last_name = nameParts.slice(1).join(' ') || '';
    } else {
      return res.status(400).json({
        error: 'Manager first name and last name are required'
      });
    }

    if (!manager_email) {
      return res.status(400).json({
        error: 'Manager email is required'
      });
    }

    // Check if user already exists
    const existingUser = await userDb.getByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Determine user role
    // 1. First user becomes admin
    // 2. User with email matching ADMIN_EMAIL env var becomes admin
    // 3. Otherwise, default to 'employee'
    const allUsers = await userDb.getAll();
    const isFirstUser = allUsers.length === 0;
    const isAdminEmail = process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();

    let userRole = 'employee'; // Default role
    if (isFirstUser || isAdminEmail) {
      userRole = 'admin';
      console.log(`Creating admin user: ${email} (${isFirstUser ? 'first user' : 'admin email match'})`);
    }

    // Create user
    const result = await userDb.create({
      email,
      password_hash,
      name: name || `${first_name} ${last_name}`,
      first_name: first_name || null,
      last_name: last_name || null,
      manager_first_name,
      manager_last_name,
      manager_email,
      role: userRole
    });

    const newUser = await userDb.getById(result.id);

    // Sync asset ownership for pre-loaded assets
    const syncResult = await syncAssetOwnership(newUser.email);
    if (syncResult.ownerUpdates > 0 || syncResult.managerUpdates > 0) {
      console.log(`Synced asset ownership for ${newUser.email}: ${syncResult.ownerUpdates} as owner, ${syncResult.managerUpdates} as manager`);
      
      // Log audit for sync
      await auditDb.log(
        'sync_assets',
        'user',
        newUser.id,
        newUser.email,
        {
          owner_assets_synced: syncResult.ownerUpdates,
          manager_assets_synced: syncResult.managerUpdates
        },
        'system'
      );
    }

    // Generate token
    const token = generateToken(newUser);

    // Log audit
    await auditDb.log(
      'create',
      'user',
      newUser.id,
      newUser.email,
      {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        manager_first_name: newUser.manager_first_name,
        manager_last_name: newUser.manager_last_name,
        manager_email: newUser.manager_email,
        registration_method: 'local'
      },
      newUser.email
    );

    // Link any existing assets to this user's manager information
    try {
      const linkedAssets = await assetDb.linkAssetsToUser(
        newUser.email,
        newUser.manager_first_name,
        newUser.manager_last_name,
        newUser.manager_email
      );

      if (linkedAssets.changes > 0) {
        console.log(`Linked ${linkedAssets.changes} assets to user ${newUser.email}`);

        // Log audit for asset linking
        await auditDb.log(
          'update',
          'asset',
          null,
          `Assets linked to ${newUser.email}`,
          {
            employee_email: newUser.email,
            manager_first_name: newUser.manager_first_name,
            manager_last_name: newUser.manager_last_name,
            manager_email: newUser.manager_email,
            linked_count: linkedAssets.changes
          },
          newUser.email
        );
      }
    } catch (linkError) {
      console.error('Error linking assets during registration:', linkError);
      // Don't fail registration if asset linking fails
    }

    // Auto-assign manager role if applicable
    try {
      // Case 1: If this user specified a manager_email that matches an existing user,
      // that user should be assigned the manager role (if not already manager/admin)
      if (newUser.manager_email) {
        await autoAssignManagerRole(newUser.manager_email, newUser.email);
      }

      // Case 2: If any existing users have this new user's email as their manager_email,
      // this new user should be assigned the manager role (if not already manager/admin)
      const employeesWithThisManager = await userDb.getByManagerEmail(newUser.email);
      if (employeesWithThisManager && employeesWithThisManager.length > 0) {
        const wasUpdated = await autoAssignManagerRole(newUser.email, newUser.email);
        if (wasUpdated) {
          // Refresh the newUser object to reflect the updated role
          const updatedUser = await userDb.getById(newUser.id);
          newUser.role = updatedUser.role;
          console.log(`User ${newUser.email} has ${employeesWithThisManager.length} employees and was assigned manager role`);
        }
      }

      // Case 3: If any assets have this new user's email as their manager_email,
      // this new user should be assigned the manager role (if not already manager/admin)
      const assetsWithThisManager = await assetDb.getByManagerEmail(newUser.email);
      if (assetsWithThisManager && assetsWithThisManager.length > 0) {
        const wasUpdated = await autoAssignManagerRole(newUser.email, newUser.email);
        if (wasUpdated) {
          // Refresh the newUser object to reflect the updated role
          const updatedUser = await userDb.getById(newUser.id);
          newUser.role = updatedUser.role;
          console.log(`User ${newUser.email} is manager of ${assetsWithThisManager.length} assets and was assigned manager role`);
        }
      }
    } catch (roleError) {
      console.error('Error auto-assigning manager role during registration:', roleError);
      // Don't fail registration if role assignment fails
    }

    // Check for pending attestation invites and convert them
    try {
      const pendingInvites = await attestationPendingInviteDb.getActiveByEmail(newUser.email);
      for (const invite of pendingInvites) {
        // Only convert if campaign is still active
        const campaign = await attestationCampaignDb.getById(invite.campaign_id);
        if (campaign && campaign.status === 'active') {
          // Create attestation record
          const record = await attestationRecordDb.create({
            campaign_id: invite.campaign_id,
            user_id: newUser.id,
            status: 'pending'
          });
          
          // Update invite
          await attestationPendingInviteDb.update(invite.id, {
            registered_at: new Date().toISOString(),
            converted_record_id: record.id
          });
          
          // Send "attestation ready" email
          try {
            const { sendAttestationReadyEmail } = await import('./services/smtpMailer.js');
            await sendAttestationReadyEmail(newUser.email, newUser.first_name, campaign);
          } catch (emailError) {
            console.error(`Failed to send attestation ready email to ${newUser.email}:`, emailError);
          }
          
          console.log(`Converted pending invite to attestation record for ${newUser.email} in campaign ${campaign.name}`);
        }
      }
    } catch (inviteError) {
      console.error('Error converting pending attestation invites:', inviteError);
      // Don't fail registration if invite conversion fails
    }

    // Return user info (without password hash)
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        manager_name: newUser.manager_name,
        manager_first_name: newUser.manager_first_name,
        manager_last_name: newUser.manager_last_name,
        manager_email: newUser.manager_email,
        profile_image: newUser.profile_image
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Find user
    const user = await userDb.getByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if MFA is enabled
    if (user.mfa_enabled) {
      // Generate MFA session ID
      const mfaSessionId = randomBytes(32).toString('hex');

      // Store user info temporarily
      pendingMFALogins.set(mfaSessionId, {
        userId: user.id,
        timestamp: Date.now()
      });

      return res.json({
        mfaRequired: true,
        mfaSessionId: mfaSessionId,
        message: 'MFA verification required'
      });
    }

    // Update last login
    await userDb.updateLastLogin(user.id);

    // Generate token
    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        manager_name: user.manager_name,
        manager_first_name: user.manager_first_name,
        manager_last_name: user.manager_last_name,
        manager_email: user.manager_email,
        profile_image: user.profile_image
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Request password reset
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user
    const user = await userDb.getByEmail(email);
    
    // Always return success to prevent email enumeration
    // Even if user doesn't exist, we return success but don't send email
    if (!user) {
      return res.json({ 
        success: true, 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    }

    // Generate secure random token
    const resetToken = randomBytes(32).toString('hex');
    
    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    
    // Delete any existing tokens for this user
    await passwordResetTokenDb.deleteByUserId(user.id);
    
    // Create new reset token
    await passwordResetTokenDb.create(user.id, resetToken, expiresAt);
    
    // Build reset URL - use app_url with fallbacks
    const { getAppUrl } = await import('./services/smtpMailer.js');
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    const requestOrigin = req.get('origin');
    let baseUrl = await getAppUrl();
    
    // If request origin is in allowed list, use it (takes precedence for security)
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      baseUrl = requestOrigin;
    }
    
    const resetUrl = `${baseUrl}/reset-password/${resetToken}`;
    
    // Send email
    const emailResult = await sendPasswordResetEmail(user.email, resetToken, resetUrl);
    
    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to send password reset email. Please contact support or try again later.' 
      });
    }

    // Log audit
    await auditDb.log(
      'password_reset_requested',
      'user',
      user.id,
      user.email,
      { email: user.email },
      user.email
    );

    res.json({ 
      success: true, 
      message: 'If an account with that email exists, a password reset link has been sent.' 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Verify reset token
app.get('/api/auth/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Find token
    const resetToken = await passwordResetTokenDb.findByToken(token);
    
    if (!resetToken) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid or expired reset token' 
      });
    }

    // Check if token has been used
    if (resetToken.used) {
      return res.status(400).json({ 
        success: false,
        error: 'This reset token has already been used' 
      });
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(resetToken.expires_at);
    
    if (now > expiresAt) {
      return res.status(400).json({ 
        success: false,
        error: 'This reset token has expired' 
      });
    }

    res.json({ 
      success: true,
      message: 'Token is valid' 
    });
  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(500).json({ error: 'Failed to verify reset token' });
  }
});

// Reset password with token
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Find token
    const resetToken = await passwordResetTokenDb.findByToken(token);
    
    if (!resetToken) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid or expired reset token' 
      });
    }

    // Check if token has been used
    if (resetToken.used) {
      return res.status(400).json({ 
        success: false,
        error: 'This reset token has already been used' 
      });
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(resetToken.expires_at);
    
    if (now > expiresAt) {
      return res.status(400).json({ 
        success: false,
        error: 'This reset token has expired' 
      });
    }

    // Get user
    const user = await userDb.getById(resetToken.user_id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password
    const password_hash = await hashPassword(password);
    
    // Update password
    await userDb.updatePassword(user.id, password_hash);
    
    // Mark token as used
    await passwordResetTokenDb.markAsUsed(resetToken.id);
    
    // Delete all other tokens for this user
    await passwordResetTokenDb.deleteByUserId(user.id);
    
    // Log audit
    await auditDb.log(
      'password_reset_completed',
      'user',
      user.id,
      user.email,
      { email: user.email },
      user.email
    );

    res.json({ 
      success: true,
      message: 'Password has been reset successfully' 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Get current user (verify token)
app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const user = await userDb.getById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      manager_name: user.manager_name,
      manager_first_name: user.manager_first_name,
      manager_last_name: user.manager_last_name,
      manager_email: user.manager_email,
      profile_image: user.profile_image,
      profile_complete: user.profile_complete
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Update user profile
app.put('/api/auth/profile', authenticate, async (req, res) => {
  try {
    let { first_name, last_name, manager_first_name, manager_last_name, manager_name, manager_email, profile_image } = req.body;

    // Validation
    if (!first_name || !last_name) {
      return res.status(400).json({
        error: 'First name and last name are required'
      });
    }

    // Support both split fields and combined field for backward compatibility
    // If split fields are provided, use them; otherwise fall back to combined field
    if (manager_first_name && manager_last_name) {
      // Split fields provided - use them
    } else if (manager_name) {
      // Combined field provided - split it
      const nameParts = manager_name.trim().split(/\s+/);
      manager_first_name = nameParts[0] || '';
      manager_last_name = nameParts.slice(1).join(' ') || '';
    } else {
      return res.status(400).json({
        error: 'Manager first name and last name are required'
      });
    }

    if (!manager_email) {
      return res.status(400).json({
        error: 'Manager email is required'
      });
    }

    // Get old profile data for audit
    const oldUser = await userDb.getById(req.user.id);

    // Normalize and validate profile image if provided
    let normalizedProfileImage = oldUser.profile_image;
    if (Object.prototype.hasOwnProperty.call(req.body, 'profile_image')) {
      if (!profile_image) {
        normalizedProfileImage = null;
      } else if (typeof profile_image !== 'string' || !profile_image.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Profile image must be a base64-encoded image data URL' });
      } else {
        const base64Payload = profile_image.split(',')[1] || '';
        const buffer = Buffer.from(base64Payload, 'base64');
        if (buffer.length > 5 * 1024 * 1024) { // 5MB limit
          return res.status(400).json({ error: 'Profile image must be 5MB or smaller' });
        }
        normalizedProfileImage = profile_image;
      }
    }

    // Calculate name from first_name and last_name
    const name = `${first_name} ${last_name}`;

    // Update profile
    await userDb.updateProfile(req.user.id, {
      name,
      first_name,
      last_name,
      manager_first_name,
      manager_last_name,
      manager_email,
      profile_image: normalizedProfileImage
    });

    // Get updated user
    const user = await userDb.getById(req.user.id);

    // Log audit
    await auditDb.log(
      'update_profile',
      'user',
      user.id,
      user.email,
      {
        old_first_name: oldUser.first_name,
        old_last_name: oldUser.last_name,
        old_manager_first_name: oldUser.manager_first_name,
        old_manager_last_name: oldUser.manager_last_name,
        old_manager_email: oldUser.manager_email,
        old_profile_image_set: !!oldUser.profile_image,
        new_first_name: first_name,
        new_last_name: last_name,
        new_manager_first_name: manager_first_name,
        new_manager_last_name: manager_last_name,
        new_manager_email: manager_email,
        new_profile_image_set: !!normalizedProfileImage
      },
      user.email
    );

    // Update manager info on all assets for this employee if manager changed
    const managerChanged = oldUser.manager_first_name !== manager_first_name || 
                           oldUser.manager_last_name !== manager_last_name ||
                           oldUser.manager_email !== manager_email;
    if (managerChanged) {
      try {
        const combined_manager_name = `${manager_first_name} ${manager_last_name}`;
        const updatedAssets = await assetDb.updateManagerForEmployee(
          user.email,
          combined_manager_name,
          manager_email
        );

        if (updatedAssets.changes > 0) {
          console.log(`Updated manager info for ${updatedAssets.changes} assets for employee ${user.email}`);

          // Log audit for asset manager sync
          await auditDb.log(
            'update',
            'asset',
            null,
            `Manager synced for ${user.email}`,
            {
              employee_email: user.email,
              old_manager_first_name: oldUser.manager_first_name,
              old_manager_last_name: oldUser.manager_last_name,
              old_manager_email: oldUser.manager_email,
              new_manager_first_name: manager_first_name,
              new_manager_last_name: manager_last_name,
              new_manager_email: manager_email,
              updated_count: updatedAssets.changes
            },
            user.email
          );
        }
      } catch (syncError) {
        console.error('Error syncing manager info to assets:', syncError);
        // Don't fail profile update if asset sync fails
      }
    }

    // Auto-assign manager role if manager_email changed
    if (managerChanged && manager_email && oldUser.manager_email !== manager_email) {
      try {
        await autoAssignManagerRole(manager_email, user.email);
      } catch (roleError) {
        console.error('Error auto-assigning manager role during profile update:', roleError);
        // Don't fail profile update if role assignment fails
      }
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      manager_name: user.manager_name,
      manager_first_name: user.manager_first_name,
      manager_last_name: user.manager_last_name,
      manager_email: user.manager_email,
      profile_image: user.profile_image
    }
  });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Complete profile (for OIDC users)
app.post('/api/auth/complete-profile', authenticate, async (req, res) => {
  try {
    const { manager_first_name, manager_last_name, manager_email } = req.body;

    // Validation
    if (!manager_first_name || !manager_last_name || !manager_email) {
      return res.status(400).json({
        error: 'Manager first name, last name, and email are required'
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(manager_email)) {
      return res.status(400).json({
        error: 'Please provide a valid email address'
      });
    }

    // Get current user
    const user = await userDb.getById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user with manager information and mark profile as complete
    await userDb.completeProfile(req.user.id, {
      manager_first_name,
      manager_last_name,
      manager_email
    });

    // Get updated user
    const updatedUser = await userDb.getById(req.user.id);

    // Log audit
    await auditDb.log(
      'complete_profile',
      'user',
      updatedUser.id,
      updatedUser.email,
      {
        manager_first_name,
        manager_last_name,
        manager_email
      },
      updatedUser.email
    );

    // Sync manager info to existing assets
    try {
      const combined_manager_name = `${manager_first_name} ${manager_last_name}`;
      const updatedAssets = await assetDb.updateManagerForEmployee(
        updatedUser.email,
        combined_manager_name,
        manager_email
      );

      if (updatedAssets.changes > 0) {
        console.log(`Updated manager info for ${updatedAssets.changes} assets for employee ${updatedUser.email}`);

        // Log audit for asset manager sync
        await auditDb.log(
          'update',
          'asset',
          null,
          `Manager synced for ${updatedUser.email}`,
          {
            employee_email: updatedUser.email,
            old_manager_first_name: null,
            old_manager_last_name: null,
            old_manager_email: null,
            new_manager_first_name: manager_first_name,
            new_manager_last_name: manager_last_name,
            new_manager_email: manager_email,
            updated_count: updatedAssets.changes
          },
          updatedUser.email
        );
      }
    } catch (syncError) {
      console.error('Error syncing manager info to assets during profile completion:', syncError);
      // Don't fail profile completion if asset sync fails
    }

    // Auto-assign manager role if manager exists
    try {
      await autoAssignManagerRole(manager_email, updatedUser.email);
    } catch (roleError) {
      console.error('Error auto-assigning manager role during profile completion:', roleError);
      // Don't fail profile completion if role assignment fails
    }

    res.json({
      message: 'Profile completed successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        manager_first_name: updatedUser.manager_first_name,
        manager_last_name: updatedUser.manager_last_name,
        manager_email: updatedUser.manager_email,
        profile_image: updatedUser.profile_image,
        profile_complete: updatedUser.profile_complete
      }
    });
  } catch (error) {
    console.error('Complete profile error:', error);
    res.status(500).json({ error: 'Failed to complete profile' });
  }
});

// Change password
app.put('/api/auth/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        error: 'Current password, new password, and confirmation are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        error: 'New password and confirmation do not match'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'New password must be at least 6 characters long'
      });
    }

    // Get current user
    const user = await userDb.getById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password in database
    await userDb.updatePassword(req.user.id, newPasswordHash);

    // Log the password change
    await auditDb.log(
      'change_password',
      'user',
      user.id,
      user.email,
      'Password changed successfully',
      user.email
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ===== MFA Endpoints =====

// Get MFA status for current user
app.get('/api/auth/mfa/status', authenticate, async (req, res) => {
  try {
    const mfaStatus = await userDb.getMFAStatus(req.user.id);
    res.json({
      enabled: mfaStatus?.mfa_enabled === 1,
      hasBackupCodes: mfaStatus?.mfa_backup_codes ? JSON.parse(mfaStatus.mfa_backup_codes).length > 0 : false
    });
  } catch (error) {
    console.error('Get MFA status error:', error);
    res.status(500).json({ error: 'Failed to get MFA status' });
  }
});

// Start MFA enrollment
app.post('/api/auth/mfa/enroll', authenticate, async (req, res) => {
  try {
    const user = await userDb.getById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if MFA is already enabled
    if (user.mfa_enabled) {
      return res.status(400).json({ error: 'MFA is already enabled' });
    }

    // Generate MFA secret and QR code
    const { secret, qrCode } = await generateMFASecret(user.email);

    // Store secret temporarily in session (not in database yet)
    pendingMFALogins.set(`enroll_${req.user.id}`, {
      secret,
      timestamp: Date.now()
    });

    res.json({
      qrCode,
      secret, // Send secret for manual entry if QR code fails
      message: 'Scan QR code with your authenticator app'
    });
  } catch (error) {
    console.error('MFA enrollment error:', error);
    res.status(500).json({ error: 'Failed to start MFA enrollment' });
  }
});

// Verify and complete MFA enrollment
app.post('/api/auth/mfa/verify-enrollment', authenticate, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Get pending enrollment
    const enrollKey = `enroll_${req.user.id}`;
    const enrollment = pendingMFALogins.get(enrollKey);

    if (!enrollment) {
      return res.status(400).json({ error: 'No pending MFA enrollment found' });
    }

    // Verify TOTP token
    const isValid = verifyTOTP(enrollment.secret, token);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();

    // Enable MFA in database
    await userDb.enableMFA(req.user.id, enrollment.secret, backupCodes);

    // Clean up pending enrollment
    pendingMFALogins.delete(enrollKey);

    // Log the action
    await auditDb.log(
      'enable_mfa',
      'user',
      req.user.id,
      req.user.email,
      { message: 'MFA enabled' },
      req.user.email
    );

    res.json({
      message: 'MFA enabled successfully',
      backupCodes: backupCodes.map(formatBackupCode)
    });
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({ error: 'Failed to verify MFA enrollment' });
  }
});

// Disable MFA
app.post('/api/auth/mfa/disable', authenticate, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required to disable MFA' });
    }

    // Verify password
    const user = await userDb.getById(req.user.id);
    const isValid = await comparePassword(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Disable MFA
    await userDb.disableMFA(req.user.id);

    // Log the action
    await auditDb.log(
      'disable_mfa',
      'user',
      req.user.id,
      req.user.email,
      { message: 'MFA disabled' },
      req.user.email
    );

    res.json({ message: 'MFA disabled successfully' });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({ error: 'Failed to disable MFA' });
  }
});

// Verify MFA during login
app.post('/api/auth/mfa/verify-login', async (req, res) => {
  try {
    const { mfaSessionId, token, useBackupCode } = req.body;

    if (!mfaSessionId || !token) {
      return res.status(400).json({ error: 'Session ID and token are required' });
    }

    // Get pending login
    const pendingLogin = pendingMFALogins.get(mfaSessionId);

    if (!pendingLogin) {
      return res.status(400).json({ error: 'Invalid or expired MFA session' });
    }

    // Get user
    const user = await userDb.getById(pendingLogin.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let isValid = false;

    if (useBackupCode) {
      // Verify and consume backup code
      const cleanedCode = token.replace(/-/g, '').toUpperCase();
      isValid = await userDb.useBackupCode(user.id, cleanedCode);
    } else {
      // Verify TOTP token
      isValid = verifyTOTP(user.mfa_secret, token);
    }

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    // Clean up pending login
    pendingMFALogins.delete(mfaSessionId);

    // Update last login
    await userDb.updateLastLogin(user.id);

    // Generate token
    const authToken = generateToken(user);

    res.json({
      message: 'Login successful',
      token: authToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        manager_name: user.manager_name,
        manager_first_name: user.manager_first_name,
        manager_last_name: user.manager_last_name,
        manager_email: user.manager_email
      }
    });
  } catch (error) {
    console.error('MFA login verification error:', error);
    res.status(500).json({ error: 'Failed to verify MFA' });
  }
});

// ===== Passkey Endpoints =====

app.get('/api/auth/passkeys', authenticate, async (req, res) => {
  try {
    const passkeys = await passkeyDb.listByUser(req.user.id);
    res.json({ passkeys: passkeys.map(serializePasskey) });
  } catch (error) {
    console.error('Failed to list passkeys:', error);
    res.status(500).json({ error: 'Unable to load passkeys' });
  }
});

app.get('/api/auth/passkeys/config', async (req, res) => {
  try {
    res.json({ enabled: await isPasskeyEnabled() });
  } catch (error) {
    console.error('Failed to load passkey config:', error);
    res.json({ enabled: true });
  }
});

app.post('/api/auth/passkeys/registration-options', authenticate, async (req, res) => {
  try {
    if (!(await isPasskeyEnabled())) {
      return res.status(403).json({ error: 'Passkey registration is disabled by an administrator' });
    }

    const config = await getPasskeyConfig();
    const origin = getExpectedOrigin(req);

    console.log('[Passkey Registration] Configuration:', {
      rpID: config.rpID,
      rpName: config.rpName,
      expectedOrigin: origin,
      requestOrigin: req.get('origin'),
      userEmail: req.user.email
    });

    const userPasskeys = await passkeyDb.listByUser(req.user.id);

    // Filter out passkeys with invalid credential_id before converting
    const validPasskeys = userPasskeys.filter(pk =>
      pk.credential_id && typeof pk.credential_id === 'string'
    );

    console.log('[Passkey Registration] User has', validPasskeys.length, 'existing passkeys');

    const options = await generateRegistrationOptions({
      rpName: config.rpName,
      rpID: config.rpID,
      userName: req.user.email,
      userDisplayName: req.user.name || req.user.email,
      // simplewebauthn requires userID to be a BufferSource (not string)
      userID: Buffer.from(req.user.id.toString()),
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred'
      },
      excludeCredentials: validPasskeys.map((pk) => ({
        id: pk.credential_id,
        type: 'public-key',
        transports: pk.transports ? JSON.parse(pk.transports) : undefined
      }))
    });

    pendingPasskeyRegistrations.set(req.user.id, options.challenge);
    res.json({ options });
  } catch (error) {
    const config = await getPasskeyConfig();
    console.error('Failed to generate passkey registration options:', error);
    console.error('[Passkey Registration] RP ID:', config.rpID);
    console.error('[Passkey Registration] Expected Origin:', getExpectedOrigin(req));
    console.error('[Passkey Registration] Request Origin:', req.get('origin'));
    console.error('[Passkey Registration] Hint: Ensure PASSKEY_RP_ID matches your domain and you\'re accessing via the correct hostname (use localhost, not 127.0.0.1 for local development)');
    res.status(500).json({ error: 'Unable to start passkey registration' });
  }
});

app.post('/api/auth/passkeys/verify-registration', authenticate, async (req, res) => {
  try {
    if (!(await isPasskeyEnabled())) {
      return res.status(403).json({ error: 'Passkey registration is disabled by an administrator' });
    }

    const config = await getPasskeyConfig();
    const { credential, name } = req.body;
    const expectedChallenge = pendingPasskeyRegistrations.get(req.user.id);

    console.log('[Passkey Registration] Starting verification for user:', req.user.email);
    console.log('[Passkey Registration] Credential received:', {
      id: credential?.id?.substring(0, 20) + '...',
      type: credential?.type,
      hasResponse: !!credential?.response
    });

    if (!expectedChallenge) {
      return res.status(400).json({ error: 'No passkey registration in progress' });
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: getExpectedOrigin(req),
      expectedRPID: config.rpID
    });

    console.log('[Passkey Registration] Verification result:', {
      verified: verification?.verified,
      hasRegistrationInfo: !!verification?.registrationInfo
    });

    if (!verification?.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Passkey registration verification failed' });
    }

    const registrationInfo = verification.registrationInfo;

    const normalizeBuffer = (value) => {
      if (!value) return undefined;

      if (typeof value === 'string') {
        try {
          return isoBase64URL.toBuffer(value);
        } catch (err) {
          console.error('[Passkey Registration] Failed to normalize string buffer:', err);
          return undefined;
        }
      }

      if (Buffer.isBuffer(value)) return value;
      if (value instanceof ArrayBuffer) return Buffer.from(value);
      if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);

      console.error('[Passkey Registration] Unsupported buffer type:', typeof value);
      return undefined;
    };

    // Handle both modern and legacy shapes of SimpleWebAuthn registrationInfo
    const credentialID =
      normalizeBuffer(registrationInfo.credentialID) ||
      normalizeBuffer(registrationInfo.credential?.credentialID || registrationInfo.credential?.id);

    const credentialPublicKey =
      normalizeBuffer(registrationInfo.credentialPublicKey) ||
      normalizeBuffer(registrationInfo.credential?.credentialPublicKey || registrationInfo.credential?.publicKey);

    const counter =
      registrationInfo.counter ??
      registrationInfo.credential?.counter ??
      0;

    const { credentialDeviceType, credentialBackedUp } = registrationInfo;

    console.log('[Passkey Registration] Extracted data:', {
      credentialIDLength: credentialID?.length || credentialID?.byteLength || 0,
      credentialIDType: typeof credentialID,
      credentialPublicKeyLength: credentialPublicKey?.length || credentialPublicKey?.byteLength || 0,
      credentialPublicKeyType: typeof credentialPublicKey,
      counter,
      credentialDeviceType,
      credentialBackedUp
    });

    const credentialIdBase64 = credentialID ? isoBase64URL.fromBuffer(credentialID) : credential?.rawId;
    const publicKeyBase64 = credentialPublicKey ? isoBase64URL.fromBuffer(credentialPublicKey) : undefined;

    if (!credentialIdBase64 || !publicKeyBase64) {
      console.error('[Passkey Registration] Missing credential data after verification:', {
        credentialIDPresent: !!credentialID,
        credentialPublicKeyPresent: !!credentialPublicKey,
        credentialIdBase64Length: credentialIdBase64?.length || 0,
        publicKeyBase64Length: publicKeyBase64?.length || 0
      });

      pendingPasskeyRegistrations.delete(req.user.id);
      return res.status(400).json({
        error: 'Passkey registration data was incomplete. Please try creating the passkey again.'
      });
    }

    console.log('[Passkey Registration] Converted to base64:', {
      credentialIdBase64Length: credentialIdBase64?.length || 0,
      publicKeyBase64Length: publicKeyBase64?.length || 0
    });

    const record = await passkeyDb.create({
      userId: req.user.id,
      name: name || 'Passkey',
      credentialId: credentialIdBase64,
      publicKey: publicKeyBase64,
      counter,
      transports: credential?.response?.transports || []
    });

    console.log('[Passkey Registration] Created record with ID:', record.id);

    pendingPasskeyRegistrations.delete(req.user.id);
    const savedPasskey = await passkeyDb.getById(record.id);

    console.log('[Passkey Registration] Retrieved saved passkey:', {
      id: savedPasskey?.id,
      credentialIdLength: savedPasskey?.credential_id?.length || 0,
      publicKeyLength: savedPasskey?.public_key?.length || 0
    });

    res.json({ passkey: serializePasskey(savedPasskey) });
  } catch (error) {
    console.error('Failed to verify passkey registration:', error);
    res.status(500).json({ error: 'Unable to verify passkey registration' });
  }
});

app.post('/api/auth/passkeys/auth-options', async (req, res) => {
  try {
    if (!(await isPasskeyEnabled())) {
      return res.status(403).json({ error: 'Passkey sign-in is disabled by an administrator' });
    }

    const config = await getPasskeyConfig();
    const { email } = req.body;

    // Support both email-based and passwordless (discoverable credential) flows
    let allowCredentials = undefined;
    let userId = null;

    if (email) {
      // Email-based flow: fetch user's passkeys
      const user = await userDb.getByEmail(email);
      if (!user) {
        return res.status(404).json({ error: 'No account found for this email' });
      }

      const userPasskeys = await passkeyDb.listByUser(user.id);
      console.log(`[Passkey Auth] User ${user.email} has ${userPasskeys.length} passkeys`);

      if (!userPasskeys.length) {
        return res.status(400).json({ error: 'No passkeys registered for this account. Please register a passkey first from your profile settings.' });
      }

      // Filter out passkeys with invalid credential_id and convert to buffer
      const validPasskeys = userPasskeys.filter(pk =>
        pk.credential_id && typeof pk.credential_id === 'string'
      );

      console.log(`[Passkey Auth] ${validPasskeys.length} valid passkeys out of ${userPasskeys.length} total`);

      if (validPasskeys.length === 0) {
        console.error('[Passkey Auth] Invalid passkey data detected for user:', user.email);
        console.error('[Passkey Auth] Passkey details:', userPasskeys.map(pk => ({
          id: pk.id,
          name: pk.name,
          credential_id: pk.credential_id,
          credential_id_type: typeof pk.credential_id,
          credential_id_length: pk.credential_id ? pk.credential_id.length : 0,
          public_key: pk.public_key ? 'present' : 'missing',
          created_at: pk.created_at
        })));

        // Clean up invalid passkeys automatically
        console.log('[Passkey Auth] Attempting to clean up invalid passkeys...');
        for (const pk of userPasskeys) {
          if (!pk.credential_id || typeof pk.credential_id !== 'string') {
            try {
              await passkeyDb.delete(pk.id);
              console.log(`[Passkey Auth] Deleted invalid passkey ID ${pk.id}`);
            } catch (deleteErr) {
              console.error(`[Passkey Auth] Failed to delete invalid passkey ID ${pk.id}:`, deleteErr);
            }
          }
        }

        return res.status(400).json({
          error: 'Your passkey data was corrupted and has been automatically removed. Please register a new passkey from your profile settings.'
        });
      }

      // simplewebauthn expects allowCredentials IDs to be base64url strings, not Buffers
      allowCredentials = validPasskeys.map((pk) => ({
        id: pk.credential_id,
        type: 'public-key',
        transports: pk.transports ? JSON.parse(pk.transports) : undefined
      }));

      userId = user.id;
    }

    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID: config.rpID,
      userVerification: 'preferred',
      // If allowCredentials is undefined, this enables conditional mediation (passwordless)
      allowCredentials
    });

    // Store challenge for verification
    // Use challenge as key for passwordless flow, user.id for email-based flow
    const challengeKey = userId || options.challenge;
    pendingPasskeyLogins.set(challengeKey, {
      challenge: options.challenge,
      email: email || null,
      userId
    });

    res.json({ options });
  } catch (error) {
    console.error('Failed to generate passkey authentication options:', error);
    res.status(500).json({ error: 'Unable to start passkey sign in' });
  }
});

app.post('/api/auth/passkeys/verify-authentication', async (req, res) => {
  try {
    if (!(await isPasskeyEnabled())) {
      return res.status(403).json({ error: 'Passkey sign-in is disabled by an administrator' });
    }

    const config = await getPasskeyConfig();
    const { email, credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Credential response is required' });
    }

    // Extract the challenge from clientDataJSON so we can match the correct pending request
    let clientChallenge = null;
    try {
      const clientDataBuffer = Buffer.from(credential?.response?.clientDataJSON || '', 'base64url');
      const clientDataJson = JSON.parse(clientDataBuffer.toString('utf8'));
      if (clientDataJson?.challenge) {
        // Normalize to base64url without padding for consistent lookups
        clientChallenge = Buffer.from(clientDataJson.challenge, 'base64url').toString('base64url');
      }
    } catch (err) {
      console.warn('[Passkey Auth] Failed to parse clientDataJSON challenge:', err.message);
    }

    // Look up passkey by credential ID
    const dbPasskey = await passkeyDb.getByCredentialId(credential.id);
    if (!dbPasskey) {
      return res.status(404).json({ error: 'Passkey not recognized' });
    }

    // Validate credential_id is a string before using it
    if (!dbPasskey.credential_id || typeof dbPasskey.credential_id !== 'string') {
      return res.status(500).json({ error: 'Invalid passkey data in database' });
    }

    // Get user info
    const user = email
      ? await userDb.getByEmail(email)
      : await userDb.getById(dbPasskey.user_id);

    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    // Verify passkey belongs to the user
    if (dbPasskey.user_id !== user.id) {
      return res.status(403).json({ error: 'Passkey does not belong to this account' });
    }

    // Find the pending authentication challenge
    // For email-based flow, it's keyed by user.id; for passwordless, we need to search
    let pending = pendingPasskeyLogins.get(user.id);

    if (!pending && clientChallenge) {
      pending = pendingPasskeyLogins.get(clientChallenge);
    }

    if (!pending) {
      // Search for challenge in passwordless flow storage
      for (const [key, value] of pendingPasskeyLogins.entries()) {
        if (value.userId === null || value.userId === user.id) {
          pending = value;
          break;
        }
      }
    }

    if (!pending) {
      return res.status(400).json({ error: 'No pending passkey authentication found' });
    }

    // Verify the authentication response using the credential format expected by simplewebauthn
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: pending.challenge,
      expectedOrigin: getExpectedOrigin(req),
      expectedRPID: config.rpID,
      credential: {
        id: dbPasskey.credential_id,
        publicKey: isoBase64URL.toBuffer(dbPasskey.public_key),
        counter: typeof dbPasskey.counter === 'number' && Number.isFinite(dbPasskey.counter)
          ? dbPasskey.counter
          : 0,
        transports: dbPasskey.transports ? JSON.parse(dbPasskey.transports) : []
      }
    });

    if (!verification?.verified || !verification.authenticationInfo) {
      return res.status(400).json({ error: 'Passkey authentication failed' });
    }

    // Update counter and last login
    await passkeyDb.updateCounter(dbPasskey.id, verification.authenticationInfo.newCounter ?? dbPasskey.counter);
    await userDb.updateLastLogin(user.id);

    // Clean up pending authentication(s)
    pendingPasskeyLogins.delete(user.id);
    pendingPasskeyLogins.delete(pending.challenge);

    const token = generateToken(user);

    res.json({ token, user });
  } catch (error) {
    console.error('Failed to verify passkey authentication:', error);
    res.status(500).json({ error: 'Unable to verify passkey sign in' });
  }
});

app.delete('/api/auth/passkeys/:id', authenticate, async (req, res) => {
  try {
    const passkey = await passkeyDb.getById(req.params.id);

    if (!passkey || passkey.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Passkey not found' });
    }

    await passkeyDb.delete(req.params.id);
    res.json({ message: 'Passkey removed' });
  } catch (error) {
    console.error('Failed to delete passkey:', error);
    res.status(500).json({ error: 'Unable to delete passkey' });
  }
});

// Get all users (admin only)
app.get('/api/auth/users', authenticate, authorize('admin', 'manager'), async (req, res) => {
  try {
    const users = await userDb.getAll();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Update user details (admin only)
app.put('/api/auth/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { first_name, last_name, manager_first_name, manager_last_name, manager_email, profile_image } = req.body;

    const targetUser = await userDb.getById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    if (!manager_first_name || !manager_last_name || !manager_email) {
      return res.status(400).json({ error: 'Manager first name, last name, and email are required' });
    }

    let normalizedProfileImage = targetUser.profile_image;
    if (Object.prototype.hasOwnProperty.call(req.body, 'profile_image')) {
      if (!profile_image) {
        normalizedProfileImage = null;
      } else if (typeof profile_image !== 'string' || !profile_image.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Profile image must be a base64-encoded image data URL' });
      } else {
        const base64Payload = profile_image.split(',')[1] || '';
        const buffer = Buffer.from(base64Payload, 'base64');
        if (buffer.length > 5 * 1024 * 1024) {
          return res.status(400).json({ error: 'Profile image must be 5MB or smaller' });
        }
        normalizedProfileImage = profile_image;
      }
    }

    const name = `${first_name} ${last_name}`;

    await userDb.updateProfile(userId, {
      name,
      first_name,
      last_name,
      manager_first_name,
      manager_last_name,
      manager_email,
      profile_image: normalizedProfileImage
    });

    const updatedUser = await userDb.getById(userId);

    await auditDb.log(
      'admin_update_user',
      'user',
      updatedUser.id,
      updatedUser.email,
      {
        old_first_name: targetUser.first_name,
        old_last_name: targetUser.last_name,
        old_manager_first_name: targetUser.manager_first_name,
        old_manager_last_name: targetUser.manager_last_name,
        old_manager_email: targetUser.manager_email,
        old_profile_image_set: !!targetUser.profile_image,
        new_first_name: first_name,
        new_last_name: last_name,
        new_manager_first_name: manager_first_name,
        new_manager_last_name: manager_last_name,
        new_manager_email: manager_email,
        new_profile_image_set: !!normalizedProfileImage,
        changed_by: req.user.email
      },
      req.user.email
    );

    const managerChanged =
      targetUser.manager_first_name !== manager_first_name || 
      targetUser.manager_last_name !== manager_last_name ||
      targetUser.manager_email !== manager_email;

    if (managerChanged) {
      try {
        const manager_name = `${manager_first_name} ${manager_last_name}`;
        await assetDb.updateManagerForEmployee(
          updatedUser.email,
          manager_name,
          manager_email
        );
      } catch (error) {
        console.error('Failed to update manager on assets:', error);
      }
    }

    res.json({
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        manager_first_name: updatedUser.manager_first_name,
        manager_last_name: updatedUser.manager_last_name,
        manager_email: updatedUser.manager_email
      }
    });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Update user role (admin only)
app.put('/api/auth/users/:id/role', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    const userId = parseInt(req.params.id);

    // Validation
    if (!role || !['admin', 'manager', 'employee'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role. Must be one of: admin, manager, employee'
      });
    }

    const user = await userDb.getById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admin from demoting themselves
    if (userId === req.user.id && role !== 'admin') {
      return res.status(403).json({
        error: 'Cannot change your own admin role'
      });
    }

    const oldRole = user.role;
    await userDb.updateRole(userId, role);
    const updatedUser = await userDb.getById(userId);

    // Log audit
    await auditDb.log(
      'update_role',
      'user',
      updatedUser.id,
      updatedUser.email,
      {
        old_role: oldRole,
        new_role: role,
        changed_by: req.user.email
      },
      req.user.email
    );

    res.json({
      message: 'User role updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        manager_name: updatedUser.manager_name,
        manager_first_name: updatedUser.manager_first_name,
        manager_last_name: updatedUser.manager_last_name,
        manager_email: updatedUser.manager_email
      }
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Delete user (admin only)
app.delete('/api/auth/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(403).json({
        error: 'Cannot delete your own account'
      });
    }

    const user = await userDb.getById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log audit before deletion
    await auditDb.log(
      'delete',
      'user',
      user.id,
      user.email,
      {
        name: user.name,
        email: user.email,
        role: user.role,
        deleted_by: req.user.email
      },
      req.user.email
    );

    await userDb.delete(userId);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ===== OIDC Settings Management (Admin Only) =====

// Get OIDC settings
app.get('/api/admin/oidc-settings', authenticate, authorize('admin'), async (req, res) => {
  try {
    const settings = await oidcSettingsDb.get();
    // Don't send client_secret to frontend for security
    const { client_secret, ...safeSettings } = settings || {};
    res.json({
      ...safeSettings,
      sso_button_text: safeSettings?.sso_button_text || 'Sign In with SSO',
      sso_button_help_text: safeSettings?.sso_button_help_text || '',
      sso_button_variant: safeSettings?.sso_button_variant || 'outline',
      has_client_secret: !!client_secret
    });
  } catch (error) {
    console.error('Get OIDC settings error:', error);
    res.status(500).json({ error: 'Failed to get OIDC settings' });
  }
});

// Update OIDC settings
app.put('/api/admin/oidc-settings', authenticate, authorize('admin'), async (req, res) => {
  try {
    const settings = req.body;

    // Validate required fields if enabling OIDC
    if (settings.enabled) {
      if (!settings.issuer_url || !settings.client_id || !settings.redirect_uri) {
        return res.status(400).json({
          error: 'Issuer URL, Client ID, and Redirect URI are required when enabling OIDC'
        });
      }
    }

    // Get existing settings to preserve client_secret if not provided
    const existingSettings = await oidcSettingsDb.get();
    if (!settings.client_secret && existingSettings?.client_secret) {
      settings.client_secret = existingSettings.client_secret;
    }

    settings.sso_button_text = settings.sso_button_text || 'Sign In with SSO';
    settings.sso_button_help_text = settings.sso_button_help_text || '';
    settings.sso_button_variant = settings.sso_button_variant || 'outline';

    // Update settings
    await oidcSettingsDb.update(settings, req.user.email);

    // Reinitialize OIDC client with new settings
    if (settings.enabled) {
      await initializeOIDC(settings);
    }

    // Log the change
    await auditDb.log(
      'update',
      'oidc_settings',
      1,
      'OIDC Configuration',
      `OIDC settings updated (enabled: ${settings.enabled})`,
      req.user.email
    );

    res.json({ message: 'OIDC settings updated successfully' });
  } catch (error) {
    console.error('Update OIDC settings error:', error);
    res.status(500).json({ error: 'Failed to update OIDC settings' });
  }
});

// Branding settings routes (public read, admin write)
app.get('/api/branding', async (req, res) => {
  try {
    const settings = await brandingSettingsDb.get();
    res.json(settings || {});
  } catch (error) {
    console.error('Get branding settings error:', error);
    res.status(500).json({ error: 'Failed to load branding settings' });
  }
});

app.put('/api/admin/branding', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { 
      logo_data, 
      logo_filename, 
      logo_content_type,
      site_name,
      sub_title,
      favicon_data,
      favicon_filename,
      favicon_content_type,
      primary_color,
      include_logo_in_emails,
      app_url
    } = req.body;

    console.log('[Branding] Update request received:', {
      user: req.user.email,
      filename: logo_filename,
      content_type: logo_content_type,
      data_length: logo_data ? logo_data.length : 0,
      data_prefix: logo_data ? logo_data.substring(0, 50) : 'null',
      site_name,
      sub_title,
      favicon_filename,
      primary_color,
      include_logo_in_emails,
      app_url
    });

    // Validate logo data if provided
    if (logo_data && !logo_data.startsWith('data:image/')) {
      console.error('[Branding] Invalid logo data format - does not start with data:image/');
      return res.status(400).json({ error: 'Invalid logo data format' });
    }

    // Validate favicon data if provided
    if (favicon_data && !favicon_data.startsWith('data:image/')) {
      console.error('[Branding] Invalid favicon data format - does not start with data:image/');
      return res.status(400).json({ error: 'Invalid favicon data format' });
    }

    // Validate primary color if provided (basic hex color validation)
    if (primary_color && !/^#[0-9A-Fa-f]{6}$/.test(primary_color)) {
      console.error('[Branding] Invalid primary color format:', primary_color);
      return res.status(400).json({ error: 'Invalid primary color format. Use hex format like #3B82F6' });
    }

    await brandingSettingsDb.update({
      logo_data,
      logo_filename,
      logo_content_type,
      site_name,
      sub_title,
      favicon_data,
      favicon_filename,
      favicon_content_type,
      primary_color,
      include_logo_in_emails,
      app_url
    }, req.user.email);

    console.log('[Branding] Settings updated successfully in database');

    // Build audit log details
    const changes = [];
    if (logo_filename) changes.push(`Logo: ${logo_filename}`);
    if (favicon_filename) changes.push(`Favicon: ${favicon_filename}`);
    if (site_name) changes.push(`Site name: ${site_name}`);
    if (sub_title) changes.push(`Subtitle: ${sub_title}`);
    if (primary_color) changes.push(`Color: ${primary_color}`);
    if (include_logo_in_emails !== undefined) changes.push(`Email logo: ${include_logo_in_emails ? 'enabled' : 'disabled'}`);
    if (app_url !== undefined) changes.push(`App URL: ${app_url || 'cleared'}`);

    await auditDb.log(
      'update',
      'branding_settings',
      1,
      'Branding Configuration',
      changes.length > 0 ? changes.join(', ') : 'Branding settings updated',
      req.user.email
    );

    res.json({ message: 'Branding settings updated successfully' });
  } catch (error) {
    console.error('Update branding settings error:', error);
    res.status(500).json({ error: 'Failed to update branding settings' });
  }
});

app.delete('/api/admin/branding', authenticate, authorize('admin'), async (req, res) => {
  try {
    await brandingSettingsDb.delete();

    await auditDb.log(
      'delete',
      'branding_settings',
      1,
      'Branding Configuration',
      'Logo removed',
      req.user.email
    );

    res.json({ message: 'Logo removed successfully' });
  } catch (error) {
    console.error('Delete branding settings error:', error);
    res.status(500).json({ error: 'Failed to remove logo' });
  }
});

// Passkey settings routes (admin only)
app.get('/api/admin/passkey-settings', authenticate, authorize('admin'), async (req, res) => {
  try {
    const dbSettings = await passkeySettingsDb.get();
    const managedByEnv = Boolean(
      process.env.PASSKEY_RP_ID ||
      process.env.PASSKEY_RP_NAME ||
      process.env.PASSKEY_ORIGIN ||
      process.env.PASSKEY_ENABLED !== undefined
    );

    const enabled = process.env.PASSKEY_ENABLED !== undefined
      ? parseBooleanEnv(process.env.PASSKEY_ENABLED, true)
      : dbSettings?.enabled !== 0;

    // Environment variables take precedence if set
    const settings = {
      rp_id: process.env.PASSKEY_RP_ID || dbSettings?.rp_id || 'localhost',
      rp_name: process.env.PASSKEY_RP_NAME || dbSettings?.rp_name || 'KARS - KeyData Asset Registration System',
      origin: process.env.PASSKEY_ORIGIN || dbSettings?.origin || 'http://localhost:5173',
      enabled,
      managed_by_env: managedByEnv,
      updated_at: dbSettings?.updated_at,
      updated_by: dbSettings?.updated_by
    };

    res.json(settings);
  } catch (error) {
    console.error('Get passkey settings error:', error);
    res.status(500).json({ error: 'Failed to get passkey settings' });
  }
});

app.put('/api/admin/passkey-settings', authenticate, authorize('admin'), async (req, res) => {
  try {
    const managedByEnv = Boolean(
      process.env.PASSKEY_RP_ID ||
      process.env.PASSKEY_RP_NAME ||
      process.env.PASSKEY_ORIGIN ||
      process.env.PASSKEY_ENABLED !== undefined
    );

    if (managedByEnv) {
      return res.status(400).json({
        error: 'Passkey settings are managed by environment variables. Remove PASSKEY_RP_ID, PASSKEY_RP_NAME, PASSKEY_ORIGIN, and PASSKEY_ENABLED from environment to use database configuration.'
      });
    }

    const { rp_id, rp_name, origin, enabled = true } = req.body;

    // Validation
    if (!rp_id || !rp_name || !origin) {
      return res.status(400).json({
        error: 'RP ID, RP Name, and Origin are all required'
      });
    }

    // Validate origin format
    try {
      new URL(origin);
    } catch (err) {
      return res.status(400).json({
        error: 'Origin must be a valid URL (e.g., http://localhost:5173 or https://example.com)'
      });
    }

    // Update settings
    await passkeySettingsDb.update({
      rp_id,
      rp_name,
      origin,
      enabled
    }, req.user.email);

    // Log the change
    await auditDb.log(
      'update',
      'passkey_settings',
      1,
      'Passkey Configuration',
      `Passkey settings updated (RP ID: ${rp_id})`,
      req.user.email
    );

    res.json({
      message: 'Passkey settings updated successfully. Restart required for changes to take effect.',
      restart_required: true
    });
  } catch (error) {
    console.error('Update passkey settings error:', error);
    res.status(500).json({ error: 'Failed to update passkey settings' });
  }
});

// Database engine settings (admin only)
const formatDatabaseSettings = () => {
  const settings = databaseSettings.get();
  return {
    engine: settings.engine,
    postgresUrl: settings.postgresUrl,
    managedByEnv: settings.managedByEnv,
    effectiveEngine: databaseEngine,
    restartRequired: true
  };
};

app.get('/api/admin/database', authenticate, authorize('admin'), (req, res) => {
  try {
    res.json(formatDatabaseSettings());
  } catch (error) {
    console.error('Get database settings error:', error);
    res.status(500).json({ error: 'Failed to load database settings' });
  }
});

app.put('/api/admin/database', authenticate, authorize('admin'), async (req, res) => {
  try {
    const current = databaseSettings.get();

    if (current.managedByEnv) {
      return res.status(400).json({ error: 'Database settings are managed by environment variables' });
    }

    const { engine, postgresUrl } = req.body;
    const updated = await databaseSettings.update({ engine, postgresUrl });

    res.json({
      ...updated,
      effectiveEngine: updated.engine,
      restartRequired: true
    });
  } catch (error) {
    console.error('Update database settings error:', error);
    res.status(500).json({ error: error.message || 'Failed to update database settings' });
  }
});

app.post('/api/admin/database/import-sqlite', authenticate, authorize('admin'), upload.single('sqliteFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Upload a SQLite assets.db file to import' });
  }

  if (databaseEngine !== 'postgres') {
    await unlink(req.file.path).catch(() => {});
    return res.status(400).json({ error: 'Switch to PostgreSQL before importing SQLite data' });
  }

  try {
    const results = await importSqliteDatabase(req.file.path);
    res.json({
      message: 'SQLite data imported into PostgreSQL successfully',
      imported: results
    });
  } catch (error) {
    console.error('SQLite import failed:', error);
    res.status(500).json({ error: error.message || 'Failed to import SQLite data' });
  } finally {
    await unlink(req.file.path).catch(() => {});
  }
});

// ===== HubSpot Integration Endpoints =====

// Get HubSpot settings (Admin only)
app.get('/api/admin/hubspot-settings', authenticate, authorize('admin'), async (req, res) => {
  try {
    const settings = await hubspotSettingsDb.get();
    res.json(settings);
  } catch (error) {
    console.error('Get HubSpot settings error:', error);
    res.status(500).json({ error: 'Failed to load HubSpot settings' });
  }
});

// Update HubSpot settings (Admin only)
app.put('/api/admin/hubspot-settings', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { enabled, access_token, auto_sync_enabled, sync_interval } = req.body;
    
    await hubspotSettingsDb.update({
      enabled,
      access_token,
      auto_sync_enabled,
      sync_interval
    });

    // Log the settings change
    await auditDb.log(
      'update',
      'hubspot_settings',
      1,
      'HubSpot Integration',
      'Updated HubSpot integration settings',
      req.user.email
    );

    const updatedSettings = await hubspotSettingsDb.get();
    res.json({ message: 'HubSpot settings saved successfully', settings: updatedSettings });
  } catch (error) {
    console.error('Update HubSpot settings error:', error);
    res.status(500).json({ error: error.message || 'Failed to update HubSpot settings' });
  }
});

// Test HubSpot connection (Admin only)
app.post('/api/admin/hubspot/test-connection', authenticate, authorize('admin'), async (req, res) => {
  try {
    const accessToken = await hubspotSettingsDb.getAccessToken();
    
    if (!accessToken) {
      return res.status(400).json({ error: 'HubSpot access token is not configured' });
    }

    const result = await testHubSpotConnection(accessToken);
    
    if (result.success) {
      res.json({ message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('HubSpot connection test error:', error);
    res.status(500).json({ error: error.message || 'Failed to test HubSpot connection' });
  }
});

// Rate limiting for sync operations (simple in-memory implementation)
const syncRateLimiter = new Map();
const SYNC_RATE_LIMIT_MS = 60000; // 1 minute

// Sync companies from HubSpot (Admin only)
app.post('/api/admin/hubspot/sync-companies', authenticate, authorize('admin'), async (req, res) => {
  try {
    // Check rate limiting
    const lastSync = syncRateLimiter.get('hubspot-sync');
    if (lastSync && Date.now() - lastSync < SYNC_RATE_LIMIT_MS) {
      const remainingSeconds = Math.ceil((SYNC_RATE_LIMIT_MS - (Date.now() - lastSync)) / 1000);
      return res.status(429).json({ 
        error: `Please wait ${remainingSeconds} seconds before syncing again` 
      });
    }

    const accessToken = await hubspotSettingsDb.getAccessToken();
    
    if (!accessToken) {
      return res.status(400).json({ error: 'HubSpot access token is not configured' });
    }

    const syncStartedAt = new Date().toISOString();
    
    // Update rate limiter
    syncRateLimiter.set('hubspot-sync', Date.now());

    try {
      // Perform the sync
      const result = await syncCompaniesToKARS(
        accessToken,
        companyDb,
        auditDb,
        req.user.email
      );

      const syncCompletedAt = new Date().toISOString();

      // Log the sync
      await hubspotSyncLogDb.log({
        sync_started_at: syncStartedAt,
        sync_completed_at: syncCompletedAt,
        status: 'success',
        companies_found: result.companiesFound,
        companies_created: result.companiesCreated,
        companies_updated: result.companiesUpdated,
        error_message: result.errors.length > 0 ? JSON.stringify(result.errors) : null
      });

      // Update HubSpot settings with last sync info
      await hubspotSettingsDb.updateSyncStatus(
        'success',
        result.companiesCreated + result.companiesUpdated
      );

      // Log to audit log
      await auditDb.log(
        'sync',
        'hubspot',
        null,
        'HubSpot Companies',
        `Synced ${result.companiesFound} companies: ${result.companiesCreated} created, ${result.companiesUpdated} updated`,
        req.user.email
      );

      res.json({
        message: 'HubSpot sync completed successfully',
        ...result
      });
    } catch (syncError) {
      const syncCompletedAt = new Date().toISOString();

      // Log the failed sync
      await hubspotSyncLogDb.log({
        sync_started_at: syncStartedAt,
        sync_completed_at: syncCompletedAt,
        status: 'error',
        companies_found: 0,
        companies_created: 0,
        companies_updated: 0,
        error_message: syncError.message
      });

      // Update HubSpot settings with last sync info
      await hubspotSettingsDb.updateSyncStatus('error', 0);

      throw syncError;
    }
  } catch (error) {
    console.error('HubSpot sync error:', error);
    res.status(500).json({ error: error.message || 'Failed to sync companies from HubSpot' });
  }
});

// Get HubSpot sync history (Admin only)
app.get('/api/admin/hubspot/sync-history', authenticate, authorize('admin'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = await hubspotSyncLogDb.getHistory(limit);
    res.json(history);
  } catch (error) {
    console.error('Get HubSpot sync history error:', error);
    res.status(500).json({ error: 'Failed to load sync history' });
  }
});

// ===== SMTP Notification Settings Endpoints =====

// Get SMTP notification settings
app.get('/api/admin/notification-settings', authenticate, authorize('admin'), async (req, res) => {
  try {
    const settings = await smtpSettingsDb.get();
    res.json(settings);
  } catch (error) {
    console.error('Get SMTP settings error:', error);
    res.status(500).json({ error: 'Failed to load notification settings' });
  }
});

// Update SMTP notification settings
app.put('/api/admin/notification-settings', authenticate, authorize('admin'), async (req, res) => {
  try {
    const {
      enabled,
      host,
      port,
      use_tls,
      username,
      password,
      clear_password,
      auth_method,
      from_name,
      from_email,
      default_recipient
    } = req.body;

    // Build update object
    const updateData = {
      enabled,
      host,
      port,
      use_tls,
      username,
      auth_method,
      from_name,
      from_email,
      default_recipient
    };

    // Handle password encryption
    // Only encrypt and update if password is provided and not the placeholder
    if (password && password !== '[REDACTED]' && password !== '') {
      try {
        const encryptedPassword = encryptValue(password);
        updateData.password_encrypted = encryptedPassword;
      } catch (error) {
        console.error('Password encryption error:', error);
        return res.status(500).json({ 
          error: 'Failed to encrypt password. Please check KARS_MASTER_KEY configuration.' 
        });
      }
    } else if (clear_password === true) {
      // Explicitly clear the password if requested
      updateData.clear_password = true;
    }

    await smtpSettingsDb.update(updateData);

    // Log the action
    await auditDb.log(
      'update',
      'smtp_settings',
      1,
      'SMTP Notification Settings',
      `Updated SMTP settings. Enabled: ${enabled ? 'Yes' : 'No'}`,
      req.user.email
    );

    // Return updated settings (without password)
    const updatedSettings = await smtpSettingsDb.get();
    res.json(updatedSettings);
  } catch (error) {
    console.error('Update SMTP settings error:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

// Send test email
app.post('/api/admin/notification-settings/test', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { recipient } = req.body;

    // Validate that settings are enabled
    const settings = await smtpSettingsDb.get();
    if (!settings || !settings.enabled) {
      return res.status(400).json({ 
        error: 'SMTP settings are not enabled. Please enable them before sending a test email.' 
      });
    }

    // Send test email
    const result = await sendTestEmail(recipient);

    if (result.success) {
      // Log the action
      await auditDb.log(
        'test',
        'smtp_settings',
        1,
        'SMTP Notification Settings',
        `Sent test email to ${recipient || settings.default_recipient}`,
        req.user.email
      );

      res.json({ 
        success: true, 
        message: result.message,
        messageId: result.messageId
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Send test email error:', error);
    res.status(500).json({ 
      error: 'Failed to send test email',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ===== Email Template Management Endpoints =====

// Get all email templates
app.get('/api/admin/email-templates', authenticate, authorize('admin'), async (req, res) => {
  try {
    const templates = await emailTemplateDb.getAll();
    res.json({ success: true, templates });
  } catch (error) {
    console.error('Get email templates error:', error);
    res.status(500).json({ error: 'Failed to load email templates' });
  }
});

// Get single email template by key
app.get('/api/admin/email-templates/:key', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { key } = req.params;
    const template = await emailTemplateDb.getByKey(key);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ success: true, template });
  } catch (error) {
    console.error('Get email template error:', error);
    res.status(500).json({ error: 'Failed to load email template' });
  }
});

// Update email template
app.put('/api/admin/email-templates/:key', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { key } = req.params;
    const { subject, html_body, text_body } = req.body;
    
    // Validate required fields
    if (!subject || !html_body || !text_body) {
      return res.status(400).json({ error: 'Subject, HTML body, and text body are required' });
    }
    
    // Check if template exists
    const existing = await emailTemplateDb.getByKey(key);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Update template
    await emailTemplateDb.update(key, { subject, html_body, text_body }, req.user.email);
    
    // Log the action
    await auditDb.log(
      'update',
      'email_template',
      existing.id,
      existing.name,
      `Updated email template: ${existing.name}`,
      req.user.email
    );
    
    res.json({ success: true, message: 'Email template updated successfully' });
  } catch (error) {
    console.error('Update email template error:', error);
    res.status(500).json({ error: 'Failed to update email template' });
  }
});

// Reset email template to default
app.post('/api/admin/email-templates/:key/reset', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { key } = req.params;
    
    // Check if template exists
    const existing = await emailTemplateDb.getByKey(key);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Reset template to default values
    await emailTemplateDb.reset(key);
    
    // Log the action
    await auditDb.log(
      'reset',
      'email_template',
      existing.id,
      existing.name,
      `Reset email template to default: ${existing.name}`,
      req.user.email
    );
    
    res.json({ success: true, message: 'Email template reset to default values' });
  } catch (error) {
    console.error('Reset email template error:', error);
    res.status(500).json({ error: 'Failed to reset email template' });
  }
});

// Preview email template with sample data
app.post('/api/admin/email-templates/:key/preview', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { key } = req.params;
    const { subject, html_body, text_body } = req.body;
    
    // Get branding settings for preview
    const branding = await brandingSettingsDb.get();
    const siteName = branding?.site_name || 'KARS';
    
    // Define sample variables for each template type
    const sampleVariables = {
      test_email: {
        siteName,
        smtpHost: 'smtp.example.com',
        smtpPort: '587',
        timestamp: new Date().toISOString()
      },
      password_reset: {
        siteName,
        resetUrl: 'https://example.com/reset-password?token=sample-token-123',
        expiryTime: '1 hour'
      },
      attestation_launch: {
        siteName,
        campaignName: 'Q4 2024 Asset Attestation',
        campaignDescription: 'Please review and confirm all assets assigned to you for the fourth quarter.',
        attestationUrl: 'https://example.com/my-attestations'
      },
      attestation_reminder: {
        siteName,
        campaignName: 'Q4 2024 Asset Attestation',
        attestationUrl: 'https://example.com/my-attestations'
      },
      attestation_escalation: {
        siteName,
        campaignName: 'Q4 2024 Asset Attestation',
        employeeName: 'John Doe',
        employeeEmail: 'john.doe@example.com',
        escalationDays: '10'
      },
      attestation_complete: {
        siteName,
        campaignName: 'Q4 2024 Asset Attestation',
        employeeName: 'John Doe',
        employeeEmail: 'john.doe@example.com',
        completedAt: new Date().toLocaleString()
      }
    };
    
    const variables = sampleVariables[key] || { siteName };
    
    // Substitute variables in the provided content
    const substituteVariables = (template, vars) => {
      let result = template || '';
      for (const [varKey, value] of Object.entries(vars)) {
        const regex = new RegExp(`\\{\\{${varKey}\\}\\}`, 'g');
        result = result.replace(regex, value || '');
      }
      return result;
    };
    
    const previewSubject = substituteVariables(subject, variables);
    const previewHtml = substituteVariables(html_body, variables);
    const previewText = substituteVariables(text_body, variables);
    
    // Wrap HTML with branding (simulating actual email)
    const buildEmailHtml = (branding, siteName, content) => {
      const logoHeader = branding?.include_logo_in_emails && branding?.logo_data
        ? `<div style="text-align: center; margin-bottom: 20px;">
             <img src="${branding.logo_data}" alt="${siteName}" style="max-height: 80px; max-width: 300px; object-fit: contain;" />
           </div>`
        : '';
    
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          ${logoHeader}
          ${content}
        </div>
      `;
    };
    
    const wrappedHtml = buildEmailHtml(branding, siteName, previewHtml);
    
    res.json({
      success: true,
      preview: {
        subject: previewSubject,
        html: wrappedHtml,
        text: previewText,
        variables: Object.keys(variables)
      }
    });
  } catch (error) {
    console.error('Preview email template error:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

// ===== OIDC Authentication Endpoints =====

// Store for state tokens (in production, use Redis or similar)
const stateStore = new Map();

// Get OIDC configuration (for frontend)
app.get('/api/auth/oidc/config', async (req, res) => {
  try {
    const settings = await oidcSettingsDb.get();
    const buttonText = settings?.sso_button_text || 'Sign In with SSO';
    const buttonHelpText = settings?.sso_button_help_text || '';
    const buttonVariant = settings?.sso_button_variant || 'outline';
    res.json({
      enabled: settings?.enabled === 1 && isOIDCEnabled(),
      button_text: buttonText,
      button_help_text: buttonHelpText,
      button_variant: buttonVariant
    });
  } catch (error) {
    res.json({
      enabled: false,
      button_text: 'Sign In with SSO',
      button_help_text: '',
      button_variant: 'outline'
    });
  }
});

// Initiate OIDC login
app.get('/api/auth/oidc/login', async (req, res) => {
  try {
    if (!isOIDCEnabled()) {
      return res.status(503).json({ error: 'OIDC is not enabled' });
    }

    // Generate state token for CSRF protection
    const state = randomBytes(32).toString('hex');

    // Store state with timestamp (expire after 10 minutes)
    stateStore.set(state, {
      timestamp: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    // Clean up expired states
    for (const [key, value] of stateStore.entries()) {
      if (Date.now() > value.expiresAt) {
        stateStore.delete(key);
      }
    }

    const authUrl = await getAuthorizationUrl(state);
    res.json({ authUrl, state });
  } catch (error) {
    console.error('OIDC login init error:', error);
    res.status(500).json({ error: 'Failed to initiate OIDC login' });
  }
});

// Handle OIDC callback
app.get('/api/auth/oidc/callback', async (req, res) => {
  try {
    if (!isOIDCEnabled()) {
      return res.status(503).json({ error: 'OIDC is not enabled' });
    }

    const { code, state, error: oidcError, error_description } = req.query;

    // Check for OIDC errors
    if (oidcError) {
      console.error('OIDC error:', oidcError, error_description);
      return res.status(400).json({
        error: 'OIDC authentication failed',
        details: error_description || oidcError
      });
    }

    // Validate state
    if (!state || !stateStore.has(state)) {
      return res.status(400).json({ error: 'Invalid or expired state' });
    }

    // Remove used state
    stateStore.delete(state);

    if (!code) {
      return res.status(400).json({ error: 'Authorization code missing' });
    }

    // Exchange code for tokens
    const tokenSet = await handleCallback(req.query, state);

    // Get user info and ID token claims
    const userinfo = await getUserInfo(tokenSet);
    const claims = tokenSet.claims();

    // Merge claims from both sources
    const allClaims = { ...claims, ...userinfo };

    // Extract user data from claims
    const userData = extractUserData(allClaims);

    // Find or create user (JIT provisioning)
    let user = await userDb.getByOIDCSub(userData.oidcSub);

    if (!user) {
      // Check if user with same email exists
      user = await userDb.getByEmail(userData.email);

      if (user) {
        // Link existing user to OIDC
        console.log(`Linking existing user ${userData.email} to OIDC subject ${userData.oidcSub}`);
        await userDb.linkOIDC(user.id, userData.oidcSub);
      } else {
        // Create new user (JIT provisioning)
        console.log(`Creating new user via OIDC: ${userData.email} with role ${userData.role}`);
        const result = await userDb.createFromOIDC({
          email: userData.email,
          name: userData.fullName,
          first_name: userData.firstName,
          last_name: userData.lastName,
          role: userData.role,
          oidcSub: userData.oidcSub,
          manager_first_name: userData.managerFirstName,
          manager_last_name: userData.managerLastName,
          manager_email: userData.managerEmail
        });

        user = await userDb.getById(result.id);

        // Log user creation
        await auditDb.log(
          'create',
          'user',
          user.id,
          user.email,
          `User created via OIDC with role ${user.role}`,
          user.email
        );
      }
    }

    // Update last login
    await userDb.updateLastLogin(user.id);

    // Check for pending attestation invites and convert them
    try {
      const pendingInvites = await attestationPendingInviteDb.getActiveByEmail(user.email);
      for (const invite of pendingInvites) {
        // Only convert if campaign is still active
        const campaign = await attestationCampaignDb.getById(invite.campaign_id);
        if (campaign && campaign.status === 'active') {
          // Create attestation record
          const record = await attestationRecordDb.create({
            campaign_id: invite.campaign_id,
            user_id: user.id,
            status: 'pending'
          });
          
          // Update invite
          await attestationPendingInviteDb.update(invite.id, {
            registered_at: new Date().toISOString(),
            converted_record_id: record.id
          });
          
          // Send "attestation ready" email
          try {
            const { sendAttestationReadyEmail } = await import('./services/smtpMailer.js');
            await sendAttestationReadyEmail(user.email, user.first_name, campaign);
          } catch (emailError) {
            console.error(`Failed to send attestation ready email to ${user.email}:`, emailError);
          }
          
          console.log(`Converted pending invite to attestation record for ${user.email} in campaign ${campaign.name}`);
        }
      }
    } catch (inviteError) {
      console.error('Error converting pending attestation invites:', inviteError);
      // Don't fail login if invite conversion fails
    }

    // Generate JWT token
    const token = generateToken(user);

    res.json({
      message: 'OIDC login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        manager_name: user.manager_name,
        manager_first_name: user.manager_first_name,
        manager_last_name: user.manager_last_name,
        manager_email: user.manager_email,
        profile_complete: user.profile_complete
      }
    });
  } catch (error) {
    console.error('OIDC callback error:', error);
    res.status(500).json({ error: 'Failed to process OIDC callback', details: error.message });
  }
});

// Get dashboard stats (counts for assets, employees, companies)
app.get('/api/stats', authenticate, async (req, res) => {
  try {
    const assets = await assetDb.getAll();
    const users = await userDb.getAll();
    const companies = await companyDb.getAll();

    res.json({
      assetsCount: assets.length,
      employeesCount: users.length,
      companiesCount: companies.length
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get all assets (with role-based filtering)
app.get('/api/assets', authenticate, async (req, res) => {
  try {
    const user = await userDb.getById(req.user.id);
    
    // Use scoped query for role-based filtering
    const filteredAssets = await assetDb.getScopedForUser(user);

    res.json(filteredAssets);
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// Get single asset by ID
app.get('/api/assets/:id', async (req, res) => {
  try {
    const asset = await assetDb.getById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(asset);
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// Search assets
app.get('/api/assets/search', async (req, res) => {
  try {
    const filters = {
      employee_name: req.query.employee,
      manager_name: req.query.manager,
      company_name: req.query.company,
      status: req.query.status
    };

    const assets = await assetDb.search(filters);
    res.json(assets);
  } catch (error) {
    console.error('Error searching assets:', error);
    res.status(500).json({ error: 'Failed to search assets' });
  }
});

// Bulk import assets via CSV
app.post('/api/assets/import', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'CSV file is required' });
  }

  try {
    const records = await parseCSVFile(req.file.path);
    const requiredFields = [
      'employee_first_name',
      'employee_last_name',
      'employee_email',
      'company_name',
      'asset_type',
      'serial_number',
      'asset_tag'
    ];
    const validStatuses = ['active', 'returned', 'lost', 'damaged', 'retired'];
    const validAssetTypes = ['laptop', 'mobile_phone'];

    let imported = 0;
    const errors = [];

    for (let index = 0; index < records.length; index++) {
      const row = records[index];
      const normalizedRow = Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key.trim(), (value || '').trim()])
      );

      const missingFields = requiredFields.filter((field) => !normalizedRow[field]);
      if (missingFields.length > 0) {
        errors.push(`Row ${index + 2}: Missing required fields: ${missingFields.join(', ')}`);
        continue;
      }

      const status = normalizedRow.status ? normalizedRow.status.toLowerCase() : 'active';
      if (normalizedRow.status && !validStatuses.includes(status)) {
        errors.push(`Row ${index + 2}: Invalid status '${normalizedRow.status}'. Valid statuses: ${validStatuses.join(', ')}`);
        continue;
      }

      const asset_type = normalizedRow.asset_type ? normalizedRow.asset_type.toLowerCase() : '';
      if (!validAssetTypes.includes(asset_type)) {
        errors.push(`Row ${index + 2}: Invalid asset_type '${normalizedRow.asset_type}'. Valid types: ${validAssetTypes.join(', ')}`);
        continue;
      }

      const assetData = {
        employee_first_name: normalizedRow.employee_first_name,
        employee_last_name: normalizedRow.employee_last_name,
        employee_email: normalizedRow.employee_email,
        manager_first_name: normalizedRow.manager_first_name || null,
        manager_last_name: normalizedRow.manager_last_name || null,
        manager_email: normalizedRow.manager_email || null,
        company_name: normalizedRow.company_name,
        asset_type: asset_type,
        make: normalizedRow.make || '',
        model: normalizedRow.model || '',
        serial_number: normalizedRow.serial_number,
        asset_tag: normalizedRow.asset_tag,
        status,
        notes: normalizedRow.notes || ''
      };

      try {
        const result = await assetDb.create(assetData);
        
        const employee_name = `${assetData.employee_first_name} ${assetData.employee_last_name}`;
        // Use result.id directly instead of fetching the asset again
        await auditDb.log(
          'CREATE',
          'asset',
          result.id,
          `${assetData.serial_number} - ${employee_name}`,
          {
            employee_first_name: assetData.employee_first_name,
            employee_last_name: assetData.employee_last_name,
            employee_email: assetData.employee_email,
            company_name: assetData.company_name,
            asset_type: assetData.asset_type,
            serial_number: assetData.serial_number,
            asset_tag: assetData.asset_tag,
            imported: true
          },
          assetData.employee_email
        );

        imported += 1;
      } catch (error) {
        const duplicateError = error.message.includes('UNIQUE constraint failed');
        const postgresDuplicate = error.message.includes('duplicate key value violates unique constraint');
        if (duplicateError || postgresDuplicate) {
          errors.push(`Row ${index + 2}: Asset with this serial number or asset tag already exists`);
        } else {
          errors.push(`Row ${index + 2}: ${error.message}`);
        }
      }
    }

    res.json({
      message: `Imported ${imported} assets${errors.length ? ` with ${errors.length} issues` : ''}`,
      imported,
      failed: errors.length,
      errors
    });
  } catch (error) {
    console.error('Error importing assets:', error);
    res.status(500).json({ error: 'Failed to import assets' });
  } finally {
    await unlink(req.file.path);
  }
});

// Create new asset
app.post('/api/assets', authenticate, async (req, res) => {
  try {
    const { 
      employee_first_name, 
      employee_last_name, 
      employee_email, 
      manager_first_name,
      manager_last_name,
      manager_email,
      company_name,
      asset_type,
      serial_number, 
      asset_tag, 
      notes 
    } = req.body;

    // Validation
    if (!employee_first_name || !employee_last_name || !employee_email || !company_name || !asset_type || !serial_number || !asset_tag) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['employee_first_name', 'employee_last_name', 'employee_email', 'company_name', 'asset_type', 'serial_number', 'asset_tag']
      });
    }

    // Validate asset_type
    if (!['laptop', 'mobile_phone'].includes(asset_type)) {
      return res.status(400).json({
        error: 'Invalid asset_type. Must be either "laptop" or "mobile_phone"'
      });
    }

    const result = await assetDb.create(req.body);
    const newAsset = await assetDb.getById(result.id);

    // Log audit
    const employee_name = `${employee_first_name} ${employee_last_name}`;
    await auditDb.log(
      'CREATE',
      'asset',
      newAsset.id,
      `${serial_number} - ${employee_name}`,
      {
        employee_first_name,
        employee_last_name,
        employee_email,
        manager_first_name,
        manager_last_name,
        manager_email,
        company_name,
        asset_type,
        serial_number,
        asset_tag
      },
      employee_email
    );

    res.status(201).json({
      message: 'Asset registered successfully',
      asset: newAsset
    });
  } catch (error) {
    console.error('Error creating asset:', error);

    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        error: 'Asset with this serial number or asset tag already exists'
      });
    }

    res.status(500).json({ error: 'Failed to register asset' });
  }
});

// ===== Bulk Asset Operations =====
// NOTE: Bulk routes MUST be defined BEFORE routes with :id parameters
// to prevent Express from matching "bulk" as an asset ID

// Bulk update asset status
app.patch('/api/assets/bulk/status', authenticate, async (req, res) => {
  try {
    const { ids, status, notes } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Asset IDs array is required' });
    }

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['active', 'returned', 'lost', 'damaged', 'retired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        validStatuses
      });
    }

    const user = await userDb.getById(req.user.id);
    
    // Fetch all assets in one query
    const assets = await assetDb.getByIds(ids);
    const assetMap = new Map(assets.map(asset => [asset.id, asset]));
    
    const results = { updated: [], failed: [] };
    const allowedIds = [];

    // Check permissions and build list of allowed IDs
    for (const id of ids) {
      const asset = assetMap.get(id);
      if (!asset) {
        results.failed.push({ id, reason: 'Asset not found' });
        continue;
      }

      // Check permissions: admin can update any, others can only update their own
      if (user.role !== 'admin' && asset.employee_email !== user.email) {
        results.failed.push({ id, reason: 'Permission denied' });
        continue;
      }

      allowedIds.push(id);
      const employeeName = `${asset.employee_first_name} ${asset.employee_last_name}`;
      results.updated.push({
        id,
        serial: asset.serial_number,
        employee: employeeName
      });
    }

    // Perform bulk update in a single query
    if (allowedIds.length > 0) {
      await assetDb.bulkUpdateStatus(allowedIds, status, notes);

      // Log audit entries with original status from assetMap (fetched before update)
      // Note: Could be further optimized with batch insert
      for (const id of allowedIds) {
        const asset = assetMap.get(id);
        const employeeName = `${asset.employee_first_name} ${asset.employee_last_name}`;
        await auditDb.log(
          'BULK_STATUS_CHANGE',
          'asset',
          asset.id,
          `${asset.serial_number} - ${employeeName}`,
          {
            old_status: asset.status,  // Original status from pre-update fetch
            new_status: status,
            notes: notes || '',
            bulk_operation: true
          },
          req.user.email
        );
      }
    }

    res.json({
      message: `Updated ${results.updated.length} of ${ids.length} assets`,
      updated: results.updated,
      failed: results.failed
    });
  } catch (error) {
    console.error('Error bulk updating asset status:', error);
    res.status(500).json({ error: 'Failed to bulk update asset status' });
  }
});

// Bulk delete assets (admin only)
app.delete('/api/assets/bulk/delete', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Asset IDs array is required' });
    }

    // Fetch all assets in one query
    const assets = await assetDb.getByIds(ids);
    const assetMap = new Map(assets.map(asset => [asset.id, asset]));
    
    const results = { deleted: [], failed: [] };
    const validIds = [];

    // Check which assets exist and log audit
    for (const id of ids) {
      const asset = assetMap.get(id);
      if (!asset) {
        results.failed.push({ id, reason: 'Asset not found' });
        continue;
      }

      validIds.push(id);
      const employeeName = `${asset.employee_first_name} ${asset.employee_last_name}`;
      const managerName = asset.manager_first_name && asset.manager_last_name 
        ? `${asset.manager_first_name} ${asset.manager_last_name}` 
        : '';
      results.deleted.push({
        id,
        serial: asset.serial_number,
        employee: employeeName
      });

      // Log audit before deletion
      await auditDb.log(
        'BULK_DELETE',
        'asset',
        asset.id,
        `${asset.serial_number} - ${employeeName}`,
        {
          employee_name: employeeName,
          employee_email: asset.employee_email,
          manager_name: managerName,
          manager_email: asset.manager_email,
          company_name: asset.company_name,
          asset_type: asset.asset_type,
          serial_number: asset.serial_number,
          asset_tag: asset.asset_tag,
          status: asset.status,
          deleted_by: req.user.email,
          bulk_operation: true
        },
        req.user.email
      );
    }

    // Perform bulk delete in a single query
    if (validIds.length > 0) {
      await assetDb.bulkDelete(validIds);
    }

    res.json({
      message: `Deleted ${results.deleted.length} of ${ids.length} assets`,
      deleted: results.deleted,
      failed: results.failed
    });
  } catch (error) {
    console.error('Error bulk deleting assets:', error);
    res.status(500).json({ error: 'Failed to bulk delete assets' });
  }
});

// Bulk assign manager to assets (admin only)
app.patch('/api/assets/bulk/manager', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { ids, manager_name, manager_email } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Asset IDs array is required' });
    }

    if (!manager_name || !manager_email) {
      return res.status(400).json({ error: 'Manager name and email are required' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(manager_email)) {
      return res.status(400).json({ error: 'Invalid manager email format' });
    }

    // Fetch all assets in one query
    const assets = await assetDb.getByIds(ids);
    const assetMap = new Map(assets.map(asset => [asset.id, asset]));
    
    const results = { updated: [], failed: [] };
    const validIds = [];

    // Check which assets exist and log audit
    for (const id of ids) {
      const asset = assetMap.get(id);
      if (!asset) {
        results.failed.push({ id, reason: 'Asset not found' });
        continue;
      }

      validIds.push(id);
      const employeeName = `${asset.employee_first_name} ${asset.employee_last_name}`;
      const oldManagerName = asset.manager_first_name && asset.manager_last_name 
        ? `${asset.manager_first_name} ${asset.manager_last_name}` 
        : '';
      results.updated.push({
        id,
        serial: asset.serial_number,
        employee: employeeName
      });

      // Log audit
      await auditDb.log(
        'BULK_MANAGER_ASSIGN',
        'asset',
        asset.id,
        `${asset.serial_number} - ${employeeName}`,
        {
          old_manager_name: oldManagerName,
          old_manager_email: asset.manager_email,
          new_manager_name: manager_name,
          new_manager_email: manager_email,
          bulk_operation: true
        },
        req.user.email
      );
    }

    // Perform bulk update in a single query
    if (validIds.length > 0) {
      await assetDb.bulkUpdateManager(validIds, manager_name, manager_email);
    }

    res.json({
      message: `Updated manager for ${results.updated.length} of ${ids.length} assets`,
      updated: results.updated,
      failed: results.failed
    });
  } catch (error) {
    console.error('Error bulk assigning manager:', error);
    res.status(500).json({ error: 'Failed to bulk assign manager' });
  }
});

// Update asset status
app.patch('/api/assets/:id/status', async (req, res) => {
  try {
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['active', 'returned', 'lost', 'damaged', 'retired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        validStatuses
      });
    }

    const asset = await assetDb.getById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const oldStatus = asset.status;
    await assetDb.updateStatus(req.params.id, status, notes);
    const updatedAsset = await assetDb.getById(req.params.id);

    // Log audit
    const employeeName = `${asset.employee_first_name} ${asset.employee_last_name}`;
    await auditDb.log(
      'STATUS_CHANGE',
      'asset',
      asset.id,
      `${asset.serial_number} - ${employeeName}`,
      {
        old_status: oldStatus,
        new_status: status,
        notes: notes || ''
      },
      asset.employee_email
    );

    res.json({
      message: 'Asset status updated successfully',
      asset: updatedAsset
    });
  } catch (error) {
    console.error('Error updating asset status:', error);
    res.status(500).json({ error: 'Failed to update asset status' });
  }
});

// Update entire asset
app.put('/api/assets/:id', authenticate, async (req, res) => {
  try {
    const asset = await assetDb.getById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const user = await userDb.getById(req.user.id);
    
    // Authorization: Only owner or admin can edit
    // Use owner_id if available, fall back to email matching
    const isOwner = (asset.owner_id && asset.owner_id === user.id) || 
                    (asset.employee_email && asset.employee_email.toLowerCase() === user.email.toLowerCase());
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ 
        error: 'Forbidden: Only the asset owner or an admin can edit this asset' 
      });
    }

    let { 
      employee_first_name, 
      employee_last_name, 
      employee_email, 
      manager_first_name, 
      manager_last_name, 
      manager_email, 
      company_name,
      asset_type,
      serial_number, 
      asset_tag, 
      status, 
      notes 
    } = req.body;

    // Employees can update the asset but cannot change their own name/email
    if (isOwner && user.role === 'employee') {
      employee_first_name = asset.employee_first_name;
      employee_last_name = asset.employee_last_name;
      employee_email = asset.employee_email;
    }

    if (!employee_first_name || !employee_last_name || !employee_email || !company_name || !asset_type || !serial_number || !asset_tag) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['employee_first_name', 'employee_last_name', 'employee_email', 'company_name', 'asset_type', 'serial_number', 'asset_tag']
      });
    }

    // Validate asset_type
    if (!['laptop', 'mobile_phone'].includes(asset_type)) {
      return res.status(400).json({
        error: 'Invalid asset_type. Must be either "laptop" or "mobile_phone"'
      });
    }

    // Validate manager fields before update
    if (manager_first_name || manager_last_name || manager_email) {
      // Check if manager name fields accidentally contain email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      if (manager_first_name && emailRegex.test(manager_first_name)) {
        return res.status(400).json({
          error: 'Manager first name appears to be an email address. Please enter a name instead.'
        });
      }
      
      if (manager_last_name && emailRegex.test(manager_last_name)) {
        return res.status(400).json({
          error: 'Manager last name appears to be an email address. Please enter a name instead.'
        });
      }

      // If manager email is provided, ensure name fields are also provided
      if (manager_email && (!manager_first_name || !manager_last_name)) {
        return res.status(400).json({
          error: 'Manager first name and last name are required when providing manager email'
        });
      }
    }

    await assetDb.update(req.params.id, req.body);
    const updatedAsset = await assetDb.getById(req.params.id);

    // Log audit trail
    const employeeName = `${updatedAsset.employee_first_name} ${updatedAsset.employee_last_name}`;
    await auditDb.log(
      'update',
      'asset',
      req.params.id,
      `${updatedAsset.serial_number} - ${employeeName}`,
      {
        previous: asset,
        updated: updatedAsset
      },
      req.user.email
    );

    res.json({
      message: 'Asset updated successfully',
      asset: updatedAsset
    });
  } catch (error) {
    console.error('Error updating asset:', error);

    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        error: 'Asset with this serial number or asset tag already exists'
      });
    }

    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// Delete asset (admin or employee deleting their own asset)
app.delete('/api/assets/:id', authenticate, async (req, res) => {
  try {
    const asset = await assetDb.getById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const user = await userDb.getById(req.user.id);

    // Check if user is admin or is deleting their own asset
    if (user.role !== 'admin' && asset.employee_email !== user.email) {
      return res.status(403).json({ error: 'You can only delete your own assets' });
    }

    // Log audit before deletion
    const employeeName = `${asset.employee_first_name} ${asset.employee_last_name}`;
    const managerName = asset.manager_first_name && asset.manager_last_name 
      ? `${asset.manager_first_name} ${asset.manager_last_name}` 
      : '';
    await auditDb.log(
      'DELETE',
      'asset',
      asset.id,
      `${asset.serial_number} - ${employeeName}`,
      {
        employee_name: employeeName,
        employee_email: asset.employee_email,
        manager_name: managerName,
        manager_email: asset.manager_email,
        company_name: asset.company_name,
        asset_type: asset.asset_type,
        serial_number: asset.serial_number,
        asset_tag: asset.asset_tag,
        status: asset.status,
        deleted_by: req.user.email
      },
      req.user.email
    );

    await assetDb.delete(req.params.id);

    res.json({
      message: 'Asset deleted successfully',
      deletedAsset: {
        id: asset.id,
        serial_number: asset.serial_number,
        employee_name: employeeName
      }
    });
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// ===== Company Management Endpoints =====

// Get all companies (admin only - full details)
app.get('/api/companies', authenticate, authorize('admin'), async (req, res) => {
  try {
    const companies = await companyDb.getAll();
    res.json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get company names for dropdown (all authenticated users)
app.get('/api/companies/names', authenticate, async (req, res) => {
  try {
    const companies = await companyDb.getAll();
    // Return only id and name for dropdown use
    const companyNames = companies.map(c => ({ id: c.id, name: c.name }));
    res.json(companyNames);
  } catch (error) {
    console.error('Error fetching company names:', error);
    res.status(500).json({ error: 'Failed to fetch company names' });
  }
});

// Bulk import companies via CSV (admin only)
app.post('/api/companies/import', authenticate, authorize('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'CSV file is required' });
  }

  try {
    const records = await parseCSVFile(req.file.path);
    let imported = 0;
    const errors = [];

    for (let index = 0; index < records.length; index++) {
      const row = records[index];
      const name = (row.name || '').trim();
      const description = (row.description || '').trim();

      if (!name) {
        errors.push(`Row ${index + 2}: Company name is required`);
        continue;
      }

      try {
        const existing = await companyDb.getByName(name);
        if (existing) {
          errors.push(`Row ${index + 2}: A company with the name "${name}" already exists`);
          continue;
        }

        const result = await companyDb.create({ name, description });
        const newCompany = await companyDb.getById(result.id);

        await auditDb.log(
          'CREATE',
          'company',
          newCompany.id,
          name,
          { description: newCompany.description, imported: true },
          req.user.email
        );

        imported += 1;
      } catch (error) {
        errors.push(`Row ${index + 2}: ${error.message}`);
      }
    }

    res.json({
      message: `Imported ${imported} companies${errors.length ? ` with ${errors.length} issues` : ''}`,
      imported,
      failed: errors.length,
      errors
    });
  } catch (error) {
    console.error('Error importing companies:', error);
    res.status(500).json({ error: 'Failed to import companies' });
  } finally {
    await unlink(req.file.path);
  }
});

// Get single company by ID
app.get('/api/companies/:id', async (req, res) => {
  try {
    const company = await companyDb.getById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(company);
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// Create new company (admin only)
app.post('/api/companies', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, description } = req.body;

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({
        error: 'Company name is required'
      });
    }

    // Check if company already exists
    const existing = await companyDb.getByName(name);
    if (existing) {
      return res.status(409).json({
        error: 'A company with this name already exists'
      });
    }

    const result = await companyDb.create(req.body);
    const newCompany = await companyDb.getById(result.id);

    res.status(201).json({
      message: 'Company registered successfully',
      company: newCompany
    });
  } catch (error) {
    console.error('Error creating company:', error);

    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        error: 'A company with this name already exists'
      });
    }

    res.status(500).json({ error: 'Failed to register company' });
  }
});

// Update company (admin only)
app.put('/api/companies/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const company = await companyDb.getById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const { name, description } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        error: 'Company name is required'
      });
    }

    // Check if another company has this name
    const existing = await companyDb.getByName(name);
    if (existing && existing.id !== parseInt(req.params.id)) {
      return res.status(409).json({
        error: 'A company with this name already exists'
      });
    }

    await companyDb.update(req.params.id, req.body);
    const updatedCompany = await companyDb.getById(req.params.id);

    res.json({
      message: 'Company updated successfully',
      company: updatedCompany
    });
  } catch (error) {
    console.error('Error updating company:', error);

    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        error: 'A company with this name already exists'
      });
    }

    res.status(500).json({ error: 'Failed to update company' });
  }
});

// Delete company (admin only)
app.delete('/api/companies/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const company = await companyDb.getById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check if company has assets
    if (await companyDb.hasAssets(company.id)) {
      return res.status(409).json({
        error: 'Cannot delete company with existing assets. Please reassign or delete assets first.'
      });
    }

    await companyDb.delete(req.params.id);
    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

// ===== Asset Type Endpoints =====

// Get active asset types (any authenticated user)
app.get('/api/asset-types', authenticate, async (req, res) => {
  try {
    const assetTypes = await assetTypeDb.getActive();
    res.json(assetTypes);
  } catch (error) {
    console.error('Error fetching active asset types:', error);
    res.status(500).json({ error: 'Failed to fetch asset types' });
  }
});

// Get all asset types including inactive (admin only)
app.get('/api/admin/asset-types', authenticate, authorize('admin'), async (req, res) => {
  try {
    const assetTypes = await assetTypeDb.getAll();
    
    // Get usage count for each type
    const assetTypesWithUsage = await Promise.all(
      assetTypes.map(async (type) => {
        const usageCount = await assetTypeDb.getUsageCount(type.id);
        return { ...type, usage_count: usageCount };
      })
    );
    
    res.json(assetTypesWithUsage);
  } catch (error) {
    console.error('Error fetching all asset types:', error);
    res.status(500).json({ error: 'Failed to fetch asset types' });
  }
});

// Create new asset type (admin only)
app.post('/api/admin/asset-types', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, display_name, description, is_active, sort_order } = req.body;
    
    // Validation
    if (!name || !display_name) {
      return res.status(400).json({ error: 'name and display_name are required' });
    }
    
    // Check if name already exists
    const existing = await assetTypeDb.getByName(name);
    if (existing) {
      return res.status(409).json({ error: 'Asset type with this name already exists' });
    }
    
    const result = await assetTypeDb.create({
      name,
      display_name,
      description,
      is_active: is_active !== undefined ? is_active : 1,
      sort_order: sort_order || 0
    });
    
    const newAssetType = await assetTypeDb.getById(result.id);
    
    // Log audit
    await auditDb.log(
      'create',
      'asset_type',
      result.id,
      display_name,
      { name, display_name, description },
      req.user.email
    );
    
    res.status(201).json(newAssetType);
  } catch (error) {
    console.error('Error creating asset type:', error);
    res.status(500).json({ error: 'Failed to create asset type' });
  }
});

// Update asset type (admin only)
app.put('/api/admin/asset-types/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, display_name, description, is_active, sort_order } = req.body;
    
    const assetType = await assetTypeDb.getById(id);
    if (!assetType) {
      return res.status(404).json({ error: 'Asset type not found' });
    }
    
    // If name is being changed, check if new name already exists
    if (name && name !== assetType.name) {
      const existing = await assetTypeDb.getByName(name);
      if (existing) {
        return res.status(409).json({ error: 'Asset type with this name already exists' });
      }
    }
    
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (display_name !== undefined) updates.display_name = display_name;
    if (description !== undefined) updates.description = description;
    if (is_active !== undefined) updates.is_active = is_active;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    
    await assetTypeDb.update(id, updates);
    const updatedAssetType = await assetTypeDb.getById(id);
    
    // Log audit
    await auditDb.log(
      'update',
      'asset_type',
      id,
      updatedAssetType.display_name,
      updates,
      req.user.email
    );
    
    res.json(updatedAssetType);
  } catch (error) {
    console.error('Error updating asset type:', error);
    res.status(500).json({ error: 'Failed to update asset type' });
  }
});

// Delete asset type (admin only, only if not in use)
app.delete('/api/admin/asset-types/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    const assetType = await assetTypeDb.getById(id);
    if (!assetType) {
      return res.status(404).json({ error: 'Asset type not found' });
    }
    
    // Check if asset type is in use
    const usageCount = await assetTypeDb.getUsageCount(id);
    if (usageCount > 0) {
      return res.status(409).json({
        error: `Cannot delete asset type that is in use by ${usageCount} asset(s)`,
        usage_count: usageCount
      });
    }
    
    await assetTypeDb.delete(id);
    
    // Log audit
    await auditDb.log(
      'delete',
      'asset_type',
      id,
      assetType.display_name,
      { name: assetType.name },
      req.user.email
    );
    
    res.json({ message: 'Asset type deleted successfully' });
  } catch (error) {
    console.error('Error deleting asset type:', error);
    res.status(500).json({ error: 'Failed to delete asset type' });
  }
});

// Update asset types sort order (admin only)
app.put('/api/admin/asset-types/reorder', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { orderedIds } = req.body;
    
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ error: 'orderedIds must be a non-empty array' });
    }
    
    await assetTypeDb.reorder(orderedIds);
    
    // Log audit
    await auditDb.log(
      'reorder',
      'asset_type',
      null,
      'Asset Types',
      { orderedIds },
      req.user.email
    );
    
    res.json({ message: 'Asset types reordered successfully' });
  } catch (error) {
    console.error('Error reordering asset types:', error);
    res.status(500).json({ error: 'Failed to reorder asset types' });
  }
});

// ===== Audit & Reporting Endpoints =====

// Get all audit logs (with role-based filtering)
app.get('/api/audit/logs', authenticate, async (req, res) => {
  try {
    const user = await userDb.getById(req.user.id);

    const options = {
      entityType: req.query.entityType,
      entityId: req.query.entityId,
      action: req.query.action,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      userEmail: req.query.userEmail,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };

    let logs = await auditDb.getAll(options);

    // Role-based filtering
    if (user.role === 'employee') {
      // Employees only see their own audit logs
      logs = logs.filter(log => log.user_email === user.email);
    }
    // Admin and Manager see all logs (no filtering)

    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get audit logs for specific entity
app.get('/api/audit/entity/:type/:id', async (req, res) => {
  try {
    const logs = await auditDb.getByEntity(req.params.type, req.params.id);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching entity audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch entity audit logs' });
  }
});

// Get recent audit logs
app.get('/api/audit/recent', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    const logs = await auditDb.getRecent(limit);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching recent audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch recent audit logs' });
  }
});

// Get audit statistics
app.get('/api/audit/stats', async (req, res) => {
  try {
    const stats = await auditDb.getStats(req.query.startDate, req.query.endDate);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({ error: 'Failed to fetch audit stats' });
  }
});

// Generate report (CSV export)
app.get('/api/audit/export', authenticate, async (req, res) => {
  try {
    const user = await userDb.getById(req.user.id);

    const options = {
      entityType: req.query.entityType,
      action: req.query.action,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      userEmail: req.query.userEmail
    };

    let logs = await auditDb.getAll(options);

    // Role-based filtering
    if (user.role === 'employee') {
      // Employees only see their own audit logs
      logs = logs.filter(log => log.user_email === user.email);
    }
    // Admin and Manager see all logs (no filtering)

    // Generate CSV
    const headers = ['ID', 'Timestamp', 'Action', 'Entity Type', 'Entity Name', 'Details', 'User Email'];
    const csvRows = [headers.join(',')];

    logs.forEach(log => {
      const row = [
        log.id,
        log.timestamp,
        log.action,
        log.entity_type,
        `"${log.entity_name || ''}"`,
        `"${log.details || ''}"`,
        log.user_email || ''
      ];
      csvRows.push(row.join(','));
    });

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

// Asset summary report (with role-based filtering)
app.get('/api/reports/summary', authenticate, async (req, res) => {
  try {
    const user = await userDb.getById(req.user.id);
    const allAssets = await assetDb.getAll();

    // Filter assets based on role
    let assets;
    if (user.role === 'admin' || user.role === 'manager') {
      // Admin and Manager see all assets
      assets = allAssets;
    } else {
      // Employee sees only own assets
      assets = allAssets.filter(asset =>
        asset.employee_email === user.email
      );
    }

    const summary = {
      total: assets.length,
      by_status: {},
      by_company: {},
      by_manager: {},
      by_type: {}
    };

    // Get asset type display names
    const assetTypes = await assetTypeDb.getAll();
    const typeDisplayMap = {};
    assetTypes.forEach(type => {
      typeDisplayMap[type.name] = type.display_name;
    });

    assets.forEach(asset => {
      // Status breakdown
      summary.by_status[asset.status] = (summary.by_status[asset.status] || 0) + 1;

      // Company breakdown
      summary.by_company[asset.company_name] = (summary.by_company[asset.company_name] || 0) + 1;

      // Manager breakdown
      const managerFullName = asset.manager_first_name && asset.manager_last_name 
        ? `${asset.manager_first_name} ${asset.manager_last_name}` 
        : 'No Manager';
      summary.by_manager[managerFullName] = (summary.by_manager[managerFullName] || 0) + 1;

      // Type breakdown
      const typeName = asset.asset_type || 'other';
      const displayName = typeDisplayMap[typeName] || typeName;
      summary.by_type[displayName] = (summary.by_type[displayName] || 0) + 1;
    });

    res.json(summary);
  } catch (error) {
    console.error('Error generating summary report:', error);
    res.status(500).json({ error: 'Failed to generate summary report' });
  }
});

// Enhanced summary report with trends and comparisons
app.get('/api/reports/summary-enhanced', authenticate, async (req, res) => {
  try {
    const user = await userDb.getById(req.user.id);
    const allAssets = await assetDb.getAll();

    // Filter assets based on role
    let assets;
    if (user.role === 'admin' || user.role === 'manager') {
      assets = allAssets;
    } else {
      assets = allAssets.filter(asset => asset.employee_email === user.email);
    }

    // Calculate current period stats
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);

    const currentAssets = assets.filter(a => a.registration_date && new Date(a.registration_date) <= now);
    const previousAssets = assets.filter(a => a.registration_date && new Date(a.registration_date) <= thirtyDaysAgo);
    
    const totalChange = currentAssets.length - previousAssets.length;

    // Status breakdown
    const byStatus = { active: 0, returned: 0, lost: 0, damaged: 0, retired: 0 };
    currentAssets.forEach(asset => {
      if (byStatus.hasOwnProperty(asset.status)) {
        byStatus[asset.status]++;
      }
    });

    // Company breakdown (top 10)
    const companyMap = {};
    currentAssets.forEach(asset => {
      const company = asset.company_name || 'Unknown';
      companyMap[company] = (companyMap[company] || 0) + 1;
    });
    const byCompany = Object.entries(companyMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Manager breakdown
    const managerMap = {};
    currentAssets.forEach(asset => {
      const name = asset.manager_first_name && asset.manager_last_name 
        ? `${asset.manager_first_name} ${asset.manager_last_name}` 
        : 'No Manager';
      const email = asset.manager_email || 'N/A';
      const key = `${name}|${email}`;
      managerMap[key] = (managerMap[key] || 0) + 1;
    });
    const byManager = Object.entries(managerMap)
      .map(([key, count]) => {
        const [name, email] = key.split('|');
        return { name, email, count };
      })
      .sort((a, b) => b.count - a.count);

    // Type breakdown - use display names from asset_types table
    const assetTypes = await assetTypeDb.getAll();
    const typeDisplayMap = {};
    assetTypes.forEach(type => {
      typeDisplayMap[type.name] = type.display_name;
    });
    
    const typeMap = {};
    currentAssets.forEach(asset => {
      const typeName = asset.asset_type || 'other';
      const displayName = typeDisplayMap[typeName] || typeName;
      typeMap[displayName] = (typeMap[displayName] || 0) + 1;
    });

    // Calculate compliance score (simplified)
    const activeAssets = currentAssets.filter(a => a.status === 'active');
    const assetsWithManagers = activeAssets.filter(a => a.manager_email).length;
    const complianceScore = activeAssets.length > 0 
      ? Math.round((assetsWithManagers / activeAssets.length) * 100) 
      : 100;

    res.json({
      total: currentAssets.length,
      totalChange,
      byStatus,
      byCompany,
      byManager,
      byType: typeMap,
      complianceScore
    });
  } catch (error) {
    console.error('Error generating enhanced summary:', error);
    res.status(500).json({ error: 'Failed to generate enhanced summary' });
  }
});

// Enhanced statistics with time series data
app.get('/api/reports/statistics-enhanced', authenticate, authorize('admin', 'manager'), async (req, res) => {
  try {
    const period = parseInt(req.query.period) || 30;
    const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
    
    // Get audit logs for the period
    const logs = await auditDb.getAll();
    const filteredLogs = logs.filter(log => new Date(log.timestamp) >= startDate);

    // Activity by day
    const activityByDay = {};
    filteredLogs.forEach(log => {
      const date = new Date(log.timestamp).toISOString().split('T')[0];
      if (!activityByDay[date]) {
        activityByDay[date] = { date, CREATE: 0, UPDATE: 0, STATUS_CHANGE: 0, DELETE: 0 };
      }
      const action = log.action || 'UPDATE';
      if (activityByDay[date].hasOwnProperty(action)) {
        activityByDay[date][action]++;
      }
    });

    const activityArray = Object.values(activityByDay).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    // Action breakdown
    const actionBreakdown = {};
    filteredLogs.forEach(log => {
      const action = log.action || 'UPDATE';
      actionBreakdown[action] = (actionBreakdown[action] || 0) + 1;
    });
    const actionBreakdownArray = Object.entries(actionBreakdown)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count);

    // Top users
    const userActivity = {};
    filteredLogs.forEach(log => {
      const email = log.user_email || 'System';
      userActivity[email] = (userActivity[email] || 0) + 1;
    });
    const topUsers = Object.entries(userActivity)
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Recent activity (last 20)
    const recentActivity = filteredLogs
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 20)
      .map(log => ({
        timestamp: log.timestamp,
        action: log.action,
        entity_type: log.entity_type,
        entity_name: log.entity_name,
        user_email: log.user_email
      }));

    res.json({
      activityByDay: activityArray,
      actionBreakdown: actionBreakdownArray,
      topUsers,
      recentActivity
    });
  } catch (error) {
    console.error('Error generating enhanced statistics:', error);
    res.status(500).json({ error: 'Failed to generate enhanced statistics' });
  }
});

// Compliance metrics
app.get('/api/reports/compliance', authenticate, authorize('admin', 'manager'), async (req, res) => {
  try {
    const user = await userDb.getById(req.user.id);
    const allAssets = await assetDb.getAll();

    // Filter assets based on role
    let assets;
    if (user.role === 'admin' || user.role === 'manager') {
      assets = allAssets;
    } else {
      assets = allAssets.filter(asset => asset.employee_email === user.email);
    }

    // Calculate at-risk assets (lost + damaged)
    const atRiskAssets = assets.filter(a => a.status === 'lost' || a.status === 'damaged').length;

    // Get attestation campaigns
    const campaigns = await attestationCampaignDb.getAll();
    const activeCampaigns = campaigns.filter(c => c.status === 'active');
    
    // Calculate campaign progress
    const campaignProgress = [];
    for (const campaign of activeCampaigns.slice(0, 5)) {
      try {
        const records = await attestationRecordDb.getByCampaignId(campaign.id);
        const completed = records.filter(r => r.status === 'completed').length;
        const total = records.length;
        campaignProgress.push({
          name: campaign.name,
          progress: total > 0 ? Math.round((completed / total) * 100) : 0,
          completed,
          total
        });
      } catch (err) {
        console.error(`Error getting records for campaign ${campaign.id}:`, err);
      }
    }

    // Overdue attestations (estimate based on active campaigns)
    let overdueAttestations = 0;
    for (const campaign of activeCampaigns) {
      try {
        const records = await attestationRecordDb.getByCampaignId(campaign.id);
        const now = new Date();
        const overdue = records.filter(r => {
          if (r.status !== 'pending') return false;
          if (!campaign.end_date) return false;
          return new Date(campaign.end_date) < now;
        }).length;
        overdueAttestations += overdue;
      } catch (err) {
        console.error(`Error calculating overdue for campaign ${campaign.id}:`, err);
      }
    }

    // Attested this quarter
    const quarterStart = new Date();
    quarterStart.setMonth(Math.floor(quarterStart.getMonth() / 3) * 3, 1);
    quarterStart.setHours(0, 0, 0, 0);
    
    let attestedThisQuarter = 0;
    for (const campaign of campaigns) {
      if (new Date(campaign.start_date) >= quarterStart) {
        try {
          const records = await attestationRecordDb.getByCampaignId(campaign.id);
          attestedThisQuarter += records.filter(r => r.status === 'completed').length;
        } catch (err) {
          console.error(`Error counting quarterly attestations for campaign ${campaign.id}:`, err);
        }
      }
    }

    // Risk indicators
    const riskIndicators = [];
    const lostCount = assets.filter(a => a.status === 'lost').length;
    const damagedCount = assets.filter(a => a.status === 'damaged').length;
    
    if (lostCount > 0) {
      riskIndicators.push({ type: 'Lost Assets', count: lostCount, severity: 'high', description: 'Assets marked as lost' });
    }
    if (damagedCount > 0) {
      riskIndicators.push({ type: 'Damaged Assets', count: damagedCount, severity: 'medium', description: 'Assets marked as damaged' });
    }
    if (overdueAttestations > 0) {
      riskIndicators.push({ type: 'Overdue Attestations', count: overdueAttestations, severity: 'medium', description: 'Past due date' });
    }

    // Compliance checklist
    const activeAssets = assets.filter(a => a.status === 'active');
    const assetsWithOwners = activeAssets.filter(a => a.employee_email).length;
    const assetsWithManagers = activeAssets.filter(a => a.manager_email).length;
    const assetsWithCompanies = activeAssets.filter(a => a.company_name).length;
    
    const checklist = [
      {
        item: 'All active assets have owners',
        status: assetsWithOwners === activeAssets.length ? 'pass' : 'fail',
        description: `${assetsWithOwners}/${activeAssets.length} assets have assigned owners`
      },
      {
        item: 'All active assets have managers',
        status: assetsWithManagers === activeAssets.length ? 'pass' : 'warn',
        description: `${assetsWithManagers}/${activeAssets.length} assets have assigned managers`
      },
      {
        item: 'All active assets assigned to companies',
        status: assetsWithCompanies === activeAssets.length ? 'pass' : 'warn',
        description: `${assetsWithCompanies}/${activeAssets.length} assets assigned to companies`
      },
      {
        item: 'Active attestation campaigns',
        status: activeCampaigns.length > 0 ? 'pass' : 'warn',
        description: `${activeCampaigns.length} active campaigns running`
      },
      {
        item: 'No overdue attestations',
        status: overdueAttestations === 0 ? 'pass' : 'fail',
        description: `${overdueAttestations} attestations overdue`
      },
      {
        item: 'No at-risk assets',
        status: atRiskAssets === 0 ? 'pass' : (atRiskAssets < 5 ? 'warn' : 'fail'),
        description: `${atRiskAssets} assets at risk`
      }
    ];

    // Calculate overall compliance score
    const passCount = checklist.filter(c => c.status === 'pass').length;
    const score = Math.round((passCount / checklist.length) * 100);

    res.json({
      score,
      overdueAttestations,
      atRiskAssets,
      attestedThisQuarter,
      campaigns: campaignProgress,
      riskIndicators,
      checklist
    });
  } catch (error) {
    console.error('Error generating compliance report:', error);
    res.status(500).json({ error: 'Failed to generate compliance report' });
  }
});

// Trend data with period comparison
app.get('/api/reports/trends', authenticate, authorize('admin', 'manager'), async (req, res) => {
  try {
    const user = await userDb.getById(req.user.id);
    const period = parseInt(req.query.period) || 30;
    const compareTo = req.query.compareTo || 'previous';
    
    const allAssets = await assetDb.getAll();

    // Filter assets based on role
    let assets;
    if (user.role === 'admin' || user.role === 'manager') {
      assets = allAssets;
    } else {
      assets = allAssets.filter(asset => asset.employee_email === user.email);
    }

    // Asset growth over time - optimized approach
    const now = new Date();
    const startDate = new Date(now - period * 24 * 60 * 60 * 1000);
    
    // Sort assets by creation date once
    const sortedAssets = [...assets].sort((a, b) => 
      new Date(a.created_date) - new Date(b.created_date)
    );
    
    const sampleInterval = Math.max(1, Math.floor(period / 30));
    const assetGrowth = [];
    
    let assetIndex = 0;
    for (let i = 0; i <= period; i++) {
      if (i % sampleInterval !== 0 && i !== period) continue;
      
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Count assets up to this date using sorted array
      while (assetIndex < sortedAssets.length && 
             new Date(sortedAssets[assetIndex].created_date) <= date) {
        assetIndex++;
      }
      
      assetGrowth.push({ date: dateStr, count: assetIndex });
    }

    // Status changes over time - optimized
    const statusChanges = [];
    for (let i = 0; i <= period; i += sampleInterval) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const statusCount = { date: dateStr, active: 0, returned: 0, lost: 0, damaged: 0, retired: 0 };
      
      // Count only assets created before or on this date
      for (const asset of assets) {
        if (new Date(asset.created_date) <= date) {
          if (statusCount.hasOwnProperty(asset.status)) {
            statusCount[asset.status]++;
          }
        }
      }
      
      statusChanges.push(statusCount);
    }

    // Current vs previous period metrics
    const currentPeriodStart = new Date(now - period * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(now - 2 * period * 24 * 60 * 60 * 1000);
    const previousPeriodEnd = currentPeriodStart;

    const currentAssets = assets.filter(a => {
      const createdDate = new Date(a.created_date);
      return createdDate >= currentPeriodStart && createdDate <= now;
    });

    const previousAssets = assets.filter(a => {
      const createdDate = new Date(a.created_date);
      return createdDate >= previousPeriodStart && createdDate < previousPeriodEnd;
    });

    const allCurrentAssets = assets.filter(a => new Date(a.created_date) <= now);
    const allPreviousAssets = assets.filter(a => new Date(a.created_date) < previousPeriodEnd);

    const currentActiveCount = allCurrentAssets.filter(a => a.status === 'active').length;
    const previousActiveCount = allPreviousAssets.filter(a => a.status === 'active').length;

    const current = {
      totalAssets: allCurrentAssets.length,
      activeRate: allCurrentAssets.length > 0 ? currentActiveCount / allCurrentAssets.length : 0,
      newAssets: currentAssets.length
    };

    const previous = {
      totalAssets: allPreviousAssets.length,
      activeRate: allPreviousAssets.length > 0 ? previousActiveCount / allPreviousAssets.length : 0,
      newAssets: previousAssets.length
    };

    const changes = {
      totalAssets: current.totalAssets - previous.totalAssets,
      activeRate: current.activeRate - previous.activeRate,
      newAssets: current.newAssets - previous.newAssets
    };

    res.json({
      assetGrowth,
      statusChanges,
      metricsComparison: {
        current,
        previous,
        changes
      }
    });
  } catch (error) {
    console.error('Error generating trends report:', error);
    res.status(500).json({ error: 'Failed to generate trends report' });
  }
});

// ===== ATTESTATION CAMPAIGN ROUTES =====

// Create new attestation campaign (Admin only)
app.post('/api/attestation/campaigns', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, description, start_date, end_date, reminder_days, escalation_days, target_type, target_user_ids, target_company_ids } = req.body;
    
    if (!name || !start_date) {
      return res.status(400).json({ error: 'Campaign name and start date are required' });
    }
    
    // Validate target_type
    if (target_type && !['all', 'selected', 'companies'].includes(target_type)) {
      return res.status(400).json({ error: 'Invalid target_type. Must be "all", "selected", or "companies"' });
    }
    
    // Validate target_user_ids if target_type is 'selected'
    if (target_type === 'selected' && (!target_user_ids || !Array.isArray(target_user_ids) || target_user_ids.length === 0)) {
      return res.status(400).json({ error: 'target_user_ids is required when target_type is "selected"' });
    }
    
    // Validate target_company_ids if target_type is 'companies'
    if (target_type === 'companies' && (!target_company_ids || !Array.isArray(target_company_ids) || target_company_ids.length === 0)) {
      return res.status(400).json({ error: 'target_company_ids is required when target_type is "companies"' });
    }
    
    const campaign = {
      name,
      description,
      start_date,
      end_date: sanitizeDateValue(end_date),
      status: 'draft',
      reminder_days: reminder_days || 7,
      escalation_days: escalation_days || 10,
      target_type: target_type || 'all',
      target_user_ids: target_type === 'selected' ? JSON.stringify(target_user_ids) : null,
      target_company_ids: target_type === 'companies' ? JSON.stringify(target_company_ids) : null,
      created_by: req.user.id
    };
    
    const result = await attestationCampaignDb.create(campaign);
    
    let targetingInfo = campaign.target_type;
    if (target_type === 'selected') {
      targetingInfo += `, ${target_user_ids.length} users`;
    } else if (target_type === 'companies') {
      targetingInfo += `, ${target_company_ids.length} companies`;
    }
    
    await auditDb.log(
      'create',
      'attestation_campaign',
      result.id,
      name,
      `Created attestation campaign: ${name} (targeting: ${targetingInfo})`,
      req.user.email
    );
    
    res.json({ success: true, campaignId: result.id });
  } catch (error) {
    console.error('Error creating attestation campaign:', error);
    res.status(500).json({ error: 'Failed to create attestation campaign' });
  }
});

// Get all attestation campaigns (Admin only)
app.get('/api/attestation/campaigns', authenticate, authorize('admin'), async (req, res) => {
  try {
    const campaigns = await attestationCampaignDb.getAll();
    
    // Add pending invites count to each campaign
    for (const campaign of campaigns) {
      const pendingInvites = await attestationPendingInviteDb.getByCampaignId(campaign.id);
      const unresolvedInvites = pendingInvites.filter(inv => !inv.registered_at);
      campaign.pending_invites_count = unresolvedInvites.length;
    }
    
    res.json({ success: true, campaigns });
  } catch (error) {
    console.error('Error fetching attestation campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch attestation campaigns' });
  }
});

// Get specific campaign details with stats (Admin only)
app.get('/api/attestation/campaigns/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const campaign = await attestationCampaignDb.getById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Get all records for this campaign
    const records = await attestationRecordDb.getByCampaignId(campaign.id);
    
    // Calculate stats
    const stats = {
      total: records.length,
      completed: records.filter(r => r.status === 'completed').length,
      in_progress: records.filter(r => r.status === 'in_progress').length,
      pending: records.filter(r => r.status === 'pending').length,
      reminders_sent: records.filter(r => r.reminder_sent_at).length,
      escalations_sent: records.filter(r => r.escalation_sent_at).length
    };
    
    res.json({ success: true, campaign, stats });
  } catch (error) {
    console.error('Error fetching campaign details:', error);
    res.status(500).json({ error: 'Failed to fetch campaign details' });
  }
});

// Update campaign (Admin only)
app.put('/api/attestation/campaigns/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, description, start_date, end_date, reminder_days, escalation_days, status, target_type, target_user_ids, target_company_ids } = req.body;
    
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (start_date !== undefined) updates.start_date = start_date;
    if (end_date !== undefined) updates.end_date = sanitizeDateValue(end_date);
    if (reminder_days !== undefined) updates.reminder_days = reminder_days;
    if (escalation_days !== undefined) updates.escalation_days = escalation_days;
    if (status !== undefined) updates.status = status;
    if (target_type !== undefined) updates.target_type = target_type;
    if (target_user_ids !== undefined) {
      updates.target_user_ids = target_user_ids && Array.isArray(target_user_ids) ? JSON.stringify(target_user_ids) : null;
    }
    if (target_company_ids !== undefined) {
      updates.target_company_ids = target_company_ids && Array.isArray(target_company_ids) ? JSON.stringify(target_company_ids) : null;
    }
    
    await attestationCampaignDb.update(req.params.id, updates);
    
    const updatedCampaign = await attestationCampaignDb.getById(req.params.id);
    await auditDb.log(
      'update',
      'attestation_campaign',
      req.params.id,
      updatedCampaign?.name || 'Unknown',
      `Updated attestation campaign`,
      req.user.email
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// Start campaign - creates records for all employees and sends emails (Admin only)
app.post('/api/attestation/campaigns/:id/start', authenticate, authorize('admin'), async (req, res) => {
  try {
    const campaign = await attestationCampaignDb.getById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    if (campaign.status !== 'draft') {
      return res.status(400).json({ error: 'Campaign has already been started' });
    }
    
    // Get users based on targeting
    let users = [];
    let unregisteredOwners = [];
    
    if (campaign.target_type === 'companies' && campaign.target_company_ids) {
      // Get users who own assets in the specified companies
      try {
        const companyIds = JSON.parse(campaign.target_company_ids);
        
        // Validate that company IDs exist
        const companies = await companyDb.getAll();
        const validCompanyIds = companyIds.filter(id => companies.some(c => c.id === id));
        
        if (validCompanyIds.length === 0) {
          return res.status(400).json({ error: 'No valid companies found for the selected company IDs' });
        }
        
        // Get registered owners by company IDs
        users = await assetDb.getRegisteredOwnersByCompanyIds(validCompanyIds);
        
        // Get unregistered owners by company IDs
        unregisteredOwners = await assetDb.getUnregisteredOwnersByCompanyIds(validCompanyIds);
        
        if (users.length === 0 && unregisteredOwners.length === 0) {
          return res.status(400).json({ error: 'No asset owners found in the selected companies' });
        }
      } catch (parseError) {
        console.error('Error parsing target_company_ids:', parseError);
        return res.status(500).json({ error: 'Invalid target company IDs format' });
      }
    } else if (campaign.target_type === 'selected' && campaign.target_user_ids) {
      // Filter users by selected user IDs
      try {
        const targetIds = JSON.parse(campaign.target_user_ids);
        const allUsers = await userDb.getAll();
        users = allUsers.filter(u => targetIds.includes(u.id));
        // For selected users, we don't include unregistered owners
      } catch (parseError) {
        console.error('Error parsing target_user_ids:', parseError);
        return res.status(500).json({ error: 'Invalid target user IDs format' });
      }
    } else {
      // Default: all users and unregistered owners
      users = await userDb.getAll();
      unregisteredOwners = await assetDb.getUnregisteredOwners();
    }
    
    // Create attestation records for registered users
    let recordsCreated = 0;
    let emailsSent = 0;
    
    for (const user of users) {
      // Create record for this user
      await attestationRecordDb.create({
        campaign_id: campaign.id,
        user_id: user.id,
        status: 'pending'
      });
      recordsCreated++;
      
      // Send email notification (only if SMTP is configured)
      if (user.email) {
        try {
          const { sendAttestationLaunchEmail } = await import('./services/smtpMailer.js');
          // Email function will use branding app_url with fallbacks
          const result = await sendAttestationLaunchEmail(user.email, campaign);
          if (result.success) {
            emailsSent++;
          }
        } catch (emailError) {
          console.error(`Failed to send email to ${user.email}:`, emailError);
        }
      }
    }
    
    // Create pending invites for unregistered owners
    let pendingInvitesCreated = 0;
    let inviteEmailsSent = 0;
    
    // Get OIDC settings for SSO info
    const oidcSettings = await oidcSettingsDb.get();
    const ssoEnabled = oidcSettings?.enabled || false;
    const ssoButtonText = oidcSettings?.button_text || 'Sign In with SSO';
    
    for (const owner of unregisteredOwners) {
      // Generate unique invite token
      const crypto = await import('crypto');
      const inviteToken = crypto.randomBytes(32).toString('hex');
      
      // Create pending invite
      await attestationPendingInviteDb.create({
        campaign_id: campaign.id,
        employee_email: owner.employee_email,
        employee_first_name: owner.employee_first_name,
        employee_last_name: owner.employee_last_name,
        invite_token: inviteToken,
        invite_sent_at: new Date().toISOString()
      });
      pendingInvitesCreated++;
      
      // Send invitation email
      try {
        const { sendAttestationRegistrationInvite } = await import('./services/smtpMailer.js');
        const result = await sendAttestationRegistrationInvite(
          owner.employee_email,
          owner.employee_first_name,
          owner.employee_last_name,
          campaign,
          inviteToken,
          owner.asset_count,
          ssoEnabled,
          ssoButtonText
        );
        if (result.success) {
          inviteEmailsSent++;
        }
      } catch (emailError) {
        console.error(`Failed to send invite email to ${owner.employee_email}:`, emailError);
      }
    }
    
    // Update campaign status to active
    await attestationCampaignDb.update(campaign.id, {
      status: 'active',
      start_date: new Date().toISOString()
    });
    
    await auditDb.log(
      'start',
      'attestation_campaign',
      campaign.id,
      campaign.name,
      `Started attestation campaign: ${campaign.name} (targeting: ${campaign.target_type}). Created ${recordsCreated} records, sent ${emailsSent} emails. Created ${pendingInvitesCreated} pending invites, sent ${inviteEmailsSent} invite emails`,
      req.user.email
    );
    
    res.json({ 
      success: true, 
      message: 'Campaign started',
      recordsCreated, 
      emailsSent,
      pendingInvitesCreated,
      inviteEmailsSent
    });
  } catch (error) {
    console.error('Error starting campaign:', error);
    res.status(500).json({ error: 'Failed to start campaign' });
  }
});

// Cancel campaign (Admin only)
app.post('/api/attestation/campaigns/:id/cancel', authenticate, authorize('admin'), async (req, res) => {
  try {
    const campaign = await attestationCampaignDb.getById(req.params.id);
    await attestationCampaignDb.update(req.params.id, { status: 'cancelled' });
    
    await auditDb.log(
      'cancel',
      'attestation_campaign',
      req.params.id,
      campaign?.name || 'Unknown',
      'Cancelled attestation campaign',
      req.user.email
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error cancelling campaign:', error);
    res.status(500).json({ error: 'Failed to cancel campaign' });
  }
});

// Delete campaign (Admin only)
app.delete('/api/attestation/campaigns/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const campaign = await attestationCampaignDb.getById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Delete the campaign - cascade will handle attestation_records
    await attestationCampaignDb.delete(req.params.id);
    
    await auditDb.log(
      'delete',
      'attestation_campaign',
      req.params.id,
      campaign.name,
      `Deleted attestation campaign: ${campaign.name}`,
      req.user.email
    );
    
    res.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// Get campaign dashboard with detailed employee records (Admin only)
app.get('/api/attestation/campaigns/:id/dashboard', authenticate, authorize('admin'), async (req, res) => {
  try {
    const campaign = await attestationCampaignDb.getById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Get all records with user details
    const records = await attestationRecordDb.getByCampaignId(campaign.id);
    const detailedRecords = [];
    
    for (const record of records) {
      const user = await userDb.getById(record.user_id);
      if (user) {
        detailedRecords.push({
          ...record,
          user_email: user.email,
          user_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.name,
          user_role: user.role
        });
      }
    }
    
    res.json({ success: true, campaign, records: detailedRecords });
  } catch (error) {
    console.error('Error fetching campaign dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch campaign dashboard' });
  }
});

// Export campaign report as CSV (Admin only)
app.get('/api/attestation/campaigns/:id/export', authenticate, authorize('admin'), async (req, res) => {
  try {
    const campaign = await attestationCampaignDb.getById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const records = await attestationRecordDb.getByCampaignId(campaign.id);
    
    // Build CSV
    let csv = 'Employee Name,Email,Status,Started,Completed,Reminder Sent,Escalation Sent\n';
    
    for (const record of records) {
      const user = await userDb.getById(record.user_id);
      if (user) {
        const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.name;
        csv += `"${name}","${user.email}","${record.status}","${record.started_at || ''}","${record.completed_at || ''}","${record.reminder_sent_at || ''}","${record.escalation_sent_at || ''}"\n`;
      }
    }
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attestation-${campaign.name.replace(/[^a-z0-9]/gi, '-')}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting campaign:', error);
    res.status(500).json({ error: 'Failed to export campaign' });
  }
});

// Get current user's attestations (All authenticated users)
app.get('/api/attestation/my-attestations', authenticate, async (req, res) => {
  try {
    const records = await attestationRecordDb.getByUserId(req.user.id);
    const detailedRecords = [];
    
    for (const record of records) {
      const campaign = await attestationCampaignDb.getById(record.campaign_id);
      if (campaign && campaign.status === 'active') {
        detailedRecords.push({
          ...record,
          campaign
        });
      }
    }
    
    res.json({ success: true, attestations: detailedRecords });
  } catch (error) {
    console.error('Error fetching user attestations:', error);
    res.status(500).json({ error: 'Failed to fetch attestations' });
  }
});

// Get specific attestation record with assets (All authenticated users)
app.get('/api/attestation/records/:id', authenticate, async (req, res) => {
  try {
    const record = await attestationRecordDb.getById(req.params.id);
    
    if (!record) {
      return res.status(404).json({ error: 'Attestation record not found' });
    }
    
    // Verify user has access to this record
    if (record.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const campaign = await attestationCampaignDb.getById(record.campaign_id);
    
    // Get user's assets
    const allAssets = await assetDb.getAll();
    const userAssets = allAssets.filter(a => a.employee_email === req.user.email);
    
    // Get attested assets for this record
    const attestedAssets = await attestationAssetDb.getByRecordId(record.id);
    
    // Get new assets added during attestation
    const newAssets = await attestationNewAssetDb.getByRecordId(record.id);
    
    res.json({ 
      success: true, 
      record, 
      campaign,
      assets: userAssets,
      attestedAssets,
      newAssets
    });
  } catch (error) {
    console.error('Error fetching attestation record:', error);
    res.status(500).json({ error: 'Failed to fetch attestation record' });
  }
});

// Update asset attestation status (All authenticated users)
app.put('/api/attestation/records/:id/assets/:assetId', authenticate, async (req, res) => {
  try {
    const record = await attestationRecordDb.getById(req.params.id);
    
    if (!record) {
      return res.status(404).json({ error: 'Attestation record not found' });
    }
    
    // Verify user has access
    if (record.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { attested_status, notes } = req.body;
    const asset = await assetDb.getById(req.params.assetId);
    
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    // Create or update attestation asset record
    await attestationAssetDb.create({
      attestation_record_id: record.id,
      asset_id: asset.id,
      attested_status,
      previous_status: asset.status,
      notes,
      attested_at: new Date().toISOString()
    });
    
    // Update record status to in_progress if it was pending
    if (record.status === 'pending') {
      await attestationRecordDb.update(record.id, {
        status: 'in_progress',
        started_at: new Date().toISOString()
      });
    }
    
    // If attested_status changed, update the asset
    if (attested_status && attested_status !== asset.status) {
      await assetDb.update(asset.id, { status: attested_status });
      
      await auditDb.log(
        'update',
        'asset',
        asset.id,
        asset.asset_tag || asset.serial_number || 'Unknown',
        `Updated asset status during attestation: ${asset.status} -> ${attested_status}`,
        req.user.email
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating asset attestation:', error);
    res.status(500).json({ error: 'Failed to update asset attestation' });
  }
});

// Add new asset during attestation (All authenticated users)
app.post('/api/attestation/records/:id/assets/new', authenticate, async (req, res) => {
  try {
    const record = await attestationRecordDb.getById(req.params.id);
    
    if (!record) {
      return res.status(404).json({ error: 'Attestation record not found' });
    }
    
    // Verify user has access
    if (record.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { asset_type, make, model, serial_number, asset_tag, company_id, notes } = req.body;
    
    if (!asset_type || !serial_number || !asset_tag) {
      return res.status(400).json({ error: 'Asset type, serial number, and asset tag are required' });
    }
    
    // Create new asset record
    await attestationNewAssetDb.create({
      attestation_record_id: record.id,
      asset_type,
      make,
      model,
      serial_number,
      asset_tag,
      company_id,
      notes
    });
    
    // Update record status to in_progress if it was pending
    if (record.status === 'pending') {
      await attestationRecordDb.update(record.id, {
        status: 'in_progress',
        started_at: new Date().toISOString()
      });
    }
    
    await auditDb.log(
      'create',
      'attestation_new_asset',
      record.id,
      `${asset_type} - ${serial_number}`,
      `Added new asset during attestation: ${asset_type} - ${serial_number}`,
      req.user.email
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding new asset during attestation:', error);
    res.status(500).json({ error: 'Failed to add new asset' });
  }
});

// Complete attestation (All authenticated users)
app.post('/api/attestation/records/:id/complete', authenticate, async (req, res) => {
  try {
    const record = await attestationRecordDb.getById(req.params.id);
    
    if (!record) {
      return res.status(404).json({ error: 'Attestation record not found' });
    }
    
    // Verify user has access
    if (record.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get newly added assets during attestation
    const newAssets = await attestationNewAssetDb.getByRecordId(record.id);
    
    // Transfer new assets to the main assets table
    for (const newAsset of newAssets) {
      try {
        const createdAsset = await assetDb.create({
          employee_email: req.user.email,
          employee_first_name: req.user.first_name || '',
          employee_last_name: req.user.last_name || '',
          manager_email: req.user.manager_email || null,
          company_id: newAsset.company_id,
          asset_type: newAsset.asset_type,
          make: newAsset.make || '',
          model: newAsset.model || '',
          serial_number: newAsset.serial_number,
          asset_tag: newAsset.asset_tag,
          status: 'active',
          notes: newAsset.notes || ''
        });
        
        // Log audit trail (wrapped in try-catch to not block asset creation on audit failure)
        try {
          await auditDb.log(
            'create',
            'asset',
            newAsset.serial_number,
            `${newAsset.asset_type} - ${newAsset.serial_number}`,
            `Asset created from attestation: ${newAsset.asset_type} - ${newAsset.serial_number}`,
            req.user.email
          );
        } catch (auditError) {
          console.error('Failed to log asset creation audit:', auditError);
        }
      } catch (assetError) {
        console.error('Error creating asset from attestation:', assetError);
        // Continue with other assets even if one fails
      }
    }
    
    // Mark as completed
    await attestationRecordDb.update(record.id, {
      status: 'completed',
      completed_at: new Date().toISOString()
    });
    
    const campaign = await attestationCampaignDb.getById(record.campaign_id);
    
    await auditDb.log(
      'complete',
      'attestation_record',
      record.id,
      campaign?.name || 'Unknown Campaign',
      `Completed attestation for campaign: ${campaign?.name || 'Unknown'}`,
      req.user.email
    );
    
    // Send notification to admins
    try {
      const admins = await userDb.getByRole('admin');
      const adminEmails = admins.map(a => a.email).filter(Boolean);
      
      if (adminEmails.length > 0) {
        const { sendAttestationCompleteAdminNotification } = await import('./services/smtpMailer.js');
        const employeeName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.name;
        await sendAttestationCompleteAdminNotification(adminEmails, employeeName, req.user.email, campaign);
      }
    } catch (emailError) {
      console.error('Failed to send admin notification:', emailError);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error completing attestation:', error);
    res.status(500).json({ error: 'Failed to complete attestation' });
  }
});

// Validate attestation invite token (Public endpoint)
app.get('/api/attestation/validate-invite/:token', async (req, res) => {
  try {
    const invite = await attestationPendingInviteDb.getByToken(req.params.token);
    
    if (!invite) {
      return res.json({ valid: false, error: 'Invalid invite token' });
    }
    
    // Check if already registered
    if (invite.registered_at) {
      return res.json({ valid: false, error: 'Invite has already been used' });
    }
    
    // Check if campaign is still active
    const campaign = await attestationCampaignDb.getById(invite.campaign_id);
    if (!campaign) {
      return res.json({ valid: false, error: 'Campaign not found' });
    }
    
    if (campaign.status !== 'active') {
      return res.json({ valid: false, error: 'Campaign is no longer active' });
    }
    
    // Get asset count for this employee
    const assets = await assetDb.getByEmployee(invite.employee_email);
    const assetCount = assets.length;
    
    // Check if SSO is enabled
    const oidcSettings = await oidcSettingsDb.get();
    const ssoEnabled = oidcSettings?.enabled || false;
    const ssoButtonText = oidcSettings?.button_text || 'Sign In with SSO';
    
    res.json({
      valid: true,
      email: invite.employee_email,
      firstName: invite.employee_first_name,
      lastName: invite.employee_last_name,
      campaignName: campaign.name,
      campaignDescription: campaign.description,
      assetCount,
      ssoEnabled,
      ssoButtonText
    });
  } catch (error) {
    console.error('Error validating invite token:', error);
    res.status(500).json({ error: 'Failed to validate invite token' });
  }
});

// Get pending invites for campaign (Admin only)
app.get('/api/attestation/campaigns/:id/pending-invites', authenticate, authorize('admin'), async (req, res) => {
  try {
    const campaign = await attestationCampaignDb.getById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const pendingInvites = await attestationPendingInviteDb.getByCampaignId(req.params.id);
    
    // Enrich with asset counts
    const enrichedInvites = await Promise.all(
      pendingInvites.map(async (invite) => {
        const assets = await assetDb.getByEmployee(invite.employee_email);
        return {
          ...invite,
          asset_count: assets.length
        };
      })
    );
    
    res.json({ success: true, invites: enrichedInvites });
  } catch (error) {
    console.error('Error fetching pending invites:', error);
    res.status(500).json({ error: 'Failed to fetch pending invites' });
  }
});

// Resend invites (Admin only)
app.post('/api/attestation/campaigns/:id/resend-invites', authenticate, authorize('admin'), async (req, res) => {
  try {
    const campaign = await attestationCampaignDb.getById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    if (campaign.status !== 'active') {
      return res.status(400).json({ error: 'Campaign is not active' });
    }
    
    const { inviteIds } = req.body;
    
    // Get invites to resend
    let invitesToResend;
    if (inviteIds && inviteIds.length > 0) {
      // Resend specific invites
      invitesToResend = await Promise.all(
        inviteIds.map(id => attestationPendingInviteDb.getById(id))
      );
      invitesToResend = invitesToResend.filter(inv => inv && !inv.registered_at);
    } else {
      // Resend all unregistered invites
      const allInvites = await attestationPendingInviteDb.getByCampaignId(req.params.id);
      invitesToResend = allInvites.filter(inv => !inv.registered_at);
    }
    
    // Get OIDC settings
    const oidcSettings = await oidcSettingsDb.get();
    const ssoEnabled = oidcSettings?.enabled || false;
    const ssoButtonText = oidcSettings?.button_text || 'Sign In with SSO';
    
    let emailsSent = 0;
    
    for (const invite of invitesToResend) {
      // Get asset count
      const assets = await assetDb.getByEmployee(invite.employee_email);
      const assetCount = assets.length;
      
      try {
        const { sendAttestationRegistrationInvite } = await import('./services/smtpMailer.js');
        const result = await sendAttestationRegistrationInvite(
          invite.employee_email,
          invite.employee_first_name,
          invite.employee_last_name,
          campaign,
          invite.invite_token,
          assetCount,
          ssoEnabled,
          ssoButtonText
        );
        
        if (result.success) {
          emailsSent++;
          // Update invite_sent_at
          await attestationPendingInviteDb.update(invite.id, {
            invite_sent_at: new Date().toISOString()
          });
        }
      } catch (emailError) {
        console.error(`Failed to resend invite to ${invite.employee_email}:`, emailError);
      }
    }
    
    await auditDb.log(
      'resend_invites',
      'attestation_campaign',
      campaign.id,
      campaign.name,
      `Resent ${emailsSent} attestation invites for campaign: ${campaign.name}`,
      req.user.email
    );
    
    res.json({ success: true, emailsSent });
  } catch (error) {
    console.error('Error resending invites:', error);
    res.status(500).json({ error: 'Failed to resend invites' });
  }
});

// Start server after database initialization
const startServer = async () => {
  try {
    await assetDb.init();
    await initializeOIDCFromSettings();
    console.log(`Using ${databaseEngine.toUpperCase()} database backend`);

    app.listen(PORT, () => {
    console.log(`KARS API running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
