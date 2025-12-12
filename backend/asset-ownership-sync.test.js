import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { assetDb, userDb, syncAssetOwnership, companyDb } from './database.js';

describe('Asset Ownership Sync', () => {
  let employeeUser;
  let managerUser;
  let preloadedAsset;
  let testCompany;

  beforeAll(async () => {
    // Initialize database
    await assetDb.init();

    // Create test company (required for assets with company_id FK)
    const companyResult = await companyDb.create({
      name: `Test Company ${Date.now()}`,
      description: 'Test company for ownership sync tests'
    });
    testCompany = await companyDb.getById(companyResult.id);
  });

  beforeEach(async () => {
    // Clean up any previous test data
    const allUsers = await userDb.getAll();
    for (const user of allUsers) {
      if (user.email.includes('sync-test')) {
        await userDb.delete(user.id);
      }
    }

    const allAssets = await assetDb.getAll();
    for (const asset of allAssets) {
      if (asset.employee_email && asset.employee_email.includes('sync-test')) {
        await assetDb.delete(asset.id);
      }
    }
  });

  afterAll(async () => {
    // Final cleanup
    if (preloadedAsset) {
      try {
        await assetDb.delete(preloadedAsset.id);
      } catch (err) {
        // Ignore errors
      }
    }
    if (employeeUser) {
      try {
        await userDb.delete(employeeUser.id);
      } catch (err) {
        // Ignore errors
      }
    }
    if (managerUser) {
      try {
        await userDb.delete(managerUser.id);
      } catch (err) {
        // Ignore errors
      }
    }
    if (testCompany) {
      try {
        await companyDb.delete(testCompany.id);
      } catch (err) {
        // Ignore errors
      }
    }
  });

  describe('syncAssetOwnership', () => {
    it('should backfill owner_id when user registers after asset is created', async () => {
      // Step 1: Create asset with only email (simulating pre-loaded asset)
      const assetResult = await assetDb.create({
        employee_first_name: 'Test',
        employee_last_name: 'Employee',
        employee_email: 'employee-sync-test@test.com',
        manager_first_name: 'Test',
        manager_last_name: 'Manager',
        manager_email: 'manager-sync-test@test.com',
        company_name: testCompany.name,
        asset_type: 'laptop',
        serial_number: 'SN-SYNC-001',
        asset_tag: 'TAG-SYNC-001',
        status: 'active'
      });

      preloadedAsset = await assetDb.getById(assetResult.id);
      
      // Verify owner_id is NULL (or undefined in the asset, depending on DB)
      expect(preloadedAsset.owner_id).toBeFalsy();

      // Step 2: User registers
      const userResult = await userDb.create({
        email: 'employee-sync-test@test.com',
        password_hash: 'hash1',
        name: 'Test Employee',
        role: 'employee',
        first_name: 'Test',
        last_name: 'Employee',
        manager_first_name: 'Test',
        manager_last_name: 'Manager',
        manager_email: 'manager-sync-test@test.com'
      });

      employeeUser = await userDb.getByEmail('employee-sync-test@test.com');

      // Step 3: Call syncAssetOwnership
      const syncResult = await syncAssetOwnership(employeeUser.email);

      // Verify sync happened
      expect(syncResult.ownerUpdates).toBe(1);

      // Step 4: Fetch asset again and verify owner_id is set
      const updatedAsset = await assetDb.getById(preloadedAsset.id);
      expect(updatedAsset.owner_id).toBe(employeeUser.id);
    });

    it('should backfill manager_id when manager registers after asset is created', async () => {
      // Step 1: Create asset with manager email but no manager_id
      const assetResult = await assetDb.create({
        employee_first_name: 'Test',
        employee_last_name: 'Employee',
        employee_email: 'emp-mgr-sync@test.com',
        manager_first_name: 'Test',
        manager_last_name: 'Manager',
        manager_email: 'manager-sync-test2@test.com',
        company_name: testCompany.name,
        asset_type: 'laptop',
        serial_number: 'SN-SYNC-002',
        asset_tag: 'TAG-SYNC-002',
        status: 'active'
      });

      const asset = await assetDb.getById(assetResult.id);
      
      // Verify manager_id is NULL
      expect(asset.manager_id).toBeFalsy();

      // Step 2: Manager registers
      const managerResult = await userDb.create({
        email: 'manager-sync-test2@test.com',
        password_hash: 'hash2',
        name: 'Test Manager',
        role: 'manager',
        first_name: 'Test',
        last_name: 'Manager'
      });

      managerUser = await userDb.getByEmail('manager-sync-test2@test.com');

      // Step 3: Call syncAssetOwnership
      const syncResult = await syncAssetOwnership(managerUser.email);

      // Verify sync happened
      expect(syncResult.managerUpdates).toBe(1);

      // Step 4: Fetch asset again and verify manager_id is set
      const updatedAsset = await assetDb.getById(asset.id);
      expect(updatedAsset.manager_id).toBe(managerUser.id);

      // Cleanup
      await assetDb.delete(asset.id);
    });

    it('should handle non-existent email gracefully', async () => {
      const syncResult = await syncAssetOwnership('nonexistent@test.com');
      
      expect(syncResult.ownerUpdates).toBe(0);
      expect(syncResult.managerUpdates).toBe(0);
    });

    it('should not update assets that already have owner_id set', async () => {
      // Step 1: Create user first
      const userResult = await userDb.create({
        email: 'user-with-assets@test.com',
        password_hash: 'hash3',
        name: 'User With Assets',
        role: 'employee',
        first_name: 'User',
        last_name: 'Assets',
        manager_first_name: 'Some',
        manager_last_name: 'Manager',
        manager_email: 'some@manager.com'
      });

      const user = await userDb.getByEmail('user-with-assets@test.com');

      // Step 2: Create asset with owner_id already set
      const assetResult = await assetDb.create({
        employee_first_name: 'User',
        employee_last_name: 'Assets',
        employee_email: 'user-with-assets@test.com',
        manager_first_name: 'Some',
        manager_last_name: 'Manager',
        manager_email: 'some@manager.com',
        company_name: testCompany.name,
        asset_type: 'laptop',
        serial_number: 'SN-SYNC-003',
        asset_tag: 'TAG-SYNC-003',
        status: 'active'
      });

      const asset = await assetDb.getById(assetResult.id);
      
      // Verify owner_id is already set
      expect(asset.owner_id).toBe(user.id);

      // Step 3: Call syncAssetOwnership
      const syncResult = await syncAssetOwnership(user.email);

      // Should not update anything since owner_id is already set
      expect(syncResult.ownerUpdates).toBe(0);

      // Cleanup
      await assetDb.delete(asset.id);
      await userDb.delete(user.id);
    });
  });

  describe('getScopedForUser with email fallback', () => {
    it('should return assets for employee based on email even when owner_id is NULL', async () => {
      // Create asset with only email, no owner_id
      const assetResult = await assetDb.create({
        employee_first_name: 'Email',
        employee_last_name: 'Only',
        employee_email: 'email-only-test@test.com',
        manager_first_name: 'Test',
        manager_last_name: 'Manager',
        manager_email: 'test-manager@test.com',
        company_name: testCompany.name,
        asset_type: 'laptop',
        serial_number: 'SN-EMAIL-001',
        asset_tag: 'TAG-EMAIL-001',
        status: 'active'
      });

      // Create user
      const userResult = await userDb.create({
        email: 'email-only-test@test.com',
        password_hash: 'hash4',
        name: 'Email Only',
        role: 'employee',
        first_name: 'Email',
        last_name: 'Only',
        manager_first_name: 'Test',
        manager_last_name: 'Manager',
        manager_email: 'test-manager@test.com'
      });

      const user = await userDb.getByEmail('email-only-test@test.com');

      // Get scoped assets
      const assets = await assetDb.getScopedForUser(user);

      // Should find the asset via email fallback
      const foundAsset = assets.find(a => a.id === assetResult.id);
      expect(foundAsset).toBeTruthy();
      expect(foundAsset.employee_email).toBe('email-only-test@test.com');

      // Cleanup
      await assetDb.delete(assetResult.id);
      await userDb.delete(user.id);
    });

    it('should return assets for manager based on email even when manager_id is NULL', async () => {
      // Create manager user
      const managerResult = await userDb.create({
        email: 'mgr-email-test@test.com',
        password_hash: 'hash5',
        name: 'Manager Email',
        role: 'manager',
        first_name: 'Manager',
        last_name: 'Email'
      });

      const manager = await userDb.getByEmail('mgr-email-test@test.com');

      // Create asset with manager email but no manager_id
      const assetResult = await assetDb.create({
        employee_first_name: 'Some',
        employee_last_name: 'Employee',
        employee_email: 'some-employee@test.com',
        manager_first_name: 'Manager',
        manager_last_name: 'Email',
        manager_email: 'mgr-email-test@test.com',
        company_name: testCompany.name,
        asset_type: 'laptop',
        serial_number: 'SN-MGR-001',
        asset_tag: 'TAG-MGR-001',
        status: 'active'
      });

      // Get scoped assets for manager
      const assets = await assetDb.getScopedForUser(manager);

      // Should find the asset via email fallback
      const foundAsset = assets.find(a => a.id === assetResult.id);
      expect(foundAsset).toBeTruthy();
      expect(foundAsset.manager_email).toBe('mgr-email-test@test.com');

      // Cleanup
      await assetDb.delete(assetResult.id);
      await userDb.delete(manager.id);
    });
  });

  describe('updateManagerForEmployee with owner_id check', () => {
    it('should update assets by both email and owner_id', async () => {
      // Create employee user
      const userResult = await userDb.create({
        email: 'emp-update-test@test.com',
        password_hash: 'hash6',
        name: 'Employee Update',
        role: 'employee',
        first_name: 'Employee',
        last_name: 'Update',
        manager_first_name: 'Old',
        manager_last_name: 'Manager',
        manager_email: 'old-manager@test.com'
      });

      const employee = await userDb.getByEmail('emp-update-test@test.com');

      // Create asset with owner_id set
      const assetResult = await assetDb.create({
        employee_first_name: 'Employee',
        employee_last_name: 'Update',
        employee_email: 'emp-update-test@test.com',
        manager_first_name: 'Old',
        manager_last_name: 'Manager',
        manager_email: 'old-manager@test.com',
        company_name: testCompany.name,
        asset_type: 'laptop',
        serial_number: 'SN-UPDATE-001',
        asset_tag: 'TAG-UPDATE-001',
        status: 'active'
      });

      const asset = await assetDb.getById(assetResult.id);
      expect(asset.owner_id).toBe(employee.id);

      // Update manager for employee
      await assetDb.updateManagerForEmployee(
        'emp-update-test@test.com',
        'New Manager',
        'new-manager@test.com'
      );

      // Verify asset was updated
      const updatedAsset = await assetDb.getById(assetResult.id);
      expect(updatedAsset.manager_first_name).toBe('New');
      expect(updatedAsset.manager_last_name).toBe('Manager');
      expect(updatedAsset.manager_email).toBe('new-manager@test.com');

      // Cleanup
      await assetDb.delete(assetResult.id);
      await userDb.delete(employee.id);
    });
  });
});
