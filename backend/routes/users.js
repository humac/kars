/**
 * User Management Routes
 * Handles: user listing, updates, role changes, and deletion (admin only)
 */

import { Router } from 'express';
import { requireFields, validateRole } from '../middleware/validation.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger({ module: 'users' });

/**
 * Create and configure the users router
 * @param {Object} deps - Dependencies
 */
export default function createUsersRouter(deps) {
  const router = Router();

  const {
    // Database
    userDb,
    assetDb,
    auditDb,
    // Auth
    authenticate,
    authorize,
  } = deps;

  // ===== Get All Users =====

  router.get('/', authenticate, authorize('admin', 'attestation_coordinator', 'manager'), async (req, res) => {
    try {
      const users = await userDb.getAll();
      res.json(users);
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Get users error');
      res.status(500).json({ error: 'Failed to get users' });
    }
  });

  // ===== Update User Details (Admin Only) =====

  router.put('/:id', authenticate, authorize('admin'), requireFields('first_name', 'last_name', 'manager_first_name', 'manager_last_name', 'manager_email'), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { first_name, last_name, manager_first_name, manager_last_name, manager_email, profile_image } = req.body;

      const targetUser = await userDb.getById(userId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
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
          await assetDb.updateManagerForEmployee(
            updatedUser.email,
            manager_first_name,
            manager_last_name,
            manager_email
          );
        } catch (error) {
          logger.error({ err: error, userEmail: updatedUser.email }, 'Failed to update manager on assets');
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
      logger.error({ err: error, userId: req.user?.id, targetUserId: req.params.id }, 'Admin update user error');
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // ===== Update User Role (Admin Only) =====

  router.put('/:id/role', authenticate, authorize('admin'), requireFields('role'), validateRole(), async (req, res) => {
    try {
      const { role } = req.body;
      const userId = parseInt(req.params.id);

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
      logger.error({ err: error, userId: req.user?.id, targetUserId: req.params.id }, 'Update user role error');
      res.status(500).json({ error: 'Failed to update user role' });
    }
  });

  // ===== Delete User (Admin Only) =====

  router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
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
      logger.error({ err: error, userId: req.user?.id, targetUserId: req.params.id }, 'Delete user error');
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  return router;
}
