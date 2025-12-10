import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { assetDb, smtpSettingsDb } from './database.js';
import { generateToken } from './auth.js';
import { generateMasterKey } from './utils/encryption.js';

// Set up test environment
process.env.KARS_MASTER_KEY = generateMasterKey('base64');
process.env.JWT_SECRET = 'test-secret-key';

describe('SMTP API Endpoints', () => {
  let adminToken;
  let employeeToken;

  beforeAll(async () => {
    await assetDb.init();

    // Create admin user for testing
    adminToken = generateToken({
      id: 1,
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'admin'
    });

    // Create employee user for testing
    employeeToken = generateToken({
      id: 2,
      email: 'employee@test.com',
      name: 'Employee User',
      role: 'employee'
    });
  });

  afterAll(async () => {
    // Reset SMTP settings to default state
    await smtpSettingsDb.update({
      enabled: false,
      host: null,
      port: 587,
      use_tls: true,
      username: null,
      clear_password: true,
      auth_method: 'plain',
      from_name: 'KARS Notifications',
      from_email: null,
      default_recipient: null
    });
  });

  describe('GET /api/admin/notification-settings', () => {
    it('should return SMTP settings for admin', async () => {
      const settings = await smtpSettingsDb.get();
      
      expect(settings).toBeDefined();
      expect(typeof settings.enabled).toBe('number');
      expect(typeof settings.has_password).toBe('boolean');
      expect(settings.password_encrypted).toBeUndefined(); // Should not be returned
    });

    it('should not expose encrypted password', async () => {
      // Update settings with a password
      await smtpSettingsDb.update({
        password_encrypted: 'test:encrypted:data'
      });

      const settings = await smtpSettingsDb.get();
      expect(settings.password_encrypted).toBeUndefined();
      expect(settings.has_password).toBe(true);
    });
  });

  describe('PUT /api/admin/notification-settings', () => {
    it('should update SMTP settings', async () => {
      await smtpSettingsDb.update({
        enabled: true,
        host: 'smtp.example.com',
        port: 587,
        use_tls: true,
        from_email: 'noreply@example.com',
        from_name: 'Test System'
      });

      const settings = await smtpSettingsDb.get();
      expect(settings.enabled).toBe(1);
      expect(settings.host).toBe('smtp.example.com');
      expect(settings.port).toBe(587);
      expect(settings.from_email).toBe('noreply@example.com');
    });

    it('should handle partial updates', async () => {
      await smtpSettingsDb.update({
        port: 465
      });

      const settings = await smtpSettingsDb.get();
      expect(settings.port).toBe(465);
      expect(settings.host).toBe('smtp.example.com'); // Should remain unchanged
    });
  });

  describe('Password encryption', () => {
    it('should store encrypted password separately', async () => {
      await smtpSettingsDb.update({
        password_encrypted: 'new:encrypted:password'
      });

      const password = await smtpSettingsDb.getPassword();
      expect(password).toBe('new:encrypted:password');

      const settings = await smtpSettingsDb.get();
      expect(settings.has_password).toBe(true);
      expect(settings.password_encrypted).toBeUndefined();
    });

    it('should clear password when clear_password is true', async () => {
      await smtpSettingsDb.update({
        clear_password: true
      });

      const password = await smtpSettingsDb.getPassword();
      expect(password).toBeNull();

      const settings = await smtpSettingsDb.get();
      expect(settings.has_password).toBe(false);
    });
  });

  describe('Database normalization', () => {
    it('should normalize boolean fields', async () => {
      await smtpSettingsDb.update({
        enabled: true,
        use_tls: false
      });

      const settings = await smtpSettingsDb.get();
      expect(settings.enabled).toBe(1);
      expect(settings.use_tls).toBe(0);
    });

    it('should handle null values', async () => {
      await smtpSettingsDb.update({
        username: null,
        default_recipient: null
      });

      const settings = await smtpSettingsDb.get();
      expect(settings.username).toBeNull();
      expect(settings.default_recipient).toBeNull();
    });
  });
});
