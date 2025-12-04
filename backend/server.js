import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { assetDb, companyDb, auditDb, userDb, oidcSettingsDb, databaseSettings, databaseEngine, importSqliteDatabase, passkeyDb } from './database.js';
import { authenticate, authorize, hashPassword, comparePassword, generateToken } from './auth.js';
import { initializeOIDC, getAuthorizationUrl, handleCallback, getUserInfo, extractUserData, isOIDCEnabled } from './oidc.js';
import { generateMFASecret, verifyTOTP, generateBackupCodes, formatBackupCode } from './mfa.js';
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

const rpID = process.env.PASSKEY_RP_ID || 'localhost';
const rpName = process.env.PASSKEY_RP_NAME || 'Asset Registration System';
const defaultOrigin = process.env.PASSKEY_ORIGIN || 'http://localhost:5173';

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
app.use(express.json());

const pendingMFALogins = new Map();
const pendingPasskeyRegistrations = new Map();
const pendingPasskeyLogins = new Map();

const getExpectedOrigin = (req) => process.env.PASSKEY_ORIGIN || req.get('origin') || defaultOrigin;

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
  res.json({ status: 'ok', message: 'Asset Registration API is running' });
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
    const { email, password, name, first_name, last_name, manager_name, manager_email } = req.body;

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

    if (!manager_name || !manager_email) {
      return res.status(400).json({
        error: 'Manager name and manager email are required'
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
      manager_name,
      manager_email,
      role: userRole
    });

    const newUser = await userDb.getById(result.id);

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
        manager_name: newUser.manager_name,
        manager_email: newUser.manager_email,
        registration_method: 'local'
      },
      newUser.email
    );

    // Link any existing assets to this user's manager information
    try {
      const linkedAssets = await assetDb.linkAssetsToUser(
        newUser.email,
        newUser.manager_name,
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
            manager_name: newUser.manager_name,
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
    } catch (roleError) {
      console.error('Error auto-assigning manager role during registration:', roleError);
      // Don't fail registration if role assignment fails
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
        manager_email: newUser.manager_email
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
        manager_email: user.manager_email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
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
      manager_email: user.manager_email
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Update user profile
app.put('/api/auth/profile', authenticate, async (req, res) => {
  try {
    const { first_name, last_name, manager_name, manager_email } = req.body;

    // Validation
    if (!first_name || !last_name) {
      return res.status(400).json({
        error: 'First name and last name are required'
      });
    }

    if (!manager_name || !manager_email) {
      return res.status(400).json({
        error: 'Manager name and manager email are required'
      });
    }

    // Get old profile data for audit
    const oldUser = await userDb.getById(req.user.id);

    // Calculate name from first_name and last_name
    const name = `${first_name} ${last_name}`;

    // Update profile
    await userDb.updateProfile(req.user.id, {
      name,
      first_name,
      last_name,
      manager_name,
      manager_email
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
        old_manager_name: oldUser.manager_name,
        old_manager_email: oldUser.manager_email,
        new_first_name: first_name,
        new_last_name: last_name,
        new_manager_name: manager_name,
        new_manager_email: manager_email
      },
      user.email
    );

    // Update manager info on all assets for this employee if manager changed
    const managerChanged = oldUser.manager_name !== manager_name || oldUser.manager_email !== manager_email;
    if (managerChanged) {
      try {
        const updatedAssets = await assetDb.updateManagerForEmployee(
          user.email,
          manager_name,
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
              old_manager_name: oldUser.manager_name,
              old_manager_email: oldUser.manager_email,
              new_manager_name: manager_name,
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
        manager_email: user.manager_email
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
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

app.post('/api/auth/passkeys/registration-options', authenticate, async (req, res) => {
  try {
    const userPasskeys = await passkeyDb.listByUser(req.user.id);
    const options = generateRegistrationOptions({
      rpName,
      rpID,
      userName: req.user.email,
      userDisplayName: req.user.name || req.user.email,
      // simplewebauthn requires userID to be a BufferSource (not string)
      userID: Buffer.from(req.user.id.toString()),
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred'
      },
      excludeCredentials: userPasskeys.map((pk) => ({
        id: isoBase64URL.toBuffer(pk.credential_id),
        type: 'public-key'
      }))
    });

    pendingPasskeyRegistrations.set(req.user.id, options.challenge);
    res.json({ options });
  } catch (error) {
    console.error('Failed to generate passkey registration options:', error);
    res.status(500).json({ error: 'Unable to start passkey registration' });
  }
});

app.post('/api/auth/passkeys/verify-registration', authenticate, async (req, res) => {
  try {
    const { credential, name } = req.body;
    const expectedChallenge = pendingPasskeyRegistrations.get(req.user.id);

    if (!expectedChallenge) {
      return res.status(400).json({ error: 'No passkey registration in progress' });
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: getExpectedOrigin(req),
      expectedRPID: rpID
    });

    if (!verification?.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Passkey registration verification failed' });
    }

    const { credentialPublicKey, credentialID, counter } = verification.registrationInfo;

    const record = await passkeyDb.create({
      userId: req.user.id,
      name: name || 'Passkey',
      credentialId: isoBase64URL.fromBuffer(credentialID),
      publicKey: isoBase64URL.fromBuffer(credentialPublicKey),
      counter,
      transports: credential?.response?.transports || []
    });

    pendingPasskeyRegistrations.delete(req.user.id);
    const savedPasskey = await passkeyDb.getById(record.id);

    res.json({ passkey: serializePasskey(savedPasskey) });
  } catch (error) {
    console.error('Failed to verify passkey registration:', error);
    res.status(500).json({ error: 'Unable to verify passkey registration' });
  }
});

app.post('/api/auth/passkeys/auth-options', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required to use a passkey' });
    }

    const user = await userDb.getByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'No account found for this email' });
    }

    const userPasskeys = await passkeyDb.listByUser(user.id);
    if (!userPasskeys.length) {
      return res.status(400).json({ error: 'No passkeys registered for this account' });
    }

    const options = generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      allowCredentials: userPasskeys.map((pk) => ({
        id: isoBase64URL.toBuffer(pk.credential_id),
        type: 'public-key',
        transports: pk.transports ? JSON.parse(pk.transports) : undefined
      }))
    });

    pendingPasskeyLogins.set(user.id, { challenge: options.challenge, email: user.email });
    res.json({ options });
  } catch (error) {
    console.error('Failed to generate passkey authentication options:', error);
    res.status(500).json({ error: 'Unable to start passkey sign in' });
  }
});

app.post('/api/auth/passkeys/verify-authentication', async (req, res) => {
  try {
    const { email, credential } = req.body;

    if (!email || !credential) {
      return res.status(400).json({ error: 'Email and credential response are required' });
    }

    const user = await userDb.getByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'No account found for this email' });
    }

    const pending = pendingPasskeyLogins.get(user.id);
    if (!pending || pending.email !== email) {
      return res.status(400).json({ error: 'No pending passkey authentication found' });
    }

    const dbPasskey = await passkeyDb.getByCredentialId(credential.id);
    if (!dbPasskey || dbPasskey.user_id !== user.id) {
      return res.status(404).json({ error: 'Passkey not recognized for this account' });
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: pending.challenge,
      expectedOrigin: getExpectedOrigin(req),
      expectedRPID: rpID,
      authenticator: {
        credentialID: isoBase64URL.toBuffer(dbPasskey.credential_id),
        credentialPublicKey: isoBase64URL.toBuffer(dbPasskey.public_key),
        counter: dbPasskey.counter,
        transports: dbPasskey.transports ? JSON.parse(dbPasskey.transports) : []
      }
    });

    if (!verification?.verified || !verification.authenticationInfo) {
      return res.status(400).json({ error: 'Passkey authentication failed' });
    }

    await passkeyDb.updateCounter(dbPasskey.id, verification.authenticationInfo.newCounter ?? dbPasskey.counter);
    await userDb.updateLastLogin(user.id);

    const token = generateToken(user);
    pendingPasskeyLogins.delete(user.id);

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
app.get('/api/auth/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const users = await userDb.getAll();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
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

// ===== OIDC Authentication Endpoints =====

// Store for state tokens (in production, use Redis or similar)
const stateStore = new Map();

// Get OIDC configuration (for frontend)
app.get('/api/auth/oidc/config', async (req, res) => {
  try {
    const settings = await oidcSettingsDb.get();
    res.json({
      enabled: settings?.enabled === 1 && isOIDCEnabled()
    });
  } catch (error) {
    res.json({ enabled: false });
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
          oidcSub: userData.oidcSub
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
        manager_email: user.manager_email
      }
    });
  } catch (error) {
    console.error('OIDC callback error:', error);
    res.status(500).json({ error: 'Failed to process OIDC callback', details: error.message });
  }
});

// Get all assets (with role-based filtering)
app.get('/api/assets', authenticate, async (req, res) => {
  try {
    const allAssets = await assetDb.getAll();
    const user = await userDb.getById(req.user.id);

    // Role-based filtering
    let filteredAssets;
    if (user.role === 'admin') {
      // Admin sees all assets
      filteredAssets = allAssets;
    } else if (user.role === 'manager') {
      // Manager sees their own assets + their employees' assets
      filteredAssets = allAssets.filter(asset =>
        asset.employee_email === user.email ||
        asset.manager_email === user.email
      );
    } else {
      // Employee sees only their own assets
      filteredAssets = allAssets.filter(asset =>
        asset.employee_email === user.email
      );
    }

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
      client_name: req.query.client,
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
      'employee_name',
      'employee_email',
      'client_name',
      'laptop_serial_number',
      'laptop_asset_tag'
    ];
    const validStatuses = ['active', 'returned', 'lost', 'damaged', 'retired'];

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

      // Get manager data from employee's user record if they exist
      const employeeUser = await userDb.getByEmail(normalizedRow.employee_email);
      let manager_name = null;
      let manager_email = null;

      if (employeeUser && employeeUser.manager_name && employeeUser.manager_email) {
        // User exists with manager info - use it
        manager_name = employeeUser.manager_name;
        manager_email = employeeUser.manager_email;
      }
      // If user doesn't exist or has no manager info, allow asset creation with null manager fields
      // These will be populated when the employee registers

      const assetData = {
        employee_name: normalizedRow.employee_name,
        employee_email: normalizedRow.employee_email,
        manager_name,
        manager_email,
        client_name: normalizedRow.client_name,
        laptop_make: normalizedRow.laptop_make || '',
        laptop_model: normalizedRow.laptop_model || '',
        laptop_serial_number: normalizedRow.laptop_serial_number,
        laptop_asset_tag: normalizedRow.laptop_asset_tag,
        status,
        notes: normalizedRow.notes || ''
      };

      try {
        const result = await assetDb.create(assetData);
        const newAsset = await assetDb.getById(result.id);

        await auditDb.log(
          'CREATE',
          'asset',
          newAsset.id,
          `${assetData.laptop_serial_number} - ${assetData.employee_name}`,
          {
            employee_name: assetData.employee_name,
            employee_email: assetData.employee_email,
            client_name: assetData.client_name,
            laptop_serial_number: assetData.laptop_serial_number,
            laptop_asset_tag: assetData.laptop_asset_tag,
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
    const { employee_name, employee_email, client_name, laptop_serial_number, laptop_asset_tag, notes } = req.body;

    // Validation
    if (!employee_name || !employee_email || !client_name || !laptop_serial_number || !laptop_asset_tag) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['employee_name', 'employee_email', 'client_name', 'laptop_serial_number', 'laptop_asset_tag']
      });
    }

    // Get manager data from employee's user record if they exist
    const employeeUser = await userDb.getByEmail(employee_email);
    let manager_name = null;
    let manager_email = null;

    if (employeeUser && employeeUser.manager_name && employeeUser.manager_email) {
      // User exists with manager info - use it
      manager_name = employeeUser.manager_name;
      manager_email = employeeUser.manager_email;
    }
    // If user doesn't exist or has no manager info, allow asset creation with null manager fields
    // These will be populated when the employee registers

    const result = await assetDb.create({
      ...req.body,
      manager_name,
      manager_email
    });
    const newAsset = await assetDb.getById(result.id);

    // Log audit
    await auditDb.log(
      'CREATE',
      'asset',
      newAsset.id,
      `${laptop_serial_number} - ${employee_name}`,
      {
        employee_name,
        employee_email,
        manager_name,
        manager_email,
        client_name,
        laptop_serial_number,
        laptop_asset_tag
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
    await auditDb.log(
      'STATUS_CHANGE',
      'asset',
      asset.id,
      `${asset.laptop_serial_number} - ${asset.employee_name}`,
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

    const { employee_name, employee_email, client_name, laptop_serial_number, laptop_asset_tag, status, notes } = req.body;

    if (!employee_name || !employee_email || !client_name || !laptop_serial_number || !laptop_asset_tag) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['employee_name', 'employee_email', 'client_name', 'laptop_serial_number', 'laptop_asset_tag']
      });
    }

    // Get manager data from employee's user record
    const employeeUser = await userDb.getByEmail(employee_email);
    let manager_name = '';
    let manager_email = '';

    if (employeeUser && employeeUser.manager_name && employeeUser.manager_email) {
      manager_name = employeeUser.manager_name;
      manager_email = employeeUser.manager_email;
    } else {
      return res.status(400).json({
        error: 'Employee user not found or manager information not set. Please ensure the employee is registered with manager information.'
      });
    }

    await assetDb.update(req.params.id, {
      ...req.body,
      manager_name,
      manager_email
    });
    const updatedAsset = await assetDb.getById(req.params.id);

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

// Delete asset (admin only)
app.delete('/api/assets/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const asset = await assetDb.getById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Log audit before deletion
    await auditDb.log(
      'DELETE',
      'asset',
      asset.id,
      `${asset.laptop_serial_number} - ${asset.employee_name}`,
      {
        employee_name: asset.employee_name,
        employee_email: asset.employee_email,
        manager_name: asset.manager_name,
        manager_email: asset.manager_email,
        client_name: asset.client_name,
        laptop_serial_number: asset.laptop_serial_number,
        laptop_asset_tag: asset.laptop_asset_tag,
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
        laptop_serial_number: asset.laptop_serial_number,
        employee_name: asset.employee_name
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
    if (await companyDb.hasAssets(company.name)) {
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
    } else if (user.role === 'manager') {
      // Managers see their own logs + their employees' logs
      // Get all assets where user is manager to find their employees
      const allAssets = await assetDb.getAll();
      const employeeEmails = new Set();
      employeeEmails.add(user.email); // Add manager's own email

      allAssets.forEach(asset => {
        if (asset.manager_email === user.email) {
          employeeEmails.add(asset.employee_email);
        }
      });

      logs = logs.filter(log =>
        !log.user_email || employeeEmails.has(log.user_email)
      );
    }
    // Admin sees all logs (no filtering)

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
    } else if (user.role === 'manager') {
      // Managers see their own logs + their employees' logs
      // Get all assets where user is manager to find their employees
      const allAssets = await assetDb.getAll();
      const employeeEmails = new Set();
      employeeEmails.add(user.email); // Add manager's own email

      allAssets.forEach(asset => {
        if (asset.manager_email === user.email) {
          employeeEmails.add(asset.employee_email);
        }
      });

      logs = logs.filter(log =>
        !log.user_email || employeeEmails.has(log.user_email)
      );
    }
    // Admin sees all logs (no filtering)

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
    if (user.role === 'admin') {
      assets = allAssets;
    } else if (user.role === 'manager') {
      assets = allAssets.filter(asset =>
        asset.employee_email === user.email ||
        asset.manager_email === user.email
      );
    } else {
      assets = allAssets.filter(asset =>
        asset.employee_email === user.email
      );
    }

    const summary = {
      total: assets.length,
      by_status: {},
      by_company: {},
      by_manager: {}
    };

    assets.forEach(asset => {
      // Status breakdown
      summary.by_status[asset.status] = (summary.by_status[asset.status] || 0) + 1;

      // Company breakdown
      summary.by_company[asset.client_name] = (summary.by_company[asset.client_name] || 0) + 1;

      // Manager breakdown
      summary.by_manager[asset.manager_name] = (summary.by_manager[asset.manager_name] || 0) + 1;
    });

    res.json(summary);
  } catch (error) {
    console.error('Error generating summary report:', error);
    res.status(500).json({ error: 'Failed to generate summary report' });
  }
});

// Start server after database initialization
const startServer = async () => {
  try {
    await assetDb.init();
    await initializeOIDCFromSettings();
    console.log(`Using ${databaseEngine.toUpperCase()} database backend`);

    app.listen(PORT, () => {
      console.log(`Asset Registration API running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
