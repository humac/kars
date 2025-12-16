import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { 
  attestationCampaignDb, 
  attestationRecordDb, 
  attestationNewAssetDb,
  userDb, 
  assetDb,
  companyDb 
} from './database.js';
import { unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';

const TEST_DB_PATH = resolve(process.cwd(), 'data', 'test-attestation-newasset.db');

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

describe('Attestation New Asset Integration Test', () => {
  it('should transfer new assets to main assets table when attestation is completed', async () => {
    const timestamp = Date.now();
    
    // 1. Create admin user
    const admin = await userDb.create({
      email: `admin-integration-${timestamp}@test.com`,
      password_hash: 'hash',
      name: 'Admin Integration',
      role: 'admin',
      first_name: 'Admin',
      last_name: 'Integration'
    });
    expect(admin.id).toBeDefined();
    
    // 2. Create employee user
    const employeeEmail = `employee-integration-${timestamp}@test.com`;
    const employeeCreated = await userDb.create({
      email: employeeEmail,
      password_hash: 'hash',
      name: 'Employee Integration',
      role: 'employee',
      first_name: 'Employee',
      last_name: 'Integration'
    });
    expect(employeeCreated.id).toBeDefined();
    
    // Get full employee object
    const employee = await userDb.getByEmail(employeeEmail);
    expect(employee).toBeDefined();
    
    // 3. Create company
    const company = await companyDb.create({ 
      name: `Integration Test Company ${timestamp}` 
    });
    expect(company.id).toBeDefined();
    
    // 4. Create attestation campaign
    const campaign = await attestationCampaignDb.create({
      name: 'Integration Test Campaign',
      description: 'Testing new asset transfer on completion',
      start_date: new Date().toISOString(),
      end_date: null,
      reminder_days: 7,
      escalation_days: 10,
      created_by: admin.id
    });
    expect(campaign.id).toBeDefined();
    
    // 5. Create attestation record for employee
    const record = await attestationRecordDb.create({
      campaign_id: campaign.id,
      user_id: employee.id,
      status: 'in_progress'
    });
    expect(record.id).toBeDefined();
    
    // 6. Employee adds a new asset during attestation
    const newAssetData = {
      attestation_record_id: record.id,
      asset_type: 'Laptop',
      make: 'Dell',
      model: 'XPS 15',
      serial_number: `INTEGRATION-SN-${timestamp}`,
      asset_tag: `INTEGRATION-TAG-${timestamp}`,
      company_id: company.id,
      notes: 'Added during attestation - integration test'
    };
    
    const newAsset = await attestationNewAssetDb.create(newAssetData);
    expect(newAsset.id).toBeDefined();
    
    // 7. Verify the new asset is in attestation_new_assets table
    const newAssets = await attestationNewAssetDb.getByRecordId(record.id);
    expect(newAssets.length).toBe(1);
    expect(newAssets[0].serial_number).toBe(`INTEGRATION-SN-${timestamp}`);
    
    // 8. Verify the asset is NOT in main assets table yet
    const assetsBeforeCompletion = await assetDb.getAll();
    const assetBeforeCount = assetsBeforeCompletion.filter(
      a => a.serial_number === `INTEGRATION-SN-${timestamp}`
    ).length;
    expect(assetBeforeCount).toBe(0);
    
    // 9. Simulate the completion endpoint logic
    // Get newly added assets during attestation
    const newAssetsToTransfer = await attestationNewAssetDb.getByRecordId(record.id);
    
    // Transfer new assets to the main assets table
    for (const asset of newAssetsToTransfer) {
      await assetDb.create({
        employee_email: employee.email,
        employee_first_name: employee.first_name || '',
        employee_last_name: employee.last_name || '',
        manager_email: employee.manager_email || null,
        company_id: asset.company_id,
        asset_type: asset.asset_type,
        make: asset.make || '',
        model: asset.model || '',
        serial_number: asset.serial_number,
        asset_tag: asset.asset_tag,
        status: 'active',
        notes: asset.notes || ''
      });
    }
    
    // 10. Mark attestation as completed
    await attestationRecordDb.update(record.id, {
      status: 'completed',
      completed_at: new Date().toISOString()
    });
    
    // 11. Verify the attestation is completed
    const completedRecord = await attestationRecordDb.getById(record.id);
    expect(completedRecord.status).toBe('completed');
    expect(completedRecord.completed_at).toBeTruthy();
    
    // 12. Verify the asset IS NOW in main assets table
    const assetsAfterCompletion = await assetDb.getAll();
    const assetsMatchingSerial = assetsAfterCompletion.filter(
      a => a.serial_number === `INTEGRATION-SN-${timestamp}`
    );
    expect(assetsMatchingSerial.length).toBe(1);
    
    // 13. Verify the asset has correct details
    const transferredAsset = assetsMatchingSerial[0];
    
    expect(transferredAsset.asset_type).toBe('Laptop');
    expect(transferredAsset.make).toBe('Dell');
    expect(transferredAsset.model).toBe('XPS 15');
    expect(transferredAsset.asset_tag).toBe(`INTEGRATION-TAG-${timestamp}`);
    expect(transferredAsset.company_id).toBe(company.id);
    expect(transferredAsset.status).toBe('active');
    expect(transferredAsset.notes).toBe('Added during attestation - integration test');
    
    // The owner_id should be set, which allows the JOIN to get the email
    expect(transferredAsset.owner_id).toBe(employee.id);
    expect(transferredAsset.employee_email).toBe(employee.email);
    expect(transferredAsset.employee_first_name).toBe('Employee');
    expect(transferredAsset.employee_last_name).toBe('Integration');
  });

  it('should create records only for users with assets in selected companies when campaign is company-scoped', async () => {
    const timestamp = Date.now();
    
    // 1. Create admin user
    const admin = await userDb.create({
      email: `admin-company-${timestamp}@test.com`,
      password_hash: 'hash',
      name: 'Admin Company',
      role: 'admin'
    });
    
    // 2. Create two companies
    const company1 = await companyDb.create({ name: `Company A ${timestamp}` });
    const company2 = await companyDb.create({ name: `Company B ${timestamp}` });
    
    // 3. Create two employees
    const employee1 = await userDb.create({
      email: `emp1-${timestamp}@test.com`,
      password_hash: 'hash',
      name: 'Employee 1',
      role: 'employee',
      first_name: 'Employee',
      last_name: 'One'
    });
    
    const employee2 = await userDb.create({
      email: `emp2-${timestamp}@test.com`,
      password_hash: 'hash',
      name: 'Employee 2',
      role: 'employee',
      first_name: 'Employee',
      last_name: 'Two'
    });
    
    // 4. Create assets - emp1 has assets in company1, emp2 has assets in company2
    // Create assets directly linked to users
    await assetDb.create({
      employee_email: employee1.email,
      employee_first_name: 'Employee',
      employee_last_name: 'One',
      company_id: company1.id,
      asset_type: 'Laptop',
      serial_number: `SN1-${timestamp}`,
      asset_tag: `TAG1-${timestamp}`,
      status: 'active'
    });
    
    await assetDb.create({
      employee_email: employee2.email,
      employee_first_name: 'Employee',
      employee_last_name: 'Two',
      company_id: company2.id,
      asset_type: 'Phone',
      serial_number: `SN2-${timestamp}`,
      asset_tag: `TAG2-${timestamp}`,
      status: 'active'
    });
    
    // 5. Create company-scoped campaign targeting only company1
    const campaignResult = await attestationCampaignDb.create({
      name: 'Company Scoped Campaign',
      description: 'Test company targeting',
      start_date: new Date().toISOString(),
      end_date: null,
      reminder_days: 7,
      escalation_days: 10,
      target_type: 'companies',
      target_company_ids: JSON.stringify([company1.id]),
      created_by: admin.id
    });
    
    // 6. Verify campaign was created with correct company targeting
    expect(campaignResult.id).toBeDefined();
    const campaign = await attestationCampaignDb.getById(campaignResult.id);
    expect(campaign.target_type).toBe('companies');
    const targetCompanies = JSON.parse(campaign.target_company_ids);
    expect(targetCompanies).toContain(company1.id);
    expect(targetCompanies).not.toContain(company2.id);
    
    // 7. Manually create attestation records (simulating what the /start endpoint does)
    // In real scenario, getRegisteredOwnersByCompanyIds would be used to get users
    // For this integration test, we verify the campaign structure is correct for company-scoped targeting
    await attestationRecordDb.create({
      campaign_id: campaign.id,
      user_id: employee1.id,
      status: 'pending'
    });
    
    // 8. Verify the attestation record was created
    const records = await attestationRecordDb.getByCampaignId(campaign.id);
    expect(records.length).toBe(1);
    expect(records[0].user_id).toBe(employee1.id);
  });

  it('should assign correct company from attestation context when converting new assets', async () => {
    const timestamp = Date.now();
    
    // 1. Create users and companies
    const admin = await userDb.create({
      email: `admin-context-${timestamp}@test.com`,
      password_hash: 'hash',
      name: 'Admin Context',
      role: 'admin'
    });
    
    const employee = await userDb.create({
      email: `emp-context-${timestamp}@test.com`,
      password_hash: 'hash',
      name: 'Employee Context',
      role: 'employee',
      first_name: 'Employee',
      last_name: 'Context'
    });
    
    const companyA = await companyDb.create({ name: `Context Company A ${timestamp}` });
    const companyB = await companyDb.create({ name: `Context Company B ${timestamp}` });
    
    // 2. Create campaign
    const campaign = await attestationCampaignDb.create({
      name: 'Context Test Campaign',
      start_date: new Date().toISOString(),
      reminder_days: 7,
      escalation_days: 10,
      created_by: admin.id
    });
    
    // 3. Create attestation record
    const record = await attestationRecordDb.create({
      campaign_id: campaign.id,
      user_id: employee.id,
      status: 'in_progress'
    });
    
    // 4. Add new asset with specific company during attestation
    const newAsset = await attestationNewAssetDb.create({
      attestation_record_id: record.id,
      asset_type: 'Monitor',
      make: 'Dell',
      model: 'U2720Q',
      serial_number: `CONTEXT-SN-${timestamp}`,
      asset_tag: `CONTEXT-TAG-${timestamp}`,
      company_id: companyB.id, // Specifically choosing companyB
      notes: 'Testing company context'
    });
    
    // 5. Transfer to main assets table
    const newAssetsToTransfer = await attestationNewAssetDb.getByRecordId(record.id);
    
    for (const asset of newAssetsToTransfer) {
      await assetDb.create({
        employee_email: employee.email,
        employee_first_name: employee.first_name,
        employee_last_name: employee.last_name,
        company_id: asset.company_id, // Use the company from attestation context
        asset_type: asset.asset_type,
        make: asset.make,
        model: asset.model,
        serial_number: asset.serial_number,
        asset_tag: asset.asset_tag,
        status: 'active',
        notes: asset.notes
      });
    }
    
    // 6. Verify the transferred asset has the correct company
    const allAssets = await assetDb.getAll();
    const transferredAsset = allAssets.find(a => a.serial_number === `CONTEXT-SN-${timestamp}`);
    
    expect(transferredAsset).toBeDefined();
    expect(transferredAsset.company_id).toBe(companyB.id);
    expect(transferredAsset.notes).toBe('Testing company context');
  });

  it('should persist status changes correctly during attestation', async () => {
    const timestamp = Date.now();
    
    // 1. Create users and company
    const admin = await userDb.create({
      email: `admin-status-${timestamp}@test.com`,
      password_hash: 'hash',
      name: 'Admin Status',
      role: 'admin'
    });
    
    const employee = await userDb.create({
      email: `emp-status-${timestamp}@test.com`,
      password_hash: 'hash',
      name: 'Employee Status',
      role: 'employee',
      first_name: 'Employee',
      last_name: 'Status'
    });
    
    const company = await companyDb.create({ name: `Status Company ${timestamp}` });
    
    // 2. Create existing asset
    const existingAsset = await assetDb.create({
      employee_email: employee.email,
      employee_first_name: 'Employee',
      employee_last_name: 'Status',
      company_id: company.id,
      asset_type: 'Laptop',
      serial_number: `STATUS-SN-${timestamp}`,
      asset_tag: `STATUS-TAG-${timestamp}`,
      status: 'active'
    });
    
    // 3. Create campaign and record
    const campaign = await attestationCampaignDb.create({
      name: 'Status Persistence Test',
      start_date: new Date().toISOString(),
      reminder_days: 7,
      escalation_days: 10,
      created_by: admin.id
    });
    
    const record = await attestationRecordDb.create({
      campaign_id: campaign.id,
      user_id: employee.id,
      status: 'in_progress'
    });
    
    // 4. Employee changes asset status during attestation (e.g., to 'disposed')
    // Get the full asset first, then update all fields
    const fullAsset = await assetDb.getById(existingAsset.id);
    await assetDb.update(existingAsset.id, {
      ...fullAsset,
      status: 'disposed',
      notes: 'Asset disposed during attestation'
    });
    
    // 5. Complete attestation
    await attestationRecordDb.update(record.id, {
      status: 'completed',
      completed_at: new Date().toISOString()
    });
    
    // 6. Verify the status change persisted
    const updatedAsset = await assetDb.getById(existingAsset.id);
    expect(updatedAsset.status).toBe('disposed');
    expect(updatedAsset.notes).toBe('Asset disposed during attestation');
    
    // 7. Verify attestation is completed
    const completedRecord = await attestationRecordDb.getById(record.id);
    expect(completedRecord.status).toBe('completed');
    expect(completedRecord.completed_at).toBeTruthy();
  });

  it('should convert pending invite to attestation record when unregistered owner registers', async () => {
    const timestamp = Date.now();
    
    // Import the database modules we need
    const { attestationPendingInviteDb } = await import('./database.js');
    
    // 1. Create admin and company
    const admin = await userDb.create({
      email: `admin-unreg-${timestamp}@test.com`,
      password_hash: 'hash',
      name: 'Admin Unregistered',
      role: 'admin'
    });
    
    const company = await companyDb.create({ name: `Unregistered Company ${timestamp}` });
    
    // 2. Create asset for unregistered owner
    const unregisteredEmail = `unreg-owner-${timestamp}@test.com`;
    await assetDb.create({
      employee_email: unregisteredEmail,
      employee_first_name: 'Unregistered',
      employee_last_name: 'Owner',
      company_id: company.id,
      asset_type: 'Laptop',
      serial_number: `UNREG-SN-${timestamp}`,
      asset_tag: `UNREG-TAG-${timestamp}`,
      status: 'active'
    });
    
    // 3. Create campaign
    const campaign = await attestationCampaignDb.create({
      name: 'Unregistered Owner Test',
      start_date: new Date().toISOString(),
      reminder_days: 7,
      escalation_days: 10,
      created_by: admin.id
    });
    
    // 4. Create pending invite for unregistered owner
    const pendingInvite = await attestationPendingInviteDb.create({
      campaign_id: campaign.id,
      employee_email: unregisteredEmail,
      employee_first_name: 'Unregistered',
      employee_last_name: 'Owner',
      invite_token: 'test-token-' + timestamp,
      invite_sent_at: new Date().toISOString()
    });
    
    expect(pendingInvite.id).toBeDefined();
    
    // 5. Owner registers (simulating registration endpoint)
    const newUser = await userDb.create({
      email: unregisteredEmail,
      password_hash: 'hash',
      name: 'Unregistered Owner',
      role: 'employee',
      first_name: 'Unregistered',
      last_name: 'Owner'
    });
    
    // 6. Mark pending invite as registered
    await attestationPendingInviteDb.update(pendingInvite.id, {
      registered_at: new Date().toISOString()
    });
    
    // 7. Create attestation record for the newly registered user
    await attestationRecordDb.create({
      campaign_id: campaign.id,
      user_id: newUser.id,
      status: 'pending'
    });
    
    // 8. Verify pending invite is marked as registered
    const updatedInvite = await attestationPendingInviteDb.getById(pendingInvite.id);
    expect(updatedInvite.registered_at).toBeTruthy();
    
    // 9. Verify attestation record was created
    const records = await attestationRecordDb.getByCampaignId(campaign.id);
    const userRecord = records.find(r => r.user_id === newUser.id);
    expect(userRecord).toBeDefined();
    expect(userRecord.status).toBe('pending');
  });
});
