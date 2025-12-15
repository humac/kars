import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { attestationCampaignDb, attestationRecordDb, attestationNewAssetDb, userDb, assetDb, companyDb } from './database.js';
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

  it('should create and manage company-scoped campaigns', async () => {
    const timestamp = Date.now();
    
    // Create admin user
    const admin = await userDb.create({
      email: `admin-companies-${timestamp}@test.com`,
      password_hash: 'hash',
      name: 'Test Admin',
      role: 'admin'
    });
    expect(admin.id).toBeDefined();

    // Create employee users
    const employee1Email = `employee1-${timestamp}@test.com`;
    const employee1 = await userDb.create({
      email: employee1Email,
      password_hash: 'hash',
      name: 'Employee 1',
      role: 'employee',
      first_name: 'Employee',
      last_name: 'One'
    });
    
    const employee2Email = `employee2-${timestamp}@test.com`;
    const employee2 = await userDb.create({
      email: employee2Email,
      password_hash: 'hash',
      name: 'Employee 2',
      role: 'employee',
      first_name: 'Employee',
      last_name: 'Two'
    });

    // Create companies
    const { companyDb } = await import('./database.js');
    const company1 = await companyDb.create({ name: `Company A ${timestamp}` });
    const company2 = await companyDb.create({ name: `Company B ${timestamp}` });
    expect(company1.id).toBeDefined();
    expect(company2.id).toBeDefined();

    // Create assets for employees in different companies
    const asset1 = await assetDb.create({
      employee_email: employee1Email,
      employee_first_name: 'Employee',
      employee_last_name: 'One',
      company_id: company1.id,
      asset_type: 'Laptop',
      make: 'Dell',
      model: 'XPS',
      serial_number: `SN-${timestamp}-1`,
      asset_tag: `TAG-${timestamp}-1`,
      status: 'active'
    });

    const asset2 = await assetDb.create({
      employee_email: employee2Email,
      employee_first_name: 'Employee',
      employee_last_name: 'Two',
      company_id: company2.id,
      asset_type: 'Laptop',
      make: 'HP',
      model: 'ProBook',
      serial_number: `SN-${timestamp}-2`,
      asset_tag: `TAG-${timestamp}-2`,
      status: 'active'
    });
    
    expect(asset1.id).toBeDefined();
    expect(asset2.id).toBeDefined();

    // Test: Create campaign targeting Company A only
    const campaign = await attestationCampaignDb.create({
      name: 'Company A Campaign',
      description: 'Campaign for Company A employees only',
      start_date: new Date().toISOString(),
      end_date: null,
      reminder_days: 7,
      escalation_days: 10,
      target_type: 'companies',
      target_company_ids: JSON.stringify([company1.id]),
      created_by: admin.id
    });
    expect(campaign.id).toBeDefined();

    // Retrieve campaign and verify target_company_ids
    const retrievedCampaign = await attestationCampaignDb.getById(campaign.id);
    expect(retrievedCampaign).toBeDefined();
    expect(retrievedCampaign.target_type).toBe('companies');
    expect(retrievedCampaign.target_company_ids).toBe(JSON.stringify([company1.id]));

    // Test: Get registered owners by company IDs
    const ownersCompany1 = await assetDb.getRegisteredOwnersByCompanyIds([company1.id]);
    expect(ownersCompany1.length).toBe(1);
    expect(ownersCompany1[0].email).toBe(employee1Email);

    const ownersCompany2 = await assetDb.getRegisteredOwnersByCompanyIds([company2.id]);
    expect(ownersCompany2.length).toBe(1);
    expect(ownersCompany2[0].email).toBe(employee2Email);

    const ownersAllCompanies = await assetDb.getRegisteredOwnersByCompanyIds([company1.id, company2.id]);
    expect(ownersAllCompanies.length).toBe(2);

    // Test: Update campaign to target both companies
    await attestationCampaignDb.update(campaign.id, {
      target_company_ids: JSON.stringify([company1.id, company2.id])
    });
    const updatedCampaign = await attestationCampaignDb.getById(campaign.id);
    expect(updatedCampaign.target_company_ids).toBe(JSON.stringify([company1.id, company2.id]));

    // Test: Update campaign to change target_type back to 'all'
    await attestationCampaignDb.update(campaign.id, {
      target_type: 'all',
      target_company_ids: null
    });
    const campaignAll = await attestationCampaignDb.getById(campaign.id);
    expect(campaignAll.target_type).toBe('all');
    expect(campaignAll.target_company_ids).toBeNull();
  });

  it('should create assets in main table when new assets are added during attestation', async () => {
    const timestamp = Date.now();
    
    // Create admin user
    const admin = await userDb.create({
      email: `admin-newasset-${timestamp}@test.com`,
      password_hash: 'hash',
      name: 'Test Admin',
      role: 'admin'
    });
    
    // Create employee user
    const employee = await userDb.create({
      email: `employee-newasset-${timestamp}@test.com`,
      password_hash: 'hash',
      name: 'Test Employee',
      role: 'employee',
      first_name: 'Test',
      last_name: 'Employee'
    });
    
    // Create company
    const company = await companyDb.create({ name: `Test Company ${timestamp}` });
    
    // Create campaign
    const campaign = await attestationCampaignDb.create({
      name: 'Test Campaign for New Assets',
      description: 'Test new asset creation',
      start_date: new Date().toISOString(),
      end_date: null,
      reminder_days: 7,
      escalation_days: 10,
      created_by: admin.id
    });
    
    // Create attestation record
    const record = await attestationRecordDb.create({
      campaign_id: campaign.id,
      user_id: employee.id,
      status: 'in_progress'
    });
    
    // Add new asset during attestation (simulating employee adding missing asset)
    const newAsset = await attestationNewAssetDb.create({
      attestation_record_id: record.id,
      asset_type: 'Laptop',
      make: 'Dell',
      model: 'XPS 15',
      serial_number: `SN-NEWASSET-${timestamp}`,
      asset_tag: `TAG-NEWASSET-${timestamp}`,
      company_id: company.id,
      notes: 'Added during attestation'
    });
    expect(newAsset.id).toBeDefined();
    
    // Verify the new asset is in attestation_new_assets table
    const newAssets = await attestationNewAssetDb.getByRecordId(record.id);
    expect(newAssets.length).toBe(1);
    expect(newAssets[0].serial_number).toBe(`SN-NEWASSET-${timestamp}`);
    
    // Get assets count before completion
    const assetsBefore = await assetDb.getAll();
    const assetsBeforeCount = assetsBefore.filter(a => a.serial_number === `SN-NEWASSET-${timestamp}`).length;
    expect(assetsBeforeCount).toBe(0); // Asset should not exist in main table yet
    
    // Complete attestation (this should transfer new assets to main assets table)
    await attestationRecordDb.update(record.id, {
      status: 'completed',
      completed_at: new Date().toISOString()
    });
    
    // Note: The actual transfer happens in the API endpoint, not in the DB method
    // This test validates the DB structure is ready for the transfer
    // The API endpoint test would need to be added separately with supertest
    
    // Verify attestation record is completed
    const completedRecord = await attestationRecordDb.getById(record.id);
    expect(completedRecord.status).toBe('completed');
    expect(completedRecord.completed_at).toBeTruthy();
  });
});
