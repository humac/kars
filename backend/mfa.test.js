import { describe, it, expect } from '@jest/globals';
import {
  generateMFASecret,
  verifyTOTP,
  generateBackupCodes,
  formatBackupCode,
  isValidBackupCodeFormat,
} from './mfa.js';

describe('MFA Module', () => {
  describe('generateMFASecret', () => {
    it('should generate MFA secret with required fields', async () => {
      const userEmail = 'test@example.com';
      const result = await generateMFASecret(userEmail);

      expect(result).toBeDefined();
      expect(result.secret).toBeDefined();
      expect(typeof result.secret).toBe('string');
      expect(result.qrCode).toBeDefined();
      expect(result.qrCode).toMatch(/^data:image\/png;base64,/);
      expect(result.otpauthUrl).toBeDefined();
      expect(result.otpauthUrl).toContain('otpauth://totp/');
      expect(result.otpauthUrl).toContain(userEmail);
    });

    it('should include custom issuer in otpauth URL', async () => {
      const userEmail = 'test@example.com';
      const customIssuer = 'MyApp';
      const result = await generateMFASecret(userEmail, customIssuer);

      expect(result.otpauthUrl).toContain(customIssuer);
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate default number of backup codes', () => {
      const codes = generateBackupCodes();

      expect(codes).toBeDefined();
      expect(Array.isArray(codes)).toBe(true);
      expect(codes).toHaveLength(10);
    });

    it('should generate custom number of backup codes', () => {
      const count = 5;
      const codes = generateBackupCodes(count);

      expect(codes).toHaveLength(count);
    });

    it('should generate unique codes', () => {
      const codes = generateBackupCodes();
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('should generate codes in correct format', () => {
      const codes = generateBackupCodes();

      codes.forEach((code) => {
        expect(typeof code).toBe('string');
        expect(code).toHaveLength(8);
        expect(code).toMatch(/^[0-9A-F]{8}$/);
      });
    });
  });

  describe('formatBackupCode', () => {
    it('should format backup code with dashes', () => {
      const code = '12345678';
      const formatted = formatBackupCode(code);

      expect(formatted).toBe('1234-5678');
    });

    it('should handle uppercase hex codes', () => {
      const code = 'ABCDEF01';
      const formatted = formatBackupCode(code);

      expect(formatted).toBe('ABCD-EF01');
    });
  });

  describe('isValidBackupCodeFormat', () => {
    it('should return true for valid backup code without dashes', () => {
      const code = '12345678';
      expect(isValidBackupCodeFormat(code)).toBe(true);
    });

    it('should return true for valid backup code with dashes', () => {
      const code = '1234-5678';
      expect(isValidBackupCodeFormat(code)).toBe(true);
    });

    it('should return true for uppercase hex codes', () => {
      const code = 'ABCD-EF01';
      expect(isValidBackupCodeFormat(code)).toBe(true);
    });

    it('should return false for invalid length', () => {
      const code = '123';
      expect(isValidBackupCodeFormat(code)).toBe(false);
    });

    it('should return false for non-hex characters', () => {
      const code = '1234GHIJ';
      expect(isValidBackupCodeFormat(code)).toBe(false);
    });

    it('should return false for empty string', () => {
      const code = '';
      expect(isValidBackupCodeFormat(code)).toBe(false);
    });
  });
});
