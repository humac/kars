import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { assetDb, userDb, companyDb } from './database.js';

const uniqueSuffix = Date.now();

describe('Unregistered Manager Name Display', () => {
  let testAssetId;
  let employeeUser;
  let registeredManagerUser;
  let testCompany;

  beforeAll(async () => {
    // Initialize database
    await assetDb.init();

    // Create test company (required for assets with company_id FK)
    const companyResult = await companyDb.create({
      name: `Test Company ${uniqueSuffix}`,
      description: 'Test company for unregistered manager tests'
    });
    testCompany = await companyDb.getById(companyResult.id);

    // Create an employee user
    const employeeResult = await userDb.create({
      email: `employee-${uniqueSuffix}@test.com`,
      password_hash: 'hash1',
      name: 'Test Employee',
      role: 'employee',
      first_name: 'Test',
      last_name: 'Employee'
    });

    employeeUser = await userDb.getByEmail(`employee-${uniqueSuffix}@test.com`);
  });

  afterAll(async () => {
    // Clean up test data
    if (testAssetId) await assetDb.delete(testAssetId);
    if (employeeUser) await userDb.delete(employeeUser.id);
    if (registeredManagerUser) await userDb.delete(registeredManagerUser.id);
    if (testCompany) await companyDb.delete(testCompany.id);
  });

  describe('Asset Creation with Unregistered Manager', () => {
    it('should store and display manager name when manager is not registered', async () => {
      // Create an asset with an unregistered manager
      const assetResult = await assetDb.create({
        employee_first_name: 'Test',
        employee_last_name: 'Employee',
        employee_email: `employee-${uniqueSuffix}@test.com`,
        manager_first_name: 'Jane',
        manager_last_name: 'Doe',
        manager_email: `jane.doe.${uniqueSuffix}@test.com`,
        company_name: testCompany.name,
        asset_type: 'laptop',
        serial_number: `UNREG-SN-001-${uniqueSuffix}`,
        asset_tag: `UNREG-TAG-001-${uniqueSuffix}`,
        status: 'active'
      });

      testAssetId = assetResult.id;

      // Fetch the asset
      const asset = await assetDb.getById(testAssetId);

      // Manager name should be displayed from denormalized fields
      expect(asset.manager_first_name).toBe('Jane');
      expect(asset.manager_last_name).toBe('Doe');
      expect(asset.manager_email).toBe(`jane.doe.${uniqueSuffix}@test.com`);
      expect(asset.manager_id).toBeNull();
    });

    it('should override with user record when manager registers', async () => {
      // Register the manager as a user
      await userDb.create({
        email: `jane.doe.${uniqueSuffix}@test.com`,
        password_hash: 'hash2',
        name: 'Jane Marie Doe',
        role: 'manager',
        first_name: 'Jane Marie',
        last_name: 'Doe Updated'
      });

      registeredManagerUser = await userDb.getByEmail(`jane.doe.${uniqueSuffix}@test.com`);

      // Update the asset to link to the registered manager
      await assetDb.update(testAssetId, {
        employee_first_name: 'Test',
        employee_last_name: 'Employee',
        employee_email: `employee-${uniqueSuffix}@test.com`,
        manager_first_name: 'Jane',
        manager_last_name: 'Doe',
        manager_email: `jane.doe.${uniqueSuffix}@test.com`,
        company_name: testCompany.name,
        asset_type: 'laptop',
        serial_number: `UNREG-SN-001-${uniqueSuffix}`,
        asset_tag: `UNREG-TAG-001-${uniqueSuffix}`,
        status: 'active'
      });

      // Fetch the asset again
      const asset = await assetDb.getById(testAssetId);

      // Manager name should now come from the user record via JOIN
      expect(asset.manager_first_name).toBe('Jane Marie');
      expect(asset.manager_last_name).toBe('Doe Updated');
      expect(asset.manager_email).toBe(`jane.doe.${uniqueSuffix}@test.com`);
      expect(asset.manager_id).toBe(registeredManagerUser.id);
    });
  });

  describe('updateManagerForEmployee with Unregistered Manager', () => {
    it('should update assets with unregistered manager name', async () => {
      // Create another asset
      const assetResult = await assetDb.create({
        employee_first_name: 'Test',
        employee_last_name: 'Employee',
        employee_email: `employee-${uniqueSuffix}@test.com`,
        manager_first_name: 'Old',
        manager_last_name: 'Manager',
        manager_email: `old.manager.${uniqueSuffix}@test.com`,
        company_name: testCompany.name,
        asset_type: 'laptop',
        serial_number: `UNREG-SN-002-${uniqueSuffix}`,
        asset_tag: `UNREG-TAG-002-${uniqueSuffix}`,
        status: 'active'
      });

      const assetId = assetResult.id;

      // Update the manager to an unregistered manager
      await assetDb.updateManagerForEmployee(
        `employee-${uniqueSuffix}@test.com`,
        'John',
        'Smith',
        `john.smith.${uniqueSuffix}@test.com`
      );

      // Fetch the asset
      const asset = await assetDb.getById(assetId);

      // Manager name should be split and stored
      expect(asset.manager_first_name).toBe('John');
      expect(asset.manager_last_name).toBe('Smith');
      expect(asset.manager_email).toBe(`john.smith.${uniqueSuffix}@test.com`);
      expect(asset.manager_id).toBeNull();

      // Clean up
      await assetDb.delete(assetId);
    });

    it('should handle multi-word last names correctly', async () => {
      // Create another asset
      const assetResult = await assetDb.create({
        employee_first_name: 'Test',
        employee_last_name: 'Employee',
        employee_email: `employee-${uniqueSuffix}@test.com`,
        manager_first_name: 'Old',
        manager_last_name: 'Manager',
        manager_email: `old.manager.${uniqueSuffix}@test.com`,
        company_name: testCompany.name,
        asset_type: 'laptop',
        serial_number: `UNREG-SN-003-${uniqueSuffix}`,
        asset_tag: `UNREG-TAG-003-${uniqueSuffix}`,
        status: 'active'
      });

      const assetId = assetResult.id;

      // Update the manager with a multi-word last name
      await assetDb.updateManagerForEmployee(
        `employee-${uniqueSuffix}@test.com`,
        'Mary',
        'Jane van der Berg',
        `mary.vandenberg.${uniqueSuffix}@test.com`
      );

      // Fetch the asset
      const asset = await assetDb.getById(assetId);

      // Manager name should be split correctly
      expect(asset.manager_first_name).toBe('Mary');
      expect(asset.manager_last_name).toBe('Jane van der Berg');
      expect(asset.manager_email).toBe(`mary.vandenberg.${uniqueSuffix}@test.com`);
      expect(asset.manager_id).toBeNull();

      // Clean up
      await assetDb.delete(assetId);
    });

    it('should handle empty or whitespace-only manager names', async () => {
      // Create another asset
      const assetResult = await assetDb.create({
        employee_first_name: 'Test',
        employee_last_name: 'Employee',
        employee_email: `employee-${uniqueSuffix}@test.com`,
        manager_first_name: 'Old',
        manager_last_name: 'Manager',
        manager_email: `old.manager.${uniqueSuffix}@test.com`,
        company_name: testCompany.name,
        asset_type: 'laptop',
        serial_number: `UNREG-SN-007-${uniqueSuffix}`,
        asset_tag: `UNREG-TAG-007-${uniqueSuffix}`,
        status: 'active'
      });

      const assetId = assetResult.id;

      // Update with empty manager name
      await assetDb.updateManagerForEmployee(
        `employee-${uniqueSuffix}@test.com`,
        '',
        '',
        `empty.name.${uniqueSuffix}@test.com`
      );

      // Fetch the asset
      const asset = await assetDb.getById(assetId);

      // Manager names should be empty strings, not contain whitespace
      expect(asset.manager_first_name).toBe('');
      expect(asset.manager_last_name).toBe('');
      expect(asset.manager_email).toBe(`empty.name.${uniqueSuffix}@test.com`);
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
        employee_email: `employee-${uniqueSuffix}@test.com`,
        manager_first_name: '',
        manager_last_name: '',
        manager_email: '',
        company_name: testCompany.name,
        asset_type: 'laptop',
        serial_number: `UNREG-SN-004-${uniqueSuffix}`,
        asset_tag: `UNREG-TAG-004-${uniqueSuffix}`,
        status: 'active'
      });

      const assetId = assetResult.id;

      // Link assets with unregistered manager
      await assetDb.linkAssetsToUser(
        `employee-${uniqueSuffix}@test.com`,
        'Alice',
        'Williams',
        `alice.williams.${uniqueSuffix}@test.com`
      );

      // Fetch the asset
      const asset = await assetDb.getById(assetId);

      // Manager details should be stored
      expect(asset.manager_first_name).toBe('Alice');
      expect(asset.manager_last_name).toBe('Williams');
      expect(asset.manager_email).toBe(`alice.williams.${uniqueSuffix}@test.com`);
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
        employee_email: `employee-${uniqueSuffix}@test.com`,
        manager_first_name: '',
        manager_last_name: '',
        manager_email: '',
        company_name: testCompany.name,
        asset_type: 'laptop',
        serial_number: `UNREG-SN-005-${uniqueSuffix}`,
        asset_tag: `UNREG-TAG-005-${uniqueSuffix}`,
        status: 'active'
      });

      const asset2Result = await assetDb.create({
        employee_first_name: 'Test',
        employee_last_name: 'Employee',
        employee_email: `employee-${uniqueSuffix}@test.com`,
        manager_first_name: '',
        manager_last_name: '',
        manager_email: '',
        company_name: testCompany.name,
        asset_type: 'laptop',
        serial_number: `UNREG-SN-006-${uniqueSuffix}`,
        asset_tag: `UNREG-TAG-006-${uniqueSuffix}`,
        status: 'active'
      });

      const assetIds = [asset1Result.id, asset2Result.id];

      // Bulk update with unregistered manager
      await assetDb.bulkUpdateManager(
        assetIds,
        'Robert',
        'Johnson',
        `robert.johnson.${uniqueSuffix}@test.com`
      );

      // Fetch both assets
      const asset1 = await assetDb.getById(asset1Result.id);
      const asset2 = await assetDb.getById(asset2Result.id);

      // Both should have the manager details
      expect(asset1.manager_first_name).toBe('Robert');
      expect(asset1.manager_last_name).toBe('Johnson');
      expect(asset1.manager_email).toBe(`robert.johnson.${uniqueSuffix}@test.com`);
      expect(asset1.manager_id).toBeNull();

      expect(asset2.manager_first_name).toBe('Robert');
      expect(asset2.manager_last_name).toBe('Johnson');
      expect(asset2.manager_email).toBe(`robert.johnson.${uniqueSuffix}@test.com`);
      expect(asset2.manager_id).toBeNull();

      // Clean up
      await assetDb.delete(asset1Result.id);
      await assetDb.delete(asset2Result.id);
    });
  });
});
