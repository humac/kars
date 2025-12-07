/**
 * Database User Module Tests
 * 
 * Tests for userDb functions, specifically error handling for MFA backup codes.
 */

import { describe, test, expect, beforeAll, afterEach } from '@jest/globals';
import { assetDb, userDb } from './database.js';

describe('UserDb MFA Backup Codes', () => {
  let testUserId;

  beforeAll(async () => {
    await assetDb.init();
  });

  afterEach(async () => {
    // Clean up test user if created
    if (testUserId) {
      try {
        await userDb.delete(testUserId);
      } catch (error) {
        // Ignore cleanup errors
      }
      testUserId = null;
    }
  });

  describe('useBackupCode', () => {
    test('should handle invalid JSON in mfa_backup_codes gracefully', async () => {
      // Create a test user
      const user = await userDb.create({
        email: 'test-mfa-invalid-json@example.com',
        password_hash: 'test_hash',
        name: 'Test User',
        role: 'employee',
        first_name: 'Test',
        last_name: 'User'
      });
      testUserId = user.id;

      // Enable MFA with valid backup codes first
      const validBackupCodes = ['ABCD1234', 'EFGH5678'];
      await userDb.enableMFA(testUserId, 'test_secret', validBackupCodes);

      // Now corrupt the JSON data by directly updating the database with invalid JSON
      // We need to access the database directly since dbRun is not exported
      const Database = (await import('better-sqlite3')).default;
      const { join } = await import('path');
      const { fileURLToPath } = await import('url');
      const { dirname } = await import('path');
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const dataDir = process.env.DATA_DIR || join(__dirname, 'data');
      const db = new Database(join(dataDir, 'assets.db'));
      
      db.prepare('UPDATE users SET mfa_backup_codes = ? WHERE id = ?').run('invalid json {', testUserId);
      db.close();

      // Attempt to use a backup code - should return false without crashing
      const result = await userDb.useBackupCode(testUserId, 'ABCD1234');

      expect(result).toBe(false);
    });

    test('should successfully use a valid backup code', async () => {
      // Create a test user
      const user = await userDb.create({
        email: 'test-mfa-valid@example.com',
        password_hash: 'test_hash',
        name: 'Test User',
        role: 'employee',
        first_name: 'Test',
        last_name: 'User'
      });
      testUserId = user.id;

      // Enable MFA with valid backup codes
      const validBackupCodes = ['ABCD1234', 'EFGH5678', 'IJKL9012'];
      await userDb.enableMFA(testUserId, 'test_secret', validBackupCodes);

      // Use a valid backup code
      const result = await userDb.useBackupCode(testUserId, 'ABCD1234');

      expect(result).toBe(true);

      // Verify the code was removed
      const mfaStatus = await userDb.getMFAStatus(testUserId);
      const remainingCodes = JSON.parse(mfaStatus.mfa_backup_codes);
      expect(remainingCodes).toHaveLength(2);
      expect(remainingCodes).not.toContain('ABCD1234');
      expect(remainingCodes).toContain('EFGH5678');
      expect(remainingCodes).toContain('IJKL9012');
    });

    test('should return false for non-existent backup code', async () => {
      // Create a test user
      const user = await userDb.create({
        email: 'test-mfa-invalid-code@example.com',
        password_hash: 'test_hash',
        name: 'Test User',
        role: 'employee',
        first_name: 'Test',
        last_name: 'User'
      });
      testUserId = user.id;

      // Enable MFA with valid backup codes
      const validBackupCodes = ['ABCD1234', 'EFGH5678'];
      await userDb.enableMFA(testUserId, 'test_secret', validBackupCodes);

      // Try to use a code that doesn't exist
      const result = await userDb.useBackupCode(testUserId, 'INVALID1');

      expect(result).toBe(false);

      // Verify no codes were removed
      const mfaStatus = await userDb.getMFAStatus(testUserId);
      const remainingCodes = JSON.parse(mfaStatus.mfa_backup_codes);
      expect(remainingCodes).toHaveLength(2);
    });

    test('should return false when user has no backup codes', async () => {
      // Create a test user without MFA
      const user = await userDb.create({
        email: 'test-no-mfa@example.com',
        password_hash: 'test_hash',
        name: 'Test User',
        role: 'employee',
        first_name: 'Test',
        last_name: 'User'
      });
      testUserId = user.id;

      // Try to use a backup code when MFA is not enabled
      const result = await userDb.useBackupCode(testUserId, 'ABCD1234');

      expect(result).toBe(false);
    });
  });
});
