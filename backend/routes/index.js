/**
 * Routes Index
 * Centralizes route mounting and dependency injection
 */

import createCompaniesRouter from './companies.js';
import createAuditRouter from './audit.js';
import createAssetsRouter from './assets.js';
import createReportsRouter from './reports.js';
import createAdminRouter from './admin.js';
import createAttestationRouter from './attestation.js';
import createAuthRouter from './auth.js';
import createMFARouter from './mfa.js';
import createPasskeysRouter from './passkeys.js';
import createUsersRouter from './users.js';
import createOIDCRouter from './oidc.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger({ module: 'routes' });

/**
 * Mount all route modules on the Express app
 * @param {Object} app - Express application
 * @param {Object} deps - Shared dependencies
 */
export function mountRoutes(app, deps) {
  // Assets routes
  const assetsDeps = {
    assetDb: deps.assetDb,
    userDb: deps.userDb,
    companyDb: deps.companyDb,
    auditDb: deps.auditDb,
    assetTypeDb: deps.assetTypeDb,
    authenticate: deps.authenticate,
    authorize: deps.authorize,
    upload: deps.upload,
    parseCSVFile: deps.parseCSVFile,
    syncAssetOwnership: deps.syncAssetOwnership,
  };
  const assetsRouter = createAssetsRouter(assetsDeps);
  app.use('/api/assets', assetsRouter);

  // Stats route (standalone endpoint for dashboard)
  app.get('/api/stats', deps.authenticate, async (req, res) => {
    try {
      const assets = await deps.assetDb.getAll();
      const users = await deps.userDb.getAll();
      const companies = await deps.companyDb.getAll();
      res.json({
        assetsCount: assets.length,
        employeesCount: users.length,
        companiesCount: companies.length
      });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching stats');
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // Asset types route (returns active asset types for registration forms)
  app.get('/api/asset-types', deps.authenticate, async (req, res) => {
    try {
      const assetTypes = await deps.assetTypeDb.getActive();
      res.json(assetTypes);
    } catch (error) {
      logger.error({ err: error }, 'Error fetching asset types');
      res.status(500).json({ error: 'Failed to fetch asset types' });
    }
  });

  // Companies routes
  const companiesRouter = createCompaniesRouter({
    companyDb: deps.companyDb,
    auditDb: deps.auditDb,
    authenticate: deps.authenticate,
    authorize: deps.authorize,
    upload: deps.upload,
    parseCSVFile: deps.parseCSVFile,
  });
  app.use('/api/companies', companiesRouter);

  // Audit routes
  const auditRouter = createAuditRouter({
    auditDb: deps.auditDb,
    userDb: deps.userDb,
    authenticate: deps.authenticate,
    authorize: deps.authorize,
  });
  app.use('/api/audit', auditRouter);

  // Reports routes
  const reportsRouter = createReportsRouter({
    userDb: deps.userDb,
    assetDb: deps.assetDb,
    auditDb: deps.auditDb,
    assetTypeDb: deps.assetTypeDb,
    attestationCampaignDb: deps.attestationCampaignDb,
    attestationRecordDb: deps.attestationRecordDb,
    authenticate: deps.authenticate,
    authorize: deps.authorize,
  });
  app.use('/api/reports', reportsRouter);

  // Admin routes
  const adminRouter = createAdminRouter({
    // Database
    auditDb: deps.auditDb,
    oidcSettingsDb: deps.oidcSettingsDb,
    brandingSettingsDb: deps.brandingSettingsDb,
    passkeySettingsDb: deps.passkeySettingsDb,
    databaseSettings: deps.databaseSettings,
    databaseEngine: deps.databaseEngine,
    importSqliteDatabase: deps.importSqliteDatabase,
    hubspotSettingsDb: deps.hubspotSettingsDb,
    hubspotSyncLogDb: deps.hubspotSyncLogDb,
    smtpSettingsDb: deps.smtpSettingsDb,
    emailTemplateDb: deps.emailTemplateDb,
    assetTypeDb: deps.assetTypeDb,
    companyDb: deps.companyDb,
    systemSettingsDb: deps.systemSettingsDb,
    // Auth middleware
    authenticate: deps.authenticate,
    authorize: deps.authorize,
    // File upload
    upload: deps.upload,
    // OIDC
    initializeOIDC: deps.initializeOIDC,
    // HubSpot
    testHubSpotConnection: deps.testHubSpotConnection,
    syncCompaniesToACS: deps.syncCompaniesToACS,
    // Email
    sendTestEmail: deps.sendTestEmail,
    encryptValue: deps.encryptValue,
    // Helpers
    parseBooleanEnv: deps.parseBooleanEnv,
    getSystemConfig: deps.getSystemConfig,
  });
  app.use('/api/admin', adminRouter);

  // Attestation routes
  const attestationRouter = createAttestationRouter({
    // Database
    attestationCampaignDb: deps.attestationCampaignDb,
    attestationRecordDb: deps.attestationRecordDb,
    attestationAssetDb: deps.attestationAssetDb,
    attestationNewAssetDb: deps.attestationNewAssetDb,
    attestationPendingInviteDb: deps.attestationPendingInviteDb,
    userDb: deps.userDb,
    assetDb: deps.assetDb,
    companyDb: deps.companyDb,
    auditDb: deps.auditDb,
    oidcSettingsDb: deps.oidcSettingsDb,
    // Auth middleware
    authenticate: deps.authenticate,
    authorize: deps.authorize,
    // Helpers
    sanitizeDateValue: deps.sanitizeDateValue,
  });
  app.use('/api/attestation', attestationRouter);

  // Public branding route (needs to be outside admin router for unauthenticated access)
  app.get('/api/branding', async (req, res) => {
    try {
      const settings = await deps.brandingSettingsDb.get();
      res.json(settings || {});
    } catch (error) {
      logger.error({ err: error }, 'Get branding settings error');
      res.status(500).json({ error: 'Failed to load branding settings' });
    }
  });

  // Auth routes
  const authRouter = createAuthRouter({
    // Database
    userDb: deps.userDb,
    auditDb: deps.auditDb,
    assetDb: deps.assetDb,
    passwordResetTokenDb: deps.passwordResetTokenDb,
    // Auth
    authenticate: deps.authenticate,
    hashPassword: deps.hashPassword,
    comparePassword: deps.comparePassword,
    generateToken: deps.generateToken,
    // Rate limiters
    authRateLimiter: deps.authRateLimiter,
    passwordResetRateLimiter: deps.passwordResetRateLimiter,
    // Helpers
    syncAssetOwnership: deps.syncAssetOwnership,
    mfaSessions: deps.mfaSessions,
    autoAssignManagerRoleIfNeeded: deps.autoAssignManagerRoleIfNeeded,
    autoAssignManagerRole: deps.autoAssignManagerRole,
    // Email
    sendPasswordResetEmail: deps.sendPasswordResetEmail,
  });
  app.use('/api/auth', authRouter);

  // MFA routes
  const mfaRouter = createMFARouter({
    // Database
    userDb: deps.userDb,
    auditDb: deps.auditDb,
    // Auth
    authenticate: deps.authenticate,
    comparePassword: deps.comparePassword,
    generateToken: deps.generateToken,
    // MFA
    generateMFASecret: deps.generateMFASecret,
    verifyTOTP: deps.verifyTOTP,
    generateBackupCodes: deps.generateBackupCodes,
    formatBackupCode: deps.formatBackupCode,
    // Helpers
    pendingMFAEnrollments: deps.pendingMFAEnrollments,
    mfaSessions: deps.mfaSessions,
    safeJsonParseArray: deps.safeJsonParseArray,
  });
  app.use('/api/auth/mfa', mfaRouter);

  // Passkeys routes
  const passkeysRouter = createPasskeysRouter({
    // Database
    userDb: deps.userDb,
    passkeyDb: deps.passkeyDb,
    // Auth
    authenticate: deps.authenticate,
    generateToken: deps.generateToken,
    // Helpers
    getPasskeyConfig: deps.getPasskeyConfig,
    isPasskeyEnabled: deps.isPasskeyEnabled,
    getExpectedOrigin: deps.getExpectedOrigin,
    pendingPasskeyRegistrations: deps.pendingPasskeyRegistrations,
    pendingPasskeyLogins: deps.pendingPasskeyLogins,
    safeJsonParse: deps.safeJsonParse,
    safeJsonParseArray: deps.safeJsonParseArray,
    serializePasskey: deps.serializePasskey,
  });
  app.use('/api/auth/passkeys', passkeysRouter);

  // Users routes
  const usersRouter = createUsersRouter({
    // Database
    userDb: deps.userDb,
    assetDb: deps.assetDb,
    auditDb: deps.auditDb,
    // Auth
    authenticate: deps.authenticate,
    authorize: deps.authorize,
    // Constants
    VALID_ROLES: deps.VALID_ROLES,
  });
  app.use('/api/auth/users', usersRouter);

  // OIDC routes
  const oidcRouter = createOIDCRouter({
    // Database
    userDb: deps.userDb,
    auditDb: deps.auditDb,
    oidcSettingsDb: deps.oidcSettingsDb,
    attestationCampaignDb: deps.attestationCampaignDb,
    attestationRecordDb: deps.attestationRecordDb,
    attestationPendingInviteDb: deps.attestationPendingInviteDb,
    // Auth
    generateToken: deps.generateToken,
    // OIDC
    isOIDCEnabled: deps.isOIDCEnabled,
    getAuthorizationUrl: deps.getAuthorizationUrl,
    handleCallback: deps.handleCallback,
    getUserInfo: deps.getUserInfo,
    extractUserData: deps.extractUserData,
    // Helpers
    stateStore: deps.stateStore,
  });
  app.use('/api/auth/oidc', oidcRouter);

  logger.info('Mounted route modules: assets, companies, audit, reports, admin, attestation, auth, mfa, passkeys, users, oidc');
}

export default mountRoutes;
