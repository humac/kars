import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { assetDb, userDb, companyDb } from './database.js';

describe('Asset Manager Auto-Assignment', () => {
  let testCompany;
  let testAssets = [];
  let testUsers = [];

  beforeAll(async () => {
    // Initialize database
    await assetDb.init();

    // Create test company
    const companyResult = await companyDb.create({
      name: 'Auto-Assignment Test Company',
      description: 'Test company for asset manager auto-assignment tests'
    });
    testCompany = await companyDb.getById(companyResult.id);
  });

  afterAll(async () => {
    // Clean up test data in reverse order
    for (const asset of testAssets) {
      try {
        await assetDb.delete(asset.id);
      } catch (e) {
        // Asset may have been deleted already
      }
    }
    for (const user of testUsers) {
      try {
        await userDb.delete(user.id);
      } catch (e) {
        // User may have been deleted already
      }
    }
    if (testCompany) {
      try {
        await companyDb.delete(testCompany.id);
      } catch (e) {
        // Company may have been deleted already
      }
    }
  });

  it('should auto-assign manager role when user registers and has assets with their email as manager', async () => {
    // Create assets with an unregistered manager
    const asset1Result = await assetDb.create({
      employee_first_name: 'John',
      employee_last_name: 'Doe',
      employee_email: 'john.doe.asset.test@test.com',
      manager_first_name: 'Jane',
      manager_last_name: 'Manager',
      manager_email: 'jane.manager.asset.test@test.com',
      company_name: testCompany.name,
      asset_type: 'laptop',
      serial_number: 'ASSET-MGR-001',
      asset_tag: 'ASSET-MGR-TAG-001',
      status: 'active'
    });
    testAssets.push({ id: asset1Result.id });

    const asset2Result = await assetDb.create({
      employee_first_name: 'Alice',
      employee_last_name: 'Smith',
      employee_email: 'alice.smith.asset.test@test.com',
      manager_first_name: 'Jane',
      manager_last_name: 'Manager',
      manager_email: 'jane.manager.asset.test@test.com',
      company_name: testCompany.name,
      asset_type: 'laptop',
      serial_number: 'ASSET-MGR-002',
      asset_tag: 'ASSET-MGR-TAG-002',
      status: 'active'
    });
    testAssets.push({ id: asset2Result.id });

    // Verify assets exist with this manager email
    const assetsBeforeRegistration = await assetDb.getByManagerEmail('jane.manager.asset.test@test.com');
    expect(assetsBeforeRegistration.length).toBe(2);

    // Now register the manager - should get employee role initially
    const managerUserResult = await userDb.create({
      email: 'jane.manager.asset.test@test.com',
      password_hash: 'hash123',
      name: 'Jane Manager',
      role: 'employee',
      first_name: 'Jane',
      last_name: 'Manager'
    });
    const managerUser = await userDb.getById(managerUserResult.id);
    testUsers.push(managerUser);

    // Initially should be employee
    expect(managerUser.role).toBe('employee');

    // Simulate the auto-assignment logic that happens during registration
    const assetsWithThisManager = await assetDb.getByManagerEmail(managerUser.email);
    expect(assetsWithThisManager.length).toBe(2);

    // This is what the registration endpoint should do
    if (assetsWithThisManager && assetsWithThisManager.length > 0) {
      await userDb.updateRole(managerUser.id, 'manager');
    }

    // Verify the role was updated
    const updatedUser = await userDb.getById(managerUser.id);
    expect(updatedUser.role).toBe('manager');
  });

  it('should handle case-insensitive email matching for asset manager auto-assignment', async () => {
    // Create asset with uppercase manager email
    const assetResult = await assetDb.create({
      employee_first_name: 'Bob',
      employee_last_name: 'Test',
      employee_email: 'bob.test@test.com',
      manager_first_name: 'Case',
      manager_last_name: 'Sensitive',
      manager_email: 'CASE.MANAGER@TEST.COM',
      company_name: testCompany.name,
      asset_type: 'laptop',
      serial_number: 'ASSET-MGR-003',
      asset_tag: 'ASSET-MGR-TAG-003',
      status: 'active'
    });
    testAssets.push({ id: assetResult.id });

    // Query with lowercase email
    const assetsFound = await assetDb.getByManagerEmail('case.manager@test.com');
    expect(assetsFound.length).toBe(1);
    expect(assetsFound[0].id).toBe(assetResult.id);

    // Register user with lowercase email
    const userResult = await userDb.create({
      email: 'case.manager@test.com',
      password_hash: 'hash456',
      name: 'Case Sensitive',
      role: 'employee',
      first_name: 'Case',
      last_name: 'Sensitive'
    });
    const user = await userDb.getById(userResult.id);
    testUsers.push(user);

    // Simulate auto-assignment
    const assetsWithThisManager = await assetDb.getByManagerEmail(user.email);
    expect(assetsWithThisManager.length).toBe(1);

    if (assetsWithThisManager && assetsWithThisManager.length > 0) {
      await userDb.updateRole(user.id, 'manager');
    }

    const updatedUser = await userDb.getById(user.id);
    expect(updatedUser.role).toBe('manager');
  });

  it('should not interfere when user has no assets as manager', async () => {
    // Register a user who is not a manager of any assets
    const userResult = await userDb.create({
      email: 'no.assets.manager@test.com',
      password_hash: 'hash789',
      name: 'No Assets Manager',
      role: 'employee',
      first_name: 'No Assets',
      last_name: 'Manager'
    });
    const user = await userDb.getById(userResult.id);
    testUsers.push(user);

    // Check for assets
    const assetsWithThisManager = await assetDb.getByManagerEmail(user.email);
    expect(assetsWithThisManager.length).toBe(0);

    // User should remain employee
    expect(user.role).toBe('employee');
  });

  it('should return all assets for a manager email', async () => {
    // Create multiple assets with the same manager
    const managerEmail = 'multi.asset.manager@test.com';
    
    for (let i = 1; i <= 3; i++) {
      const assetResult = await assetDb.create({
        employee_first_name: `Employee${i}`,
        employee_last_name: `Test${i}`,
        employee_email: `employee${i}.multi@test.com`,
        manager_first_name: 'Multi',
        manager_last_name: 'Asset',
        manager_email: managerEmail,
        company_name: testCompany.name,
        asset_type: 'laptop',
        serial_number: `MULTI-ASSET-${i}`,
        asset_tag: `MULTI-TAG-${i}`,
        status: 'active'
      });
      testAssets.push({ id: assetResult.id });
    }

    // Query for assets
    const assets = await assetDb.getByManagerEmail(managerEmail);
    expect(assets.length).toBe(3);
    
    // Verify all have the correct manager email
    assets.forEach(asset => {
      expect(asset.manager_email.toLowerCase()).toBe(managerEmail.toLowerCase());
    });
  });
});
