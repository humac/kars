import nodemailer from 'nodemailer';
import { smtpSettingsDb, brandingSettingsDb } from '../database.js';
import { decryptValue } from '../utils/encryption.js';

/**
 * SMTP Mailer Service
 * Handles sending emails via SMTP using stored settings
 */

/**
 * Creates a nodemailer transport based on current SMTP settings
 * @returns {Promise<Object>} Nodemailer transport object
 * @throws {Error} If settings are invalid or not configured
 */
const createTransport = async () => {
  const settings = await smtpSettingsDb.get();
  
  if (!settings || !settings.enabled) {
    throw new Error('SMTP settings are not enabled');
  }
  
  if (!settings.host || !settings.port) {
    throw new Error('SMTP host and port are required');
  }
  
  // Get encrypted password if it exists
  let password = null;
  const encryptedPassword = await smtpSettingsDb.getPassword();
  if (encryptedPassword) {
    try {
      password = decryptValue(encryptedPassword);
    } catch (error) {
      throw new Error('Failed to decrypt SMTP password. Please check KARS_MASTER_KEY configuration.');
    }
  }
  
  // Build auth config
  let auth = null;
  if (settings.username) {
    auth = {
      user: settings.username,
      pass: password || ''
    };
    
    // Set auth method if specified
    if (settings.auth_method && settings.auth_method !== 'plain') {
      auth.type = settings.auth_method;
    }
  }
  
  // Create transport
  // Note: 'secure: true' is for port 465 (implicit TLS)
  // For port 587 and others, use 'secure: false' and let STARTTLS handle encryption
  const useTls = settings.use_tls === 1 || settings.use_tls === true;
  const transportConfig = {
    host: settings.host,
    port: settings.port,
    secure: useTls && settings.port === 465, // true only for port 465 (implicit TLS)
    auth: auth,
    connectionTimeout: 10000, // 10 second connection timeout
    greetingTimeout: 5000,    // 5 second greeting timeout
    socketTimeout: 15000,     // 15 second socket timeout
    // Enable STARTTLS for non-465 ports when TLS is requested
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    },
    requireTLS: useTls && settings.port !== 465 // Require STARTTLS for port 587 and similar
  };
  
  return nodemailer.createTransport(transportConfig);
};

/**
 * Sends a test email to verify SMTP configuration
 * @param {string} recipient - Email address to send the test email to
 * @returns {Promise<Object>} Result object with success status and message
 */
/**
 * Builds email HTML with optional logo header
 * @param {Object} branding - Branding settings with logo_data and include_logo_in_emails
 * @param {string} siteName - Custom site name or 'KARS'
 * @param {string} content - Main email content HTML
 * @returns {string} Complete HTML email template
 */
const buildEmailHtml = (branding, siteName, content) => {
  const logoHeader = branding?.include_logo_in_emails && branding?.logo_data
    ? `<div style="text-align: center; margin-bottom: 20px;">
         <img src="${branding.logo_data}" alt="${siteName}" style="max-height: 80px; max-width: 300px; object-fit: contain;" />
       </div>`
    : '';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      ${logoHeader}
      ${content}
    </div>
  `;
};

export const sendTestEmail = async (recipient) => {
  try {
    const settings = await smtpSettingsDb.get();
    
    if (!settings || !settings.enabled) {
      return {
        success: false,
        error: 'SMTP settings are not enabled. Please enable them first.'
      };
    }
    
    if (!settings.from_email) {
      return {
        success: false,
        error: 'From email address is not configured'
      };
    }
    
    // Use provided recipient or default
    const toEmail = recipient || settings.default_recipient;
    if (!toEmail) {
      return {
        success: false,
        error: 'No recipient specified and no default recipient configured'
      };
    }
    
    const transport = await createTransport();
    
    // Get branding settings for email customization
    const branding = await brandingSettingsDb.get();
    const siteName = branding?.site_name || 'KARS';
    
    const emailContent = `
      <h2 style="color: #333;">${siteName} SMTP Test Email</h2>
      <p>This is a test email from <strong>${siteName} (KeyData Asset Registration System)</strong>.</p>
      <p>If you received this email, your SMTP settings are configured correctly.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">
        <strong>SMTP Server:</strong> ${settings.host}:${settings.port}<br>
        <strong>Sent at:</strong> ${new Date().toISOString()}
      </p>
    `;
    
    const mailOptions = {
      from: `"${settings.from_name || `${siteName} Notifications`}" <${settings.from_email}>`,
      to: toEmail,
      subject: `${siteName} SMTP Test Email`,
      text: `This is a test email from ${siteName} (KeyData Asset Registration System).

If you received this email, your SMTP settings are configured correctly.

SMTP Server: ${settings.host}:${settings.port}
Sent at: ${new Date().toISOString()}`,
      html: buildEmailHtml(branding, siteName, emailContent)
    };
    
    const info = await transport.sendMail(mailOptions);
    
    return {
      success: true,
      message: `Test email sent successfully to ${toEmail}`,
      messageId: info.messageId,
      response: info.response
    };
  } catch (error) {
    // Parse common SMTP errors into user-friendly messages
    let errorMessage = error.message;
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = `Connection refused. Please check that the SMTP server is running and the host/port are correct.`;
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKET') {
      errorMessage = `Connection timed out. Please check your network connection and firewall settings.`;
    } else if (error.code === 'EAUTH' || error.responseCode === 535) {
      errorMessage = `Authentication failed. Please check your username and password.`;
    } else if (error.code === 'CERT_HAS_EXPIRED' || error.message.includes('certificate')) {
      errorMessage = `SSL/TLS certificate error. The server certificate may be expired or invalid.`;
    } else if (error.responseCode >= 500 && error.responseCode < 600) {
      errorMessage = `SMTP server error (${error.responseCode}): ${error.response || error.message}`;
    }
    
    // console.error('SMTP test email failed:', error);
    
    return {
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
};

/**
 * Verifies SMTP connection without sending an email
 * @returns {Promise<Object>} Result object with success status
 */
export const verifyConnection = async () => {
  try {
    const transport = await createTransport();
    await transport.verify();
    return {
      success: true,
      message: 'SMTP connection verified successfully'
    };
  } catch (error) {
    // console.error('SMTP connection verification failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Sends a password reset email with a reset link
 * @param {string} recipient - Email address to send the reset email to
 * @param {string} resetToken - Password reset token
 * @param {string} resetUrl - Full URL for password reset (including token)
 * @returns {Promise<Object>} Result object with success status and message
 */
export const sendPasswordResetEmail = async (recipient, resetToken, resetUrl) => {
  try {
    const settings = await smtpSettingsDb.get();
    
    if (!settings || !settings.enabled) {
      return {
        success: false,
        error: 'SMTP settings are not enabled. Please enable them first.'
      };
    }
    
    if (!settings.from_email) {
      return {
        success: false,
        error: 'From email address is not configured'
      };
    }
    
    const transport = await createTransport();
    
    // Get branding settings for email customization
    const branding = await brandingSettingsDb.get();
    const siteName = branding?.site_name || 'KARS';
    
    const emailContent = `
      <h2 style="color: #333;">Password Reset Request</h2>
      <p>You recently requested to reset your password for your <strong>${siteName}</strong> account.</p>
      <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
      <div style="margin: 30px 0; text-align: center;">
        <a href="${resetUrl}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Reset Password</a>
      </div>
      <p style="color: #666; font-size: 14px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${resetUrl}" style="color: #3B82F6; word-break: break-all;">${resetUrl}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #999; font-size: 12px;">
        If you didn't request a password reset, please ignore this email or contact support if you have concerns.<br>
        This link will expire in 1 hour for security reasons.
      </p>
    `;
    
    const mailOptions = {
      from: `"${settings.from_name || `${siteName} Notifications`}" <${settings.from_email}>`,
      to: recipient,
      subject: `Password Reset Request - ${siteName}`,
      text: `You recently requested to reset your password for your ${siteName} account.

Click the link below to reset your password. This link will expire in 1 hour.

${resetUrl}

If you didn't request a password reset, please ignore this email or contact support if you have concerns.`,
      html: buildEmailHtml(branding, siteName, emailContent)
    };
    
    const info = await transport.sendMail(mailOptions);
    
    return {
      success: true,
      message: `Password reset email sent successfully to ${recipient}`,
      messageId: info.messageId
    };
  } catch (error) {
    // Parse common SMTP errors into user-friendly messages
    let errorMessage = error.message;
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = `Connection refused. Please check that the SMTP server is running and the host/port are correct.`;
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKET') {
      errorMessage = `Connection timed out. Please check your network connection and firewall settings.`;
    } else if (error.code === 'EAUTH' || error.responseCode === 535) {
      errorMessage = `Authentication failed. Please check your username and password.`;
    }
    
    return {
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
};

/**
 * Sends attestation campaign launch email to an employee
 * @param {string} recipient - Employee email address
 * @param {Object} campaign - Campaign object with name and description
 * @param {string} attestationUrl - Full URL to the attestation page (optional, will be constructed if not provided)
 * @returns {Promise<Object>} Result object with success status and message
 */
export const sendAttestationLaunchEmail = async (recipient, campaign, attestationUrl = null) => {
  try {
    const settings = await smtpSettingsDb.get();
    
    if (!settings || !settings.enabled) {
      return { success: false, error: 'SMTP settings are not enabled' };
    }
    
    if (!settings.from_email) {
      return { success: false, error: 'From email address is not configured' };
    }
    
    const transport = await createTransport();
    const branding = await brandingSettingsDb.get();
    const siteName = branding?.site_name || 'KARS';
    
    // Construct attestation URL using fallback priority: provided URL -> branding app_url -> FRONTEND_URL -> localhost
    if (!attestationUrl) {
      const baseUrl = branding?.app_url || process.env.FRONTEND_URL || 'http://localhost:3000';
      attestationUrl = `${baseUrl}/my-attestations`;
    }
    
    const emailContent = `
      <h2 style="color: #333;">Asset Attestation Required</h2>
      <p>A new asset attestation campaign has been launched: <strong>${campaign.name}</strong></p>
      ${campaign.description ? `<p>${campaign.description}</p>` : ''}
      <p>Please review and attest to the status of all your registered assets. You can also add any missing assets that aren't currently registered.</p>
      <div style="margin: 30px 0; text-align: center;">
        <a href="${attestationUrl}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Complete Attestation</a>
      </div>
      <p style="color: #666; font-size: 14px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${attestationUrl}" style="color: #3B82F6; word-break: break-all;">${attestationUrl}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #999; font-size: 12px;">
        This attestation is required to maintain accurate asset records. Please complete it at your earliest convenience.
      </p>
    `;
    
    const mailOptions = {
      from: `"${settings.from_name || `${siteName} Notifications`}" <${settings.from_email}>`,
      to: recipient,
      subject: `Action Required: Asset Attestation - ${campaign.name}`,
      text: `A new asset attestation campaign has been launched: ${campaign.name}
${campaign.description ? '\n' + campaign.description + '\n' : ''}
Please review and attest to the status of all your registered assets. You can also add any missing assets that aren't currently registered.

Complete your attestation here: ${attestationUrl}`,
      html: buildEmailHtml(branding, siteName, emailContent)
    };
    
    await transport.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Failed to send attestation launch email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Sends attestation reminder email to an employee
 * @param {string} recipient - Employee email address
 * @param {Object} campaign - Campaign object with name
 * @param {string} attestationUrl - Full URL to the attestation page (optional, will be constructed if not provided)
 * @returns {Promise<Object>} Result object with success status and message
 */
export const sendAttestationReminderEmail = async (recipient, campaign, attestationUrl = null) => {
  try {
    const settings = await smtpSettingsDb.get();
    
    if (!settings || !settings.enabled) {
      return { success: false, error: 'SMTP settings are not enabled' };
    }
    
    if (!settings.from_email) {
      return { success: false, error: 'From email address is not configured' };
    }
    
    const transport = await createTransport();
    const branding = await brandingSettingsDb.get();
    const siteName = branding?.site_name || 'KARS';
    
    // Construct attestation URL using fallback priority: provided URL -> branding app_url -> FRONTEND_URL -> localhost
    if (!attestationUrl) {
      const baseUrl = branding?.app_url || process.env.FRONTEND_URL || 'http://localhost:3000';
      attestationUrl = `${baseUrl}/my-attestations`;
    }
    
    const emailContent = `
      <h2 style="color: #333;">Reminder: Asset Attestation Pending</h2>
      <p>This is a friendly reminder that you have a pending asset attestation for: <strong>${campaign.name}</strong></p>
      <p>Please complete your attestation as soon as possible to help us maintain accurate asset records.</p>
      <div style="margin: 30px 0; text-align: center;">
        <a href="${attestationUrl}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Complete Attestation Now</a>
      </div>
      <p style="color: #666; font-size: 14px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${attestationUrl}" style="color: #3B82F6; word-break: break-all;">${attestationUrl}</a>
      </p>
    `;
    
    const mailOptions = {
      from: `"${settings.from_name || `${siteName} Notifications`}" <${settings.from_email}>`,
      to: recipient,
      subject: `Reminder: Asset Attestation Pending - ${campaign.name}`,
      text: `This is a friendly reminder that you have a pending asset attestation for: ${campaign.name}

Please complete your attestation as soon as possible to help us maintain accurate asset records.

Complete your attestation here: ${attestationUrl}`,
      html: buildEmailHtml(branding, siteName, emailContent)
    };
    
    await transport.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Failed to send attestation reminder email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Sends attestation escalation email to a manager
 * @param {string} managerEmail - Manager email address
 * @param {string} employeeName - Employee name who hasn't completed attestation
 * @param {string} employeeEmail - Employee email address
 * @param {Object} campaign - Campaign object with name
 * @returns {Promise<Object>} Result object with success status and message
 */
export const sendAttestationEscalationEmail = async (managerEmail, employeeName, employeeEmail, campaign) => {
  try {
    const settings = await smtpSettingsDb.get();
    
    if (!settings || !settings.enabled) {
      return { success: false, error: 'SMTP settings are not enabled' };
    }
    
    if (!settings.from_email) {
      return { success: false, error: 'From email address is not configured' };
    }
    
    const transport = await createTransport();
    const branding = await brandingSettingsDb.get();
    const siteName = branding?.site_name || 'KARS';
    
    const emailContent = `
      <h2 style="color: #333;">Action Required: Team Member Attestation Outstanding</h2>
      <p>This is a notification that one of your team members has not yet completed their asset attestation.</p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Employee:</strong> ${employeeName} (${employeeEmail})</p>
        <p style="margin: 5px 0;"><strong>Campaign:</strong> ${campaign.name}</p>
      </div>
      <p>Please follow up with this team member to ensure they complete their asset attestation promptly.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #999; font-size: 12px;">
        This is an automated escalation notification sent because the attestation has been outstanding for ${campaign.escalation_days} days.
      </p>
    `;
    
    const mailOptions = {
      from: `"${settings.from_name || `${siteName} Notifications`}" <${settings.from_email}>`,
      to: managerEmail,
      subject: `Team Attestation Outstanding: ${employeeName} - ${campaign.name}`,
      text: `This is a notification that one of your team members has not yet completed their asset attestation.

Employee: ${employeeName} (${employeeEmail})
Campaign: ${campaign.name}

Please follow up with this team member to ensure they complete their asset attestation promptly.

This is an automated escalation notification sent because the attestation has been outstanding for ${campaign.escalation_days} days.`,
      html: buildEmailHtml(branding, siteName, emailContent)
    };
    
    await transport.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Failed to send attestation escalation email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Sends attestation completion notification to admins
 * @param {string[]} adminEmails - Array of admin email addresses
 * @param {string} employeeName - Employee name who completed attestation
 * @param {string} employeeEmail - Employee email address
 * @param {Object} campaign - Campaign object with name
 * @returns {Promise<Object>} Result object with success status and message
 */
export const sendAttestationCompleteAdminNotification = async (adminEmails, employeeName, employeeEmail, campaign) => {
  try {
    const settings = await smtpSettingsDb.get();
    
    if (!settings || !settings.enabled) {
      return { success: false, error: 'SMTP settings are not enabled' };
    }
    
    if (!settings.from_email) {
      return { success: false, error: 'From email address is not configured' };
    }
    
    const transport = await createTransport();
    const branding = await brandingSettingsDb.get();
    const siteName = branding?.site_name || 'KARS';
    
    const emailContent = `
      <h2 style="color: #333;">Asset Attestation Completed</h2>
      <p>An employee has completed their asset attestation.</p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Employee:</strong> ${employeeName} (${employeeEmail})</p>
        <p style="margin: 5px 0;"><strong>Campaign:</strong> ${campaign.name}</p>
        <p style="margin: 5px 0;"><strong>Completed:</strong> ${new Date().toLocaleString()}</p>
      </div>
    `;
    
    const mailOptions = {
      from: `"${settings.from_name || `${siteName} Notifications`}" <${settings.from_email}>`,
      to: adminEmails.join(', '),
      subject: `Attestation Completed: ${employeeName} - ${campaign.name}`,
      text: `An employee has completed their asset attestation.

Employee: ${employeeName} (${employeeEmail})
Campaign: ${campaign.name}
Completed: ${new Date().toLocaleString()}`,
      html: buildEmailHtml(branding, siteName, emailContent)
    };
    
    await transport.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Failed to send attestation completion notification:', error);
    return { success: false, error: error.message };
  }
};
