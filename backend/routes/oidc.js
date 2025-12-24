/**
 * OIDC Authentication Routes
 * Handles: OIDC configuration, login initiation, and callback
 */

import { Router } from 'express';
import { randomBytes } from 'crypto';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger({ module: 'oidc' });

/**
 * Create and configure the OIDC router
 * @param {Object} deps - Dependencies
 */
export default function createOIDCRouter(deps) {
  const router = Router();

  const {
    // Database
    userDb,
    auditDb,
    oidcSettingsDb,
    attestationCampaignDb,
    attestationRecordDb,
    attestationPendingInviteDb,
    // Auth
    generateToken,
    // OIDC
    isOIDCEnabled,
    getAuthorizationUrl,
    handleCallback,
    getUserInfo,
    extractUserData,
    // Helpers
    stateStore,
  } = deps;

  // ===== Get OIDC Configuration (for frontend) =====

  router.get('/config', async (req, res) => {
    try {
      const settings = await oidcSettingsDb.get();
      const buttonText = settings?.sso_button_text || 'Sign In with SSO';
      const buttonHelpText = settings?.sso_button_help_text || '';
      const buttonVariant = settings?.sso_button_variant || 'outline';
      res.json({
        enabled: settings?.enabled === 1 && isOIDCEnabled(),
        button_text: buttonText,
        button_help_text: buttonHelpText,
        button_variant: buttonVariant
      });
    } catch (error) {
      res.json({
        enabled: false,
        button_text: 'Sign In with SSO',
        button_help_text: '',
        button_variant: 'outline'
      });
    }
  });

  // ===== Initiate OIDC Login =====

  router.get('/login', async (req, res) => {
    try {
      if (!isOIDCEnabled()) {
        return res.status(503).json({ error: 'OIDC is not enabled' });
      }

      // Generate state token for CSRF protection
      const state = randomBytes(32).toString('hex');

      // Store state with timestamp (expire after 10 minutes)
      stateStore.set(state, {
        timestamp: Date.now(),
        expiresAt: Date.now() + 10 * 60 * 1000
      });

      // Clean up expired states
      for (const [key, value] of stateStore.entries()) {
        if (Date.now() > value.expiresAt) {
          stateStore.delete(key);
        }
      }

      const authUrl = await getAuthorizationUrl(state);
      res.json({ authUrl, state });
    } catch (error) {
      logger.error({ err: error }, 'OIDC login init error');
      res.status(500).json({ error: 'Failed to initiate OIDC login' });
    }
  });

  // ===== Handle OIDC Callback =====

  router.get('/callback', async (req, res) => {
    try {
      if (!isOIDCEnabled()) {
        return res.status(503).json({ error: 'OIDC is not enabled' });
      }

      const { code, state, error: oidcError, error_description } = req.query;

      // Check for OIDC errors
      if (oidcError) {
        logger.error({ oidcError, error_description }, 'OIDC error');
        return res.status(400).json({
          error: 'OIDC authentication failed',
          details: error_description || oidcError
        });
      }

      // Validate state
      if (!state || !stateStore.has(state)) {
        return res.status(400).json({ error: 'Invalid or expired state' });
      }

      // Remove used state
      stateStore.delete(state);

      if (!code) {
        return res.status(400).json({ error: 'Authorization code missing' });
      }

      // Exchange code for tokens
      const tokenSet = await handleCallback(req.query, state);

      // Get user info and ID token claims
      const userinfo = await getUserInfo(tokenSet);
      const claims = tokenSet.claims();

      // Merge claims from both sources
      const allClaims = { ...claims, ...userinfo };

      // Extract user data from claims
      const userData = extractUserData(allClaims);

      // Find or create user (JIT provisioning)
      let user = await userDb.getByOIDCSub(userData.oidcSub);

      if (!user) {
        // Check if user with same email exists
        user = await userDb.getByEmail(userData.email);

        if (user) {
          // Link existing user to OIDC
          logger.info({ email: userData.email, oidcSub: userData.oidcSub }, 'Linking existing user to OIDC subject');
          await userDb.linkOIDC(user.id, userData.oidcSub);
        } else {
          // Create new user (JIT provisioning)
          logger.info({ email: userData.email, role: userData.role }, 'Creating new user via OIDC');
          const result = await userDb.createFromOIDC({
            email: userData.email,
            name: userData.fullName,
            first_name: userData.firstName,
            last_name: userData.lastName,
            role: userData.role,
            oidcSub: userData.oidcSub,
            manager_first_name: userData.managerFirstName,
            manager_last_name: userData.managerLastName,
            manager_email: userData.managerEmail
          });

          user = await userDb.getById(result.id);

          // Log user creation
          await auditDb.log(
            'create',
            'user',
            user.id,
            user.email,
            `User created via OIDC with role ${user.role}`,
            user.email
          );
        }
      }

      // Update last login
      await userDb.updateLastLogin(user.id);

      // Check for pending attestation invites and convert them
      let hasActiveAttestation = false;
      try {
        const pendingInvites = await attestationPendingInviteDb.getActiveByEmail(user.email);
        for (const invite of pendingInvites) {
          // Only convert if campaign is still active
          const campaign = await attestationCampaignDb.getById(invite.campaign_id);
          if (campaign && campaign.status === 'active') {
            // Create attestation record
            const record = await attestationRecordDb.create({
              campaign_id: invite.campaign_id,
              user_id: user.id,
              status: 'pending'
            });

            // Update invite
            await attestationPendingInviteDb.update(invite.id, {
              registered_at: new Date().toISOString(),
              converted_record_id: record.id
            });

            // Note: attestation_ready email removed - user will be redirected to attestations page
            hasActiveAttestation = true;

            logger.info({ email: user.email, campaignName: campaign.name }, 'Converted pending invite to attestation record');
          }
        }
      } catch (inviteError) {
        logger.error({ err: inviteError }, 'Error converting pending attestation invites');
        // Don't fail login if invite conversion fails
      }

      // Generate JWT token
      const token = generateToken(user);

      res.json({
        message: 'OIDC login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          first_name: user.first_name,
          last_name: user.last_name,
          manager_name: user.manager_name,
          manager_first_name: user.manager_first_name,
          manager_last_name: user.manager_last_name,
          manager_email: user.manager_email,
          profile_complete: user.profile_complete
        },
        redirectToAttestations: hasActiveAttestation
      });
    } catch (error) {
      logger.error({ err: error }, 'OIDC callback error');
      res.status(500).json({ error: 'Failed to process OIDC callback', details: error.message });
    }
  });

  return router;
}
