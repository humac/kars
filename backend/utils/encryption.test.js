import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { encryptValue, decryptValue, generateMasterKey } from './encryption.js';

describe('Encryption Utilities', () => {
  const originalEnv = process.env.ACS_MASTER_KEY;

  beforeEach(() => {
    // Set a test master key (32 bytes = 256 bits)
    process.env.ACS_MASTER_KEY = generateMasterKey('base64');
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv) {
      process.env.ACS_MASTER_KEY = originalEnv;
    } else {
      delete process.env.ACS_MASTER_KEY;
    }
  });

  describe('generateMasterKey', () => {
    it('should generate a 32-byte key in base64 format', () => {
      const key = generateMasterKey('base64');
      const buffer = Buffer.from(key, 'base64');
      expect(buffer.length).toBe(32);
    });

    it('should generate a 32-byte key in hex format', () => {
      const key = generateMasterKey('hex');
      const buffer = Buffer.from(key, 'hex');
      expect(buffer.length).toBe(32);
    });

    it('should generate different keys on each call', () => {
      const key1 = generateMasterKey();
      const key2 = generateMasterKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('encryptValue', () => {
    it('should encrypt a plaintext string', () => {
      const plaintext = 'my secret password';
      const encrypted = encryptValue(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);
      
      // Should have three parts separated by colons (iv:authTag:ciphertext)
      const parts = encrypted.split(':');
      expect(parts.length).toBe(3);
    });

    it('should return null for null input', () => {
      const encrypted = encryptValue(null);
      expect(encrypted).toBeNull();
    });

    it('should return null for empty string', () => {
      const encrypted = encryptValue('');
      expect(encrypted).toBeNull();
    });

    it('should produce different ciphertext for the same plaintext', () => {
      const plaintext = 'my secret';
      const encrypted1 = encryptValue(plaintext);
      const encrypted2 = encryptValue(plaintext);
      
      // Due to random IV, should be different each time
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw error if ACS_MASTER_KEY is not set', () => {
      delete process.env.ACS_MASTER_KEY;
      
      expect(() => {
        encryptValue('test');
      }).toThrow('ACS_MASTER_KEY environment variable is not set');
    });

    it('should throw error if ACS_MASTER_KEY is invalid length', () => {
      process.env.ACS_MASTER_KEY = Buffer.from('short', 'utf8').toString('base64');
      
      expect(() => {
        encryptValue('test');
      }).toThrow('ACS_MASTER_KEY must be exactly 32 bytes');
    });
  });

  describe('decryptValue', () => {
    it('should decrypt an encrypted value', () => {
      const plaintext = 'my secret password';
      const encrypted = encryptValue(plaintext);
      const decrypted = decryptValue(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should return null for null input', () => {
      const decrypted = decryptValue(null);
      expect(decrypted).toBeNull();
    });

    it('should return null for empty string', () => {
      const decrypted = decryptValue('');
      expect(decrypted).toBeNull();
    });

    it('should handle special characters', () => {
      const plaintext = 'p@ssw0rd!#$%^&*()_+{}|:"<>?';
      const encrypted = encryptValue(plaintext);
      const decrypted = decryptValue(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = '密码🔒🔐';
      const encrypted = encryptValue(plaintext);
      const decrypted = decryptValue(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for invalid format', () => {
      expect(() => {
        decryptValue('invalid:format');
      }).toThrow('Invalid encrypted data format');
    });

    it('should throw error for tampered ciphertext', () => {
      const plaintext = 'my secret';
      const encrypted = encryptValue(plaintext);
      
      // Tamper with the middle of the ciphertext portion (more reliable)
      const parts = encrypted.split(':');
      const midPoint = Math.floor(parts[2].length / 2);
      const replaceLen = Math.min(4, parts[2].length - midPoint);
      const tamperedCiphertext = parts[2].substring(0, midPoint) + 'XXXX' + parts[2].substring(midPoint + replaceLen);
      const tampered = `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;
      
      expect(() => {
        decryptValue(tampered);
      }).toThrow('Decryption failed');
    });

    it('should throw error if ACS_MASTER_KEY is not set', () => {
      const encrypted = encryptValue('test');
      delete process.env.ACS_MASTER_KEY;
      
      expect(() => {
        decryptValue(encrypted);
      }).toThrow('ACS_MASTER_KEY environment variable is not set');
    });

    it('should throw error if decrypting with wrong key', () => {
      const plaintext = 'my secret';
      const encrypted = encryptValue(plaintext);
      
      // Change the key
      process.env.ACS_MASTER_KEY = generateMasterKey('base64');
      
      expect(() => {
        decryptValue(encrypted);
      }).toThrow('Decryption failed');
    });
  });

  describe('encryption/decryption round-trip', () => {
    it('should successfully round-trip various text lengths', () => {
      const testCases = [
        'a',
        'short',
        'a medium length password with spaces',
        'a'.repeat(1000), // Long string
      ];

      testCases.forEach((plaintext) => {
        const encrypted = encryptValue(plaintext);
        const decrypted = decryptValue(encrypted);
        expect(decrypted).toBe(plaintext);
      });
    });
  });
});
