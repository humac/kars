/**
 * Attestation Scheduler Tests
 * 
 * This file contains comprehensive unit tests for the attestation scheduler service.
 * Tests verify reminder processing, escalations, and campaign auto-closure with proper mocking.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock database modules
const mockAttestationCampaignDb = {
  getAll: jest.fn(),
  update: jest.fn()
};

const mockAttestationRecordDb = {
  getByCampaignId: jest.fn(),
  update: jest.fn()
};

const mockUserDb = {
  getById: jest.fn()
};

const mockAttestationPendingInviteDb = {
  getByCampaignId: jest.fn(),
  update: jest.fn()
};

const mockOidcSettingsDb = {
  get: jest.fn()
};

const mockAssetDb = {
  getByEmployee: jest.fn()
};

// Mock email service functions
const mockSendAttestationReminderEmail = jest.fn();
const mockSendAttestationEscalationEmail = jest.fn();
const mockSendAttestationUnregisteredReminder = jest.fn();
const mockSendAttestationUnregisteredEscalation = jest.fn();

// Setup module mocks
jest.unstable_mockModule('./database.js', () => ({
  attestationCampaignDb: mockAttestationCampaignDb,
  attestationRecordDb: mockAttestationRecordDb,
  userDb: mockUserDb,
  attestationPendingInviteDb: mockAttestationPendingInviteDb,
  oidcSettingsDb: mockOidcSettingsDb,
  assetDb: mockAssetDb
}));

jest.unstable_mockModule('./services/smtpMailer.js', () => ({
  sendAttestationReminderEmail: mockSendAttestationReminderEmail,
  sendAttestationEscalationEmail: mockSendAttestationEscalationEmail,
  sendAttestationUnregisteredReminder: mockSendAttestationUnregisteredReminder,
  sendAttestationUnregisteredEscalation: mockSendAttestationUnregisteredEscalation
}));

// Import module under test
const { 
  processReminders, 
  processEscalations, 
  processUnregisteredReminders,
  processUnregisteredEscalations,
  autoCloseExpiredCampaigns 
} = await import('./services/attestationScheduler.js');

describe('Attestation Scheduler - processReminders()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set default FRONTEND_URL for tests
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should send reminders when reminder_days has passed since campaign start', async () => {
    // Create a campaign that started 8 days ago (reminder_days = 7)
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 8);
    
    const mockCampaign = {
      id: 1,
      name: 'Test Campaign',
      status: 'active',
      start_date: pastDate.toISOString(),
      reminder_days: 7
    };

    const mockRecord = {
      id: 1,
      campaign_id: 1,
      user_id: 100,
      status: 'pending',
      reminder_sent_at: null
    };

    const mockUser = {
      id: 100,
      email: 'employee@test.com',
      name: 'Test Employee'
    };

    mockAttestationCampaignDb.getAll.mockResolvedValue([mockCampaign]);
    mockAttestationRecordDb.getByCampaignId.mockResolvedValue([mockRecord]);
    mockUserDb.getById.mockResolvedValue(mockUser);
    mockSendAttestationReminderEmail.mockResolvedValue({ success: true });

    const result = await processReminders();

    expect(result.success).toBe(true);
    expect(mockSendAttestationReminderEmail).toHaveBeenCalledWith(
      'employee@test.com',
      mockCampaign,
      'http://localhost:3000/my-attestations'
    );
    expect(mockAttestationRecordDb.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        reminder_sent_at: expect.any(String)
      })
    );
  });

  it('should NOT send reminders before reminder_days has passed', async () => {
    // Create a campaign that started 5 days ago (reminder_days = 7)
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 5);
    
    const mockCampaign = {
      id: 1,
      name: 'Test Campaign',
      status: 'active',
      start_date: recentDate.toISOString(),
      reminder_days: 7
    };

    const mockRecord = {
      id: 1,
      campaign_id: 1,
      user_id: 100,
      status: 'pending',
      reminder_sent_at: null
    };

    mockAttestationCampaignDb.getAll.mockResolvedValue([mockCampaign]);
    mockAttestationRecordDb.getByCampaignId.mockResolvedValue([mockRecord]);

    const result = await processReminders();

    expect(result.success).toBe(true);
    expect(mockSendAttestationReminderEmail).not.toHaveBeenCalled();
    expect(mockAttestationRecordDb.update).not.toHaveBeenCalled();
  });

  it('should NOT send duplicate reminders (skip records where reminder_sent_at is already set)', async () => {
    // Create a campaign that started 8 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 8);
    
    const mockCampaign = {
      id: 1,
      name: 'Test Campaign',
      status: 'active',
      start_date: pastDate.toISOString(),
      reminder_days: 7
    };

    const mockRecord = {
      id: 1,
      campaign_id: 1,
      user_id: 100,
      status: 'pending',
      reminder_sent_at: new Date().toISOString() // Already sent
    };

    mockAttestationCampaignDb.getAll.mockResolvedValue([mockCampaign]);
    mockAttestationRecordDb.getByCampaignId.mockResolvedValue([mockRecord]);

    const result = await processReminders();

    expect(result.success).toBe(true);
    expect(mockSendAttestationReminderEmail).not.toHaveBeenCalled();
    expect(mockAttestationRecordDb.update).not.toHaveBeenCalled();
  });

  it('should skip completed records (only process status: pending)', async () => {
    // Create a campaign that started 8 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 8);
    
    const mockCampaign = {
      id: 1,
      name: 'Test Campaign',
      status: 'active',
      start_date: pastDate.toISOString(),
      reminder_days: 7
    };

    const mockRecords = [
      {
        id: 1,
        campaign_id: 1,
        user_id: 100,
        status: 'completed',
        reminder_sent_at: null
      },
      {
        id: 2,
        campaign_id: 1,
        user_id: 101,
        status: 'in_progress',
        reminder_sent_at: null
      }
    ];

    mockAttestationCampaignDb.getAll.mockResolvedValue([mockCampaign]);
    mockAttestationRecordDb.getByCampaignId.mockResolvedValue(mockRecords);

    const result = await processReminders();

    expect(result.success).toBe(true);
    expect(mockSendAttestationReminderEmail).not.toHaveBeenCalled();
    expect(mockAttestationRecordDb.update).not.toHaveBeenCalled();
  });

  it('should handle missing user email gracefully', async () => {
    // Create a campaign that started 8 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 8);
    
    const mockCampaign = {
      id: 1,
      name: 'Test Campaign',
      status: 'active',
      start_date: pastDate.toISOString(),
      reminder_days: 7
    };

    const mockRecord = {
      id: 1,
      campaign_id: 1,
      user_id: 100,
      status: 'pending',
      reminder_sent_at: null
    };

    // User with no email
    const mockUser = {
      id: 100,
      email: null,
      name: 'Test Employee'
    };

    mockAttestationCampaignDb.getAll.mockResolvedValue([mockCampaign]);
    mockAttestationRecordDb.getByCampaignId.mockResolvedValue([mockRecord]);
    mockUserDb.getById.mockResolvedValue(mockUser);

    const result = await processReminders();

    expect(result.success).toBe(true);
    expect(mockSendAttestationReminderEmail).not.toHaveBeenCalled();
    expect(mockAttestationRecordDb.update).not.toHaveBeenCalled();
  });
});

describe('Attestation Scheduler - processEscalations()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should escalate to manager after escalation_days has passed', async () => {
    // Create a campaign that started 11 days ago (escalation_days = 10)
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 11);
    
    const mockCampaign = {
      id: 1,
      name: 'Test Campaign',
      status: 'active',
      start_date: pastDate.toISOString(),
      escalation_days: 10
    };

    const mockRecord = {
      id: 1,
      campaign_id: 1,
      user_id: 100,
      status: 'pending',
      escalation_sent_at: null
    };

    const mockUser = {
      id: 100,
      email: 'employee@test.com',
      name: 'Test Employee',
      first_name: 'Test',
      last_name: 'Employee',
      manager_email: 'manager@test.com'
    };

    mockAttestationCampaignDb.getAll.mockResolvedValue([mockCampaign]);
    mockAttestationRecordDb.getByCampaignId.mockResolvedValue([mockRecord]);
    mockUserDb.getById.mockResolvedValue(mockUser);
    mockSendAttestationEscalationEmail.mockResolvedValue({ success: true });

    const result = await processEscalations();

    expect(result.success).toBe(true);
    expect(mockSendAttestationEscalationEmail).toHaveBeenCalledWith(
      'manager@test.com',
      'Test Employee',
      'employee@test.com',
      mockCampaign
    );
    expect(mockAttestationRecordDb.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        escalation_sent_at: expect.any(String)
      })
    );
  });

  it('should require manager_email on user record', async () => {
    // Create a campaign that started 11 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 11);
    
    const mockCampaign = {
      id: 1,
      name: 'Test Campaign',
      status: 'active',
      start_date: pastDate.toISOString(),
      escalation_days: 10
    };

    const mockRecord = {
      id: 1,
      campaign_id: 1,
      user_id: 100,
      status: 'pending',
      escalation_sent_at: null
    };

    // User without manager_email
    const mockUser = {
      id: 100,
      email: 'employee@test.com',
      name: 'Test Employee',
      first_name: 'Test',
      last_name: 'Employee',
      manager_email: null
    };

    mockAttestationCampaignDb.getAll.mockResolvedValue([mockCampaign]);
    mockAttestationRecordDb.getByCampaignId.mockResolvedValue([mockRecord]);
    mockUserDb.getById.mockResolvedValue(mockUser);

    const result = await processEscalations();

    expect(result.success).toBe(true);
    expect(mockSendAttestationEscalationEmail).not.toHaveBeenCalled();
    expect(mockAttestationRecordDb.update).not.toHaveBeenCalled();
  });

  it('should NOT send duplicate escalations', async () => {
    // Create a campaign that started 11 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 11);
    
    const mockCampaign = {
      id: 1,
      name: 'Test Campaign',
      status: 'active',
      start_date: pastDate.toISOString(),
      escalation_days: 10
    };

    const mockRecord = {
      id: 1,
      campaign_id: 1,
      user_id: 100,
      status: 'pending',
      escalation_sent_at: new Date().toISOString() // Already escalated
    };

    mockAttestationCampaignDb.getAll.mockResolvedValue([mockCampaign]);
    mockAttestationRecordDb.getByCampaignId.mockResolvedValue([mockRecord]);

    const result = await processEscalations();

    expect(result.success).toBe(true);
    expect(mockSendAttestationEscalationEmail).not.toHaveBeenCalled();
    expect(mockAttestationRecordDb.update).not.toHaveBeenCalled();
  });

  it('should skip non-pending records', async () => {
    // Create a campaign that started 11 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 11);
    
    const mockCampaign = {
      id: 1,
      name: 'Test Campaign',
      status: 'active',
      start_date: pastDate.toISOString(),
      escalation_days: 10
    };

    const mockRecord = {
      id: 1,
      campaign_id: 1,
      user_id: 100,
      status: 'completed',
      escalation_sent_at: null
    };

    mockAttestationCampaignDb.getAll.mockResolvedValue([mockCampaign]);
    mockAttestationRecordDb.getByCampaignId.mockResolvedValue([mockRecord]);

    const result = await processEscalations();

    expect(result.success).toBe(true);
    expect(mockSendAttestationEscalationEmail).not.toHaveBeenCalled();
    expect(mockAttestationRecordDb.update).not.toHaveBeenCalled();
  });
});

describe('Attestation Scheduler - processUnregisteredReminders()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should send reminders to unregistered asset owners', async () => {
    // Create a campaign that started 8 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 8);
    
    const mockCampaign = {
      id: 1,
      name: 'Test Campaign',
      status: 'active',
      start_date: pastDate.toISOString(),
      unregistered_reminder_days: 7
    };

    const mockInvite = {
      id: 1,
      campaign_id: 1,
      employee_email: 'unregistered@test.com',
      employee_first_name: 'John',
      employee_last_name: 'Doe',
      invite_token: 'test-token-123',
      registered_at: null,
      reminder_sent_at: null
    };

    const mockAssets = [
      { id: 1, employee_email: 'unregistered@test.com' },
      { id: 2, employee_email: 'unregistered@test.com' }
    ];

    const mockOidcSettings = {
      enabled: true,
      button_text: 'Sign In with SSO'
    };

    mockAttestationCampaignDb.getAll.mockResolvedValue([mockCampaign]);
    mockAttestationPendingInviteDb.getByCampaignId.mockResolvedValue([mockInvite]);
    mockOidcSettingsDb.get.mockResolvedValue(mockOidcSettings);
    mockAssetDb.getByEmployee.mockResolvedValue(mockAssets);
    mockSendAttestationUnregisteredReminder.mockResolvedValue({ success: true });

    const result = await processUnregisteredReminders();

    expect(result.success).toBe(true);
    expect(mockSendAttestationUnregisteredReminder).toHaveBeenCalledWith(
      'unregistered@test.com',
      'John',
      'Doe',
      mockCampaign,
      'test-token-123',
      2, // asset count
      true, // ssoEnabled
      'Sign In with SSO'
    );
    expect(mockAttestationPendingInviteDb.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        reminder_sent_at: expect.any(String)
      })
    );
  });

  it('should include correct asset count in email', async () => {
    // Create a campaign that started 8 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 8);
    
    const mockCampaign = {
      id: 1,
      name: 'Test Campaign',
      status: 'active',
      start_date: pastDate.toISOString(),
      unregistered_reminder_days: 7
    };

    const mockInvite = {
      id: 1,
      campaign_id: 1,
      employee_email: 'unregistered@test.com',
      employee_first_name: 'John',
      employee_last_name: 'Doe',
      invite_token: 'test-token-123',
      registered_at: null,
      reminder_sent_at: null
    };

    // Three assets for this employee
    const mockAssets = [
      { id: 1, employee_email: 'unregistered@test.com' },
      { id: 2, employee_email: 'unregistered@test.com' },
      { id: 3, employee_email: 'unregistered@test.com' }
    ];

    mockAttestationCampaignDb.getAll.mockResolvedValue([mockCampaign]);
    mockAttestationPendingInviteDb.getByCampaignId.mockResolvedValue([mockInvite]);
    mockOidcSettingsDb.get.mockResolvedValue({ enabled: false });
    mockAssetDb.getByEmployee.mockResolvedValue(mockAssets);
    mockSendAttestationUnregisteredReminder.mockResolvedValue({ success: true });

    const result = await processUnregisteredReminders();

    expect(result.success).toBe(true);
    expect(mockSendAttestationUnregisteredReminder).toHaveBeenCalledWith(
      'unregistered@test.com',
      'John',
      'Doe',
      mockCampaign,
      'test-token-123',
      3, // asset count
      false,
      'Sign In with SSO'
    );
  });

  it('should respect unregistered_reminder_days setting', async () => {
    // Create a campaign that started 5 days ago, but unregistered_reminder_days is 7
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    
    const mockCampaign = {
      id: 1,
      name: 'Test Campaign',
      status: 'active',
      start_date: pastDate.toISOString(),
      unregistered_reminder_days: 7
    };

    mockAttestationCampaignDb.getAll.mockResolvedValue([mockCampaign]);
    mockAttestationPendingInviteDb.getByCampaignId.mockResolvedValue([]);

    const result = await processUnregisteredReminders();

    expect(result.success).toBe(true);
    expect(mockSendAttestationUnregisteredReminder).not.toHaveBeenCalled();
  });

  it('should skip users who have already registered (registered_at is set)', async () => {
    // Create a campaign that started 8 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 8);
    
    const mockCampaign = {
      id: 1,
      name: 'Test Campaign',
      status: 'active',
      start_date: pastDate.toISOString(),
      unregistered_reminder_days: 7
    };

    const mockInvite = {
      id: 1,
      campaign_id: 1,
      employee_email: 'registered@test.com',
      employee_first_name: 'John',
      employee_last_name: 'Doe',
      invite_token: 'test-token-123',
      registered_at: new Date().toISOString(), // Already registered
      reminder_sent_at: null
    };

    mockAttestationCampaignDb.getAll.mockResolvedValue([mockCampaign]);
    mockAttestationPendingInviteDb.getByCampaignId.mockResolvedValue([mockInvite]);

    const result = await processUnregisteredReminders();

    expect(result.success).toBe(true);
    expect(mockSendAttestationUnregisteredReminder).not.toHaveBeenCalled();
    expect(mockAttestationPendingInviteDb.update).not.toHaveBeenCalled();
  });
});

describe('Attestation Scheduler - processUnregisteredEscalations()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should notify managers about unregistered team members', async () => {
    // Create a campaign that started 11 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 11);
    
    const mockCampaign = {
      id: 1,
      name: 'Test Campaign',
      status: 'active',
      start_date: pastDate.toISOString(),
      escalation_days: 10
    };

    const mockInvite = {
      id: 1,
      campaign_id: 1,
      employee_email: 'unregistered@test.com',
      employee_first_name: 'John',
      employee_last_name: 'Doe',
      registered_at: null,
      escalation_sent_at: null
    };

    const mockAssets = [
      {
        id: 1,
        employee_email: 'unregistered@test.com',
        manager_email: 'manager@test.com',
        manager_first_name: 'Jane',
        manager_last_name: 'Manager'
      },
      {
        id: 2,
        employee_email: 'unregistered@test.com',
        manager_email: 'manager@test.com',
        manager_first_name: 'Jane',
        manager_last_name: 'Manager'
      }
    ];

    mockAttestationCampaignDb.getAll.mockResolvedValue([mockCampaign]);
    mockAttestationPendingInviteDb.getByCampaignId.mockResolvedValue([mockInvite]);
    mockAssetDb.getByEmployee.mockResolvedValue(mockAssets);
    mockSendAttestationUnregisteredEscalation.mockResolvedValue({ success: true });

    const result = await processUnregisteredEscalations();

    expect(result.success).toBe(true);
    expect(mockSendAttestationUnregisteredEscalation).toHaveBeenCalledWith(
      'manager@test.com',
      'Jane Manager',
      'unregistered@test.com',
      'John Doe',
      mockCampaign,
      2 // asset count
    );
    expect(mockAttestationPendingInviteDb.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        escalation_sent_at: expect.any(String)
      })
    );
  });

  it('should get manager info from asset records', async () => {
    // Create a campaign that started 11 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 11);
    
    const mockCampaign = {
      id: 1,
      name: 'Test Campaign',
      status: 'active',
      start_date: pastDate.toISOString(),
      escalation_days: 10
    };

    const mockInvite = {
      id: 1,
      campaign_id: 1,
      employee_email: 'unregistered@test.com',
      employee_first_name: 'John',
      employee_last_name: 'Doe',
      registered_at: null,
      escalation_sent_at: null
    };

    const mockAssets = [
      {
        id: 1,
        employee_email: 'unregistered@test.com',
        manager_email: 'different-manager@test.com',
        manager_first_name: 'Bob',
        manager_last_name: 'Boss'
      }
    ];

    mockAttestationCampaignDb.getAll.mockResolvedValue([mockCampaign]);
    mockAttestationPendingInviteDb.getByCampaignId.mockResolvedValue([mockInvite]);
    mockAssetDb.getByEmployee.mockResolvedValue(mockAssets);
    mockSendAttestationUnregisteredEscalation.mockResolvedValue({ success: true });

    const result = await processUnregisteredEscalations();

    expect(result.success).toBe(true);
    expect(mockSendAttestationUnregisteredEscalation).toHaveBeenCalledWith(
      'different-manager@test.com',
      'Bob Boss',
      'unregistered@test.com',
      'John Doe',
      mockCampaign,
      1
    );
  });

  it('should skip invites that have already been escalated', async () => {
    // Create a campaign that started 11 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 11);
    
    const mockCampaign = {
      id: 1,
      name: 'Test Campaign',
      status: 'active',
      start_date: pastDate.toISOString(),
      escalation_days: 10
    };

    const mockInvite = {
      id: 1,
      campaign_id: 1,
      employee_email: 'unregistered@test.com',
      employee_first_name: 'John',
      employee_last_name: 'Doe',
      registered_at: null,
      escalation_sent_at: new Date().toISOString() // Already escalated
    };

    mockAttestationCampaignDb.getAll.mockResolvedValue([mockCampaign]);
    mockAttestationPendingInviteDb.getByCampaignId.mockResolvedValue([mockInvite]);

    const result = await processUnregisteredEscalations();

    expect(result.success).toBe(true);
    expect(mockSendAttestationUnregisteredEscalation).not.toHaveBeenCalled();
    expect(mockAttestationPendingInviteDb.update).not.toHaveBeenCalled();
  });

  it('should skip invites without manager email', async () => {
    // Create a campaign that started 11 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 11);
    
    const mockCampaign = {
      id: 1,
      name: 'Test Campaign',
      status: 'active',
      start_date: pastDate.toISOString(),
      escalation_days: 10
    };

    const mockInvite = {
      id: 1,
      campaign_id: 1,
      employee_email: 'unregistered@test.com',
      employee_first_name: 'John',
      employee_last_name: 'Doe',
      registered_at: null,
      escalation_sent_at: null
    };

    // Assets without manager_email
    const mockAssets = [
      {
        id: 1,
        employee_email: 'unregistered@test.com',
        manager_email: null
      }
    ];

    mockAttestationCampaignDb.getAll.mockResolvedValue([mockCampaign]);
    mockAttestationPendingInviteDb.getByCampaignId.mockResolvedValue([mockInvite]);
    mockAssetDb.getByEmployee.mockResolvedValue(mockAssets);

    const result = await processUnregisteredEscalations();

    expect(result.success).toBe(true);
    expect(mockSendAttestationUnregisteredEscalation).not.toHaveBeenCalled();
    expect(mockAttestationPendingInviteDb.update).not.toHaveBeenCalled();
  });
});

describe('Attestation Scheduler - autoCloseExpiredCampaigns()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should close campaigns past their end_date', async () => {
    // Create a campaign that ended 2 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 2);
    
    const mockCampaign = {
      id: 1,
      name: 'Expired Campaign',
      status: 'active',
      start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end_date: pastDate.toISOString()
    };

    mockAttestationCampaignDb.getAll.mockResolvedValue([mockCampaign]);
    mockAttestationCampaignDb.update.mockResolvedValue({ success: true });

    const result = await autoCloseExpiredCampaigns();

    expect(result.success).toBe(true);
    expect(mockAttestationCampaignDb.update).toHaveBeenCalledWith(
      1,
      { status: 'completed' }
    );
  });

  it('should NOT close campaigns without an end_date', async () => {
    const mockCampaign = {
      id: 1,
      name: 'Open-ended Campaign',
      status: 'active',
      start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end_date: null
    };

    mockAttestationCampaignDb.getAll.mockResolvedValue([mockCampaign]);

    const result = await autoCloseExpiredCampaigns();

    expect(result.success).toBe(true);
    expect(mockAttestationCampaignDb.update).not.toHaveBeenCalled();
  });

  it('should only affect active campaigns', async () => {
    // Create an expired campaign that is already completed
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 2);
    
    const mockCampaigns = [
      {
        id: 1,
        name: 'Already Completed Campaign',
        status: 'completed',
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: pastDate.toISOString()
      },
      {
        id: 2,
        name: 'Cancelled Campaign',
        status: 'cancelled',
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: pastDate.toISOString()
      }
    ];

    mockAttestationCampaignDb.getAll.mockResolvedValue(mockCampaigns);

    const result = await autoCloseExpiredCampaigns();

    expect(result.success).toBe(true);
    expect(mockAttestationCampaignDb.update).not.toHaveBeenCalled();
  });
});
