import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { assetDb, userDb, auditDb } from './database.js';

describe('Asset Authorization and Manager Sync', () => {
  let testDb;
  let employeeUser;
  let managerUser;
  let adminUser;
  let asset;

  beforeAll(async () => {
    // Initialize database
    await assetDb.init();

    // Create test users
    const employeeResult = await userDb.create({
      email: 'employee@test.com',
      password_hash: 'hash1',
      name: 'Test Employee',
      role: 'employee',
      first_name: 'Test',
      last_name: 'Employee',
      manager_name: 'Test Manager',
      manager_email: 'manager@test.com'
    });

    const managerResult = await userDb.create({
      email: 'manager@test.com',
      password_hash: 'hash2',
      name: 'Test Manager',
      role: 'manager',
      first_name: 'Test',
      last_name: 'Manager'
    });

    const adminResult = await userDb.create({
      email: 'admin@test.com',
      password_hash: 'hash3',
      name: 'Test Admin',
      role: 'admin',
      first_name: 'Test',
      last_name: 'Admin'
    });

    // Fetch created users
    employeeUser = await userDb.getByEmail('employee@test.com');
    managerUser = await userDb.getByEmail('manager@test.com');
    adminUser = await userDb.getByEmail('admin@test.com');

    // Create a test asset owned by the employee
    const assetResult = await assetDb.create({
      employee_first_name: 'Test',
      employee_last_name: 'Employee',
      employee_email: 'employee@test.com',
      manager_first_name: 'Test',
      manager_last_name: 'Manager',
      manager_email: 'manager@test.com',
      company_name: 'Test Company',
      laptop_serial_number: 'SN12345',
      laptop_asset_tag: 'TAG12345',
      status: 'active'
    });

    asset = await assetDb.getById(assetResult.id);
  });

  afterAll(async () => {
    // Clean up test data
    if (asset) await assetDb.delete(asset.id);
    if (employeeUser) await userDb.delete(employeeUser.id);
    if (managerUser) await userDb.delete(managerUser.id);
    if (adminUser) await userDb.delete(adminUser.id);
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

    it('should return managed assets for manager', async () => {
      const assets = await assetDb.getScopedForUser(managerUser);
      expect(assets.length).toBeGreaterThan(0);
      const foundAsset = assets.find(a => a.id === asset.id);
      expect(foundAsset).toBeDefined(); // Manager should see employee's asset
    });
  });

  describe('Manager Change Sync', () => {
    it('should update asset manager_id when employee manager changes', async () => {
      // Create a new manager
      await userDb.create({
        email: 'newmanager@test.com',
        password_hash: 'hash4',
        name: 'New Manager',
        role: 'manager',
        first_name: 'New',
        last_name: 'Manager'
      });

      const newManager = await userDb.getByEmail('newmanager@test.com');

      // Update employee's manager
      await assetDb.updateManagerForEmployee(
        employeeUser.email,
        'New Manager',
        'newmanager@test.com'
      );

      // Fetch the asset again
      const updatedAsset = await assetDb.getById(asset.id);

      // Check that manager_id was updated
      expect(updatedAsset.manager_id).toBe(newManager.id);
      expect(updatedAsset.manager_email).toBe('newmanager@test.com');

      // Clean up
      await userDb.delete(newManager.id);

      // Restore original manager
      await assetDb.updateManagerForEmployee(
        employeeUser.email,
        'Test Manager',
        'manager@test.com'
      );
    });

    it('should get manager name from user record via JOIN', async () => {
      // Update manager for employee
      await assetDb.updateManagerForEmployee(
        employeeUser.email,
        'John Doe Smith', // This parameter is now ignored
        'manager@test.com'
      );

      const updatedAsset = await assetDb.getById(asset.id);
      // Manager names should come from the user record via JOIN, not from denormalized fields
      expect(updatedAsset.manager_first_name).toBe('Test'); // From managerUser.first_name
      expect(updatedAsset.manager_last_name).toBe('Manager'); // From managerUser.last_name
      expect(updatedAsset.manager_email).toBe('manager@test.com');
    });
  });

  describe('Asset Update with IDs', () => {
    it('should update owner_id when employee email changes', async () => {
      // Create another employee
      await userDb.create({
        email: 'employee2@test.com',
        password_hash: 'hash5',
        name: 'Employee Two',
        role: 'employee',
        first_name: 'Employee',
        last_name: 'Two'
      });

      const employee2 = await userDb.getByEmail('employee2@test.com');

      // Update asset to assign to new employee
      await assetDb.update(asset.id, {
        ...asset,
        employee_email: 'employee2@test.com',
        employee_first_name: 'Employee',
        employee_last_name: 'Two'
      });

      const updatedAsset = await assetDb.getById(asset.id);
      expect(updatedAsset.owner_id).toBe(employee2.id);

      // Restore
      await assetDb.update(asset.id, {
        ...asset,
        employee_email: 'employee@test.com',
        employee_first_name: 'Test',
        employee_last_name: 'Employee'
      });

      // Clean up
      await userDb.delete(employee2.id);
    });
  });
});
