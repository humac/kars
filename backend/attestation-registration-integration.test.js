import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { userDb, companyDb, assetDb, attestationCampaignDb, attestationRecordDb, attestationPendingInviteDb, syncAssetOwnership } from './database.js';
import { hashPassword, generateToken } from './auth.js';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Create test Express app that replicates the registration endpoint with pending invite conversion
const app = express();
app.use(cors());
app.use(express.json());

// Rate limiter matching the actual implementation
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skipFailedRequests: true,
  keyGenerator: () => 'test'
});

// Registration endpoint that matches the updated routes/auth.js implementation
app.post('/api/auth/register', authRateLimiter, async (req, res) => {
  try {
    let { email, password, first_name, last_name, manager_first_name, manager_last_name, manager_email } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'Both first_name and last_name are required' });
    }

    if (!manager_first_name || !manager_last_name || !manager_email) {
      return res.status(400).json({ error: 'Manager information is required' });
    }

    // Check if user already exists
    const existingUser = await userDb.getByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user
    const result = await userDb.create({
      email,
      password_hash,
      name: `${first_name} ${last_name}`,
      first_name,
      last_name,
      manager_first_name,
      manager_last_name,
      manager_email,
      role: 'employee'
    });

    const newUser = await userDb.getById(result.id);

    // Sync asset ownership
    await syncAssetOwnership(newUser.email);

    // Update manager info on assets
    await assetDb.updateManagerForEmployee(
      newUser.email,
      manager_first_name,
      manager_last_name,
      manager_email
    );

    // Generate JWT token
    const token = generateToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role
    });

    // Check for pending attestation invites and convert them
    let hasActiveAttestation = false;
    try {
      const pendingInvites = await attestationPendingInviteDb.getActiveByEmail(newUser.email);
      for (const invite of pendingInvites) {
        // Only convert if campaign is still active
        const campaign = await attestationCampaignDb.getById(invite.campaign_id);
        if (campaign && campaign.status === 'active') {
          // Create attestation record
          const record = await attestationRecordDb.create({
            campaign_id: invite.campaign_id,
            user_id: newUser.id,
            status: 'pending'
          });

          // Update invite
          await attestationPendingInviteDb.update(invite.id, {
            registered_at: new Date().toISOString(),
            converted_record_id: record.id
          });

          hasActiveAttestation = true;
        }
      }
    } catch (inviteError) {
      console.error('Error converting pending attestation invites during registration:', inviteError);
    }

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        role: newUser.role,
        manager_first_name: newUser.manager_first_name,
        manager_last_name: newUser.manager_last_name,
        manager_email: newUser.manager_email
      },
      redirectToAttestations: hasActiveAttestation
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Integration test for pending invite conversion during registration
describe('Attestation - Registration Pending Invite Conversion', () => {
  let testCompany, adminUser, testCampaign, pendingInvite;
  let timestamp;

  beforeAll(async () => {
    timestamp = Date.now();

    // Create test company
    testCompany = await companyDb.create({
      name: `Test Company Reg ${timestamp}`
    });

    // Create admin user (needed for campaign creation)
    await userDb.create({
      email: `admin-reg-${timestamp}@test.com`,
      name: 'Admin User',
      first_name: 'Admin',
      last_name: 'User',
      password_hash: '$2b$10$hashhashhashhashhashhashhashhash',
      role: 'admin'
    });
    adminUser = await userDb.getByEmail(`admin-reg-${timestamp}@test.com`);

    // Create asset for unregistered owner
    const unregisteredEmail = `newuser-${timestamp}@test.com`;
    await assetDb.create({
      employee_email: unregisteredEmail,
      employee_first_name: 'New',
      employee_last_name: 'User',
      company_id: testCompany.id,
      asset_type: 'Laptop',
      serial_number: `REG-SN-${timestamp}`,
      asset_tag: `REG-TAG-${timestamp}`,
      status: 'active'
    });

    // Create campaign with active status
    testCampaign = await attestationCampaignDb.create({
      name: `Test Campaign Reg ${timestamp}`,
      description: 'Test campaign for registration integration test',
      start_date: new Date().toISOString(),
      status: 'active',
      reminder_days: 7,
      escalation_days: 10,
      created_by: adminUser.id
    });
    await attestationCampaignDb.update(testCampaign.id, { status: 'active' });

    // Create pending invite for unregistered owner
    pendingInvite = await attestationPendingInviteDb.create({
      campaign_id: testCampaign.id,
      employee_email: unregisteredEmail,
      employee_first_name: 'New',
      employee_last_name: 'User',
      invite_token: `test-token-${timestamp}`,
      invite_sent_at: new Date().toISOString()
    });
  });

  afterAll(async () => {
    // Clean up test data
    try {
      const newUser = await userDb.getByEmail(`newuser-${timestamp}@test.com`);
      if (newUser) {
        await userDb.delete(newUser.id);
      }
      const noInviteUser = await userDb.getByEmail(`noninvite-${timestamp}@test.com`);
      if (noInviteUser) {
        await userDb.delete(noInviteUser.id);
      }
      if (testCampaign?.id) await attestationCampaignDb.delete(testCampaign.id);
      if (adminUser?.id) await userDb.delete(adminUser.id);
      if (testCompany?.id) await companyDb.delete(testCompany.id);
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  });

  it('should convert pending invite to attestation record when unregistered owner registers via API', async () => {
    const unregisteredEmail = `newuser-${timestamp}@test.com`;

    // Verify pending invite exists and is not registered
    const inviteBefore = await attestationPendingInviteDb.getActiveByEmail(unregisteredEmail);
    expect(inviteBefore.length).toBe(1);
    expect(inviteBefore[0].registered_at).toBeNull();

    // Register the user via API
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: unregisteredEmail,
        password: 'Test123!',
        first_name: 'New',
        last_name: 'User',
        manager_first_name: 'Manager',
        manager_last_name: 'Person',
        manager_email: 'manager@test.com'
      });

    expect(response.status).toBe(201);
    expect(response.body.token).toBeDefined();
    expect(response.body.redirectToAttestations).toBe(true);

    // Verify pending invite is now marked as registered
    const inviteAfter = await attestationPendingInviteDb.getActiveByEmail(unregisteredEmail);
    expect(inviteAfter.length).toBe(0); // No more active invites (registered_at is set)

    // Verify attestation record was created for the user
    const newUser = await userDb.getByEmail(unregisteredEmail);
    expect(newUser).toBeDefined();

    const records = await attestationRecordDb.getByUserId(newUser.id);
    expect(records.length).toBe(1);
    expect(records[0].campaign_id).toBe(testCampaign.id);
    expect(records[0].status).toBe('pending');
  });

  it('should not set redirectToAttestations if no pending invites exist', async () => {
    const emailWithNoInvite = `noninvite-${timestamp}@test.com`;

    // Register a user without any pending invite
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: emailWithNoInvite,
        password: 'Test123!',
        first_name: 'No',
        last_name: 'Invite',
        manager_first_name: 'Manager',
        manager_last_name: 'Person',
        manager_email: 'manager@test.com'
      });

    expect(response.status).toBe(201);
    expect(response.body.redirectToAttestations).toBe(false);
  });

  it('should not create attestation record if campaign is not active', async () => {
    const timestamp2 = Date.now() + 1;
    const inactiveEmail = `inactive-${timestamp2}@test.com`;

    // Create a draft campaign
    const draftCampaign = await attestationCampaignDb.create({
      name: `Draft Campaign ${timestamp2}`,
      description: 'Draft campaign for test',
      start_date: new Date().toISOString(),
      status: 'draft',
      reminder_days: 7,
      escalation_days: 10,
      created_by: adminUser.id
    });

    // Create pending invite for the draft campaign
    await attestationPendingInviteDb.create({
      campaign_id: draftCampaign.id,
      employee_email: inactiveEmail,
      employee_first_name: 'Inactive',
      employee_last_name: 'User',
      invite_token: `draft-token-${timestamp2}`,
      invite_sent_at: new Date().toISOString()
    });

    // Register the user
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: inactiveEmail,
        password: 'Test123!',
        first_name: 'Inactive',
        last_name: 'User',
        manager_first_name: 'Manager',
        manager_last_name: 'Person',
        manager_email: 'manager@test.com'
      });

    expect(response.status).toBe(201);
    expect(response.body.redirectToAttestations).toBe(false);

    // Verify no attestation record was created
    const newUser = await userDb.getByEmail(inactiveEmail);
    const records = await attestationRecordDb.getByUserId(newUser.id);
    expect(records.length).toBe(0);

    // Clean up
    await userDb.delete(newUser.id);
    await attestationCampaignDb.delete(draftCampaign.id);
  });
});
