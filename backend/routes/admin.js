/**
 * Admin Settings Routes
 * Handles: OIDC, branding, passkey settings, database, HubSpot, SMTP, email templates, asset types
 */

import { Router } from 'express';
import { unlink } from 'fs/promises';
import { requireFields } from '../middleware/validation.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger({ module: 'admin' });

/**
 * Create and configure the admin router
 * @param {Object} deps - Dependencies
 */
export default function createAdminRouter(deps) {
  const router = Router();

  const {
    // Database
    auditDb,
    oidcSettingsDb,
    brandingSettingsDb,
    passkeySettingsDb,
    databaseSettings,
    databaseEngine,
    importSqliteDatabase,
    hubspotSettingsDb,
    hubspotSyncLogDb,
    smtpSettingsDb,
    emailTemplateDb,
    assetTypeDb,
    companyDb,
    systemSettingsDb,
    // Auth middleware
    authenticate,
    authorize,
    // File upload
    upload,
    // OIDC
    initializeOIDC,
    // HubSpot
    testHubSpotConnection,
    syncCompaniesToACS,
    // Email
    sendTestEmail,
    encryptValue,
    // Helpers
    parseBooleanEnv,
    getSystemConfig,
  } = deps;

  // ===== OIDC Settings =====

  // Get OIDC settings
  router.get('/oidc-settings', authenticate, authorize('admin'), async (req, res) => {
    try {
      const settings = await oidcSettingsDb.get();
      // Don't send client_secret to frontend for security
      const { client_secret, ...safeSettings } = settings || {};
      res.json({
        ...safeSettings,
        sso_button_text: safeSettings?.sso_button_text || 'Sign In with SSO',
        sso_button_help_text: safeSettings?.sso_button_help_text || '',
        sso_button_variant: safeSettings?.sso_button_variant || 'outline',
        has_client_secret: !!client_secret
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Get OIDC settings error');
      res.status(500).json({ error: 'Failed to get OIDC settings' });
    }
  });

  // Update OIDC settings
  router.put('/oidc-settings', authenticate, authorize('admin'), async (req, res) => {
    try {
      const settings = req.body;

      // Validate required fields if enabling OIDC
      if (settings.enabled) {
        if (!settings.issuer_url || !settings.client_id || !settings.redirect_uri) {
          return res.status(400).json({
            error: 'Issuer URL, Client ID, and Redirect URI are required when enabling OIDC'
          });
        }
      }

      // Get existing settings to preserve client_secret if not provided
      const existingSettings = await oidcSettingsDb.get();
      if (!settings.client_secret && existingSettings?.client_secret) {
        settings.client_secret = existingSettings.client_secret;
      }

      settings.sso_button_text = settings.sso_button_text || 'Sign In with SSO';
      settings.sso_button_help_text = settings.sso_button_help_text || '';
      settings.sso_button_variant = settings.sso_button_variant || 'outline';

      // Update settings
      await oidcSettingsDb.update(settings, req.user.email);

      // Reinitialize OIDC client with new settings
      if (settings.enabled) {
        await initializeOIDC(settings);
      }

      // Log the change
      await auditDb.log(
        'update',
        'oidc_settings',
        1,
        'OIDC Configuration',
        `OIDC settings updated (enabled: ${settings.enabled})`,
        req.user.email
      );

      res.json({ message: 'OIDC settings updated successfully' });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Update OIDC settings error');
      res.status(500).json({ error: 'Failed to update OIDC settings' });
    }
  });

  // ===== Branding Settings =====

  // Update branding
  router.put('/branding', authenticate, authorize('admin'), async (req, res) => {
    try {
      const {
        logo_data,
        logo_filename,
        logo_content_type,
        site_name,
        sub_title,
        favicon_data,
        favicon_filename,
        favicon_content_type,
        primary_color,
        include_logo_in_emails,
        app_url,
        footer_label
      } = req.body;

      logger.info({
        user: req.user.email,
        filename: logo_filename,
        content_type: logo_content_type,
        data_length: logo_data ? logo_data.length : 0,
        data_prefix: logo_data ? logo_data.substring(0, 50) : 'null',
        site_name,
        sub_title,
        favicon_filename,
        primary_color,
        include_logo_in_emails,
        app_url,
        footer_label
      }, '[Branding] Update request received');

      // Validate logo data if provided
      if (logo_data && !logo_data.startsWith('data:image/')) {
        logger.error({ userId: req.user?.id }, '[Branding] Invalid logo data format - does not start with data:image/');
        return res.status(400).json({ error: 'Invalid logo data format' });
      }

      // Validate favicon data if provided
      if (favicon_data && !favicon_data.startsWith('data:image/')) {
        logger.error({ userId: req.user?.id }, '[Branding] Invalid favicon data format - does not start with data:image/');
        return res.status(400).json({ error: 'Invalid favicon data format' });
      }

      // Validate primary color if provided (basic hex color validation)
      if (primary_color && !/^#[0-9A-Fa-f]{6}$/.test(primary_color)) {
        logger.error({ userId: req.user?.id, primary_color }, '[Branding] Invalid primary color format');
        return res.status(400).json({ error: 'Invalid primary color format. Use hex format like #3B82F6' });
      }

      await brandingSettingsDb.update({
        logo_data,
        logo_filename,
        logo_content_type,
        site_name,
        sub_title,
        favicon_data,
        favicon_filename,
        favicon_content_type,
        primary_color,
        include_logo_in_emails,
        app_url,
        footer_label
      }, req.user.email);

      logger.info({ userId: req.user?.id }, '[Branding] Settings updated successfully in database');

      // Build audit log details
      const changes = [];
      if (logo_filename) changes.push(`Logo: ${logo_filename}`);
      if (favicon_filename) changes.push(`Favicon: ${favicon_filename}`);
      if (site_name) changes.push(`Site name: ${site_name}`);
      if (sub_title) changes.push(`Subtitle: ${sub_title}`);
      if (primary_color) changes.push(`Color: ${primary_color}`);
      if (include_logo_in_emails !== undefined) changes.push(`Email logo: ${include_logo_in_emails ? 'enabled' : 'disabled'}`);
      if (app_url !== undefined) changes.push(`App URL: ${app_url || 'cleared'}`);
      if (footer_label !== undefined) changes.push(`Footer label: ${footer_label || 'cleared'}`);

      await auditDb.log(
        'update',
        'branding_settings',
        1,
        'Branding Configuration',
        changes.length > 0 ? changes.join(', ') : 'Branding settings updated',
        req.user.email
      );

      res.json({ message: 'Branding settings updated successfully' });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Update branding settings error');
      res.status(500).json({ error: 'Failed to update branding settings' });
    }
  });

  // Delete branding
  router.delete('/branding', authenticate, authorize('admin'), async (req, res) => {
    try {
      await brandingSettingsDb.delete();

      await auditDb.log(
        'delete',
        'branding_settings',
        1,
        'Branding Configuration',
        'Logo removed',
        req.user.email
      );

      res.json({ message: 'Logo removed successfully' });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Delete branding settings error');
      res.status(500).json({ error: 'Failed to remove logo' });
    }
  });

  // ===== Passkey Settings =====

  // Get passkey settings
  router.get('/passkey-settings', authenticate, authorize('admin'), async (req, res) => {
    try {
      const dbSettings = await passkeySettingsDb.get();
      const managedByEnv = Boolean(
        process.env.PASSKEY_RP_ID ||
        process.env.PASSKEY_RP_NAME ||
        process.env.PASSKEY_ORIGIN ||
        process.env.PASSKEY_ENABLED !== undefined
      );

      const enabled = process.env.PASSKEY_ENABLED !== undefined
        ? parseBooleanEnv(process.env.PASSKEY_ENABLED, true)
        : dbSettings?.enabled !== 0;

      // Environment variables take precedence if set
      const settings = {
        rp_id: process.env.PASSKEY_RP_ID || dbSettings?.rp_id || 'localhost',
        rp_name: process.env.PASSKEY_RP_NAME || dbSettings?.rp_name || 'KARS - KeyData Asset Registration System',
        origin: process.env.PASSKEY_ORIGIN || dbSettings?.origin || 'http://localhost:5173',
        enabled,
        managed_by_env: managedByEnv,
        updated_at: dbSettings?.updated_at,
        updated_by: dbSettings?.updated_by
      };

      res.json(settings);
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Get passkey settings error');
      res.status(500).json({ error: 'Failed to get passkey settings' });
    }
  });

  // Update passkey settings
  router.put('/passkey-settings', authenticate, authorize('admin'), async (req, res) => {
    try {
      const managedByEnv = Boolean(
        process.env.PASSKEY_RP_ID ||
        process.env.PASSKEY_RP_NAME ||
        process.env.PASSKEY_ORIGIN ||
        process.env.PASSKEY_ENABLED !== undefined
      );

      if (managedByEnv) {
        return res.status(400).json({
          error: 'Passkey settings are managed by environment variables. Remove PASSKEY_RP_ID, PASSKEY_RP_NAME, PASSKEY_ORIGIN, and PASSKEY_ENABLED from environment to use database configuration.'
        });
      }

      const { rp_id, rp_name, origin, enabled = true } = req.body;

      // Validation
      if (!rp_id || !rp_name || !origin) {
        return res.status(400).json({
          error: 'RP ID, RP Name, and Origin are all required'
        });
      }

      // Validate origin format
      try {
        new URL(origin);
      } catch (err) {
        return res.status(400).json({
          error: 'Origin must be a valid URL (e.g., http://localhost:5173 or https://example.com)'
        });
      }

      // Update settings
      await passkeySettingsDb.update({
        rp_id,
        rp_name,
        origin,
        enabled
      }, req.user.email);

      // Log the change
      await auditDb.log(
        'update',
        'passkey_settings',
        1,
        'Passkey Configuration',
        `Passkey settings updated (RP ID: ${rp_id})`,
        req.user.email
      );

      res.json({
        message: 'Passkey settings updated successfully. Restart required for changes to take effect.',
        restart_required: true
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Update passkey settings error');
      res.status(500).json({ error: 'Failed to update passkey settings' });
    }
  });

  // ===== Database Settings =====

  const formatDatabaseSettings = () => {
    const settings = databaseSettings.get();
    return {
      engine: settings.engine,
      postgresUrl: settings.postgresUrl,
      managedByEnv: settings.managedByEnv,
      effectiveEngine: databaseEngine,
      restartRequired: true
    };
  };

  // Get database settings
  router.get('/database', authenticate, authorize('admin'), (req, res) => {
    try {
      res.json(formatDatabaseSettings());
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Get database settings error');
      res.status(500).json({ error: 'Failed to load database settings' });
    }
  });

  // Update database settings
  router.put('/database', authenticate, authorize('admin'), async (req, res) => {
    try {
      const current = databaseSettings.get();

      if (current.managedByEnv) {
        return res.status(400).json({ error: 'Database settings are managed by environment variables' });
      }

      const { engine, postgresUrl } = req.body;
      const updated = await databaseSettings.update({ engine, postgresUrl });

      res.json({
        ...updated,
        effectiveEngine: updated.engine,
        restartRequired: true
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Update database settings error');
      res.status(500).json({ error: error.message || 'Failed to update database settings' });
    }
  });

  // Import SQLite database
  router.post('/database/import-sqlite', authenticate, authorize('admin'), upload.single('sqliteFile'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Upload a SQLite assets.db file to import' });
    }

    if (databaseEngine !== 'postgres') {
      await unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Switch to PostgreSQL before importing SQLite data' });
    }

    try {
      const results = await importSqliteDatabase(req.file.path);
      res.json({
        message: 'SQLite data imported into PostgreSQL successfully',
        imported: results
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'SQLite import failed');
      res.status(500).json({ error: error.message || 'Failed to import SQLite data' });
    } finally {
      await unlink(req.file.path).catch(() => {});
    }
  });

  // ===== System Settings =====

  /**
   * Helper function to build system settings response with source information
   */
  const buildSystemSettingsResponse = (config, dbSettings, includeEnvValues = true) => {
    return {
      proxy: {
        enabled: {
          value: config.proxy.enabled,
          source: dbSettings?.trust_proxy !== null && dbSettings?.trust_proxy !== undefined ? 'database' : 'environment',
          envVar: 'TRUST_PROXY',
          ...(includeEnvValues && { envValue: process.env.TRUST_PROXY })
        },
        type: {
          value: config.proxy.type,
          source: dbSettings?.proxy_type ? 'database' : 'environment',
          envVar: 'PROXY_TYPE',
          ...(includeEnvValues && { envValue: process.env.PROXY_TYPE })
        },
        trustLevel: {
          value: config.proxy.trustLevel,
          source: dbSettings?.proxy_trust_level !== null && dbSettings?.proxy_trust_level !== undefined ? 'database' : 'environment',
          envVar: 'PROXY_TRUST_LEVEL',
          ...(includeEnvValues && { envValue: process.env.PROXY_TRUST_LEVEL })
        }
      },
      rateLimiting: {
        enabled: {
          value: config.rateLimiting.enabled,
          source: dbSettings?.rate_limit_enabled !== null && dbSettings?.rate_limit_enabled !== undefined ? 'database' : 'environment',
          envVar: 'RATE_LIMIT_ENABLED',
          ...(includeEnvValues && { envValue: process.env.RATE_LIMIT_ENABLED })
        },
        windowMs: {
          value: config.rateLimiting.windowMs,
          source: dbSettings?.rate_limit_window_ms ? 'database' : 'environment',
          envVar: 'RATE_LIMIT_WINDOW_MS',
          ...(includeEnvValues && { envValue: process.env.RATE_LIMIT_WINDOW_MS })
        },
        maxRequests: {
          value: config.rateLimiting.maxRequests,
          source: dbSettings?.rate_limit_max_requests ? 'database' : 'environment',
          envVar: 'RATE_LIMIT_MAX_REQUESTS',
          ...(includeEnvValues && { envValue: process.env.RATE_LIMIT_MAX_REQUESTS })
        }
      }
    };
  };

  // Get system settings with environment variable sources
  router.get('/system-settings', authenticate, authorize('admin'), async (req, res) => {
    try {
      const config = await getSystemConfig();
      const dbSettings = await systemSettingsDb.get();
      const response = buildSystemSettingsResponse(config, dbSettings);
      res.json(response);
    } catch (error) {
      console.error('Get system settings error:', error);
      res.status(500).json({ error: 'Failed to load system settings' });
    }
  });

  // Update system settings
  router.put('/system-settings', authenticate, authorize('admin'), async (req, res) => {
    try {
      const { proxy, rateLimiting } = req.body;
      
      const settings = {};
      
      // Process proxy settings
      if (proxy) {
        if (proxy.enabled !== undefined) {
          settings.trust_proxy = proxy.enabled;
        }
        if (proxy.type !== undefined) {
          settings.proxy_type = proxy.type;
        }
        if (proxy.trustLevel !== undefined) {
          settings.proxy_trust_level = proxy.trustLevel;
        }
      }
      
      // Process rate limiting settings
      if (rateLimiting) {
        if (rateLimiting.enabled !== undefined) {
          settings.rate_limit_enabled = rateLimiting.enabled;
        }
        if (rateLimiting.windowMs !== undefined) {
          settings.rate_limit_window_ms = rateLimiting.windowMs;
        }
        if (rateLimiting.maxRequests !== undefined) {
          settings.rate_limit_max_requests = rateLimiting.maxRequests;
        }
      }
      
      // Update settings in database
      await systemSettingsDb.update(settings, req.user.email);
      
      // Log the change
      await auditDb.log(
        'update',
        'system_settings',
        1,
        'System Configuration',
        'System settings updated',
        req.user.email
      );
      
      // Return updated configuration
      const config = await getSystemConfig();
      const dbSettings = await systemSettingsDb.get();
      const response = buildSystemSettingsResponse(config, dbSettings, false);
      res.json(response);
    } catch (error) {
      console.error('Update system settings error:', error);
      res.status(500).json({ error: 'Failed to update system settings' });
    }
  });

  // ===== HubSpot Settings =====

  // Rate limiting for sync operations
  const syncRateLimiter = new Map();
  const SYNC_RATE_LIMIT_MS = 60000; // 1 minute

  // Get HubSpot settings
  router.get('/hubspot-settings', authenticate, authorize('admin'), async (req, res) => {
    try {
      const settings = await hubspotSettingsDb.get();
      res.json(settings);
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Get HubSpot settings error');
      res.status(500).json({ error: 'Failed to load HubSpot settings' });
    }
  });

  // Update HubSpot settings
  router.put('/hubspot-settings', authenticate, authorize('admin'), async (req, res) => {
    try {
      const { enabled, access_token, auto_sync_enabled, sync_interval } = req.body;

      await hubspotSettingsDb.update({
        enabled,
        access_token,
        auto_sync_enabled,
        sync_interval
      });

      // Log the settings change
      await auditDb.log(
        'update',
        'hubspot_settings',
        1,
        'HubSpot Integration',
        'Updated HubSpot integration settings',
        req.user.email
      );

      const updatedSettings = await hubspotSettingsDb.get();
      res.json({ message: 'HubSpot settings saved successfully', settings: updatedSettings });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Update HubSpot settings error');
      res.status(500).json({ error: error.message || 'Failed to update HubSpot settings' });
    }
  });

  // Test HubSpot connection
  router.post('/hubspot/test-connection', authenticate, authorize('admin'), async (req, res) => {
    try {
      const accessToken = await hubspotSettingsDb.getAccessToken();

      if (!accessToken) {
        return res.status(400).json({ error: 'HubSpot access token is not configured' });
      }

      const result = await testHubSpotConnection(accessToken);

      if (result.success) {
        res.json({ message: result.message });
      } else {
        res.status(400).json({ error: result.message });
      }
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'HubSpot connection test error');
      res.status(500).json({ error: error.message || 'Failed to test HubSpot connection' });
    }
  });

  // Sync companies from HubSpot
  router.post('/hubspot/sync-companies', authenticate, authorize('admin'), async (req, res) => {
    try {
      // Check rate limiting
      const lastSync = syncRateLimiter.get('hubspot-sync');
      if (lastSync && Date.now() - lastSync < SYNC_RATE_LIMIT_MS) {
        const remainingSeconds = Math.ceil((SYNC_RATE_LIMIT_MS - (Date.now() - lastSync)) / 1000);
        return res.status(429).json({
          error: `Please wait ${remainingSeconds} seconds before syncing again`
        });
      }

      const accessToken = await hubspotSettingsDb.getAccessToken();

      if (!accessToken) {
        return res.status(400).json({ error: 'HubSpot access token is not configured' });
      }

      const syncStartedAt = new Date().toISOString();

      // Update rate limiter
      syncRateLimiter.set('hubspot-sync', Date.now());

      try {
        // Perform the sync
        const result = await syncCompaniesToACS(
          accessToken,
          companyDb,
          auditDb,
          req.user.email
        );

        const syncCompletedAt = new Date().toISOString();

        // Log the sync
        await hubspotSyncLogDb.log({
          sync_started_at: syncStartedAt,
          sync_completed_at: syncCompletedAt,
          status: 'success',
          companies_found: result.companiesFound,
          companies_created: result.companiesCreated,
          companies_updated: result.companiesUpdated,
          error_message: result.errors.length > 0 ? JSON.stringify(result.errors) : null
        });

        // Update HubSpot settings with last sync info
        await hubspotSettingsDb.updateSyncStatus(
          'success',
          result.companiesCreated + result.companiesUpdated
        );

        // Log to audit log
        await auditDb.log(
          'sync',
          'hubspot',
          null,
          'HubSpot Companies',
          `Synced ${result.companiesFound} companies: ${result.companiesCreated} created, ${result.companiesUpdated} updated`,
          req.user.email
        );

        res.json({
          message: 'HubSpot sync completed successfully',
          ...result
        });
      } catch (syncError) {
        const syncCompletedAt = new Date().toISOString();

        // Log the failed sync
        await hubspotSyncLogDb.log({
          sync_started_at: syncStartedAt,
          sync_completed_at: syncCompletedAt,
          status: 'error',
          companies_found: 0,
          companies_created: 0,
          companies_updated: 0,
          error_message: syncError.message
        });

        // Update HubSpot settings with last sync info
        await hubspotSettingsDb.updateSyncStatus('error', 0);

        throw syncError;
      }
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'HubSpot sync error');
      res.status(500).json({ error: error.message || 'Failed to sync companies from HubSpot' });
    }
  });

  // Get HubSpot sync history
  router.get('/hubspot/sync-history', authenticate, authorize('admin'), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const history = await hubspotSyncLogDb.getHistory(limit);
      res.json(history);
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Get HubSpot sync history error');
      res.status(500).json({ error: 'Failed to load sync history' });
    }
  });

  // ===== SMTP Notification Settings =====

  // Get notification settings
  router.get('/notification-settings', authenticate, authorize('admin'), async (req, res) => {
    try {
      const settings = await smtpSettingsDb.get();
      res.json(settings);
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Get SMTP settings error');
      res.status(500).json({ error: 'Failed to load notification settings' });
    }
  });

  // Update notification settings
  router.put('/notification-settings', authenticate, authorize('admin'), async (req, res) => {
    try {
      const {
        enabled,
        host,
        port,
        use_tls,
        username,
        password,
        clear_password,
        auth_method,
        from_name,
        from_email,
        default_recipient
      } = req.body;

      // Build update object
      const updateData = {
        enabled,
        host,
        port,
        use_tls,
        username,
        auth_method,
        from_name,
        from_email,
        default_recipient
      };

      // Handle password encryption
      // Only encrypt and update if password is provided and not the placeholder
      if (password && password !== '[REDACTED]' && password !== '') {
        try {
          const encryptedPassword = encryptValue(password);
          updateData.password_encrypted = encryptedPassword;
        } catch (error) {
          logger.error({ err: error, userId: req.user?.id }, 'Password encryption error');
          return res.status(500).json({
            error: 'Failed to encrypt password. Please check KARS_MASTER_KEY configuration.'
          });
        }
      } else if (clear_password === true) {
        // Explicitly clear the password if requested
        updateData.clear_password = true;
      }

      await smtpSettingsDb.update(updateData);

      // Log the action
      await auditDb.log(
        'update',
        'smtp_settings',
        1,
        'SMTP Notification Settings',
        `Updated SMTP settings. Enabled: ${enabled ? 'Yes' : 'No'}`,
        req.user.email
      );

      // Return updated settings (without password)
      const updatedSettings = await smtpSettingsDb.get();
      res.json(updatedSettings);
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Update SMTP settings error');
      res.status(500).json({ error: 'Failed to update notification settings' });
    }
  });

  // Send test email
  router.post('/notification-settings/test', authenticate, authorize('admin'), async (req, res) => {
    try {
      const { recipient } = req.body;

      // Validate that settings are enabled
      const settings = await smtpSettingsDb.get();
      if (!settings || !settings.enabled) {
        return res.status(400).json({
          error: 'SMTP settings are not enabled. Please enable them before sending a test email.'
        });
      }

      // Send test email
      const result = await sendTestEmail(recipient);

      if (result.success) {
        // Log the action
        await auditDb.log(
          'test',
          'smtp_settings',
          1,
          'SMTP Notification Settings',
          `Sent test email to ${recipient || settings.default_recipient}`,
          req.user.email
        );

        res.json({
          success: true,
          message: result.message,
          messageId: result.messageId
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          details: result.details
        });
      }
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Send test email error');
      res.status(500).json({
        error: 'Failed to send test email',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // ===== Email Templates =====

  // Get all email templates
  router.get('/email-templates', authenticate, authorize('admin'), async (req, res) => {
    try {
      const templates = await emailTemplateDb.getAll();
      res.json({ success: true, templates });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Get email templates error');
      res.status(500).json({ error: 'Failed to load email templates' });
    }
  });

  // Get single email template
  router.get('/email-templates/:key', authenticate, authorize('admin'), async (req, res) => {
    try {
      const { key } = req.params;
      const template = await emailTemplateDb.getByKey(key);

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      res.json({ success: true, template });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Get email template error');
      res.status(500).json({ error: 'Failed to load email template' });
    }
  });

  // Update email template
  router.put('/email-templates/:key', authenticate, authorize('admin'), requireFields('subject', 'html_body', 'text_body'), async (req, res) => {
    try {
      const { key } = req.params;
      const { subject, html_body, text_body } = req.body;

      // Check if template exists
      const existing = await emailTemplateDb.getByKey(key);
      if (!existing) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Update template
      await emailTemplateDb.update(key, { subject, html_body, text_body }, req.user.email);

      // Log the action
      await auditDb.log(
        'update',
        'email_template',
        existing.id,
        existing.name,
        `Updated email template: ${existing.name}`,
        req.user.email
      );

      res.json({ success: true, message: 'Email template updated successfully' });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Update email template error');
      res.status(500).json({ error: 'Failed to update email template' });
    }
  });

  // Reset email template to default
  router.post('/email-templates/:key/reset', authenticate, authorize('admin'), async (req, res) => {
    try {
      const { key } = req.params;

      // Check if template exists
      const existing = await emailTemplateDb.getByKey(key);
      if (!existing) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Reset template to default values
      await emailTemplateDb.reset(key);

      // Log the action
      await auditDb.log(
        'reset',
        'email_template',
        existing.id,
        existing.name,
        `Reset email template to default: ${existing.name}`,
        req.user.email
      );

      res.json({ success: true, message: 'Email template reset to default values' });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Reset email template error');
      res.status(500).json({ error: 'Failed to reset email template' });
    }
  });

  // Preview email template
  router.post('/email-templates/:key/preview', authenticate, authorize('admin'), async (req, res) => {
    try {
      const { key } = req.params;
      const { subject, html_body, text_body } = req.body;

      // Get branding settings for preview
      const branding = await brandingSettingsDb.get();
      const siteName = branding?.site_name || 'KARS';

      // Define sample variables for each template type
      const sampleVariables = {
        test_email: {
          siteName,
          smtpHost: 'smtp.example.com',
          smtpPort: '587',
          timestamp: new Date().toISOString()
        },
        password_reset: {
          siteName,
          resetUrl: 'https://example.com/reset-password?token=sample-token-123',
          expiryTime: '1 hour'
        },
        attestation_launch: {
          siteName,
          campaignName: 'Q4 2024 Asset Attestation',
          campaignDescription: 'Please review and confirm all assets assigned to you for the fourth quarter.',
          attestationUrl: 'https://example.com/my-attestations'
        },
        attestation_reminder: {
          siteName,
          campaignName: 'Q4 2024 Asset Attestation',
          attestationUrl: 'https://example.com/my-attestations'
        },
        attestation_escalation: {
          siteName,
          campaignName: 'Q4 2024 Asset Attestation',
          employeeName: 'John Doe',
          employeeEmail: 'john.doe@example.com',
          escalationDays: '10'
        },
        attestation_complete: {
          siteName,
          campaignName: 'Q4 2024 Asset Attestation',
          employeeName: 'John Doe',
          employeeEmail: 'john.doe@example.com',
          completedAt: new Date().toLocaleString()
        }
      };

      const variables = sampleVariables[key] || { siteName };

      // Substitute variables in the provided content
      const substituteVariables = (template, vars) => {
        let result = template || '';
        for (const [varKey, value] of Object.entries(vars)) {
          const regex = new RegExp(`\\{\\{${varKey}\\}\\}`, 'g');
          result = result.replace(regex, value || '');
        }
        return result;
      };

      const previewSubject = substituteVariables(subject, variables);
      const previewHtml = substituteVariables(html_body, variables);
      const previewText = substituteVariables(text_body, variables);

      // Wrap HTML with branding (simulating actual email)
      const buildEmailHtml = (brandingData, siteNameVal, content) => {
        const logoHeader = brandingData?.include_logo_in_emails && brandingData?.logo_data
          ? `<div style="text-align: center; margin-bottom: 20px;">
               <img src="${brandingData.logo_data}" alt="${siteNameVal}" style="max-height: 80px; max-width: 300px; object-fit: contain;" />
             </div>`
          : '';

        return `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${logoHeader}
            ${content}
          </div>
        `;
      };

      const wrappedHtml = buildEmailHtml(branding, siteName, previewHtml);

      res.json({
        success: true,
        preview: {
          subject: previewSubject,
          html: wrappedHtml,
          text: previewText,
          variables: Object.keys(variables)
        }
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Preview email template error');
      res.status(500).json({ error: 'Failed to generate preview' });
    }
  });

  // ===== Asset Types =====

  // Get all asset types (admin)
  router.get('/asset-types', authenticate, authorize('admin'), async (req, res) => {
    try {
      const assetTypes = await assetTypeDb.getAll();

      // Get usage count for each type
      const assetTypesWithUsage = await Promise.all(
        assetTypes.map(async (type) => {
          const usageCount = await assetTypeDb.getUsageCount(type.id);
          return { ...type, usage_count: usageCount };
        })
      );

      res.json(assetTypesWithUsage);
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error fetching all asset types');
      res.status(500).json({ error: 'Failed to fetch asset types' });
    }
  });

  // Create asset type
  router.post('/asset-types', authenticate, authorize('admin'), requireFields('name', 'display_name'), async (req, res) => {
    try {
      const { name, display_name, description, is_active, sort_order } = req.body;

      // Check if name already exists
      const existing = await assetTypeDb.getByName(name);
      if (existing) {
        return res.status(409).json({ error: 'Asset type with this name already exists' });
      }

      const result = await assetTypeDb.create({
        name,
        display_name,
        description,
        is_active: is_active !== undefined ? is_active : 1,
        sort_order: sort_order || 0
      });

      const newAssetType = await assetTypeDb.getById(result.id);

      // Log audit
      await auditDb.log(
        'create',
        'asset_type',
        result.id,
        display_name,
        { name, display_name, description },
        req.user.email
      );

      res.status(201).json(newAssetType);
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error creating asset type');
      res.status(500).json({ error: 'Failed to create asset type' });
    }
  });

  // Update asset type
  router.put('/asset-types/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, display_name, description, is_active, sort_order } = req.body;

      const assetType = await assetTypeDb.getById(id);
      if (!assetType) {
        return res.status(404).json({ error: 'Asset type not found' });
      }

      // If name is being changed, check if new name already exists
      if (name && name !== assetType.name) {
        const existing = await assetTypeDb.getByName(name);
        if (existing) {
          return res.status(409).json({ error: 'Asset type with this name already exists' });
        }
      }

      const updates = {};
      if (name !== undefined) updates.name = name;
      if (display_name !== undefined) updates.display_name = display_name;
      if (description !== undefined) updates.description = description;
      if (is_active !== undefined) updates.is_active = is_active;
      if (sort_order !== undefined) updates.sort_order = sort_order;

      await assetTypeDb.update(id, updates);
      const updatedAssetType = await assetTypeDb.getById(id);

      // Log audit
      await auditDb.log(
        'update',
        'asset_type',
        id,
        updatedAssetType.display_name,
        updates,
        req.user.email
      );

      res.json(updatedAssetType);
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error updating asset type');
      res.status(500).json({ error: 'Failed to update asset type' });
    }
  });

  // Delete asset type
  router.delete('/asset-types/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      const assetType = await assetTypeDb.getById(id);
      if (!assetType) {
        return res.status(404).json({ error: 'Asset type not found' });
      }

      // Check if asset type is in use
      const usageCount = await assetTypeDb.getUsageCount(id);
      if (usageCount > 0) {
        return res.status(409).json({
          error: `Cannot delete asset type that is in use by ${usageCount} asset(s)`,
          usage_count: usageCount
        });
      }

      await assetTypeDb.delete(id);

      // Log audit
      await auditDb.log(
        'delete',
        'asset_type',
        id,
        assetType.display_name,
        { name: assetType.name },
        req.user.email
      );

      res.json({ message: 'Asset type deleted successfully' });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error deleting asset type');
      res.status(500).json({ error: 'Failed to delete asset type' });
    }
  });

  // Reorder asset types
  router.put('/asset-types/reorder', authenticate, authorize('admin'), async (req, res) => {
    try {
      const { orderedIds } = req.body;

      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        return res.status(400).json({ error: 'orderedIds must be a non-empty array' });
      }

      await assetTypeDb.reorder(orderedIds);

      // Log audit
      await auditDb.log(
        'reorder',
        'asset_type',
        null,
        'Asset Types',
        { orderedIds },
        req.user.email
      );

      res.json({ message: 'Asset types reordered successfully' });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error reordering asset types');
      res.status(500).json({ error: 'Failed to reorder asset types' });
    }
  });

  return router;
}
