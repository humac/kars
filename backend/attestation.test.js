import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { attestationCampaignDb, attestationRecordDb, userDb, assetDb } from './database.js';
import { unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';

const TEST_DB_PATH = resolve(process.cwd(), 'data', 'test-attestation.db');

// Clean up test database
const cleanupTestDb = () => {
  if (existsSync(TEST_DB_PATH)) {
    try {
      unlinkSync(TEST_DB_PATH);
    } catch (err) {
      // Ignore errors
    }
  }
};

beforeAll(async () => {
  cleanupTestDb();
  process.env.DB_PATH = TEST_DB_PATH;
  await assetDb.init();
});

afterAll(() => {
  cleanupTestDb();
});

describe('Attestation DB Tables', () => {
  it('should create attestation tables and basic CRUD operations', async () => {
    // Use unique timestamps for email addresses
    const timestamp = Date.now();
    
    // Create admin user
    const admin = await userDb.create({
      email: `admin-${timestamp}@test.com`,
      password_hash: 'hash',
      name: 'Test Admin',
      role: 'admin'
    });
    expect(admin.id).toBeDefined();

    // Create employee user
    const employee = await userDb.create({
      email: `employee-${timestamp}@test.com`,
      password_hash: 'hash',
      name: 'Test Employee',
      role: 'employee',
      first_name: 'Test',
      last_name: 'Employee',
      manager_email: `manager-${timestamp}@test.com`
    });
    expect(employee.id).toBeDefined();

    // Create campaign
    const campaign = await attestationCampaignDb.create({
      name: 'Test Campaign',
      description: 'Test Description',
      start_date: new Date().toISOString(),
      end_date: null,
      reminder_days: 7,
      escalation_days: 10,
      created_by: admin.id
    });
    expect(campaign.id).toBeDefined();

    // Get campaign
    const retrievedCampaign = await attestationCampaignDb.getById(campaign.id);
    expect(retrievedCampaign).toBeDefined();
    expect(retrievedCampaign.name).toBe('Test Campaign');
    expect(retrievedCampaign.status).toBe('draft');

    // Update campaign
    await attestationCampaignDb.update(campaign.id, { status: 'active' });
    const updatedCampaign = await attestationCampaignDb.getById(campaign.id);
    expect(updatedCampaign.status).toBe('active');

    // Create attestation record
    const record = await attestationRecordDb.create({
      campaign_id: campaign.id,
      user_id: employee.id,
      status: 'pending'
    });
    expect(record.id).toBeDefined();

    // Get records by campaign
    const records = await attestationRecordDb.getByCampaignId(campaign.id);
    expect(records.length).toBe(1);
    expect(records[0].status).toBe('pending');

    // Update record
    await attestationRecordDb.update(record.id, {
      status: 'completed',
      completed_at: new Date().toISOString()
    });
    const updatedRecord = await attestationRecordDb.getById(record.id);
    expect(updatedRecord.status).toBe('completed');
    expect(updatedRecord.completed_at).toBeTruthy();

    // Get all campaigns
    const allCampaigns = await attestationCampaignDb.getAll();
    expect(allCampaigns.length).toBeGreaterThan(0);
  });

  it('should handle empty string end_date by converting to null', async () => {
    const timestamp = Date.now();
    
    // Create admin user
    const admin = await userDb.create({
      email: `admin-empty-date-${timestamp}@test.com`,
      password_hash: 'hash',
      name: 'Test Admin',
      role: 'admin'
    });
    
    // Create campaign with empty string end_date (mimics frontend behavior)
    const campaign = await attestationCampaignDb.create({
      name: 'Campaign with Empty End Date',
      description: 'Test empty end_date handling',
      start_date: new Date().toISOString(),
      end_date: '', // Empty string that should be converted to null
      reminder_days: 7,
      escalation_days: 10,
      created_by: admin.id
    });
    expect(campaign.id).toBeDefined();
    
    // Retrieve campaign and verify end_date is null, not empty string
    const retrievedCampaign = await attestationCampaignDb.getById(campaign.id);
    expect(retrievedCampaign).toBeDefined();
    expect(retrievedCampaign.end_date).toBeNull();
    
    // Test update with empty string end_date
    await attestationCampaignDb.update(campaign.id, { end_date: '' });
    const updatedCampaign = await attestationCampaignDb.getById(campaign.id);
    expect(updatedCampaign.end_date).toBeNull();
    
    // Test update with a valid end_date
    const validEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await attestationCampaignDb.update(campaign.id, { end_date: validEndDate });
    const campaignWithDate = await attestationCampaignDb.getById(campaign.id);
    expect(campaignWithDate.end_date).toBeTruthy();
    
    // Test update back to empty string
    await attestationCampaignDb.update(campaign.id, { end_date: '' });
    const campaignBackToNull = await attestationCampaignDb.getById(campaign.id);
    expect(campaignBackToNull.end_date).toBeNull();
  });
});
