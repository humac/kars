/**
 * Database Abstraction Layer Tests
 * 
 * Comprehensive tests for database CRUD operations across all database modules.
 * Tests core database functionality and ensures database abstraction layer works correctly.
 */

import { describe, test, expect, beforeAll, afterEach } from '@jest/globals';
import {
  assetDb,
  companyDb,
  auditDb,
  userDb,
  sanitizeDateValue
} from './database.js';

describe('Database Module', () => {
  beforeAll(async () => {
    // Initialize database
    await assetDb.init();
  });

  describe('sanitizeDateValue', () => {
    test('should convert empty string to null', () => {
      expect(sanitizeDateValue('')).toBeNull();
    });

    test('should pass through null values', () => {
      expect(sanitizeDateValue(null)).toBeNull();
    });

    test('should pass through undefined values as null', () => {
      expect(sanitizeDateValue(undefined)).toBeNull();
    });

    test('should pass through valid date strings', () => {
      const dateStr = '2024-01-15';
      expect(sanitizeDateValue(dateStr)).toBe(dateStr);
    });
  });

  describe('companyDb', () => {
    let testCompanyId;

    afterEach(async () => {
      // Clean up test company
      if (testCompanyId) {
        try {
          await companyDb.delete(testCompanyId);
        } catch (error) {
          // Ignore cleanup errors
        }
        testCompanyId = null;
      }
    });

    test('should create a new company', async () => {
      const result = await companyDb.create({
        name: 'Test Company DB',
        description: 'Test Description'
      });

      testCompanyId = result.id;

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('number');
    });

    test('should retrieve company by ID', async () => {
      const created = await companyDb.create({
        name: 'Test Company Get',
        description: 'Get Test'
      });
      testCompanyId = created.id;

      const retrieved = await companyDb.getById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.name).toBe('Test Company Get');
    });

    test('should retrieve company by name', async () => {
      const created = await companyDb.create({
        name: 'Unique Company Name Test',
        description: 'Name Test'
      });
      testCompanyId = created.id;

      const retrieved = await companyDb.getByName('Unique Company Name Test');

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
    });

    test('should update company', async () => {
      const created = await companyDb.create({
        name: 'Company To Update',
        description: 'Original Description'
      });
      testCompanyId = created.id;

      await companyDb.update(created.id, {
        name: 'Updated Company Name',
        description: 'Updated Description'
      });

      const updated = await companyDb.getById(created.id);
      expect(updated.name).toBe('Updated Company Name');
      expect(updated.description).toBe('Updated Description');
    });

    test('should delete company', async () => {
      const created = await companyDb.create({
        name: 'Company To Delete',
        description: 'Will be deleted'
      });

      await companyDb.delete(created.id);

      const deleted = await companyDb.getById(created.id);
      expect(deleted).toBeNull();
      testCompanyId = null; // Already deleted
    });

    test('should return all companies', async () => {
      const created = await companyDb.create({
        name: 'List Test Company',
        description: 'For listing'
      });
      testCompanyId = created.id;

      const companies = await companyDb.getAll();

      expect(Array.isArray(companies)).toBe(true);
      expect(companies.length).toBeGreaterThan(0);
      expect(companies.some(c => c.id === created.id)).toBe(true);
    });
  });

  describe('auditDb', () => {
    test('should log audit entry using log method', async () => {
      const result = await auditDb.log(
        'CREATE',
        'test_resource',
        'test-123',
        'Test Resource',
        'Test audit log entry',
        'test@example.com'
      );

      expect(result).toBeDefined();
    });

    test('should retrieve all audit logs', async () => {
      await auditDb.log(
        'READ',
        'test_resource',
        'test-456',
        'Test Resource',
        'Recent test entry',
        'test@example.com'
      );

      const logs = await auditDb.getAll({ limit: 10 });

      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });

    test('should filter audit logs by entity type', async () => {
      await auditDb.log(
        'UPDATE',
        'specific_type',
        'test-789',
        'Specific Resource',
        'Specific type entry',
        'test@example.com'
      );

      const logs = await auditDb.getAll({ entityType: 'specific_type', limit: 10 });

      expect(Array.isArray(logs)).toBe(true);
      expect(logs.every(log => log.entity_type === 'specific_type')).toBe(true);
    });
  });

  describe('userDb', () => {
    let testUserId;

    afterEach(async () => {
      // Clean up test user
      if (testUserId) {
        try {
          await userDb.delete(testUserId);
        } catch (error) {
          // Ignore cleanup errors
        }
        testUserId = null;
      }
    });

    test('should create a new user', async () => {
      const result = await userDb.create({
        email: 'testdb@example.com',
        password_hash: 'test_hash',
        name: 'Test DB User',
        role: 'employee',
        first_name: 'Test',
        last_name: 'User'
      });

      testUserId = result.id;

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('number');
    });

    test('should retrieve user by email', async () => {
      const created = await userDb.create({
        email: 'findme@example.com',
        password_hash: 'test_hash',
        name: 'Find Me User',
        role: 'employee',
        first_name: 'Find',
        last_name: 'Me'
      });
      testUserId = created.id;

      const found = await userDb.getByEmail('findme@example.com');

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.email).toBe('findme@example.com');
    });

    test('should retrieve user by ID', async () => {
      const created = await userDb.create({
        email: 'getbyid@example.com',
        password_hash: 'test_hash',
        name: 'Get By ID User',
        role: 'employee',
        first_name: 'Get',
        last_name: 'ByID'
      });
      testUserId = created.id;

      const found = await userDb.getById(created.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
    });

    test('should update user profile', async () => {
      const created = await userDb.create({
        email: 'updateme@example.com',
        password_hash: 'test_hash',
        name: 'Update Me User',
        role: 'employee',
        first_name: 'Update',
        last_name: 'Me'
      });
      testUserId = created.id;

      await userDb.updateProfile(created.id, {
        name: 'Updated Name',
        first_name: 'Updated'
      });

      const updated = await userDb.getById(created.id);
      expect(updated.name).toBe('Updated Name');
      expect(updated.first_name).toBe('Updated');
    });

    test('should list all users', async () => {
      const created = await userDb.create({
        email: 'listtest@example.com',
        password_hash: 'test_hash',
        name: 'List Test User',
        role: 'employee',
        first_name: 'List',
        last_name: 'Test'
      });
      testUserId = created.id;

      const users = await userDb.getAll();

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
      expect(users.some(u => u.id === created.id)).toBe(true);
    });
  });

  describe('assetDb', () => {
    let testAssetId;
    let testCompanyId;

    beforeAll(async () => {
      // Create test company for asset tests - use unique name with timestamp
      const uniqueName = `Asset Test Company ${Date.now()}`;
      const company = await companyDb.create({
        name: uniqueName,
        description: 'For asset tests'
      });
      testCompanyId = company.id;
    });

    afterEach(async () => {
      // Clean up test asset
      if (testAssetId) {
        try {
          await assetDb.delete(testAssetId);
        } catch (error) {
          // Ignore cleanup errors
        }
        testAssetId = null;
      }
    });

    test('should create a new asset with required fields', async () => {
      const result = await assetDb.create({
        company_id: testCompanyId,
        employee_email: 'assettest@example.com',
        asset_type: 'Laptop',
        make: 'Test Brand',
        model: 'Test Model',
        serial_number: 'TEST123',
        asset_tag: 'TAG123',
        status: 'active'
      });

      testAssetId = result.id;

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('number');
    });

    test('should retrieve asset by ID', async () => {
      const created = await assetDb.create({
        company_id: testCompanyId,
        employee_email: 'assettest@example.com',
        asset_type: 'Phone',
        make: 'Test',
        model: 'Model X',
        serial_number: 'PHONE123',
        asset_tag: 'PHONETAG123',
        status: 'active'
      });
      testAssetId = created.id;

      const retrieved = await assetDb.getById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
    });

    test('should retrieve all assets', async () => {
      const created = await assetDb.create({
        company_id: testCompanyId,
        employee_email: 'listtest@example.com',
        asset_type: 'Monitor',
        make: 'Test',
        model: 'Monitor X',
        serial_number: 'MON123',
        asset_tag: 'MONTAG123',
        status: 'active'
      });
      testAssetId = created.id;

      const assets = await assetDb.getAll();

      expect(Array.isArray(assets)).toBe(true);
      expect(assets.some(a => a.id === created.id)).toBe(true);
    });
  });

  describe('Database initialization', () => {
    test('should initialize database without errors', async () => {
      // This test verifies that init can be called multiple times safely
      await expect(assetDb.init()).resolves.not.toThrow();
    });
  });
});
