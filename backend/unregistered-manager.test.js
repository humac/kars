import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { assetDb, userDb } from './database.js';

describe('Unregistered Manager Name Display', () => {
  let testAssetId;
  let employeeUser;
  let registeredManagerUser;

  beforeAll(async () => {
    // Initialize database
    await assetDb.init();

    // Create an employee user
    const employeeResult = await userDb.create({
      email: 'employee-unregistered-test@test.com',
      password_hash: 'hash1',
      name: 'Test Employee',
      role: 'employee',
      first_name: 'Test',
      last_name: 'Employee'
    });

    employeeUser = await userDb.getByEmail('employee-unregistered-test@test.com');
  });

  afterAll(async () => {
    // Clean up test data
    if (testAssetId) await assetDb.delete(testAssetId);
    if (employeeUser) await userDb.delete(employeeUser.id);
    if (registeredManagerUser) await userDb.delete(registeredManagerUser.id);
  });

  describe('Asset Creation with Unregistered Manager', () => {
    it('should store and display manager name when manager is not registered', async () => {
      // Create an asset with an unregistered manager
      const assetResult = await assetDb.create({
        employee_first_name: 'Test',
        employee_last_name: 'Employee',
        employee_email: 'employee-unregistered-test@test.com',
        manager_first_name: 'Jane',
        manager_last_name: 'Doe',
        manager_email: 'jane.doe.unregistered@test.com',
        company_name: 'Test Company',
        laptop_serial_number: 'UNREG-SN-001',
        laptop_asset_tag: 'UNREG-TAG-001',
        status: 'active'
      });

      testAssetId = assetResult.id;

      // Fetch the asset
      const asset = await assetDb.getById(testAssetId);

      // Manager name should be displayed from denormalized fields
      expect(asset.manager_first_name).toBe('Jane');
      expect(asset.manager_last_name).toBe('Doe');
      expect(asset.manager_email).toBe('jane.doe.unregistered@test.com');
      expect(asset.manager_id).toBeNull();
    });

    it('should override with user record when manager registers', async () => {
      // Register the manager as a user
      await userDb.create({
        email: 'jane.doe.unregistered@test.com',
        password_hash: 'hash2',
        name: 'Jane Marie Doe',
        role: 'manager',
        first_name: 'Jane Marie',
        last_name: 'Doe Updated'
      });

      registeredManagerUser = await userDb.getByEmail('jane.doe.unregistered@test.com');

      // Update the asset to link to the registered manager
      await assetDb.update(testAssetId, {
        employee_first_name: 'Test',
        employee_last_name: 'Employee',
        employee_email: 'employee-unregistered-test@test.com',
        manager_first_name: 'Jane',
        manager_last_name: 'Doe',
        manager_email: 'jane.doe.unregistered@test.com',
        company_name: 'Test Company',
        laptop_serial_number: 'UNREG-SN-001',
        laptop_asset_tag: 'UNREG-TAG-001',
        status: 'active'
      });

      // Fetch the asset again
      const asset = await assetDb.getById(testAssetId);

      // Manager name should now come from the user record via JOIN
      expect(asset.manager_first_name).toBe('Jane Marie');
      expect(asset.manager_last_name).toBe('Doe Updated');
      expect(asset.manager_email).toBe('jane.doe.unregistered@test.com');
      expect(asset.manager_id).toBe(registeredManagerUser.id);
    });
  });

  describe('updateManagerForEmployee with Unregistered Manager', () => {
    it('should update assets with unregistered manager name', async () => {
      // Create another asset
      const assetResult = await assetDb.create({
        employee_first_name: 'Test',
        employee_last_name: 'Employee',
        employee_email: 'employee-unregistered-test@test.com',
        manager_first_name: 'Old',
        manager_last_name: 'Manager',
        manager_email: 'old.manager@test.com',
        company_name: 'Test Company',
        laptop_serial_number: 'UNREG-SN-002',
        laptop_asset_tag: 'UNREG-TAG-002',
        status: 'active'
      });

      const assetId = assetResult.id;

      // Update the manager to an unregistered manager
      await assetDb.updateManagerForEmployee(
        'employee-unregistered-test@test.com',
        'John Smith',
        'john.smith.unregistered@test.com'
      );

      // Fetch the asset
      const asset = await assetDb.getById(assetId);

      // Manager name should be split and stored
      expect(asset.manager_first_name).toBe('John');
      expect(asset.manager_last_name).toBe('Smith');
      expect(asset.manager_email).toBe('john.smith.unregistered@test.com');
      expect(asset.manager_id).toBeNull();

      // Clean up
      await assetDb.delete(assetId);
    });

    it('should handle multi-word last names correctly', async () => {
      // Create another asset
      const assetResult = await assetDb.create({
        employee_first_name: 'Test',
        employee_last_name: 'Employee',
        employee_email: 'employee-unregistered-test@test.com',
        manager_first_name: 'Old',
        manager_last_name: 'Manager',
        manager_email: 'old.manager@test.com',
        company_name: 'Test Company',
        laptop_serial_number: 'UNREG-SN-003',
        laptop_asset_tag: 'UNREG-TAG-003',
        status: 'active'
      });

      const assetId = assetResult.id;

      // Update the manager with a multi-word last name
      await assetDb.updateManagerForEmployee(
        'employee-unregistered-test@test.com',
        'Mary Jane van der Berg',
        'mary.vandenberg@test.com'
      );

      // Fetch the asset
      const asset = await assetDb.getById(assetId);

      // Manager name should be split correctly
      expect(asset.manager_first_name).toBe('Mary');
      expect(asset.manager_last_name).toBe('Jane van der Berg');
      expect(asset.manager_email).toBe('mary.vandenberg@test.com');
      expect(asset.manager_id).toBeNull();

      // Clean up
      await assetDb.delete(assetId);
    });
  });

  describe('linkAssetsToUser with Unregistered Manager', () => {
    it('should link assets with unregistered manager details', async () => {
      // Create an asset
      const assetResult = await assetDb.create({
        employee_first_name: 'Test',
        employee_last_name: 'Employee',
        employee_email: 'employee-unregistered-test@test.com',
        manager_first_name: '',
        manager_last_name: '',
        manager_email: '',
        company_name: 'Test Company',
        laptop_serial_number: 'UNREG-SN-004',
        laptop_asset_tag: 'UNREG-TAG-004',
        status: 'active'
      });

      const assetId = assetResult.id;

      // Link assets with unregistered manager
      await assetDb.linkAssetsToUser(
        'employee-unregistered-test@test.com',
        'Alice',
        'Williams',
        'alice.williams@test.com'
      );

      // Fetch the asset
      const asset = await assetDb.getById(assetId);

      // Manager details should be stored
      expect(asset.manager_first_name).toBe('Alice');
      expect(asset.manager_last_name).toBe('Williams');
      expect(asset.manager_email).toBe('alice.williams@test.com');
      expect(asset.manager_id).toBeNull();

      // Clean up
      await assetDb.delete(assetId);
    });
  });

  describe('bulkUpdateManager with Unregistered Manager', () => {
    it('should bulk update assets with unregistered manager details', async () => {
      // Create multiple assets
      const asset1Result = await assetDb.create({
        employee_first_name: 'Test',
        employee_last_name: 'Employee',
        employee_email: 'employee-unregistered-test@test.com',
        manager_first_name: '',
        manager_last_name: '',
        manager_email: '',
        company_name: 'Test Company',
        laptop_serial_number: 'UNREG-SN-005',
        laptop_asset_tag: 'UNREG-TAG-005',
        status: 'active'
      });

      const asset2Result = await assetDb.create({
        employee_first_name: 'Test',
        employee_last_name: 'Employee',
        employee_email: 'employee-unregistered-test@test.com',
        manager_first_name: '',
        manager_last_name: '',
        manager_email: '',
        company_name: 'Test Company',
        laptop_serial_number: 'UNREG-SN-006',
        laptop_asset_tag: 'UNREG-TAG-006',
        status: 'active'
      });

      const assetIds = [asset1Result.id, asset2Result.id];

      // Bulk update with unregistered manager
      await assetDb.bulkUpdateManager(
        assetIds,
        'Robert',
        'Johnson',
        'robert.johnson@test.com'
      );

      // Fetch both assets
      const asset1 = await assetDb.getById(asset1Result.id);
      const asset2 = await assetDb.getById(asset2Result.id);

      // Both should have the manager details
      expect(asset1.manager_first_name).toBe('Robert');
      expect(asset1.manager_last_name).toBe('Johnson');
      expect(asset1.manager_email).toBe('robert.johnson@test.com');
      expect(asset1.manager_id).toBeNull();

      expect(asset2.manager_first_name).toBe('Robert');
      expect(asset2.manager_last_name).toBe('Johnson');
      expect(asset2.manager_email).toBe('robert.johnson@test.com');
      expect(asset2.manager_id).toBeNull();

      // Clean up
      await assetDb.delete(asset1Result.id);
      await assetDb.delete(asset2Result.id);
    });
  });
});
