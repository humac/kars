import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { randomBytes } from 'crypto';
import { passwordResetTokenDb, userDb } from './database.js';
import { hashPassword } from './auth.js';

describe('Password Reset Token Management', () => {
  let testUserId;
  const testEmail = `test-reset-${Date.now()}@example.com`;
  
  beforeAll(async () => {
    // Create a test user
    const passwordHash = await hashPassword('testpassword123');
    const result = await userDb.create({
      email: testEmail,
      password_hash: passwordHash,
      name: 'Test User',
      first_name: 'Test',
      last_name: 'User',
      manager_first_name: 'Manager',
      manager_last_name: 'Test',
      manager_email: 'manager@example.com',
      role: 'employee'
    });
    testUserId = result.id;
  });

  afterAll(async () => {
    // Cleanup
    if (testUserId) {
      await userDb.delete(testUserId);
    }
  });

  describe('Token Creation', () => {
    it('should create a password reset token', async () => {
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      
      const result = await passwordResetTokenDb.create(testUserId, token, expiresAt);
      
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should create unique tokens', async () => {
      const token1 = randomBytes(32).toString('hex');
      const token2 = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      
      await passwordResetTokenDb.create(testUserId, token1, expiresAt);
      await passwordResetTokenDb.create(testUserId, token2, expiresAt);
      
      // Both tokens should be different
      expect(token1).not.toBe(token2);
    });
  });

  describe('Token Retrieval', () => {
    it('should find a token by its value', async () => {
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      
      await passwordResetTokenDb.create(testUserId, token, expiresAt);
      
      const foundToken = await passwordResetTokenDb.findByToken(token);
      
      expect(foundToken).toBeDefined();
      expect(foundToken.token).toBe(token);
      expect(foundToken.user_id).toBe(testUserId);
      expect(foundToken.used).toBe(0);
    });

    it('should return null for non-existent token', async () => {
      const nonExistentToken = 'nonexistent-token-12345';
      
      const foundToken = await passwordResetTokenDb.findByToken(nonExistentToken);
      
      expect(foundToken).toBeNull();
    });
  });

  describe('Token Usage', () => {
    it('should mark a token as used', async () => {
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      
      const result = await passwordResetTokenDb.create(testUserId, token, expiresAt);
      await passwordResetTokenDb.markAsUsed(result.id);
      
      const foundToken = await passwordResetTokenDb.findByToken(token);
      
      expect(foundToken.used).toBe(1);
    });
  });

  describe('Token Deletion', () => {
    it('should delete all tokens for a user', async () => {
      const token1 = randomBytes(32).toString('hex');
      const token2 = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      
      await passwordResetTokenDb.create(testUserId, token1, expiresAt);
      await passwordResetTokenDb.create(testUserId, token2, expiresAt);
      
      await passwordResetTokenDb.deleteByUserId(testUserId);
      
      const foundToken1 = await passwordResetTokenDb.findByToken(token1);
      const foundToken2 = await passwordResetTokenDb.findByToken(token2);
      
      expect(foundToken1).toBeNull();
      expect(foundToken2).toBeNull();
    });

    it('should delete expired tokens', async () => {
      const token = randomBytes(32).toString('hex');
      // Create an already expired token (1 hour in the past)
      const expiresAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      await passwordResetTokenDb.create(testUserId, token, expiresAt);
      await passwordResetTokenDb.deleteExpired();
      
      const foundToken = await passwordResetTokenDb.findByToken(token);
      
      expect(foundToken).toBeNull();
    });
  });

  describe('Token Expiry Validation', () => {
    it('should correctly identify expired tokens', async () => {
      const token = randomBytes(32).toString('hex');
      // Create an already expired token
      const expiresAt = new Date(Date.now() - 1000).toISOString();
      
      await passwordResetTokenDb.create(testUserId, token, expiresAt);
      
      const foundToken = await passwordResetTokenDb.findByToken(token);
      const now = new Date();
      const tokenExpiry = new Date(foundToken.expires_at);
      
      expect(tokenExpiry < now).toBe(true);
    });

    it('should correctly identify valid (non-expired) tokens', async () => {
      const token = randomBytes(32).toString('hex');
      // Create a token that expires in 1 hour
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      
      await passwordResetTokenDb.create(testUserId, token, expiresAt);
      
      const foundToken = await passwordResetTokenDb.findByToken(token);
      const now = new Date();
      const tokenExpiry = new Date(foundToken.expires_at);
      
      expect(tokenExpiry > now).toBe(true);
    });
  });
});
