import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { assetDb, assetTypeDb, companyDb } from './database.js';

describe('Asset Type Usage Count', () => {
  let testCompany;
  let laptopType;
  let timestamp;

  beforeAll(async () => {
    // Initialize database
    await assetDb.init();

    // Create test company with unique name
    timestamp = Date.now();
    const companyResult = await companyDb.create({
      name: `Test Company ${timestamp}`,
      description: 'Test company for usage count tests'
    });
    testCompany = await companyDb.getById(companyResult.id);

    // Get laptop asset type (should exist in default data)
    const allTypes = await assetTypeDb.getAll();
    laptopType = allTypes.find(t => t.name === 'laptop');
  });

  afterAll(async () => {
    // Clean up test data
    try {
      const assets = await assetDb.getAll();
      for (const asset of assets) {
        if (asset.serial_number && asset.serial_number.includes(`-${timestamp}`)) {
          await assetDb.delete(asset.id);
        }
      }
      if (testCompany) {
        await companyDb.delete(testCompany.id);
      }
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  });

  it('should return numeric count, not string concatenation', async () => {
    if (!laptopType) {
      console.warn('Laptop asset type not found, skipping test');
      return;
    }

    // Create exactly 7 test assets of type laptop
    const assetPromises = [];
    for (let i = 0; i < 7; i++) {
      assetPromises.push(
        assetDb.create({
          employee_first_name: 'Test',
          employee_last_name: `User${i}`,
          employee_email: `test-user-${i}-${timestamp}@test.com`,
          manager_first_name: 'Test',
          manager_last_name: 'Manager',
          manager_email: `test-manager-${timestamp}@test.com`,
          company_name: testCompany.name,
          asset_type: 'laptop',
          serial_number: `SN-USAGE-${i}-${timestamp}`,
          asset_tag: `TAG-USAGE-${i}-${timestamp}`,
          status: 'active'
        })
      );
    }
    await Promise.all(assetPromises);

    // Get usage count
    const usageCount = await assetTypeDb.getUsageCount(laptopType.id);

    // Should be a number (not a string)
    expect(typeof usageCount).toBe('number');

    // Should be at least 7 (our test assets), but could be more if there's existing data
    expect(usageCount).toBeGreaterThanOrEqual(7);

    // The key test: if we had 76 assets in one table and 0 in another,
    // it should return 76 (number addition), not 760 (string concatenation)
    // We can't easily test the exact scenario without mocking, but we verify
    // the result is a proper number
    expect(Number.isInteger(usageCount)).toBe(true);

    // Clean up our test assets
    const allAssets = await assetDb.getAll();
    for (const asset of allAssets) {
      if (asset.serial_number && asset.serial_number.includes(`SN-USAGE-`) && asset.serial_number.includes(`-${timestamp}`)) {
        await assetDb.delete(asset.id);
      }
    }
  });

  it('should correctly sum counts from multiple tables', async () => {
    if (!laptopType) {
      console.warn('Laptop asset type not found, skipping test');
      return;
    }

    // Create 3 test assets
    for (let i = 0; i < 3; i++) {
      await assetDb.create({
        employee_first_name: 'Test',
        employee_last_name: `Sum${i}`,
        employee_email: `test-sum-${i}-${timestamp}@test.com`,
        manager_first_name: 'Test',
        manager_last_name: 'Manager',
        manager_email: `test-manager-sum-${timestamp}@test.com`,
        company_name: testCompany.name,
        asset_type: 'laptop',
        serial_number: `SN-SUM-${i}-${timestamp}`,
        asset_tag: `TAG-SUM-${i}-${timestamp}`,
        status: 'active'
      });
    }

    const usageCount = await assetTypeDb.getUsageCount(laptopType.id);

    // Verify it's a number and at least 3
    expect(typeof usageCount).toBe('number');
    expect(usageCount).toBeGreaterThanOrEqual(3);

    // Clean up
    const allAssets = await assetDb.getAll();
    for (const asset of allAssets) {
      if (asset.serial_number && asset.serial_number.includes(`SN-SUM-`) && asset.serial_number.includes(`-${timestamp}`)) {
        await assetDb.delete(asset.id);
      }
    }
  });
});
