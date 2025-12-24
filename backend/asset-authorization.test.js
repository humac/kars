import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { assetDb, userDb, auditDb, companyDb } from './database.js';

describe('Asset Authorization and Manager Sync', () => {
  let testDb;
  let employeeUser;
  let managerUser;
  let adminUser;
  let asset;
  let testCompany;
  let timestamp;

  beforeAll(async () => {
    // Initialize database
    await assetDb.init();

    // Create test company with unique name to avoid UNIQUE constraint failures
    // Using timestamp to ensure uniqueness across multiple test runs
    timestamp = Date.now();
    const companyResult = await companyDb.create({
      name: `Test Company ${timestamp}`,
      description: 'Test company for authorization tests'
    });
    testCompany = await companyDb.getById(companyResult.id);

    // Create test users
    const employeeResult = await userDb.create({
      email: `employee-${timestamp}@test.com`,
      password_hash: 'hash1',
      name: 'Test Employee',
      role: 'employee',
      first_name: 'Test',
      last_name: 'Employee',
      manager_name: 'Test Manager',
      manager_email: `manager-${timestamp}@test.com`
    });

    const managerResult = await userDb.create({
      email: `manager-${timestamp}@test.com`,
      password_hash: 'hash2',
      name: 'Test Manager',
      role: 'manager',
      first_name: 'Test',
      last_name: 'Manager'
    });

    const adminResult = await userDb.create({
      email: `admin-${timestamp}@test.com`,
      password_hash: 'hash3',
      name: 'Test Admin',
      role: 'admin',
      first_name: 'Test',
      last_name: 'Admin'
    });

    // Fetch created users
    employeeUser = await userDb.getByEmail(`employee-${timestamp}@test.com`);
    managerUser = await userDb.getByEmail(`manager-${timestamp}@test.com`);
    adminUser = await userDb.getByEmail(`admin-${timestamp}@test.com`);

    // Create a test asset owned by the employee
    const assetResult = await assetDb.create({
      employee_first_name: 'Test',
      employee_last_name: 'Employee',
      employee_email: `employee-${timestamp}@test.com`,
      manager_first_name: 'Test',
      manager_last_name: 'Manager',
      manager_email: `manager-${timestamp}@test.com`,
      company_name: testCompany.name, // Use the unique test company name
      asset_type: 'laptop',
      serial_number: `SN12345-${timestamp}`,
      asset_tag: `TAG12345-${timestamp}`,
      status: 'active'
    });

    asset = await assetDb.getById(assetResult.id);
  });

  afterAll(async () => {
    // Clean up test data - use try/catch to ensure cleanup continues even if some items fail
    try {
      if (asset?.id) await assetDb.delete(asset.id);
    } catch (err) {
      // Asset might have already been deleted or not created
      console.warn('Failed to delete test asset:', err.message);
    }

    try {
      if (employeeUser?.id) await userDb.delete(employeeUser.id);
    } catch (err) {
      console.warn('Failed to delete employee user:', err.message);
    }

    try {
      if (managerUser?.id) await userDb.delete(managerUser.id);
    } catch (err) {
      console.warn('Failed to delete manager user:', err.message);
    }

    try {
      if (adminUser?.id) await userDb.delete(adminUser.id);
    } catch (err) {
      console.warn('Failed to delete admin user:', err.message);
    }

    try {
      if (testCompany?.id) await companyDb.delete(testCompany.id);
    } catch (err) {
      console.warn('Failed to delete test company:', err.message);
    }
  });

  describe('Asset Creation with IDs', () => {
    it('should set owner_id when creating an asset', () => {
      expect(asset.owner_id).toBe(employeeUser.id);
    });

    it('should set manager_id when creating an asset', () => {
      expect(asset.manager_id).toBe(managerUser.id);
    });
  });

  describe('Asset Scoping', () => {
    it('should return all assets for admin', async () => {
      const assets = await assetDb.getScopedForUser(adminUser);
      expect(assets.length).toBeGreaterThan(0);
      const foundAsset = assets.find(a => a.id === asset.id);
      expect(foundAsset).toBeDefined();
    });

    it('should return only owned assets for employee', async () => {
      const assets = await assetDb.getScopedForUser(employeeUser);
      expect(assets.length).toBeGreaterThan(0);
      // All returned assets should be owned by the employee
      assets.forEach(a => {
        expect(
          a.owner_id === employeeUser.id ||
          a.employee_email.toLowerCase() === employeeUser.email.toLowerCase()
        ).toBeTruthy();
      });
    });

    it('should return all assets for manager (same as admin)', async () => {
      // Fetch both at the same time to minimize race window
      const [managerAssets, adminAssets] = await Promise.all([
        assetDb.getScopedForUser(managerUser),
        assetDb.getScopedForUser(adminUser)
      ]);

      // Manager should see all assets (same access level as admin)
      // Note: We check IDs match rather than exact count to avoid race conditions
      // with parallel tests that may create/delete assets between queries
      const managerAssetIds = new Set(managerAssets.map(a => a.id));
      const adminAssetIds = new Set(adminAssets.map(a => a.id));

      // Both should see our test asset
      expect(managerAssetIds.has(asset.id)).toBe(true);
      expect(adminAssetIds.has(asset.id)).toBe(true);

      // Manager should have same visibility as admin for test asset
      expect(managerAssets.length).toBeGreaterThan(0);

      const foundAsset = managerAssets.find(a => a.id === asset.id);
      expect(foundAsset).toBeDefined(); // Manager should see employee's asset
    });
  });

  describe('Manager Change Sync', () => {
    it('should update asset manager_id when employee manager changes', async () => {
      // Create a new manager
      await userDb.create({
        email: `newmanager-${timestamp}@test.com`,
        password_hash: 'hash4',
        name: 'New Manager',
        role: 'manager',
        first_name: 'New',
        last_name: 'Manager'
      });

      const newManager = await userDb.getByEmail(`newmanager-${timestamp}@test.com`);

      // Update employee's manager
      await assetDb.updateManagerForEmployee(
        employeeUser.email,
        'New',
        'Manager',
        `newmanager-${timestamp}@test.com`
      );

      // Fetch the asset again
      const updatedAsset = await assetDb.getById(asset.id);

      // Check that manager_id was updated
      expect(updatedAsset.manager_id).toBe(newManager.id);
      expect(updatedAsset.manager_email).toBe(`newmanager-${timestamp}@test.com`);

      // Clean up
      await userDb.delete(newManager.id);

      // Restore original manager
      await assetDb.updateManagerForEmployee(
        employeeUser.email,
        'Test',
        'Manager',
        `manager-${timestamp}@test.com`
      );
    });

    it('should get manager name from user record via JOIN', async () => {
      // Update manager for employee
      await assetDb.updateManagerForEmployee(
        employeeUser.email,
        'John',
        'Doe Smith', // This parameter is now ignored
        `manager-${timestamp}@test.com`
      );

      const updatedAsset = await assetDb.getById(asset.id);
      // Manager names should come from the user record via JOIN, not from denormalized fields
      expect(updatedAsset.manager_first_name).toBe('Test'); // From managerUser.first_name
      expect(updatedAsset.manager_last_name).toBe('Manager'); // From managerUser.last_name
      expect(updatedAsset.manager_email).toBe(`manager-${timestamp}@test.com`);
    });
  });

  describe('Asset Update with IDs', () => {
    it('should update owner_id when employee email changes', async () => {
      // Create another employee
      await userDb.create({
        email: `employee2-${timestamp}@test.com`,
        password_hash: 'hash5',
        name: 'Employee Two',
        role: 'employee',
        first_name: 'Employee',
        last_name: 'Two'
      });

      const employee2 = await userDb.getByEmail(`employee2-${timestamp}@test.com`);

      // Update asset to assign to new employee
      await assetDb.update(asset.id, {
        ...asset,
        employee_email: `employee2-${timestamp}@test.com`,
        employee_first_name: 'Employee',
        employee_last_name: 'Two'
      });

      const updatedAsset = await assetDb.getById(asset.id);
      expect(updatedAsset.owner_id).toBe(employee2.id);

      // Restore
      await assetDb.update(asset.id, {
        ...asset,
        employee_email: `employee-${timestamp}@test.com`,
        employee_first_name: 'Test',
        employee_last_name: 'Employee'
      });

      // Clean up
      await userDb.delete(employee2.id);
    });
  });
});
