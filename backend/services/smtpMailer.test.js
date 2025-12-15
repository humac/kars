import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock modules before importing the module under test
const mockSmtpSettingsDb = {
  get: jest.fn(),
  getPassword: jest.fn()
};

const mockBrandingSettingsDb = {
  get: jest.fn()
};

const mockEmailTemplateDb = {
  getByKey: jest.fn()
};

const mockDecryptValue = jest.fn();

const mockSendMail = jest.fn();
const mockVerify = jest.fn();
const mockCreateTransport = jest.fn(() => ({
  sendMail: mockSendMail,
  verify: mockVerify
}));

jest.unstable_mockModule('../database.js', () => ({
  smtpSettingsDb: mockSmtpSettingsDb,
  brandingSettingsDb: mockBrandingSettingsDb,
  emailTemplateDb: mockEmailTemplateDb
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
const { sendTestEmail, verifyConnection, getAppUrl } = await import('./smtpMailer.js');

describe('SMTP Mailer Service', () => {
  beforeEach(() => {
    // Reset all mocks to ensure test isolation
    jest.clearAllMocks();
    
    // Reset mock implementations to defaults to prevent state bleeding between tests
    mockSmtpSettingsDb.get.mockReset();
    mockSmtpSettingsDb.getPassword.mockReset();
    mockBrandingSettingsDb.get.mockReset();
    mockEmailTemplateDb.getByKey.mockReset();
    mockDecryptValue.mockReset();
    mockSendMail.mockReset();
    mockVerify.mockReset();
    mockCreateTransport.mockReset();
    
    // Re-establish default mock behavior for createTransport
    mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
      verify: mockVerify
    });
    
    // Set default branding mock for all tests
    mockBrandingSettingsDb.get.mockResolvedValue({
      site_name: 'KARS',
      logo_data: null,
      include_logo_in_emails: 0
    });
    
    // Set default emailTemplateDb mock to return null (use fallback templates)
    mockEmailTemplateDb.getByKey.mockResolvedValue(null);
  });

  afterEach(() => {
    // Additional cleanup to ensure no lingering state
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

  describe('getAppUrl', () => {
    it('should return URL from branding settings without trailing slash', async () => {
      mockBrandingSettingsDb.get.mockResolvedValue({
        app_url: 'https://example.com/',
        site_name: 'KARS'
      });

      const url = await getAppUrl();

      expect(url).toBe('https://example.com');
    });

    it('should remove multiple trailing slashes', async () => {
      mockBrandingSettingsDb.get.mockResolvedValue({
        app_url: 'https://example.com///',
        site_name: 'KARS'
      });

      const url = await getAppUrl();

      expect(url).toBe('https://example.com');
    });

    it('should return URL without modification if no trailing slash', async () => {
      mockBrandingSettingsDb.get.mockResolvedValue({
        app_url: 'https://example.com',
        site_name: 'KARS'
      });

      const url = await getAppUrl();

      expect(url).toBe('https://example.com');
    });

    it('should fallback to default localhost without trailing slash', async () => {
      mockBrandingSettingsDb.get.mockResolvedValue(null);
      
      // Clear any environment variables that might interfere
      const originalFrontendUrl = process.env.FRONTEND_URL;
      const originalBaseUrl = process.env.BASE_URL;
      delete process.env.FRONTEND_URL;
      delete process.env.BASE_URL;

      const url = await getAppUrl();

      expect(url).toBe('http://localhost:3000');
      
      // Restore environment variables
      if (originalFrontendUrl) process.env.FRONTEND_URL = originalFrontendUrl;
      if (originalBaseUrl) process.env.BASE_URL = originalBaseUrl;
    });

    it('should handle URLs with paths correctly', async () => {
      mockBrandingSettingsDb.get.mockResolvedValue({
        app_url: 'https://example.com/app/',
        site_name: 'KARS'
      });

      const url = await getAppUrl();

      expect(url).toBe('https://example.com/app');
    });
  });
});
