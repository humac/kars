/**
 * Attestation Workflow Routes
 * Handles: campaigns, records, assets, invites, reminders, escalations
 */

import { Router } from 'express';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger({ module: 'attestation' });

/**
 * Helper to get user display name
 */
const getUserDisplayName = (user) => {
  return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.name || user.email;
};

/**
 * Sanitize text for log entries
 */
const sanitizeForLog = (text, maxLength = 500) => {
  if (!text) return '';
  return text.replace(/[\r\n]/g, ' ').substring(0, maxLength);
};

/**
 * Create and configure the attestation router
 * @param {Object} deps - Dependencies
 */
export default function createAttestationRouter(deps) {
  const router = Router();

  const {
    // Database
    attestationCampaignDb,
    attestationRecordDb,
    attestationAssetDb,
    attestationNewAssetDb,
    attestationPendingInviteDb,
    userDb,
    assetDb,
    companyDb,
    auditDb,
    oidcSettingsDb,
    // Auth middleware
    authenticate,
    authorize,
    // Helpers
    sanitizeDateValue,
  } = deps;

  // ===== Campaign Management =====

  // Create new attestation campaign
  router.post('/campaigns', authenticate, authorize('admin', 'attestation_coordinator'), async (req, res) => {
    try {
      const { name, description, start_date, end_date, reminder_days, escalation_days, target_type, target_user_ids, target_company_ids } = req.body;

      if (!name || !start_date) {
        return res.status(400).json({ error: 'Campaign name and start date are required' });
      }

      // Validate target_type
      if (target_type && !['all', 'selected', 'companies'].includes(target_type)) {
        return res.status(400).json({ error: 'Invalid target_type. Must be "all", "selected", or "companies"' });
      }

      // Validate target_user_ids if target_type is 'selected'
      if (target_type === 'selected' && (!target_user_ids || !Array.isArray(target_user_ids) || target_user_ids.length === 0)) {
        return res.status(400).json({ error: 'target_user_ids is required when target_type is "selected"' });
      }

      // Validate target_company_ids if target_type is 'companies'
      if (target_type === 'companies' && (!target_company_ids || !Array.isArray(target_company_ids) || target_company_ids.length === 0)) {
        return res.status(400).json({ error: 'target_company_ids is required when target_type is "companies"' });
      }

      const campaign = {
        name,
        description,
        start_date,
        end_date: sanitizeDateValue(end_date),
        status: 'draft',
        reminder_days: reminder_days || 7,
        escalation_days: escalation_days || 10,
        target_type: target_type || 'all',
        target_user_ids: target_type === 'selected' ? JSON.stringify(target_user_ids) : null,
        target_company_ids: target_type === 'companies' ? JSON.stringify(target_company_ids) : null,
        created_by: req.user.id
      };

      const result = await attestationCampaignDb.create(campaign);

      let targetingInfo = campaign.target_type;
      if (target_type === 'selected') {
        targetingInfo += `, ${target_user_ids.length} users`;
      } else if (target_type === 'companies') {
        targetingInfo += `, ${target_company_ids.length} companies`;
      }

      await auditDb.log(
        'create',
        'attestation_campaign',
        result.id,
        name,
        `Created attestation campaign: ${name} (targeting: ${targetingInfo})`,
        req.user.email
      );

      res.json({ success: true, campaignId: result.id });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error creating attestation campaign');
      res.status(500).json({ error: 'Failed to create attestation campaign' });
    }
  });

  // Get all attestation campaigns
  router.get('/campaigns', authenticate, authorize('admin', 'attestation_coordinator', 'manager'), async (req, res) => {
    try {
      const campaigns = await attestationCampaignDb.getAll();

      // Add pending invites count to each campaign
      for (const campaign of campaigns) {
        const pendingInvites = await attestationPendingInviteDb.getByCampaignId(campaign.id);
        const unresolvedInvites = pendingInvites.filter(inv => !inv.registered_at);
        campaign.pending_invites_count = unresolvedInvites.length;
      }

      res.json({ success: true, campaigns });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error fetching attestation campaigns');
      res.status(500).json({ error: 'Failed to fetch attestation campaigns' });
    }
  });

  // Get specific campaign details with stats
  router.get('/campaigns/:id', authenticate, authorize('admin', 'attestation_coordinator', 'manager'), async (req, res) => {
    try {
      const campaign = await attestationCampaignDb.getById(req.params.id);

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      // Get all records for this campaign
      const records = await attestationRecordDb.getByCampaignId(campaign.id);

      // Calculate stats
      const stats = {
        total: records.length,
        completed: records.filter(r => r.status === 'completed').length,
        in_progress: records.filter(r => r.status === 'in_progress').length,
        pending: records.filter(r => r.status === 'pending').length,
        reminders_sent: records.filter(r => r.reminder_sent_at).length,
        escalations_sent: records.filter(r => r.escalation_sent_at).length
      };

      res.json({ success: true, campaign, stats });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error fetching campaign details');
      res.status(500).json({ error: 'Failed to fetch campaign details' });
    }
  });

  // Update campaign
  router.put('/campaigns/:id', authenticate, authorize('admin', 'attestation_coordinator'), async (req, res) => {
    try {
      const { name, description, start_date, end_date, reminder_days, escalation_days, status, target_type, target_user_ids, target_company_ids } = req.body;

      const updates = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (start_date !== undefined) updates.start_date = start_date;
      if (end_date !== undefined) updates.end_date = sanitizeDateValue(end_date);
      if (reminder_days !== undefined) updates.reminder_days = reminder_days;
      if (escalation_days !== undefined) updates.escalation_days = escalation_days;
      if (status !== undefined) updates.status = status;
      if (target_type !== undefined) updates.target_type = target_type;
      if (target_user_ids !== undefined) {
        updates.target_user_ids = target_user_ids && Array.isArray(target_user_ids) ? JSON.stringify(target_user_ids) : null;
      }
      if (target_company_ids !== undefined) {
        updates.target_company_ids = target_company_ids && Array.isArray(target_company_ids) ? JSON.stringify(target_company_ids) : null;
      }

      await attestationCampaignDb.update(req.params.id, updates);

      const updatedCampaign = await attestationCampaignDb.getById(req.params.id);
      await auditDb.log(
        'update',
        'attestation_campaign',
        req.params.id,
        updatedCampaign?.name || 'Unknown',
        `Updated attestation campaign`,
        req.user.email
      );

      res.json({ success: true });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error updating campaign');
      res.status(500).json({ error: 'Failed to update campaign' });
    }
  });

  // Start campaign - creates records for all employees and sends emails
  router.post('/campaigns/:id/start', authenticate, authorize('admin', 'attestation_coordinator'), async (req, res) => {
    try {
      const campaign = await attestationCampaignDb.getById(req.params.id);

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      if (campaign.status !== 'draft') {
        return res.status(400).json({ error: 'Campaign has already been started' });
      }

      // Get users based on targeting
      let users = [];
      let unregisteredOwners = [];

      if (campaign.target_type === 'companies' && campaign.target_company_ids) {
        try {
          const companyIds = JSON.parse(campaign.target_company_ids);

          // Validate that company IDs exist
          const companies = await companyDb.getAll();
          const validCompanyIds = companyIds.filter(id => companies.some(c => c.id === id));

          if (validCompanyIds.length === 0) {
            return res.status(400).json({ error: 'No valid companies found for the selected company IDs' });
          }

          // Get registered owners by company IDs
          users = await assetDb.getRegisteredOwnersByCompanyIds(validCompanyIds);

          // Get unregistered owners by company IDs
          unregisteredOwners = await assetDb.getUnregisteredOwnersByCompanyIds(validCompanyIds);

          if (users.length === 0 && unregisteredOwners.length === 0) {
            return res.status(400).json({ error: 'No asset owners found in the selected companies' });
          }
        } catch (parseError) {
          logger.error({ err: parseError, userId: req.user?.id }, 'Error parsing target_company_ids');
          return res.status(500).json({ error: 'Invalid target company IDs format' });
        }
      } else if (campaign.target_type === 'selected' && campaign.target_user_ids) {
        try {
          const targetIds = JSON.parse(campaign.target_user_ids);
          const allUsers = await userDb.getAll();
          users = allUsers.filter(u => targetIds.includes(u.id));
        } catch (parseError) {
          logger.error({ err: parseError, userId: req.user?.id }, 'Error parsing target_user_ids');
          return res.status(500).json({ error: 'Invalid target user IDs format' });
        }
      } else {
        users = await userDb.getAll();
        unregisteredOwners = await assetDb.getUnregisteredOwners();
      }

      // Create attestation records for registered users
      let recordsCreated = 0;
      let emailsSent = 0;

      for (const user of users) {
        await attestationRecordDb.create({
          campaign_id: campaign.id,
          user_id: user.id,
          status: 'pending'
        });
        recordsCreated++;

        // Send email notification
        if (user.email) {
          try {
            const { sendAttestationLaunchEmail } = await import('../services/smtpMailer.js');
            const result = await sendAttestationLaunchEmail(user.email, campaign);
            if (result.success) {
              emailsSent++;
            }
          } catch (emailError) {
            logger.error({ err: emailError, userId: req.user?.id, userEmail: user.email }, 'Failed to send email to user');
          }
        }
      }

      // Create pending invites for unregistered owners
      let pendingInvitesCreated = 0;
      let inviteEmailsSent = 0;

      const oidcSettings = await oidcSettingsDb.get();
      const ssoEnabled = oidcSettings?.enabled || false;
      const ssoButtonText = oidcSettings?.button_text || 'Sign In with SSO';

      for (const owner of unregisteredOwners) {
        const crypto = await import('crypto');
        const inviteToken = crypto.randomBytes(32).toString('hex');

        await attestationPendingInviteDb.create({
          campaign_id: campaign.id,
          employee_email: owner.employee_email,
          employee_first_name: owner.employee_first_name,
          employee_last_name: owner.employee_last_name,
          invite_token: inviteToken,
          invite_sent_at: new Date().toISOString()
        });
        pendingInvitesCreated++;

        try {
          const { sendAttestationRegistrationInvite } = await import('../services/smtpMailer.js');
          const result = await sendAttestationRegistrationInvite(
            owner.employee_email,
            owner.employee_first_name,
            owner.employee_last_name,
            campaign,
            inviteToken,
            owner.asset_count,
            ssoEnabled,
            ssoButtonText
          );
          if (result.success) {
            inviteEmailsSent++;
          }
        } catch (emailError) {
          logger.error({ err: emailError, userId: req.user?.id, employeeEmail: owner.employee_email }, 'Failed to send invite email to owner');
        }
      }

      // Update campaign status to active
      await attestationCampaignDb.update(campaign.id, {
        status: 'active',
        start_date: new Date().toISOString()
      });

      await auditDb.log(
        'start',
        'attestation_campaign',
        campaign.id,
        campaign.name,
        `Started attestation campaign: ${campaign.name} (targeting: ${campaign.target_type}). Created ${recordsCreated} records, sent ${emailsSent} emails. Created ${pendingInvitesCreated} pending invites, sent ${inviteEmailsSent} invite emails`,
        req.user.email
      );

      res.json({
        success: true,
        message: 'Campaign started',
        recordsCreated,
        emailsSent,
        pendingInvitesCreated,
        inviteEmailsSent
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error starting campaign');
      res.status(500).json({ error: 'Failed to start campaign' });
    }
  });

  // Cancel campaign
  router.post('/campaigns/:id/cancel', authenticate, authorize('admin', 'attestation_coordinator'), async (req, res) => {
    try {
      const campaign = await attestationCampaignDb.getById(req.params.id);
      await attestationCampaignDb.update(req.params.id, { status: 'cancelled' });

      await auditDb.log(
        'cancel',
        'attestation_campaign',
        req.params.id,
        campaign?.name || 'Unknown',
        'Cancelled attestation campaign',
        req.user.email
      );

      res.json({ success: true });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error cancelling campaign');
      res.status(500).json({ error: 'Failed to cancel campaign' });
    }
  });

  // Delete campaign
  router.delete('/campaigns/:id', authenticate, authorize('admin', 'attestation_coordinator'), async (req, res) => {
    try {
      const campaign = await attestationCampaignDb.getById(req.params.id);

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      await attestationCampaignDb.delete(req.params.id);

      await auditDb.log(
        'delete',
        'attestation_campaign',
        req.params.id,
        campaign.name,
        `Deleted attestation campaign: ${campaign.name}`,
        req.user.email
      );

      res.json({ success: true, message: 'Campaign deleted successfully' });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error deleting campaign');
      res.status(500).json({ error: 'Failed to delete campaign' });
    }
  });

  // Get campaign dashboard with detailed employee records
  router.get('/campaigns/:id/dashboard', authenticate, authorize('admin', 'attestation_coordinator', 'manager'), async (req, res) => {
    try {
      const campaign = await attestationCampaignDb.getById(req.params.id);

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const records = await attestationRecordDb.getByCampaignId(campaign.id);
      const detailedRecords = [];

      for (const record of records) {
        const user = await userDb.getById(record.user_id);
        if (user) {
          const userAssets = await assetDb.getByEmployeeEmail(user.email);
          const companyIds = [...new Set(userAssets.map(a => a.company_id).filter(Boolean))];

          const companies = [];
          for (const companyId of companyIds) {
            const company = await companyDb.getById(companyId);
            if (company) companies.push(company.name);
          }

          detailedRecords.push({
            ...record,
            user_email: user.email,
            user_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.name,
            user_role: user.role,
            manager_email: user.manager_email || null,
            companies: companies
          });
        }
      }

      res.json({ success: true, campaign, records: detailedRecords });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error fetching campaign dashboard');
      res.status(500).json({ error: 'Failed to fetch campaign dashboard' });
    }
  });

  // Export campaign report as CSV
  router.get('/campaigns/:id/export', authenticate, authorize('admin', 'attestation_coordinator'), async (req, res) => {
    try {
      const campaign = await attestationCampaignDb.getById(req.params.id);

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const records = await attestationRecordDb.getByCampaignId(campaign.id);

      let csv = 'Employee Name,Email,Status,Started,Completed,Reminder Sent,Escalation Sent\n';

      for (const record of records) {
        const user = await userDb.getById(record.user_id);
        if (user) {
          const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.name;
          csv += `"${name}","${user.email}","${record.status}","${record.started_at || ''}","${record.completed_at || ''}","${record.reminder_sent_at || ''}","${record.escalation_sent_at || ''}"\n`;
        }
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="attestation-${campaign.name.replace(/[^a-z0-9]/gi, '-')}.csv"`);
      res.send(csv);
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error exporting campaign');
      res.status(500).json({ error: 'Failed to export campaign' });
    }
  });

  // ===== User Attestations =====

  // Get current user's attestations
  router.get('/my-attestations', authenticate, async (req, res) => {
    try {
      const records = await attestationRecordDb.getByUserId(req.user.id);
      const detailedRecords = [];

      for (const record of records) {
        const campaign = await attestationCampaignDb.getById(record.campaign_id);
        if (campaign && campaign.status === 'active') {
          detailedRecords.push({
            ...record,
            campaign
          });
        }
      }

      res.json({ success: true, attestations: detailedRecords });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error fetching user attestations');
      res.status(500).json({ error: 'Failed to fetch attestations' });
    }
  });

  // Get specific attestation record with assets
  router.get('/records/:id', authenticate, async (req, res) => {
    try {
      const record = await attestationRecordDb.getById(req.params.id);

      if (!record) {
        return res.status(404).json({ error: 'Attestation record not found' });
      }

      // Verify user has access to this record
      if (record.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const campaign = await attestationCampaignDb.getById(record.campaign_id);

      // Get user's assets
      const allAssets = await assetDb.getAll();
      let userAssets = allAssets.filter(a => a.employee_email === req.user.email);

      // Filter by company if campaign is company-scoped
      if (campaign.target_type === 'companies' && campaign.target_company_ids) {
        try {
          const targetCompanyIds = JSON.parse(campaign.target_company_ids);
          userAssets = userAssets.filter(asset => targetCompanyIds.includes(asset.company_id));
        } catch (parseError) {
          logger.error({ err: parseError, userId: req.user?.id }, 'Error parsing target_company_ids');
        }
      }

      const attestedAssets = await attestationAssetDb.getByRecordId(record.id);
      const newAssets = await attestationNewAssetDb.getByRecordId(record.id);

      res.json({
        success: true,
        record,
        campaign,
        assets: userAssets,
        attestedAssets,
        newAssets
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error fetching attestation record');
      res.status(500).json({ error: 'Failed to fetch attestation record' });
    }
  });

  // Update asset attestation status
  router.put('/records/:id/assets/:assetId', authenticate, async (req, res) => {
    try {
      const record = await attestationRecordDb.getById(req.params.id);

      if (!record) {
        return res.status(404).json({ error: 'Attestation record not found' });
      }

      if (record.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { attested_status, notes, returned_date } = req.body;
      const asset = await assetDb.getById(req.params.assetId);

      if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      // Validate returned_date is provided when status is 'returned'
      if (attested_status === 'returned' && !returned_date) {
        return res.status(400).json({ error: 'Returned date is required when status is returned' });
      }

      await attestationAssetDb.create({
        attestation_record_id: record.id,
        asset_id: asset.id,
        attested_status,
        previous_status: asset.status,
        notes,
        attested_at: new Date().toISOString()
      });

      // Update record status to in_progress if it was pending
      if (record.status === 'pending') {
        await attestationRecordDb.update(record.id, {
          status: 'in_progress',
          started_at: new Date().toISOString()
        });
      }

      // If attested_status changed, update the asset
      if (attested_status && attested_status !== asset.status) {
        // Pass returned_date if status is 'returned'
        const returnedDateValue = attested_status === 'returned' ? returned_date : null;
        await assetDb.updateStatus(asset.id, attested_status, notes, returnedDateValue);

        await auditDb.log(
          'update',
          'asset',
          asset.id,
          asset.asset_tag || asset.serial_number || 'Unknown',
          `Updated asset status during attestation: ${asset.status} -> ${attested_status}`,
          req.user.email
        );
      }

      res.json({ success: true });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error updating asset attestation');
      res.status(500).json({ error: 'Failed to update asset attestation' });
    }
  });

  // Add new asset during attestation
  router.post('/records/:id/assets/new', authenticate, async (req, res) => {
    try {
      const record = await attestationRecordDb.getById(req.params.id);

      if (!record) {
        return res.status(404).json({ error: 'Attestation record not found' });
      }

      if (record.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { asset_type, make, model, serial_number, asset_tag, company_id, notes,
              employee_first_name, employee_last_name, employee_email,
              manager_first_name, manager_last_name, manager_email } = req.body;

      if (!asset_type || !serial_number || !asset_tag) {
        return res.status(400).json({ error: 'Asset type, serial number, and asset tag are required' });
      }
      if (!employee_first_name || !employee_last_name || !employee_email) {
        return res.status(400).json({ error: 'Employee first name, last name, and email are required' });
      }
      if (!company_id) {
        return res.status(400).json({ error: 'Company is required' });
      }

      await attestationNewAssetDb.create({
        attestation_record_id: record.id,
        asset_type,
        make,
        model,
        serial_number,
        asset_tag,
        company_id,
        notes,
        employee_first_name,
        employee_last_name,
        employee_email,
        manager_first_name,
        manager_last_name,
        manager_email
      });

      if (record.status === 'pending') {
        await attestationRecordDb.update(record.id, {
          status: 'in_progress',
          started_at: new Date().toISOString()
        });
      }

      await auditDb.log(
        'create',
        'attestation_new_asset',
        record.id,
        `${asset_type} - ${serial_number}`,
        `Added new asset during attestation: ${asset_type} - ${serial_number}`,
        req.user.email
      );

      res.json({ success: true });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error adding new asset during attestation');
      res.status(500).json({ error: 'Failed to add new asset' });
    }
  });

  // Complete attestation
  router.post('/records/:id/complete', authenticate, async (req, res) => {
    try {
      const record = await attestationRecordDb.getById(req.params.id);

      if (!record) {
        return res.status(404).json({ error: 'Attestation record not found' });
      }

      if (record.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get newly added assets during attestation
      const newAssets = await attestationNewAssetDb.getByRecordId(record.id);

      // Transfer new assets to the main assets table
      for (const newAsset of newAssets) {
        try {
          await assetDb.create({
            employee_email: newAsset.employee_email || req.user.email,
            employee_first_name: newAsset.employee_first_name || req.user.first_name || '',
            employee_last_name: newAsset.employee_last_name || req.user.last_name || '',
            manager_email: newAsset.manager_email || req.user.manager_email || null,
            manager_first_name: newAsset.manager_first_name || null,
            manager_last_name: newAsset.manager_last_name || null,
            company_id: newAsset.company_id,
            asset_type: newAsset.asset_type,
            make: newAsset.make || '',
            model: newAsset.model || '',
            serial_number: newAsset.serial_number,
            asset_tag: newAsset.asset_tag,
            status: 'active',
            issued_date: newAsset.issued_date || null,
            returned_date: newAsset.returned_date || null,
            notes: newAsset.notes || ''
          });

          try {
            await auditDb.log(
              'create',
              'asset',
              newAsset.serial_number,
              `${newAsset.asset_type} - ${newAsset.serial_number}`,
              `Asset created from attestation: ${newAsset.asset_type} - ${newAsset.serial_number}`,
              req.user.email
            );
          } catch (auditError) {
            logger.error({ err: auditError, userId: req.user?.id }, 'Failed to log asset creation audit');
          }
        } catch (assetError) {
          logger.error({ err: assetError, userId: req.user?.id }, 'Error creating asset from attestation');
        }
      }

      // Mark as completed
      await attestationRecordDb.update(record.id, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });

      const campaign = await attestationCampaignDb.getById(record.campaign_id);

      await auditDb.log(
        'complete',
        'attestation_record',
        record.id,
        campaign?.name || 'Unknown Campaign',
        `Completed attestation for campaign: ${campaign?.name || 'Unknown'}`,
        req.user.email
      );

      // Send notification to admins
      try {
        const admins = await userDb.getByRole('admin');
        const adminEmails = admins.map(a => a.email).filter(Boolean);

        if (adminEmails.length > 0) {
          const { sendAttestationCompleteAdminNotification } = await import('../services/smtpMailer.js');
          const employeeName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.name;
          await sendAttestationCompleteAdminNotification(adminEmails, employeeName, req.user.email, campaign);
        }
      } catch (emailError) {
        logger.error({ err: emailError, userId: req.user?.id }, 'Failed to send admin notification');
      }

      res.json({ success: true });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error completing attestation');
      res.status(500).json({ error: 'Failed to complete attestation' });
    }
  });

  // ===== Invites =====

  // Validate attestation invite token (public endpoint)
  router.get('/validate-invite/:token', async (req, res) => {
    try {
      const invite = await attestationPendingInviteDb.getByToken(req.params.token);

      if (!invite) {
        return res.json({ valid: false, error: 'Invalid invite token' });
      }

      if (invite.registered_at) {
        return res.json({ valid: false, error: 'Invite has already been used' });
      }

      const campaign = await attestationCampaignDb.getById(invite.campaign_id);
      if (!campaign) {
        return res.json({ valid: false, error: 'Campaign not found' });
      }

      if (campaign.status !== 'active') {
        return res.json({ valid: false, error: 'Campaign is no longer active' });
      }

      const assets = await assetDb.getByEmployeeEmail(invite.employee_email);
      const assetCount = assets.length;

      const oidcSettings = await oidcSettingsDb.get();
      const ssoEnabled = oidcSettings?.enabled || false;
      const ssoButtonText = oidcSettings?.button_text || 'Sign In with SSO';

      res.json({
        valid: true,
        email: invite.employee_email,
        firstName: invite.employee_first_name,
        lastName: invite.employee_last_name,
        campaignName: campaign.name,
        campaignDescription: campaign.description,
        assetCount,
        ssoEnabled,
        ssoButtonText
      });
    } catch (error) {
      logger.error({ err: error }, 'Error validating invite token');
      res.status(500).json({ error: 'Failed to validate invite token' });
    }
  });

  // Get pending invites for campaign
  router.get('/campaigns/:id/pending-invites', authenticate, authorize('admin', 'attestation_coordinator', 'manager'), async (req, res) => {
    try {
      const campaign = await attestationCampaignDb.getById(req.params.id);

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const allInvites = await attestationPendingInviteDb.getByCampaignId(req.params.id);
      const pendingInvites = allInvites.filter(invite => !invite.registered_at);

      const formattedInvites = pendingInvites.map(invite => ({
        id: invite.id,
        email: invite.employee_email,
        token: invite.invite_token,
        invite_sent_at: invite.invite_sent_at,
        registered_at: invite.registered_at
      }));

      res.json({
        success: true,
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        pending_invites: formattedInvites
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error fetching pending invites');
      res.status(500).json({ error: 'Failed to fetch pending invites' });
    }
  });

  // Resend invites for campaign
  router.post('/campaigns/:id/resend-invites', authenticate, authorize('admin', 'attestation_coordinator'), async (req, res) => {
    try {
      const campaign = await attestationCampaignDb.getById(req.params.id);

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      if (campaign.status !== 'active') {
        return res.status(400).json({ error: 'Campaign is not active' });
      }

      const { inviteIds } = req.body;

      let invitesToResend;
      if (inviteIds && inviteIds.length > 0) {
        invitesToResend = await Promise.all(
          inviteIds.map(id => attestationPendingInviteDb.getById(id))
        );
        invitesToResend = invitesToResend.filter(inv => inv && !inv.registered_at);
      } else {
        const allInvites = await attestationPendingInviteDb.getByCampaignId(req.params.id);
        invitesToResend = allInvites.filter(inv => !inv.registered_at);
      }

      const oidcSettings = await oidcSettingsDb.get();
      const ssoEnabled = oidcSettings?.enabled || false;
      const ssoButtonText = oidcSettings?.button_text || 'Sign In with SSO';

      let emailsSent = 0;

      for (const invite of invitesToResend) {
        const assets = await assetDb.getByEmployeeEmail(invite.employee_email);
        const assetCount = assets.length;

        try {
          const { sendAttestationRegistrationInvite } = await import('../services/smtpMailer.js');
          const result = await sendAttestationRegistrationInvite(
            invite.employee_email,
            invite.employee_first_name,
            invite.employee_last_name,
            campaign,
            invite.invite_token,
            assetCount,
            ssoEnabled,
            ssoButtonText
          );

          if (result.success) {
            emailsSent++;
            await attestationPendingInviteDb.update(invite.id, {
              invite_sent_at: new Date().toISOString()
            });
          }
        } catch (emailError) {
          logger.error({ err: emailError, userId: req.user?.id, employeeEmail: invite.employee_email }, 'Failed to resend invite to employee');
        }
      }

      await auditDb.log(
        'resend_invites',
        'attestation_campaign',
        campaign.id,
        campaign.name,
        `Resent ${emailsSent} attestation invites for campaign: ${campaign.name}`,
        req.user.email
      );

      res.json({ success: true, emailsSent });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error resending invites');
      res.status(500).json({ error: 'Failed to resend invites' });
    }
  });

  // Resend single pending invite
  router.post('/pending-invites/:id/resend', authenticate, authorize('admin', 'attestation_coordinator'), async (req, res) => {
    try {
      const invite = await attestationPendingInviteDb.getById(req.params.id);

      if (!invite) {
        return res.status(404).json({ error: 'Invite not found' });
      }

      if (invite.registered_at) {
        return res.status(400).json({ error: 'User has already registered' });
      }

      const campaign = await attestationCampaignDb.getById(invite.campaign_id);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const assets = await assetDb.getByEmployeeEmail(invite.employee_email);
      const assetCount = assets.length;

      const oidcSettings = await oidcSettingsDb.get();
      const ssoEnabled = oidcSettings?.enabled || false;
      const ssoButtonText = oidcSettings?.button_text || 'Sign In with SSO';

      const { sendAttestationRegistrationInvite } = await import('../services/smtpMailer.js');
      const result = await sendAttestationRegistrationInvite(
        invite.employee_email,
        invite.employee_first_name,
        invite.employee_last_name,
        campaign,
        invite.invite_token,
        assetCount,
        ssoEnabled,
        ssoButtonText
      );

      if (result.success) {
        await attestationPendingInviteDb.update(invite.id, {
          invite_sent_at: new Date().toISOString()
        });

        await auditDb.log(
          'resend_invite',
          'attestation_pending_invite',
          invite.id,
          invite.employee_email,
          `Resent registration invite to ${invite.employee_email} for campaign: ${campaign.name}`,
          req.user.email
        );

        res.json({ success: true, message: 'Invite resent successfully' });
      } else {
        res.status(500).json({ error: result.error || 'Failed to send invite' });
      }
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error resending invite');
      res.status(500).json({ error: 'Failed to resend invite' });
    }
  });

  // ===== Reminders & Escalations =====

  // Manual reminder for specific attestation record
  router.post('/records/:id/remind', authenticate, authorize('admin', 'attestation_coordinator', 'manager'), async (req, res) => {
    try {
      const record = await attestationRecordDb.getById(req.params.id);
      if (!record) {
        return res.status(404).json({ error: 'Record not found' });
      }

      const campaign = await attestationCampaignDb.getById(record.campaign_id);
      const user = await userDb.getById(record.user_id);

      if (!user || !campaign) {
        return res.status(404).json({ error: 'Campaign or user not found' });
      }

      const { sendAttestationReminderEmail } = await import('../services/smtpMailer.js');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const attestationUrl = `${frontendUrl}/my-attestations`;
      await sendAttestationReminderEmail(user.email, campaign, attestationUrl);

      await attestationRecordDb.update(record.id, {
        reminder_sent_at: new Date().toISOString()
      });

      await auditDb.log(
        'reminder_sent',
        'attestation_record',
        record.id,
        `${user.email} - ${campaign.name}`,
        `Manual reminder sent to ${user.email}`,
        req.user.email
      );

      res.json({ success: true, message: 'Reminder sent successfully' });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error sending reminder');
      res.status(500).json({ error: 'Failed to send reminder' });
    }
  });

  // Bulk reminder for multiple attestation records
  router.post('/campaigns/:id/bulk-remind', authenticate, authorize('admin', 'attestation_coordinator', 'manager'), async (req, res) => {
    try {
      const campaign = await attestationCampaignDb.getById(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const { record_ids } = req.body;
      if (!record_ids || !Array.isArray(record_ids) || record_ids.length === 0) {
        return res.status(400).json({ error: 'record_ids array is required' });
      }

      const { sendAttestationReminderEmail } = await import('../services/smtpMailer.js');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const attestationUrl = `${frontendUrl}/my-attestations`;

      const results = await Promise.all(
        record_ids.map(async (recordId) => {
          try {
            const record = await attestationRecordDb.getById(recordId);
            if (!record || record.campaign_id !== campaign.id) {
              return { success: false, recordId };
            }

            const user = await userDb.getById(record.user_id);
            if (!user) {
              return { success: false, recordId };
            }

            const result = await sendAttestationReminderEmail(user.email, campaign, attestationUrl);

            if (result.success) {
              await attestationRecordDb.update(record.id, {
                reminder_sent_at: new Date().toISOString()
              });
              return { success: true, recordId };
            } else {
              return { success: false, recordId };
            }
          } catch (error) {
            logger.error({ err: error, userId: req.user?.id, recordId }, 'Error sending reminder for record');
            return { success: false, recordId };
          }
        })
      );

      const sent = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      await auditDb.log(
        'bulk_reminder_sent',
        'attestation_campaign',
        campaign.id,
        campaign.name,
        `Bulk reminder sent: ${sent} successful, ${failed} failed`,
        req.user.email
      );

      res.json({ success: true, sent, failed });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error sending bulk reminders');
      res.status(500).json({ error: 'Failed to send bulk reminders' });
    }
  });

  // Manual escalation for specific attestation record
  router.post('/records/:id/escalate', authenticate, authorize('admin', 'attestation_coordinator'), async (req, res) => {
    try {
      const record = await attestationRecordDb.getById(req.params.id);
      if (!record) {
        return res.status(404).json({ error: 'Record not found' });
      }

      const campaign = await attestationCampaignDb.getById(record.campaign_id);
      const user = await userDb.getById(record.user_id);

      if (!user || !campaign) {
        return res.status(404).json({ error: 'Campaign or user not found' });
      }

      if (!user.manager_email) {
        return res.status(400).json({ error: 'User does not have a manager assigned' });
      }

      const { custom_message } = req.body;

      const { sendAttestationEscalationEmail } = await import('../services/smtpMailer.js');
      const userName = getUserDisplayName(user);
      const result = await sendAttestationEscalationEmail(
        user.manager_email,
        userName,
        user.email,
        campaign,
        custom_message || null
      );

      if (result.success) {
        await attestationRecordDb.update(record.id, {
          escalation_sent_at: new Date().toISOString()
        });

        const details = custom_message
          ? `Manual escalation sent to manager ${user.manager_email} with custom message: ${sanitizeForLog(custom_message)}`
          : `Manual escalation sent to manager ${user.manager_email}`;

        await auditDb.log(
          'escalation_sent',
          'attestation_record',
          record.id,
          `${user.email} - ${campaign.name}`,
          details,
          req.user.email
        );

        res.json({ success: true, message: 'Escalation sent successfully' });
      } else {
        res.status(500).json({ error: result.error || 'Failed to send escalation' });
      }
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error sending escalation');
      res.status(500).json({ error: 'Failed to send escalation' });
    }
  });

  return router;
}
