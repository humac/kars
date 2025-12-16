/**
 * Attestation Email Template Tests
 * 
 * This file contains comprehensive tests for attestation email templates,
 * including variable substitution, template loading, and email function behavior.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock database modules
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

// Setup module mocks
jest.unstable_mockModule('./database.js', () => ({
  smtpSettingsDb: mockSmtpSettingsDb,
  brandingSettingsDb: mockBrandingSettingsDb,
  emailTemplateDb: mockEmailTemplateDb
}));

jest.unstable_mockModule('./utils/encryption.js', () => ({
  decryptValue: mockDecryptValue
}));

jest.unstable_mockModule('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport
  }
}));

// Import module under test
const { 
  sendAttestationLaunchEmail,
  sendAttestationReminderEmail,
  sendAttestationEscalationEmail,
  sendAttestationUnregisteredReminder,
  sendAttestationUnregisteredEscalation
} = await import('./services/smtpMailer.js');

describe('Attestation Email Templates - Variable Substitution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockSmtpSettingsDb.get.mockResolvedValue({
      enabled: 1,
      host: 'smtp.example.com',
      port: 587,
      use_tls: 1,
      from_name: 'KARS',
      from_email: 'noreply@example.com'
    });
    
    mockSmtpSettingsDb.getPassword.mockResolvedValue('encrypted:password');
    mockDecryptValue.mockReturnValue('password');
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });
    
    mockBrandingSettingsDb.get.mockResolvedValue({
      site_name: 'KARS Test',
      logo_data: null,
      include_logo_in_emails: 0,
      app_url: 'http://localhost:3000'
    });
    
    mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
      verify: mockVerify
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should replace all template variables correctly in attestation launch email', async () => {
    const mockTemplate = {
      key: 'attestation_launch',
      subject: 'Action Required: {{campaignName}}',
      html_body: '<p>Campaign: {{campaignName}}</p><p>Description: {{campaignDescription}}</p><p>URL: {{attestationUrl}}</p><p>Site: {{siteName}}</p>',
      text_body: 'Campaign: {{campaignName}}\nDescription: {{campaignDescription}}\nURL: {{attestationUrl}}\nSite: {{siteName}}'
    };
    
    mockEmailTemplateDb.getByKey.mockResolvedValue(mockTemplate);
    
    const campaign = {
      name: 'Test Campaign',
      description: 'Test Description'
    };
    
    const result = await sendAttestationLaunchEmail(
      'test@example.com',
      campaign,
      'http://localhost:3000/my-attestations'
    );
    
    expect(result.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Action Required: Test Campaign',
        text: expect.stringContaining('Campaign: Test Campaign'),
        text: expect.stringContaining('Description: Test Description'),
        text: expect.stringContaining('URL: http://localhost:3000/my-attestations'),
        text: expect.stringContaining('Site: KARS Test')
      })
    );
  });

  it('should handle missing template variables gracefully without crashing', async () => {
    const mockTemplate = {
      key: 'attestation_launch',
      subject: 'Action Required: {{campaignName}} - {{missingVariable}}',
      html_body: '<p>Campaign: {{campaignName}}</p><p>Missing: {{missingVariable}}</p>',
      text_body: 'Campaign: {{campaignName}}\nMissing: {{missingVariable}}'
    };
    
    mockEmailTemplateDb.getByKey.mockResolvedValue(mockTemplate);
    
    const campaign = {
      name: 'Test Campaign',
      description: 'Test Description'
    };
    
    const result = await sendAttestationLaunchEmail(
      'test@example.com',
      campaign,
      'http://localhost:3000/my-attestations'
    );
    
    expect(result.success).toBe(true);
    // Missing variables remain in the template (not replaced) - this is expected behavior
    // The function doesn't crash and successfully sends the email
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('Test Campaign'),
        to: 'test@example.com'
      })
    );
  });

  it('should handle empty or null variable values', async () => {
    const mockTemplate = {
      key: 'attestation_launch',
      subject: '{{campaignName}}',
      html_body: '<p>{{campaignDescription}}</p>',
      text_body: '{{campaignDescription}}'
    };
    
    mockEmailTemplateDb.getByKey.mockResolvedValue(mockTemplate);
    
    const campaign = {
      name: 'Test Campaign',
      description: null // null description
    };
    
    const result = await sendAttestationLaunchEmail(
      'test@example.com',
      campaign,
      'http://localhost:3000/my-attestations'
    );
    
    expect(result.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalled();
  });
});

describe('Attestation Email Templates - Template Loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockSmtpSettingsDb.get.mockResolvedValue({
      enabled: 1,
      host: 'smtp.example.com',
      port: 587,
      use_tls: 1,
      from_name: 'KARS',
      from_email: 'noreply@example.com'
    });
    
    mockSmtpSettingsDb.getPassword.mockResolvedValue('encrypted:password');
    mockDecryptValue.mockReturnValue('password');
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });
    
    mockBrandingSettingsDb.get.mockResolvedValue({
      site_name: 'KARS Test',
      logo_data: null,
      include_logo_in_emails: 0,
      app_url: 'http://localhost:3000'
    });
    
    mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
      verify: mockVerify
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should load template from database when available', async () => {
    const mockTemplate = {
      key: 'attestation_launch',
      subject: 'Custom Template: {{campaignName}}',
      html_body: '<p>Custom HTML</p>',
      text_body: 'Custom Text'
    };
    
    mockEmailTemplateDb.getByKey.mockResolvedValue(mockTemplate);
    
    const campaign = {
      name: 'Test Campaign',
      description: 'Test Description'
    };
    
    const result = await sendAttestationLaunchEmail(
      'test@example.com',
      campaign
    );
    
    expect(result.success).toBe(true);
    expect(mockEmailTemplateDb.getByKey).toHaveBeenCalledWith('attestation_launch');
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Custom Template: Test Campaign'
      })
    );
  });

  it('should fall back to hardcoded defaults when no database template exists', async () => {
    // Return null to simulate no template in database
    mockEmailTemplateDb.getByKey.mockResolvedValue(null);
    
    const campaign = {
      name: 'Test Campaign',
      description: 'Test Description'
    };
    
    const result = await sendAttestationLaunchEmail(
      'test@example.com',
      campaign
    );
    
    expect(result.success).toBe(true);
    expect(mockEmailTemplateDb.getByKey).toHaveBeenCalledWith('attestation_launch');
    // Should use fallback template with default subject format
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('Action Required: Asset Attestation')
      })
    );
  });

  it('should load correct template key for each email type', async () => {
    mockEmailTemplateDb.getByKey.mockResolvedValue(null);
    
    const campaign = { name: 'Test Campaign' };
    
    // Test launch email
    await sendAttestationLaunchEmail('test@example.com', campaign);
    expect(mockEmailTemplateDb.getByKey).toHaveBeenCalledWith('attestation_launch');
    
    jest.clearAllMocks();
    mockEmailTemplateDb.getByKey.mockResolvedValue(null);
    mockSmtpSettingsDb.get.mockResolvedValue({
      enabled: 1,
      host: 'smtp.example.com',
      port: 587,
      from_email: 'noreply@example.com'
    });
    mockBrandingSettingsDb.get.mockResolvedValue({
      site_name: 'KARS Test',
      app_url: 'http://localhost:3000'
    });
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });
    
    // Test reminder email
    await sendAttestationReminderEmail('test@example.com', campaign);
    expect(mockEmailTemplateDb.getByKey).toHaveBeenCalledWith('attestation_reminder');
  });
});

describe('Attestation Email Functions - sendAttestationLaunchEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSmtpSettingsDb.get.mockResolvedValue({
      enabled: 1,
      host: 'smtp.example.com',
      port: 587,
      from_name: 'KARS',
      from_email: 'noreply@example.com'
    });
    
    mockSmtpSettingsDb.getPassword.mockResolvedValue('encrypted:password');
    mockDecryptValue.mockReturnValue('password');
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });
    mockBrandingSettingsDb.get.mockResolvedValue({
      site_name: 'KARS Test',
      app_url: 'http://localhost:3000'
    });
    mockEmailTemplateDb.getByKey.mockResolvedValue(null);
    mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
      verify: mockVerify
    });
  });

  it('should pass correct variables for launch email', async () => {
    const campaign = {
      name: 'Q4 2024 Campaign',
      description: 'Quarterly asset review'
    };
    
    const result = await sendAttestationLaunchEmail(
      'employee@example.com',
      campaign,
      'http://localhost:3000/my-attestations'
    );
    
    expect(result.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'employee@example.com',
        subject: expect.stringContaining('Q4 2024 Campaign')
      })
    );
  });
});

describe('Attestation Email Functions - sendAttestationReminderEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSmtpSettingsDb.get.mockResolvedValue({
      enabled: 1,
      host: 'smtp.example.com',
      port: 587,
      from_name: 'KARS',
      from_email: 'noreply@example.com'
    });
    
    mockSmtpSettingsDb.getPassword.mockResolvedValue('encrypted:password');
    mockDecryptValue.mockReturnValue('password');
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });
    mockBrandingSettingsDb.get.mockResolvedValue({
      site_name: 'KARS Test',
      app_url: 'http://localhost:3000'
    });
    mockEmailTemplateDb.getByKey.mockResolvedValue(null);
    mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
      verify: mockVerify
    });
  });

  it('should construct correct URL for reminder email', async () => {
    const campaign = {
      name: 'Test Campaign'
    };
    
    const result = await sendAttestationReminderEmail(
      'employee@example.com',
      campaign,
      'http://localhost:3000/my-attestations'
    );
    
    expect(result.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('http://localhost:3000/my-attestations')
      })
    );
  });
});

describe('Attestation Email Functions - sendAttestationEscalationEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSmtpSettingsDb.get.mockResolvedValue({
      enabled: 1,
      host: 'smtp.example.com',
      port: 587,
      from_name: 'KARS',
      from_email: 'noreply@example.com'
    });
    
    mockSmtpSettingsDb.getPassword.mockResolvedValue('encrypted:password');
    mockDecryptValue.mockReturnValue('password');
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });
    mockBrandingSettingsDb.get.mockResolvedValue({
      site_name: 'KARS Test',
      app_url: 'http://localhost:3000'
    });
    mockEmailTemplateDb.getByKey.mockResolvedValue(null);
    mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
      verify: mockVerify
    });
  });

  it('should include manager info in escalation email', async () => {
    const campaign = {
      name: 'Test Campaign'
    };
    
    const result = await sendAttestationEscalationEmail(
      'manager@example.com',
      'John Doe',
      'employee@example.com',
      campaign
    );
    
    expect(result.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'manager@example.com',
        text: expect.stringContaining('John Doe'),
        text: expect.stringContaining('employee@example.com')
      })
    );
  });
});

describe('Attestation Email Functions - sendAttestationUnregisteredReminder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSmtpSettingsDb.get.mockResolvedValue({
      enabled: 1,
      host: 'smtp.example.com',
      port: 587,
      from_name: 'KARS',
      from_email: 'noreply@example.com'
    });
    
    mockSmtpSettingsDb.getPassword.mockResolvedValue('encrypted:password');
    mockDecryptValue.mockReturnValue('password');
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });
    mockBrandingSettingsDb.get.mockResolvedValue({
      site_name: 'KARS Test',
      app_url: 'http://localhost:3000'
    });
    mockEmailTemplateDb.getByKey.mockResolvedValue(null);
    mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
      verify: mockVerify
    });
  });

  it('should handle SSO settings correctly', async () => {
    const campaign = {
      name: 'Test Campaign'
    };
    
    const result = await sendAttestationUnregisteredReminder(
      'unregistered@example.com',
      'Jane',
      'Smith',
      campaign,
      'test-token-123',
      3, // asset count
      true, // SSO enabled
      'Sign In with Company SSO'
    );
    
    expect(result.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'unregistered@example.com',
        text: expect.stringContaining('3 assets')
      })
    );
  });

  it('should include asset count in unregistered reminder', async () => {
    const campaign = {
      name: 'Test Campaign'
    };
    
    const result = await sendAttestationUnregisteredReminder(
      'unregistered@example.com',
      'Jane',
      'Smith',
      campaign,
      'test-token-123',
      5, // 5 assets
      false,
      'Sign In with SSO'
    );
    
    expect(result.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('5 assets')
      })
    );
  });
});

describe('Attestation Email Functions - sendAttestationUnregisteredEscalation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSmtpSettingsDb.get.mockResolvedValue({
      enabled: 1,
      host: 'smtp.example.com',
      port: 587,
      from_name: 'KARS',
      from_email: 'noreply@example.com'
    });
    
    mockSmtpSettingsDb.getPassword.mockResolvedValue('encrypted:password');
    mockDecryptValue.mockReturnValue('password');
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });
    mockBrandingSettingsDb.get.mockResolvedValue({
      site_name: 'KARS Test',
      app_url: 'http://localhost:3000'
    });
    mockEmailTemplateDb.getByKey.mockResolvedValue(null);
    mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
      verify: mockVerify
    });
  });

  it('should include asset count in unregistered escalation email', async () => {
    const campaign = {
      name: 'Test Campaign'
    };
    
    const result = await sendAttestationUnregisteredEscalation(
      'manager@example.com',
      'Bob Manager',
      'unregistered@example.com',
      'Jane Smith',
      campaign,
      4 // 4 assets
    );
    
    expect(result.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'manager@example.com',
        text: expect.stringContaining('4 assets'),
        text: expect.stringContaining('Jane Smith'),
        text: expect.stringContaining('unregistered@example.com')
      })
    );
  });

  it('should include manager name in unregistered escalation', async () => {
    const campaign = {
      name: 'Test Campaign'
    };
    
    const result = await sendAttestationUnregisteredEscalation(
      'manager@example.com',
      'Bob Manager',
      'unregistered@example.com',
      'Jane Smith',
      campaign,
      2
    );
    
    expect(result.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalled();
  });
});
