/**
 * Authentication Routes
 * Handles: registration, login, password reset, profile, MFA, passkeys, users, OIDC
 */

import { Router } from 'express';
import { requireFields, validateEmail } from '../middleware/validation.js';

/**
 * Create and configure the auth router
 * @param {Object} deps - Dependencies
 */
export default function createAuthRouter(deps) {
  const router = Router();

  const {
    // Database
    userDb,
    auditDb,
    passwordResetTokenDb,
    // Auth
    authenticate,
    hashPassword,
    comparePassword,
    generateToken,
    // Rate limiters
    authRateLimiter,
    passwordResetRateLimiter,
    // Helpers
    syncAssetOwnership,
    mfaSessions,
    // Email
    sendPasswordResetEmail,
  } = deps;

  // ===== Registration =====

  router.post('/register', authRateLimiter, async (req, res) => {
    try {
      let { email, password, name, first_name, last_name, manager_first_name, manager_last_name, manager_name, manager_email } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      if (!name && (!first_name || !last_name)) {
        return res.status(400).json({ error: 'Either name or both first_name and last_name are required' });
      }

      // Support both split fields and combined field for backward compatibility
      if (manager_first_name && manager_last_name) {
        // Split fields provided - use them
      } else if (manager_name) {
        const nameParts = manager_name.trim().split(/\s+/);
        manager_first_name = nameParts[0] || '';
        manager_last_name = nameParts.slice(1).join(' ') || '';
      } else {
        return res.status(400).json({ error: 'Manager first name and last name are required' });
      }

      if (!manager_email) {
        return res.status(400).json({ error: 'Manager email is required' });
      }

      // Check if user already exists
      const existingUser = await userDb.getByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }

      // Hash password
      const password_hash = await hashPassword(password);

      // Determine user role
      const allUsers = await userDb.getAll();
      const isFirstUser = allUsers.length === 0;
      const isAdminEmail = process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();

      let userRole = 'employee';
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

      // Check if this user is a manager for existing assets and should be auto-assigned manager role
      const autoAssignManagerRoleIfNeeded = deps.autoAssignManagerRoleIfNeeded;
      if (autoAssignManagerRoleIfNeeded) {
        await autoAssignManagerRoleIfNeeded(newUser.email);
      }

      // Generate JWT token
      const token = generateToken({
        id: newUser.id,
        email: newUser.email,
        role: newUser.role
      });

      // Log audit
      await auditDb.log(
        'REGISTER',
        'user',
        newUser.id,
        newUser.email,
        { role: newUser.role, manager_email },
        newUser.email
      );

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          role: newUser.role,
          manager_first_name: newUser.manager_first_name,
          manager_last_name: newUser.manager_last_name,
          manager_email: newUser.manager_email
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // ===== Login =====

  router.post('/login', authRateLimiter, requireFields('email', 'password'), async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await userDb.getByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValid = await comparePassword(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if MFA is enabled
      if (user.mfa_enabled) {
        // Generate a temporary session for MFA verification
        const crypto = await import('crypto');
        const mfaSessionId = crypto.randomBytes(32).toString('hex');

        mfaSessions.set(mfaSessionId, {
          userId: user.id,
          email: user.email,
          role: user.role,
          createdAt: Date.now()
        });

        // Clean up old sessions (older than 5 minutes)
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        for (const [key, session] of mfaSessions.entries()) {
          if (session.createdAt < fiveMinutesAgo) {
            mfaSessions.delete(key);
          }
        }

        return res.json({
          requiresMFA: true,
          mfaSessionId,
          message: 'Please provide your 2FA code'
        });
      }

      // No MFA - generate token directly
      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      await auditDb.log('LOGIN', 'user', user.id, user.email, { method: 'password' }, user.email);

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          manager_first_name: user.manager_first_name,
          manager_last_name: user.manager_last_name,
          manager_email: user.manager_email,
          profile_complete: Boolean(user.first_name && user.last_name && user.manager_email)
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // ===== Password Reset =====

  router.post('/forgot-password', passwordResetRateLimiter, requireFields('email'), async (req, res) => {
    try {
      const { email } = req.body;

      const user = await userDb.getByEmail(email);

      // Always return success to prevent email enumeration
      if (!user) {
        console.log(`Password reset requested for non-existent email: ${email}`);
        return res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
      }

      // Generate reset token
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store token in database
      await passwordResetTokenDb.create({
        user_id: user.id,
        token,
        expires_at: expiresAt.toISOString()
      });

      // Send email
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const resetLink = `${frontendUrl}/reset-password?token=${token}`;

      try {
        await sendPasswordResetEmail(user.email, user.first_name || user.name || 'User', resetLink);
        console.log(`Password reset email sent to ${email}`);
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        // Don't fail the request if email fails - user can request again
      }

      await auditDb.log(
        'PASSWORD_RESET_REQUEST',
        'user',
        user.id,
        user.email,
        { requested_at: new Date().toISOString() },
        user.email
      );

      res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Failed to process password reset request' });
    }
  });

  router.get('/verify-reset-token/:token', async (req, res) => {
    try {
      const { token } = req.params;

      const resetToken = await passwordResetTokenDb.getByToken(token);

      if (!resetToken) {
        return res.status(400).json({ valid: false, error: 'Invalid or expired reset token' });
      }

      // Check if token is expired
      const expiresAt = new Date(resetToken.expires_at);
      if (expiresAt < new Date()) {
        await passwordResetTokenDb.delete(resetToken.id);
        return res.status(400).json({ valid: false, error: 'Reset token has expired' });
      }

      // Check if token has been used
      if (resetToken.used_at) {
        return res.status(400).json({ valid: false, error: 'Reset token has already been used' });
      }

      res.json({ valid: true });
    } catch (error) {
      console.error('Verify reset token error:', error);
      res.status(500).json({ valid: false, error: 'Failed to verify reset token' });
    }
  });

  router.post('/reset-password', requireFields('token', 'password'), async (req, res) => {
    try {
      const { token, password } = req.body;

      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }

      const resetToken = await passwordResetTokenDb.getByToken(token);

      if (!resetToken) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      // Check if token is expired
      const expiresAt = new Date(resetToken.expires_at);
      if (expiresAt < new Date()) {
        await passwordResetTokenDb.delete(resetToken.id);
        return res.status(400).json({ error: 'Reset token has expired' });
      }

      // Check if token has been used
      if (resetToken.used_at) {
        return res.status(400).json({ error: 'Reset token has already been used' });
      }

      // Hash new password
      const password_hash = await hashPassword(password);

      // Update user's password
      await userDb.updatePassword(resetToken.user_id, password_hash);

      // Mark token as used
      await passwordResetTokenDb.markUsed(resetToken.id);

      // Get user for audit log
      const user = await userDb.getById(resetToken.user_id);

      await auditDb.log(
        'PASSWORD_RESET',
        'user',
        user.id,
        user.email,
        { reset_at: new Date().toISOString() },
        user.email
      );

      res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  // ===== Profile =====

  router.get('/me', authenticate, async (req, res) => {
    try {
      const user = await userDb.getById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        manager_first_name: user.manager_first_name,
        manager_last_name: user.manager_last_name,
        manager_email: user.manager_email,
        mfa_enabled: user.mfa_enabled,
        profile_complete: Boolean(user.first_name && user.last_name && user.manager_email)
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  });

  router.put('/profile', authenticate, requireFields('first_name', 'last_name'), async (req, res) => {
    try {
      const { first_name, last_name, manager_first_name, manager_last_name, manager_email } = req.body;

      const user = await userDb.getById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Build update object
      const updates = {
        first_name,
        last_name,
        name: `${first_name} ${last_name}`
      };

      // Manager fields are optional for profile updates
      if (manager_first_name !== undefined) updates.manager_first_name = manager_first_name;
      if (manager_last_name !== undefined) updates.manager_last_name = manager_last_name;
      if (manager_email !== undefined) updates.manager_email = manager_email;

      await userDb.update(user.id, updates);

      // If manager changed, sync assets
      if (manager_email && manager_email !== user.manager_email) {
        await syncAssetOwnership(user.email);
      }

      const updatedUser = await userDb.getById(user.id);

      await auditDb.log(
        'UPDATE_PROFILE',
        'user',
        user.id,
        user.email,
        { updated_fields: Object.keys(updates) },
        user.email
      );

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          first_name: updatedUser.first_name,
          last_name: updatedUser.last_name,
          role: updatedUser.role,
          manager_first_name: updatedUser.manager_first_name,
          manager_last_name: updatedUser.manager_last_name,
          manager_email: updatedUser.manager_email,
          profile_complete: Boolean(updatedUser.first_name && updatedUser.last_name && updatedUser.manager_email)
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  // ===== Complete Profile (for OIDC users) =====

  router.post('/complete-profile', authenticate, requireFields('manager_first_name', 'manager_last_name', 'manager_email'), validateEmail('manager_email'), async (req, res) => {
    try {
      const { manager_first_name, manager_last_name, manager_email } = req.body;

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
        const assetDb = deps.assetDb;
        if (assetDb) {
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
        }
      } catch (syncError) {
        console.error('Error syncing manager info to assets during profile completion:', syncError);
        // Don't fail profile completion if asset sync fails
      }

      // Auto-assign manager role if manager exists
      const autoAssignManagerRole = deps.autoAssignManagerRole;
      if (autoAssignManagerRole) {
        try {
          await autoAssignManagerRole(manager_email, updatedUser.email);
        } catch (roleError) {
          console.error('Error auto-assigning manager role during profile completion:', roleError);
          // Don't fail profile completion if role assignment fails
        }
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

  // ===== Change Password =====

  router.put('/change-password', authenticate, requireFields('currentPassword', 'newPassword', 'confirmPassword'), async (req, res) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;

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

  return router;
}
