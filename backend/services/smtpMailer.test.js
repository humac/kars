import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock modules before importing the module under test
const mockSmtpSettingsDb = {
  get: jest.fn(),
  getPassword: jest.fn()
};

const mockDecryptValue = jest.fn();

const mockSendMail = jest.fn();
const mockVerify = jest.fn();
const mockCreateTransport = jest.fn(() => ({
  sendMail: mockSendMail,
  verify: mockVerify
}));

jest.unstable_mockModule('../database.js', () => ({
  smtpSettingsDb: mockSmtpSettingsDb
}));

jest.unstable_mockModule('../utils/encryption.js', () => ({
  decryptValue: mockDecryptValue
}));

jest.unstable_mockModule('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport
  }
}));

// Now import the module under test
const { sendTestEmail, verifyConnection } = await import('./smtpMailer.js');

describe('SMTP Mailer Service', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('sendTestEmail', () => {
    it('should send test email successfully with valid settings', async () => {
      const mockSettings = {
        enabled: 1,
        host: 'smtp.example.com',
        port: 587,
        use_tls: 1,
        username: 'user@example.com',
        from_name: 'KARS',
        from_email: 'noreply@example.com',
        default_recipient: 'admin@example.com'
      };

      mockSmtpSettingsDb.get.mockResolvedValue(mockSettings);
      mockSmtpSettingsDb.getPassword.mockResolvedValue('encrypted:password:data');
      mockDecryptValue.mockReturnValue('my-secret-password');
      mockSendMail.mockResolvedValue({
        messageId: '<test@example.com>',
        response: '250 Message accepted'
      });

      const result = await sendTestEmail('test@example.com');

      expect(result.success).toBe(true);
      expect(result.message).toContain('test@example.com');
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining('KARS'),
          to: 'test@example.com',
          subject: expect.stringContaining('Test')
        })
      );
    });

    it('should use default recipient when none provided', async () => {
      const mockSettings = {
        enabled: 1,
        host: 'smtp.example.com',
        port: 587,
        use_tls: 1,
        from_email: 'noreply@example.com',
        default_recipient: 'admin@example.com'
      };

      mockSmtpSettingsDb.get.mockResolvedValue(mockSettings);
      mockSmtpSettingsDb.getPassword.mockResolvedValue(null);
      mockSendMail.mockResolvedValue({
        messageId: '<test@example.com>',
        response: '250 OK'
      });

      const result = await sendTestEmail();

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@example.com'
        })
      );
    });

    it('should fail when SMTP is not enabled', async () => {
      const mockSettings = {
        enabled: 0,
        host: 'smtp.example.com',
        port: 587
      };

      mockSmtpSettingsDb.get.mockResolvedValue(mockSettings);

      const result = await sendTestEmail('test@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not enabled');
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should fail when from_email is not configured', async () => {
      const mockSettings = {
        enabled: 1,
        host: 'smtp.example.com',
        port: 587,
        from_email: null
      };

      mockSmtpSettingsDb.get.mockResolvedValue(mockSettings);

      const result = await sendTestEmail('test@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('From email');
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should fail when no recipient specified', async () => {
      const mockSettings = {
        enabled: 1,
        host: 'smtp.example.com',
        port: 587,
        from_email: 'noreply@example.com',
        default_recipient: null
      };

      mockSmtpSettingsDb.get.mockResolvedValue(mockSettings);

      const result = await sendTestEmail();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No recipient');
    });

    it('should handle authentication errors gracefully', async () => {
      const mockSettings = {
        enabled: 1,
        host: 'smtp.example.com',
        port: 587,
        use_tls: 1,
        username: 'user@example.com',
        from_email: 'noreply@example.com',
        default_recipient: 'admin@example.com'
      };

      mockSmtpSettingsDb.get.mockResolvedValue(mockSettings);
      mockSmtpSettingsDb.getPassword.mockResolvedValue('encrypted:password:data');
      mockDecryptValue.mockReturnValue('wrong-password');

      const authError = new Error('Authentication failed');
      authError.code = 'EAUTH';
      authError.responseCode = 535;
      mockSendMail.mockRejectedValue(authError);

      const result = await sendTestEmail('test@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
    });

    it('should handle connection refused errors', async () => {
      const mockSettings = {
        enabled: 1,
        host: 'smtp.example.com',
        port: 587,
        from_email: 'noreply@example.com',
        default_recipient: 'admin@example.com'
      };

      mockSmtpSettingsDb.get.mockResolvedValue(mockSettings);
      mockSmtpSettingsDb.getPassword.mockResolvedValue(null);

      const connError = new Error('Connection refused');
      connError.code = 'ECONNREFUSED';
      mockSendMail.mockRejectedValue(connError);

      const result = await sendTestEmail('test@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
    });

    it('should handle timeout errors', async () => {
      const mockSettings = {
        enabled: 1,
        host: 'smtp.example.com',
        port: 587,
        from_email: 'noreply@example.com',
        default_recipient: 'admin@example.com'
      };

      mockSmtpSettingsDb.get.mockResolvedValue(mockSettings);
      mockSmtpSettingsDb.getPassword.mockResolvedValue(null);

      const timeoutError = new Error('Connection timed out');
      timeoutError.code = 'ETIMEDOUT';
      mockSendMail.mockRejectedValue(timeoutError);

      const result = await sendTestEmail('test@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('should handle password decryption errors', async () => {
      const mockSettings = {
        enabled: 1,
        host: 'smtp.example.com',
        port: 587,
        username: 'user@example.com',
        from_email: 'noreply@example.com',
        default_recipient: 'admin@example.com'
      };

      mockSmtpSettingsDb.get.mockResolvedValue(mockSettings);
      mockSmtpSettingsDb.getPassword.mockResolvedValue('invalid:encrypted:data');
      mockDecryptValue.mockImplementation(() => {
        throw new Error('Decryption failed: Invalid auth tag');
      });

      const result = await sendTestEmail('test@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('decrypt SMTP password');
    });
  });

  describe('verifyConnection', () => {
    it('should verify connection successfully', async () => {
      const mockSettings = {
        enabled: 1,
        host: 'smtp.example.com',
        port: 587,
        use_tls: 1
      };

      mockSmtpSettingsDb.get.mockResolvedValue(mockSettings);
      mockSmtpSettingsDb.getPassword.mockResolvedValue(null);
      mockVerify.mockResolvedValue(true);

      const result = await verifyConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain('verified');
      expect(mockVerify).toHaveBeenCalled();
    });

    it('should handle verification failure', async () => {
      const mockSettings = {
        enabled: 1,
        host: 'invalid.example.com',
        port: 587
      };

      mockSmtpSettingsDb.get.mockResolvedValue(mockSettings);
      mockSmtpSettingsDb.getPassword.mockResolvedValue(null);
      mockVerify.mockRejectedValue(new Error('Connection failed'));

      const result = await verifyConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection failed');
    });
  });
});
