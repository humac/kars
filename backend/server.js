import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { assetDb, companyDb, auditDb, userDb, oidcSettingsDb } from './database.js';
import { authenticate, authorize, hashPassword, comparePassword, generateToken } from './auth.js';
import { initializeOIDC, getAuthorizationUrl, handleCallback, getUserInfo, extractUserData, isOIDCEnabled } from './oidc.js';
import { generateMFASecret, verifyTOTP, generateBackupCodes, formatBackupCode } from './mfa.js';
import { randomBytes } from 'crypto';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
assetDb.init();

// Initialize OIDC from database settings (async)
(async () => {
  try {
    const settings = oidcSettingsDb.get();
    if (settings && settings.enabled === 1) {
      await initializeOIDC(settings);
    } else {
      console.log('OIDC is disabled in settings');
    }
  } catch (err) {
    console.error('OIDC initialization failed:', err.message);
  }
})();

// Store for pending MFA logins (in production, use Redis)
const pendingMFALogins = new Map();

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

// ===== Authentication Endpoints =====

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, first_name, last_name } = req.body;

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

    // Check if user already exists
    const existingUser = userDb.getByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Determine user role
    // 1. First user becomes admin
    // 2. User with email matching ADMIN_EMAIL env var becomes admin
    // 3. Otherwise, default to 'employee'
    const allUsers = userDb.getAll();
    const isFirstUser = allUsers.length === 0;
    const isAdminEmail = process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();

    let userRole = 'employee'; // Default role
    if (isFirstUser || isAdminEmail) {
      userRole = 'admin';
      console.log(`Creating admin user: ${email} (${isFirstUser ? 'first user' : 'admin email match'})`);
    }

    // Create user
    const result = userDb.create({
      email,
      password_hash,
      name: name || `${first_name} ${last_name}`,
      first_name: first_name || null,
      last_name: last_name || null,
      role: userRole
    });

    const newUser = userDb.getById(result.lastInsertRowid);

    // Generate token
    const token = generateToken(newUser);

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
        last_name: newUser.last_name
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
    const user = userDb.getByEmail(email);
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
    userDb.updateLastLogin(user.id);

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
        last_name: user.last_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Get current user (verify token)
app.get('/api/auth/me', authenticate, (req, res) => {
  try {
    const user = userDb.getById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Update user profile
app.put('/api/auth/profile', authenticate, (req, res) => {
  try {
    const { first_name, last_name } = req.body;

    // Validation
    if (!first_name || !last_name) {
      return res.status(400).json({
        error: 'First name and last name are required'
      });
    }

    // Update profile
    userDb.updateProfile(req.user.id, {
      first_name,
      last_name
    });

    // Get updated user
    const user = userDb.getById(req.user.id);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name
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
    const user = userDb.getById(req.user.id);
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
    userDb.updatePassword(req.user.id, newPasswordHash);

    // Log the password change
    auditDb.create({
      action: 'change_password',
      entity_type: 'user',
      entity_id: user.id,
      entity_name: user.email,
      details: 'Password changed successfully',
      user_email: user.email
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ===== MFA Endpoints =====

// Get MFA status for current user
app.get('/api/auth/mfa/status', authenticate, (req, res) => {
  try {
    const mfaStatus = userDb.getMFAStatus(req.user.id);
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
    const user = userDb.getById(req.user.id);
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
    userDb.enableMFA(req.user.id, enrollment.secret, backupCodes);

    // Clean up pending enrollment
    pendingMFALogins.delete(enrollKey);

    // Log the action
    auditDb.log(
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
    const user = userDb.getById(req.user.id);
    const isValid = await comparePassword(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Disable MFA
    userDb.disableMFA(req.user.id);

    // Log the action
    auditDb.log(
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
    const user = userDb.getById(pendingLogin.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let isValid = false;

    if (useBackupCode) {
      // Verify and consume backup code
      const cleanedCode = token.replace(/-/g, '').toUpperCase();
      isValid = userDb.useBackupCode(user.id, cleanedCode);
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
    userDb.updateLastLogin(user.id);

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
        last_name: user.last_name
      }
    });
  } catch (error) {
    console.error('MFA login verification error:', error);
    res.status(500).json({ error: 'Failed to verify MFA' });
  }
});

// Get all users (admin only)
app.get('/api/auth/users', authenticate, authorize('admin'), (req, res) => {
  try {
    const users = userDb.getAll();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Update user role (admin only)
app.put('/api/auth/users/:id/role', authenticate, authorize('admin'), (req, res) => {
  try {
    const { role } = req.body;
    const userId = parseInt(req.params.id);

    // Validation
    if (!role || !['admin', 'manager', 'employee'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role. Must be one of: admin, manager, employee'
      });
    }

    const user = userDb.getById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admin from demoting themselves
    if (userId === req.user.id && role !== 'admin') {
      return res.status(403).json({
        error: 'Cannot change your own admin role'
      });
    }

    userDb.updateRole(userId, role);
    const updatedUser = userDb.getById(userId);

    res.json({
      message: 'User role updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name
      }
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Delete user (admin only)
app.delete('/api/auth/users/:id', authenticate, authorize('admin'), (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(403).json({
        error: 'Cannot delete your own account'
      });
    }

    const user = userDb.getById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    userDb.delete(userId);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ===== OIDC Settings Management (Admin Only) =====

// Get OIDC settings
app.get('/api/admin/oidc-settings', authenticate, authorize('admin'), (req, res) => {
  try {
    const settings = oidcSettingsDb.get();
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
    const existingSettings = oidcSettingsDb.get();
    if (!settings.client_secret && existingSettings?.client_secret) {
      settings.client_secret = existingSettings.client_secret;
    }

    // Update settings
    oidcSettingsDb.update(settings, req.user.email);

    // Reinitialize OIDC client with new settings
    if (settings.enabled) {
      await initializeOIDC(settings);
    }

    // Log the change
    auditDb.log(
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

// ===== OIDC Authentication Endpoints =====

// Store for state tokens (in production, use Redis or similar)
const stateStore = new Map();

// Get OIDC configuration (for frontend)
app.get('/api/auth/oidc/config', (req, res) => {
  try {
    const settings = oidcSettingsDb.get();
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
    let user = userDb.getByOIDCSub(userData.oidcSub);

    if (!user) {
      // Check if user with same email exists
      user = userDb.getByEmail(userData.email);

      if (user) {
        // Link existing user to OIDC
        console.log(`Linking existing user ${userData.email} to OIDC subject ${userData.oidcSub}`);
        userDb.linkOIDC(user.id, userData.oidcSub);
      } else {
        // Create new user (JIT provisioning)
        console.log(`Creating new user via OIDC: ${userData.email} with role ${userData.role}`);
        const result = userDb.createFromOIDC({
          email: userData.email,
          name: userData.fullName,
          first_name: userData.firstName,
          last_name: userData.lastName,
          role: userData.role,
          oidcSub: userData.oidcSub
        });

        user = userDb.getById(result.lastInsertRowid);

        // Log user creation
        auditDb.log(
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
    userDb.updateLastLogin(user.id);

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
        last_name: user.last_name
      }
    });
  } catch (error) {
    console.error('OIDC callback error:', error);
    res.status(500).json({ error: 'Failed to process OIDC callback', details: error.message });
  }
});

// Get all assets (with role-based filtering)
app.get('/api/assets', authenticate, (req, res) => {
  try {
    const allAssets = assetDb.getAll();
    const user = userDb.getById(req.user.id);

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
app.get('/api/assets/:id', (req, res) => {
  try {
    const asset = assetDb.getById(req.params.id);
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
app.get('/api/assets/search', (req, res) => {
  try {
    const filters = {
      employee_name: req.query.employee,
      manager_name: req.query.manager,
      client_name: req.query.client,
      status: req.query.status
    };

    const assets = assetDb.search(filters);
    res.json(assets);
  } catch (error) {
    console.error('Error searching assets:', error);
    res.status(500).json({ error: 'Failed to search assets' });
  }
});

// Create new asset
app.post('/api/assets', authenticate, (req, res) => {
  try {
    const { employee_name, employee_email, manager_name, manager_email, client_name, laptop_serial_number, laptop_asset_tag, notes } = req.body;

    // Validation
    if (!employee_name || !employee_email || !manager_name || !manager_email || !client_name || !laptop_serial_number || !laptop_asset_tag) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['employee_name', 'employee_email', 'manager_name', 'manager_email', 'client_name', 'laptop_serial_number', 'laptop_asset_tag']
      });
    }

    const result = assetDb.create(req.body);
    const newAsset = assetDb.getById(result.lastInsertRowid);

    // Log audit
    auditDb.log(
      'CREATE',
      'asset',
      newAsset.id,
      `${laptop_serial_number} - ${employee_name}`,
      {
        employee_name,
        employee_email,
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
app.patch('/api/assets/:id/status', (req, res) => {
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

    const asset = assetDb.getById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const oldStatus = asset.status;
    assetDb.updateStatus(req.params.id, status, notes);
    const updatedAsset = assetDb.getById(req.params.id);

    // Log audit
    auditDb.log(
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
app.put('/api/assets/:id', (req, res) => {
  try {
    const asset = assetDb.getById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const { employee_name, employee_email, manager_name, manager_email, client_name, laptop_serial_number, laptop_asset_tag, status, notes } = req.body;

    if (!employee_name || !employee_email || !manager_name || !manager_email || !client_name || !laptop_serial_number || !laptop_asset_tag) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['employee_name', 'employee_email', 'manager_name', 'manager_email', 'client_name', 'laptop_serial_number', 'laptop_asset_tag']
      });
    }

    assetDb.update(req.params.id, req.body);
    const updatedAsset = assetDb.getById(req.params.id);

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

// Delete asset
app.delete('/api/assets/:id', (req, res) => {
  try {
    const asset = assetDb.getById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    assetDb.delete(req.params.id);
    res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// ===== Company Management Endpoints =====

// Get all companies (admin only - full details)
app.get('/api/companies', authenticate, authorize('admin'), (req, res) => {
  try {
    const companies = companyDb.getAll();
    res.json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get company names for dropdown (all authenticated users)
app.get('/api/companies/names', authenticate, (req, res) => {
  try {
    const companies = companyDb.getAll();
    // Return only id and name for dropdown use
    const companyNames = companies.map(c => ({ id: c.id, name: c.name }));
    res.json(companyNames);
  } catch (error) {
    console.error('Error fetching company names:', error);
    res.status(500).json({ error: 'Failed to fetch company names' });
  }
});

// Get single company by ID
app.get('/api/companies/:id', (req, res) => {
  try {
    const company = companyDb.getById(req.params.id);
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
app.post('/api/companies', authenticate, authorize('admin'), (req, res) => {
  try {
    const { name, description } = req.body;

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({
        error: 'Company name is required'
      });
    }

    // Check if company already exists
    const existing = companyDb.getByName(name);
    if (existing) {
      return res.status(409).json({
        error: 'A company with this name already exists'
      });
    }

    const result = companyDb.create(req.body);
    const newCompany = companyDb.getById(result.lastInsertRowid);

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
app.put('/api/companies/:id', authenticate, authorize('admin'), (req, res) => {
  try {
    const company = companyDb.getById(req.params.id);
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
    const existing = companyDb.getByName(name);
    if (existing && existing.id !== parseInt(req.params.id)) {
      return res.status(409).json({
        error: 'A company with this name already exists'
      });
    }

    companyDb.update(req.params.id, req.body);
    const updatedCompany = companyDb.getById(req.params.id);

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
app.delete('/api/companies/:id', authenticate, authorize('admin'), (req, res) => {
  try {
    const company = companyDb.getById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check if company has assets
    if (companyDb.hasAssets(company.name)) {
      return res.status(409).json({
        error: 'Cannot delete company with existing assets. Please reassign or delete assets first.'
      });
    }

    companyDb.delete(req.params.id);
    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

// ===== Audit & Reporting Endpoints =====

// Get all audit logs (with role-based filtering)
app.get('/api/audit/logs', authenticate, (req, res) => {
  try {
    const user = userDb.getById(req.user.id);

    const options = {
      entityType: req.query.entityType,
      entityId: req.query.entityId,
      action: req.query.action,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      userEmail: req.query.userEmail,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };

    let logs = auditDb.getAll(options);

    // Role-based filtering
    if (user.role === 'employee') {
      // Employees only see their own audit logs
      logs = logs.filter(log => log.user_email === user.email);
    } else if (user.role === 'manager') {
      // Managers see their own logs + their employees' logs
      // Get all assets where user is manager to find their employees
      const allAssets = assetDb.getAll();
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
app.get('/api/audit/entity/:type/:id', (req, res) => {
  try {
    const logs = auditDb.getByEntity(req.params.type, req.params.id);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching entity audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch entity audit logs' });
  }
});

// Get recent audit logs
app.get('/api/audit/recent', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    const logs = auditDb.getRecent(limit);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching recent audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch recent audit logs' });
  }
});

// Get audit statistics
app.get('/api/audit/stats', (req, res) => {
  try {
    const stats = auditDb.getStats(req.query.startDate, req.query.endDate);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({ error: 'Failed to fetch audit stats' });
  }
});

// Generate report (CSV export)
app.get('/api/audit/export', authenticate, (req, res) => {
  try {
    const user = userDb.getById(req.user.id);

    const options = {
      entityType: req.query.entityType,
      action: req.query.action,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      userEmail: req.query.userEmail
    };

    let logs = auditDb.getAll(options);

    // Role-based filtering
    if (user.role === 'employee') {
      // Employees only see their own audit logs
      logs = logs.filter(log => log.user_email === user.email);
    } else if (user.role === 'manager') {
      // Managers see their own logs + their employees' logs
      // Get all assets where user is manager to find their employees
      const allAssets = assetDb.getAll();
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
app.get('/api/reports/summary', authenticate, (req, res) => {
  try {
    const user = userDb.getById(req.user.id);
    const allAssets = assetDb.getAll();

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

// Start server
app.listen(PORT, () => {
  console.log(`Asset Registration API running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
