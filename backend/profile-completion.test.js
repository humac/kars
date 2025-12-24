import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { userDb, auditDb, assetDb, companyDb } from './database.js';
import { generateToken } from './auth.js';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { authenticate } from './auth.js';

// Setup minimal Express app for testing
const app = express();
app.use(cors());
app.use(express.json());

// Add complete-profile endpoint
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
        manager_first_name,
        manager_last_name,
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

describe('Profile Completion Flow', () => {
  beforeAll(async () => {
    // Initialize database
    await assetDb.init();
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      await userDb.delete(1);
      await userDb.delete(2);
    } catch (err) {
      // Ignore errors during cleanup
    }
  });

  test('should create OIDC user with profile_complete = false when no manager data', async () => {
    // Create OIDC user without manager data
    const result = await userDb.createFromOIDC({
      email: 'oidc.test@example.com',
      name: 'OIDC Test User',
      first_name: 'OIDC',
      last_name: 'Test',
      role: 'employee',
      oidcSub: 'oidc_sub_123'
      // No manager data
    });

    const user = await userDb.getById(result.id);
    expect(user.profile_complete).toBe(0);
    expect(user.manager_first_name).toBeNull();
    expect(user.manager_last_name).toBeNull();
    expect(user.manager_email).toBeNull();

    // Cleanup
    await userDb.delete(result.id);
  });

  test('should create OIDC user with profile_complete = true when manager data provided', async () => {
    // Create OIDC user with manager data
    const result = await userDb.createFromOIDC({
      email: 'oidc.complete@example.com',
      name: 'OIDC Complete User',
      first_name: 'OIDC',
      last_name: 'Complete',
      role: 'employee',
      oidcSub: 'oidc_sub_456',
      manager_first_name: 'Manager',
      manager_last_name: 'Name',
      manager_email: 'manager@example.com'
    });

    const user = await userDb.getById(result.id);
    expect(user.profile_complete).toBe(1);
    expect(user.manager_first_name).toBe('Manager');
    expect(user.manager_last_name).toBe('Name');
    expect(user.manager_email).toBe('manager@example.com');

    // Cleanup
    await userDb.delete(result.id);
  });

  test('should complete profile successfully with valid data', async () => {
    // Create OIDC user with incomplete profile
    const result = await userDb.createFromOIDC({
      email: 'incomplete@example.com',
      name: 'Incomplete User',
      first_name: 'Incomplete',
      last_name: 'User',
      role: 'employee',
      oidcSub: 'oidc_sub_789'
    });

    const user = await userDb.getById(result.id);
    expect(user.profile_complete).toBe(0);

    // Generate token
    const token = generateToken(user);

    // Complete profile via API
    const response = await request(app)
      .post('/api/auth/complete-profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        manager_first_name: 'New',
        manager_last_name: 'Manager',
        manager_email: 'newmanager@example.com'
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Profile completed successfully');
    expect(response.body.user.profile_complete).toBe(1);
    expect(response.body.user.manager_first_name).toBe('New');
    expect(response.body.user.manager_last_name).toBe('Manager');
    expect(response.body.user.manager_email).toBe('newmanager@example.com');

    // Verify in database
    const updatedUser = await userDb.getById(result.id);
    expect(updatedUser.profile_complete).toBe(1);
    expect(updatedUser.manager_first_name).toBe('New');
    expect(updatedUser.manager_last_name).toBe('Manager');
    expect(updatedUser.manager_email).toBe('newmanager@example.com');

    // Cleanup
    await userDb.delete(result.id);
  });

  test('should reject profile completion with missing fields', async () => {
    // Create OIDC user with incomplete profile
    const result = await userDb.createFromOIDC({
      email: 'test.incomplete@example.com',
      name: 'Test User',
      first_name: 'Test',
      last_name: 'User',
      role: 'employee',
      oidcSub: 'oidc_sub_999'
    });

    const user = await userDb.getById(result.id);
    const token = generateToken(user);

    // Try to complete profile with missing fields
    const response = await request(app)
      .post('/api/auth/complete-profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        manager_first_name: 'New'
        // Missing last name and email
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Manager first name, last name, and email are required');

    // Cleanup
    await userDb.delete(result.id);
  });

  test('should reject profile completion with invalid email', async () => {
    // Create OIDC user with incomplete profile
    const result = await userDb.createFromOIDC({
      email: 'invalid.test@example.com',
      name: 'Invalid Test User',
      first_name: 'Invalid',
      last_name: 'Test',
      role: 'employee',
      oidcSub: 'oidc_sub_888'
    });

    const user = await userDb.getById(result.id);
    const token = generateToken(user);

    // Try to complete profile with invalid email
    const response = await request(app)
      .post('/api/auth/complete-profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        manager_first_name: 'New',
        manager_last_name: 'Manager',
        manager_email: 'invalid-email'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Please provide a valid email address');

    // Cleanup
    await userDb.delete(result.id);
  });

  test('should create audit log when profile is completed', async () => {
    // Create OIDC user with incomplete profile
    const result = await userDb.createFromOIDC({
      email: 'audit.test@example.com',
      name: 'Audit Test User',
      first_name: 'Audit',
      last_name: 'Test',
      role: 'employee',
      oidcSub: 'oidc_sub_777'
    });

    const user = await userDb.getById(result.id);
    const token = generateToken(user);

    // Complete profile
    await request(app)
      .post('/api/auth/complete-profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        manager_first_name: 'Manager',
        manager_last_name: 'Boss',
        manager_email: 'manager@example.com'
      });

    // Check audit log
    const logs = await auditDb.getAll();
    const profileCompleteLog = logs.find(
      log => log.action === 'complete_profile' && log.entity_id === user.id
    );

    expect(profileCompleteLog).toBeDefined();
    expect(profileCompleteLog.entity_type).toBe('user');
    expect(profileCompleteLog.user_email).toBe('audit.test@example.com');

    // Cleanup
    await userDb.delete(result.id);
  });

  test('should sync manager info to preloaded assets when profile is completed', async () => {
    // Create unique identifiers for this test
    const timestamp = Date.now();
    const uniqueEmail = `preload.user.${timestamp}@example.com`;
    const uniqueName = `Test Company for Assets ${timestamp}`;
    const uniqueTag = `TEST-PRELOAD-${timestamp}`;
    const uniqueOidcSub = `oidc_sub_preload_${timestamp}`;

    // Create test company with unique name
    const companyResult = await companyDb.create({
      name: uniqueName,
      description: 'Test company for profile completion asset sync'
    });
    const company = await companyDb.getById(companyResult.id);

    // Step 1: Create a preloaded asset for a user who hasn't registered yet
    const assetResult = await assetDb.create({
      employee_first_name: 'Preload',
      employee_last_name: 'User',
      employee_email: uniqueEmail,
      manager_first_name: '',
      manager_last_name: '',
      manager_email: '',
      asset_tag: uniqueTag,
      asset_type: 'Laptop',
      make: 'Test',
      model: 'Preload Test',
      serial_number: `PRELOAD-${timestamp}`,
      company_id: company.id
    });

    // Verify asset has no manager info
    let asset = await assetDb.getById(assetResult.id);
    expect(asset.manager_first_name).toBeFalsy();
    expect(asset.manager_last_name).toBeFalsy();
    expect(asset.manager_email).toBeFalsy();

    // Step 2: User registers via OIDC without manager info (incomplete profile)
    const userResult = await userDb.createFromOIDC({
      email: uniqueEmail,
      name: 'Preload User',
      first_name: 'Preload',
      last_name: 'User',
      role: 'employee',
      oidcSub: uniqueOidcSub
    });

    const user = await userDb.getById(userResult.id);
    expect(user.profile_complete).toBe(0);

    // Generate token
    const token = generateToken(user);

    // Step 3: Complete profile with manager information
    const response = await request(app)
      .post('/api/auth/complete-profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        manager_first_name: 'New',
        manager_last_name: 'Manager',
        manager_email: 'newmanager@example.com'
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Profile completed successfully');

    // Step 4: Verify the preloaded asset now has manager information
    asset = await assetDb.getById(assetResult.id);
    expect(asset.manager_first_name).toBe('New');
    expect(asset.manager_last_name).toBe('Manager');
    expect(asset.manager_email).toBe('newmanager@example.com');

    // Step 5: Verify audit log contains asset sync entry
    const logs = await auditDb.getAll();
    const assetSyncLog = logs.find(
      log => log.action === 'update' &&
        log.entity_type === 'asset' &&
        log.entity_name &&
        log.entity_name.includes(`Manager synced for ${uniqueEmail}`)
    );

    expect(assetSyncLog).toBeDefined();
    expect(assetSyncLog.user_email).toBe(uniqueEmail);

    // Cleanup
    await assetDb.delete(assetResult.id);
    await userDb.delete(userResult.id);
    await companyDb.delete(company.id);
  });
});
