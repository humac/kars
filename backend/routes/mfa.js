/**
 * MFA Routes
 * Handles: MFA enrollment, verification, and management
 */

import { Router } from 'express';
import { requireFields } from '../middleware/validation.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger({ module: 'mfa' });

/**
 * Create and configure the MFA router
 * @param {Object} deps - Dependencies
 */
export default function createMFARouter(deps) {
  const router = Router();

  const {
    // Database
    userDb,
    auditDb,
    // Auth
    authenticate,
    comparePassword,
    generateToken,
    // MFA
    generateMFASecret,
    verifyTOTP,
    generateBackupCodes,
    formatBackupCode,
    // Helpers
    pendingMFAEnrollments,
    mfaSessions,
    safeJsonParseArray,
  } = deps;

  // ===== MFA Status =====

  router.get('/status', authenticate, async (req, res) => {
    try {
      const mfaStatus = await userDb.getMFAStatus(req.user.id);
      res.json({
        enabled: mfaStatus?.mfa_enabled === 1,
        hasBackupCodes: safeJsonParseArray(mfaStatus?.mfa_backup_codes).length > 0
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Get MFA status error');
      res.status(500).json({ error: 'Failed to get MFA status' });
    }
  });

  // ===== MFA Enrollment =====

  router.post('/enroll', authenticate, async (req, res) => {
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
      pendingMFAEnrollments.set(`enroll_${req.user.id}`, {
        secret,
        timestamp: Date.now()
      });

      res.json({
        qrCode,
        secret, // Send secret for manual entry if QR code fails
        message: 'Scan QR code with your authenticator app'
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'MFA enrollment error');
      res.status(500).json({ error: 'Failed to start MFA enrollment' });
    }
  });

  // ===== Verify MFA Enrollment =====

  router.post('/verify-enrollment', authenticate, requireFields('token'), async (req, res) => {
    try {
      const { token } = req.body;

      // Get pending enrollment
      const enrollKey = `enroll_${req.user.id}`;
      const enrollment = pendingMFAEnrollments.get(enrollKey);

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
      pendingMFAEnrollments.delete(enrollKey);

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
      logger.error({ err: error, userId: req.user?.id }, 'MFA verification error');
      res.status(500).json({ error: 'Failed to verify MFA enrollment' });
    }
  });

  // ===== Disable MFA =====

  router.post('/disable', authenticate, requireFields('password'), async (req, res) => {
    try {
      const { password } = req.body;

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
      logger.error({ err: error, userId: req.user?.id }, 'MFA disable error');
      res.status(500).json({ error: 'Failed to disable MFA' });
    }
  });

  // ===== Verify MFA Login =====

  router.post('/verify-login', requireFields('mfaSessionId', 'token'), async (req, res) => {
    try {
      const { mfaSessionId, token, useBackupCode } = req.body;

      // Get pending login
      const pendingLogin = mfaSessions.get(mfaSessionId);

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
      mfaSessions.delete(mfaSessionId);

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
      logger.error({ err: error }, 'MFA login verification error');
      res.status(500).json({ error: 'Failed to verify MFA' });
    }
  });

  return router;
}
