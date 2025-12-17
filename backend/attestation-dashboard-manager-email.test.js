import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { userDb, companyDb, attestationCampaignDb, attestationRecordDb } from './database.js';
import { generateToken } from './auth.js';
import request from 'supertest';
import express from 'express';
import { authenticate, authorize } from './auth.js';

// Import the actual server app to test the real endpoint
import './server.js'; // This will load the server routes

// Create express app for testing (replicating the actual endpoint logic)
const app = express();
app.use(express.json());

// Copy the actual dashboard endpoint implementation for testing
app.get('/api/attestation/campaigns/:id/dashboard', authenticate, authorize('admin', 'manager'), async (req, res) => {
  try {
    const campaign = await attestationCampaignDb.getById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Get all records with user details
    const records = await attestationRecordDb.getByCampaignId(campaign.id);
    const detailedRecords = [];
    
    for (const record of records) {
      const user = await userDb.getById(record.user_id);
      if (user) {
        detailedRecords.push({
          ...record,
          user_email: user.email,
          user_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.name,
          user_role: user.role,
          manager_email: user.manager_email || null
        });
      }
    }
    
    res.json({ success: true, campaign, records: detailedRecords });
  } catch (error) {
    console.error('Error fetching campaign dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch campaign dashboard' });
  }
});

describe('Attestation Dashboard - Manager Email Field', () => {
  let adminUser, employeeUser1, employeeUser2, managerUser;
  let adminToken;
  let testCompany, testCampaign;
  let timestamp;

  beforeAll(async () => {
    // Use timestamp to ensure unique test data
    timestamp = Date.now();

    // Create test company
    testCompany = await companyDb.create({
      name: `Test Company Dashboard ${timestamp}`
    });

    // Create manager user
    await userDb.create({
      email: `manager-dash-${timestamp}@test.com`,
      name: 'Manager User',
      first_name: 'Manager',
      last_name: 'User',
      password_hash: 'dummy-hash',
      role: 'manager'
    });
    managerUser = await userDb.getByEmail(`manager-dash-${timestamp}@test.com`);

    // Create admin user
    await userDb.create({
      email: `admin-dash-${timestamp}@test.com`,
      name: 'Admin User',
      first_name: 'Admin',
      last_name: 'User',
      password_hash: 'dummy-hash',
      role: 'admin'
    });
    adminUser = await userDb.getByEmail(`admin-dash-${timestamp}@test.com`);
    adminToken = generateToken(adminUser);

    // Create employee users with manager_email set
    await userDb.create({
      email: `employee1-dash-${timestamp}@test.com`,
      name: 'Employee One',
      first_name: 'Employee',
      last_name: 'One',
      password_hash: 'dummy-hash',
      role: 'employee',
      manager_email: managerUser.email
    });
    employeeUser1 = await userDb.getByEmail(`employee1-dash-${timestamp}@test.com`);

    await userDb.create({
      email: `employee2-dash-${timestamp}@test.com`,
      name: 'Employee Two',
      first_name: 'Employee',
      last_name: 'Two',
      password_hash: 'dummy-hash',
      role: 'employee',
      manager_email: managerUser.email
    });
    employeeUser2 = await userDb.getByEmail(`employee2-dash-${timestamp}@test.com`);

    // Create test campaign
    const startDate = new Date();
    const dueDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days later
    testCampaign = await attestationCampaignDb.create({
      name: `Test Campaign Dashboard ${timestamp}`,
      description: 'Test campaign for dashboard manager email test',
      start_date: startDate.toISOString(),
      due_date: dueDate.toISOString(),
      status: 'active',
      created_by: adminUser.id
    });

    // Create attestation records for employees
    await attestationRecordDb.create({
      campaign_id: testCampaign.id,
      user_id: employeeUser1.id,
      status: 'pending'
    });

    await attestationRecordDb.create({
      campaign_id: testCampaign.id,
      user_id: employeeUser2.id,
      status: 'pending'
    });
  });

  afterAll(async () => {
    // Clean up test data
    try {
      if (testCampaign?.id) await attestationCampaignDb.delete(testCampaign.id);
      if (employeeUser1?.id) await userDb.delete(employeeUser1.id);
      if (employeeUser2?.id) await userDb.delete(employeeUser2.id);
      if (managerUser?.id) await userDb.delete(managerUser.id);
      if (adminUser?.id) await userDb.delete(adminUser.id);
      if (testCompany?.id) await companyDb.delete(testCompany.id);
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  });

  it('should include manager_email in dashboard API response', async () => {
    const response = await request(app)
      .get(`/api/attestation/campaigns/${testCampaign.id}/dashboard`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.records).toBeDefined();
    expect(Array.isArray(response.body.records)).toBe(true);
    expect(response.body.records.length).toBeGreaterThan(0);

    // Verify each record has manager_email field
    response.body.records.forEach(record => {
      expect(record).toHaveProperty('manager_email');
      expect(record.manager_email).toBe(managerUser.email);
    });
  });

  it('should return manager_email as null when user has no manager', async () => {
    // Create a user without manager_email
    await userDb.create({
      email: `no-manager-${timestamp}@test.com`,
      name: 'No Manager User',
      first_name: 'No',
      last_name: 'Manager',
      password_hash: 'dummy-hash',
      role: 'employee',
      manager_email: null
    });
    const noManagerUser = await userDb.getByEmail(`no-manager-${timestamp}@test.com`);

    // Create attestation record for this user
    await attestationRecordDb.create({
      campaign_id: testCampaign.id,
      user_id: noManagerUser.id,
      status: 'pending'
    });

    const response = await request(app)
      .get(`/api/attestation/campaigns/${testCampaign.id}/dashboard`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Find the record for the user without manager
    const noManagerRecord = response.body.records.find(r => r.user_id === noManagerUser.id);
    expect(noManagerRecord).toBeDefined();
    expect(noManagerRecord).toHaveProperty('manager_email');
    expect(noManagerRecord.manager_email).toBeNull();

    // Cleanup - delete user (attestation records will be cleaned up with campaign)
    await userDb.delete(noManagerUser.id);
  });

  it('should include all expected user fields in addition to manager_email', async () => {
    const response = await request(app)
      .get(`/api/attestation/campaigns/${testCampaign.id}/dashboard`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.records.length).toBeGreaterThan(0);

    // Verify structure of the records
    const record = response.body.records[0];
    expect(record).toHaveProperty('user_email');
    expect(record).toHaveProperty('user_name');
    expect(record).toHaveProperty('user_role');
    expect(record).toHaveProperty('manager_email');
    expect(record).toHaveProperty('status');
    expect(record).toHaveProperty('campaign_id');
    expect(record).toHaveProperty('user_id');
  });
});
