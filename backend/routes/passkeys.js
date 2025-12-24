/**
 * Passkey Routes
 * Handles: WebAuthn passkey registration and authentication
 */

import { Router } from 'express';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger({ module: 'passkeys' });

/**
 * Create and configure the passkeys router
 * @param {Object} deps - Dependencies
 */
export default function createPasskeysRouter(deps) {
  const router = Router();

  const {
    // Database
    userDb,
    passkeyDb,
    // Auth
    authenticate,
    generateToken,
    // Helpers
    getPasskeyConfig,
    isPasskeyEnabled,
    getExpectedOrigin,
    pendingPasskeyRegistrations,
    pendingPasskeyLogins,
    safeJsonParse,
    safeJsonParseArray,
    serializePasskey,
  } = deps;

  // ===== List Passkeys =====

  router.get('/', authenticate, async (req, res) => {
    try {
      const passkeys = await passkeyDb.listByUser(req.user.id);
      res.json({ passkeys: passkeys.map(serializePasskey) });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Failed to list passkeys');
      res.status(500).json({ error: 'Unable to load passkeys' });
    }
  });

  // ===== Get Passkey Config =====

  router.get('/config', async (req, res) => {
    try {
      res.json({ enabled: await isPasskeyEnabled() });
    } catch (error) {
      logger.error({ err: error }, 'Failed to load passkey config');
      res.json({ enabled: true });
    }
  });

  // ===== Registration Options =====

  router.post('/registration-options', authenticate, async (req, res) => {
    try {
      if (!(await isPasskeyEnabled())) {
        return res.status(403).json({ error: 'Passkey registration is disabled by an administrator' });
      }

      const config = await getPasskeyConfig();
      const origin = getExpectedOrigin(req);

      logger.info({
        rpID: config.rpID,
        rpName: config.rpName,
        expectedOrigin: origin,
        requestOrigin: req.get('origin'),
        userEmail: req.user.email
      }, '[Passkey Registration] Configuration');

      const userPasskeys = await passkeyDb.listByUser(req.user.id);

      // Filter out passkeys with invalid credential_id before converting
      const validPasskeys = userPasskeys.filter(pk =>
        pk.credential_id && typeof pk.credential_id === 'string'
      );

      logger.info({ validPasskeysCount: validPasskeys.length }, '[Passkey Registration] User has existing passkeys');

      const options = await generateRegistrationOptions({
        rpName: config.rpName,
        rpID: config.rpID,
        userName: req.user.email,
        userDisplayName: req.user.name || req.user.email,
        // simplewebauthn requires userID to be a BufferSource (not string)
        userID: Buffer.from(req.user.id.toString()),
        attestationType: 'none',
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred'
        },
        excludeCredentials: validPasskeys.map((pk) => ({
          id: pk.credential_id,
          type: 'public-key',
          transports: safeJsonParse(pk.transports, undefined)
        }))
      });

      pendingPasskeyRegistrations.set(req.user.id, options.challenge);
      res.json({ options });
    } catch (error) {
      const config = await getPasskeyConfig();
      logger.error({ err: error }, 'Failed to generate passkey registration options');
      logger.error({ rpID: config.rpID }, '[Passkey Registration] RP ID');
      logger.error({ expectedOrigin: getExpectedOrigin(req) }, '[Passkey Registration] Expected Origin');
      logger.error({ requestOrigin: req.get('origin') }, '[Passkey Registration] Request Origin');
      logger.error('[Passkey Registration] Hint: Ensure PASSKEY_RP_ID matches your domain and you\'re accessing via the correct hostname (use localhost, not 127.0.0.1 for local development)');
      res.status(500).json({ error: 'Unable to start passkey registration' });
    }
  });

  // ===== Verify Registration =====

  router.post('/verify-registration', authenticate, async (req, res) => {
    try {
      if (!(await isPasskeyEnabled())) {
        return res.status(403).json({ error: 'Passkey registration is disabled by an administrator' });
      }

      const config = await getPasskeyConfig();
      const { credential, name } = req.body;
      const expectedChallenge = pendingPasskeyRegistrations.get(req.user.id);

      logger.info({ userEmail: req.user.email }, '[Passkey Registration] Starting verification for user');
      logger.info({
        id: credential?.id?.substring(0, 20) + '...',
        type: credential?.type,
        hasResponse: !!credential?.response
      }, '[Passkey Registration] Credential received');

      if (!expectedChallenge) {
        return res.status(400).json({ error: 'No passkey registration in progress' });
      }

      const verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: getExpectedOrigin(req),
        expectedRPID: config.rpID
      });

      logger.info({
        verified: verification?.verified,
        hasRegistrationInfo: !!verification?.registrationInfo
      }, '[Passkey Registration] Verification result');

      if (!verification?.verified || !verification.registrationInfo) {
        return res.status(400).json({ error: 'Passkey registration verification failed' });
      }

      const registrationInfo = verification.registrationInfo;

      const normalizeBuffer = (value) => {
        if (!value) return undefined;

        if (typeof value === 'string') {
          try {
            return isoBase64URL.toBuffer(value);
          } catch (err) {
            logger.error({ err }, '[Passkey Registration] Failed to normalize string buffer');
            return undefined;
          }
        }

        if (Buffer.isBuffer(value)) return value;
        if (value instanceof ArrayBuffer) return Buffer.from(value);
        if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);

        logger.error({ valueType: typeof value }, '[Passkey Registration] Unsupported buffer type');
        return undefined;
      };

      // Handle both modern and legacy shapes of SimpleWebAuthn registrationInfo
      const credentialID =
        normalizeBuffer(registrationInfo.credentialID) ||
        normalizeBuffer(registrationInfo.credential?.credentialID || registrationInfo.credential?.id);

      const credentialPublicKey =
        normalizeBuffer(registrationInfo.credentialPublicKey) ||
        normalizeBuffer(registrationInfo.credential?.credentialPublicKey || registrationInfo.credential?.publicKey);

      const counter =
        registrationInfo.counter ??
        registrationInfo.credential?.counter ??
        0;

      const { credentialDeviceType, credentialBackedUp } = registrationInfo;

      logger.info({
        credentialIDLength: credentialID?.length || credentialID?.byteLength || 0,
        credentialIDType: typeof credentialID,
        credentialPublicKeyLength: credentialPublicKey?.length || credentialPublicKey?.byteLength || 0,
        credentialPublicKeyType: typeof credentialPublicKey,
        counter,
        credentialDeviceType,
        credentialBackedUp
      }, '[Passkey Registration] Extracted data');

      const credentialIdBase64 = credentialID ? isoBase64URL.fromBuffer(credentialID) : credential?.rawId;
      const publicKeyBase64 = credentialPublicKey ? isoBase64URL.fromBuffer(credentialPublicKey) : undefined;

      if (!credentialIdBase64 || !publicKeyBase64) {
        logger.error({
          credentialIDPresent: !!credentialID,
          credentialPublicKeyPresent: !!credentialPublicKey,
          credentialIdBase64Length: credentialIdBase64?.length || 0,
          publicKeyBase64Length: publicKeyBase64?.length || 0
        }, '[Passkey Registration] Missing credential data after verification');

        pendingPasskeyRegistrations.delete(req.user.id);
        return res.status(400).json({
          error: 'Passkey registration data was incomplete. Please try creating the passkey again.'
        });
      }

      logger.info({
        credentialIdBase64Length: credentialIdBase64?.length || 0,
        publicKeyBase64Length: publicKeyBase64?.length || 0
      }, '[Passkey Registration] Converted to base64');

      const record = await passkeyDb.create({
        userId: req.user.id,
        name: name || 'Passkey',
        credentialId: credentialIdBase64,
        publicKey: publicKeyBase64,
        counter,
        transports: credential?.response?.transports || []
      });

      logger.info({ recordId: record.id }, '[Passkey Registration] Created record with ID');

      pendingPasskeyRegistrations.delete(req.user.id);
      const savedPasskey = await passkeyDb.getById(record.id);

      logger.info({
        id: savedPasskey?.id,
        credentialIdLength: savedPasskey?.credential_id?.length || 0,
        publicKeyLength: savedPasskey?.public_key?.length || 0
      }, '[Passkey Registration] Retrieved saved passkey');

      res.json({ passkey: serializePasskey(savedPasskey) });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Failed to verify passkey registration');
      res.status(500).json({ error: 'Unable to verify passkey registration' });
    }
  });

  // ===== Authentication Options =====

  router.post('/auth-options', async (req, res) => {
    try {
      if (!(await isPasskeyEnabled())) {
        return res.status(403).json({ error: 'Passkey sign-in is disabled by an administrator' });
      }

      const config = await getPasskeyConfig();
      const { email } = req.body;

      // Support both email-based and passwordless (discoverable credential) flows
      let allowCredentials = undefined;
      let userId = null;

      if (email) {
        // Email-based flow: fetch user's passkeys
        const user = await userDb.getByEmail(email);
        if (!user) {
          return res.status(404).json({ error: 'No account found for this email' });
        }

        const userPasskeys = await passkeyDb.listByUser(user.id);
        logger.info({ userEmail: user.email, passkeysCount: userPasskeys.length }, '[Passkey Auth] User has passkeys');

        if (!userPasskeys.length) {
          return res.status(400).json({ error: 'No passkeys registered for this account. Please register a passkey first from your profile settings.' });
        }

        // Filter out passkeys with invalid credential_id and convert to buffer
        const validPasskeys = userPasskeys.filter(pk =>
          pk.credential_id && typeof pk.credential_id === 'string'
        );

        logger.info({ validPasskeysCount: validPasskeys.length, totalPasskeys: userPasskeys.length }, '[Passkey Auth] Valid passkeys out of total');

        if (validPasskeys.length === 0) {
          logger.error({ userEmail: user.email }, '[Passkey Auth] Invalid passkey data detected for user');
          logger.error({ passkeyDetails: userPasskeys.map(pk => ({
            id: pk.id,
            name: pk.name,
            credential_id: pk.credential_id,
            credential_id_type: typeof pk.credential_id,
            credential_id_length: pk.credential_id ? pk.credential_id.length : 0,
            public_key: pk.public_key ? 'present' : 'missing',
            created_at: pk.created_at
          })) }, '[Passkey Auth] Passkey details');

          // Clean up invalid passkeys automatically
          logger.info('[Passkey Auth] Attempting to clean up invalid passkeys');
          for (const pk of userPasskeys) {
            if (!pk.credential_id || typeof pk.credential_id !== 'string') {
              try {
                await passkeyDb.delete(pk.id);
                logger.info({ passkeyId: pk.id }, '[Passkey Auth] Deleted invalid passkey ID');
              } catch (deleteErr) {
                logger.error({ err: deleteErr, passkeyId: pk.id }, '[Passkey Auth] Failed to delete invalid passkey ID');
              }
            }
          }

          return res.status(400).json({
            error: 'Your passkey data was corrupted and has been automatically removed. Please register a new passkey from your profile settings.'
          });
        }

        // simplewebauthn expects allowCredentials IDs to be base64url strings, not Buffers
        allowCredentials = validPasskeys.map((pk) => ({
          id: pk.credential_id,
          type: 'public-key',
          transports: safeJsonParse(pk.transports, undefined)
        }));

        userId = user.id;
      }

      // Generate authentication options
      const options = await generateAuthenticationOptions({
        rpID: config.rpID,
        userVerification: 'preferred',
        // If allowCredentials is undefined, this enables conditional mediation (passwordless)
        allowCredentials
      });

      // Store challenge for verification
      // Use challenge as key for passwordless flow, user.id for email-based flow
      const challengeKey = userId || options.challenge;
      pendingPasskeyLogins.set(challengeKey, {
        challenge: options.challenge,
        email: email || null,
        userId
      });

      res.json({ options });
    } catch (error) {
      logger.error({ err: error }, 'Failed to generate passkey authentication options');
      res.status(500).json({ error: 'Unable to start passkey sign in' });
    }
  });

  // ===== Verify Authentication =====

  router.post('/verify-authentication', async (req, res) => {
    try {
      if (!(await isPasskeyEnabled())) {
        return res.status(403).json({ error: 'Passkey sign-in is disabled by an administrator' });
      }

      const config = await getPasskeyConfig();
      const { email, credential } = req.body;

      if (!credential) {
        return res.status(400).json({ error: 'Credential response is required' });
      }

      // Extract the challenge from clientDataJSON so we can match the correct pending request
      let clientChallenge = null;
      try {
        const clientDataBuffer = Buffer.from(credential?.response?.clientDataJSON || '', 'base64url');
        const clientDataJson = JSON.parse(clientDataBuffer.toString('utf8'));
        if (clientDataJson?.challenge) {
          // Normalize to base64url without padding for consistent lookups
          clientChallenge = Buffer.from(clientDataJson.challenge, 'base64url').toString('base64url');
        }
      } catch (err) {
        logger.warn({ err, message: err.message }, '[Passkey Auth] Failed to parse clientDataJSON challenge');
      }

      // Look up passkey by credential ID
      const dbPasskey = await passkeyDb.getByCredentialId(credential.id);
      if (!dbPasskey) {
        return res.status(404).json({ error: 'Passkey not recognized' });
      }

      // Validate credential_id is a string before using it
      if (!dbPasskey.credential_id || typeof dbPasskey.credential_id !== 'string') {
        return res.status(500).json({ error: 'Invalid passkey data in database' });
      }

      // Get user info
      const user = email
        ? await userDb.getByEmail(email)
        : await userDb.getById(dbPasskey.user_id);

      if (!user) {
        return res.status(404).json({ error: 'User account not found' });
      }

      // Verify passkey belongs to the user
      if (dbPasskey.user_id !== user.id) {
        return res.status(403).json({ error: 'Passkey does not belong to this account' });
      }

      // Find the pending authentication challenge
      // For email-based flow, it's keyed by user.id; for passwordless, we need to search
      let pending = pendingPasskeyLogins.get(user.id);

      if (!pending && clientChallenge) {
        pending = pendingPasskeyLogins.get(clientChallenge);
      }

      if (!pending) {
        // Search for challenge in passwordless flow storage
        for (const [_key, value] of pendingPasskeyLogins.entries()) {
          if (value.userId === null || value.userId === user.id) {
            pending = value;
            break;
          }
        }
      }

      if (!pending) {
        return res.status(400).json({ error: 'No pending passkey authentication found' });
      }

      // Verify the authentication response using the credential format expected by simplewebauthn
      const verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: pending.challenge,
        expectedOrigin: getExpectedOrigin(req),
        expectedRPID: config.rpID,
        credential: {
          id: dbPasskey.credential_id,
          publicKey: isoBase64URL.toBuffer(dbPasskey.public_key),
          counter: typeof dbPasskey.counter === 'number' && Number.isFinite(dbPasskey.counter)
            ? dbPasskey.counter
            : 0,
          transports: safeJsonParseArray(dbPasskey.transports)
        }
      });

      if (!verification?.verified || !verification.authenticationInfo) {
        return res.status(400).json({ error: 'Passkey authentication failed' });
      }

      // Update counter and last login
      await passkeyDb.updateCounter(dbPasskey.id, verification.authenticationInfo.newCounter ?? dbPasskey.counter);
      await userDb.updateLastLogin(user.id);

      // Clean up pending authentication(s)
      pendingPasskeyLogins.delete(user.id);
      pendingPasskeyLogins.delete(pending.challenge);

      const token = generateToken(user);

      res.json({ token, user });
    } catch (error) {
      logger.error({ err: error }, 'Failed to verify passkey authentication');
      res.status(500).json({ error: 'Unable to verify passkey sign in' });
    }
  });

  // ===== Delete Passkey =====

  router.delete('/:id', authenticate, async (req, res) => {
    try {
      const passkey = await passkeyDb.getById(req.params.id);

      if (!passkey || passkey.user_id !== req.user.id) {
        return res.status(404).json({ error: 'Passkey not found' });
      }

      await passkeyDb.delete(req.params.id);
      res.json({ message: 'Passkey removed' });
    } catch (error) {
      logger.error({ err: error, passkeyId: req.params.id, userId: req.user?.id }, 'Failed to delete passkey');
      res.status(500).json({ error: 'Unable to delete passkey' });
    }
  });

  return router;
}
