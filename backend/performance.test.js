/**
 * Performance Tests
 * 
 * These tests validate that our optimizations reduce database queries
 * and improve execution time for bulk operations.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { assetDb, userDb, auditDb } from './database.js';

describe('Performance Optimizations', () => {
  beforeAll(async () => {
    await assetDb.init();
  });

  beforeEach(async () => {
    // Clean up test data
    const testEmails = [
      'perf1@example.com', 
      'perf2@example.com', 
      'perf3@example.com',
      'MixedCase@example.com',
      'indexed@example.com'
    ];
    const users = await userDb.getByEmails(testEmails);
    for (const user of users) {
      await userDb.delete(user.id);
    }
  });

  describe('Batch User Fetch', () => {
    test('getByEmails should fetch multiple users in one query', async () => {
      // Create test users
      const emails = ['perf1@example.com', 'perf2@example.com', 'perf3@example.com'];
      
      for (const email of emails) {
        await userDb.create({
          email,
          password_hash: 'test_hash',
          name: 'Test User',
          role: 'employee',
          first_name: 'Test',
          last_name: 'User',
          manager_name: 'Manager',
          manager_email: 'manager@example.com'
        });
      }

      const startTime = Date.now();
      const users = await userDb.getByEmails(emails);
      const duration = Date.now() - startTime;

      expect(users).toHaveLength(3);
      expect(users.map(u => u.email).sort()).toEqual(emails.sort());
      
      // Should be fast (single query)
      expect(duration).toBeLessThan(100);
    });

    test('getByEmails should handle empty array', async () => {
      const users = await userDb.getByEmails([]);
      expect(users).toEqual([]);
    });

    test('getByEmails should be case-insensitive', async () => {
      const user = await userDb.create({
        email: 'MixedCase@example.com',
        password_hash: 'test_hash',
        name: 'Test User',
        role: 'employee'
      });

      // Query with different case variations
      const users = await userDb.getByEmails(['mixedcase@example.com', 'MIXEDCASE@EXAMPLE.COM']);
      expect(users.length).toBe(1);  // Should return only 1 user (deduplicated)
      expect(users[0].email.toLowerCase()).toBe('mixedcase@example.com');

      // Cleanup
      await userDb.delete(user.id);
    });
  });

  describe('Batch Asset Operations', () => {
    let assetIds = [];

    beforeEach(async () => {
      // Create test assets
      assetIds = [];
      for (let i = 0; i < 5; i++) {
        const result = await assetDb.create({
          employee_name: `Employee ${i}`,
          employee_email: `emp${i}@example.com`,
          manager_name: 'Manager',
          manager_email: 'manager@example.com',
          company_name: 'Test Company',
          laptop_serial_number: `SN${Date.now()}${i}`,
          laptop_asset_tag: `TAG${Date.now()}${i}`,
          status: 'active',
          notes: ''
        });
        assetIds.push(result.id);
      }
    });

    afterEach(async () => {
      // Clean up
      for (const id of assetIds) {
        try {
          await assetDb.delete(id);
        } catch (err) {
          // May already be deleted
        }
      }
    });

    test('getByIds should fetch multiple assets in one query', async () => {
      const startTime = Date.now();
      const assets = await assetDb.getByIds(assetIds);
      const duration = Date.now() - startTime;

      expect(assets).toHaveLength(5);
      expect(assets.every(a => assetIds.includes(a.id))).toBe(true);
      
      // Should be fast (single query)
      expect(duration).toBeLessThan(100);
    });

    test('getByIds should handle empty array', async () => {
      const assets = await assetDb.getByIds([]);
      expect(assets).toEqual([]);
    });

    test('bulkUpdateStatus should update multiple assets in one query', async () => {
      const startTime = Date.now();
      const result = await assetDb.bulkUpdateStatus(assetIds, 'returned', 'Bulk return');
      const duration = Date.now() - startTime;

      expect(result.changes).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);

      // Verify updates
      const assets = await assetDb.getByIds(assetIds);
      expect(assets.every(a => a.status === 'returned')).toBe(true);
    });

    test('bulkUpdateManager should update multiple assets in one query', async () => {
      const startTime = Date.now();
      const result = await assetDb.bulkUpdateManager(assetIds, 'New Manager', 'newmgr@example.com');
      const duration = Date.now() - startTime;

      expect(result.changes).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);

      // Verify updates
      const assets = await assetDb.getByIds(assetIds);
      expect(assets.every(a => a.manager_email === 'newmgr@example.com')).toBe(true);
    });

    test('bulkDelete should delete multiple assets in one query', async () => {
      const startTime = Date.now();
      const result = await assetDb.bulkDelete(assetIds);
      const duration = Date.now() - startTime;

      expect(result.changes).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);

      // Verify deletion
      const assets = await assetDb.getByIds(assetIds);
      expect(assets).toHaveLength(0);
    });
  });

  describe('Manager Employee Lookup', () => {
    let managerEmail = 'perfmgr@example.com';
    let assetIds = [];

    beforeEach(async () => {
      // Create test assets with same manager
      assetIds = [];
      for (let i = 0; i < 3; i++) {
        const result = await assetDb.create({
          employee_name: `Employee ${i}`,
          employee_email: `emp${i}@perftest.com`,
          manager_name: 'Perf Manager',
          manager_email: managerEmail,
          company_name: 'Test Company',
          laptop_serial_number: `PERF${Date.now()}${i}`,
          laptop_asset_tag: `PTAG${Date.now()}${i}`,
          status: 'active',
          notes: ''
        });
        assetIds.push(result.id);
      }
    });

    afterEach(async () => {
      // Clean up
      for (const id of assetIds) {
        try {
          await assetDb.delete(id);
        } catch (err) {
          // May already be deleted
        }
      }
    });

    test('getEmployeeEmailsByManager should efficiently query employee emails', async () => {
      const startTime = Date.now();
      const emails = await assetDb.getEmployeeEmailsByManager(managerEmail);
      const duration = Date.now() - startTime;

      expect(emails).toHaveLength(3);
      expect(emails).toContain('emp0@perftest.com');
      expect(emails).toContain('emp1@perftest.com');
      expect(emails).toContain('emp2@perftest.com');
      
      // Should be fast (single query)
      expect(duration).toBeLessThan(100);
    });

    test('getEmployeeEmailsByManager should handle manager with no employees', async () => {
      const emails = await assetDb.getEmployeeEmailsByManager('nonexistent@example.com');
      expect(emails).toEqual([]);
    });
  });

  describe('Index Performance', () => {
    test('queries should benefit from indexes on email fields', async () => {
      // Create a user
      const user = await userDb.create({
        email: 'indexed@example.com',
        password_hash: 'hash',
        name: 'Indexed User',
        role: 'employee',
        manager_email: 'mgr@example.com'
      });

      // Query by email should be fast
      const start1 = Date.now();
      const foundUser = await userDb.getByEmail('indexed@example.com');
      const duration1 = Date.now() - start1;

      expect(foundUser).not.toBeNull();
      expect(foundUser.email).toBe('indexed@example.com');
      expect(duration1).toBeLessThan(50);

      // Query by manager email should be fast
      const start2 = Date.now();
      const employees = await userDb.getByManagerEmail('mgr@example.com');
      const duration2 = Date.now() - start2;

      expect(employees.length).toBeGreaterThan(0);
      expect(duration2).toBeLessThan(50);

      // Cleanup
      await userDb.delete(user.id);
    });
  });
});
