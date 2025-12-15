import nodemailer from 'nodemailer';
import { smtpSettingsDb, brandingSettingsDb, emailTemplateDb } from '../database.js';
import { decryptValue } from '../utils/encryption.js';

/**
 * SMTP Mailer Service
 * Handles sending emails via SMTP using stored settings
 */

/**
 * Substitutes variables in a template string with provided values
 * Variables use {{variableName}} syntax
 * @param {string} template - Template string with {{variable}} placeholders
 * @param {Object} variables - Object with variable names as keys and values
 * @returns {string} Template with variables replaced
 */
const substituteVariables = (template, variables) => {
  if (!template) return '';
  
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
};

/**
 * Gets the app URL with fallback chain: branding.app_url -> FRONTEND_URL -> BASE_URL -> localhost
 * @returns {Promise<string>} The app URL to use for email links
 */
export const getAppUrl = async () => {
  const branding = await brandingSettingsDb.get();
  return branding?.app_url || process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:3000';
};

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
    
    // Try to get template from database
    const template = await emailTemplateDb.getByKey('test_email');
    
    // Prepare variables for substitution
    const variables = {
      siteName,
      smtpHost: settings.host,
      smtpPort: settings.port,
      timestamp: new Date().toISOString()
    };
    
    // Use template if available, otherwise fall back to hardcoded default
    let subject, emailContent, textContent;
    
    if (template) {
      subject = substituteVariables(template.subject, variables);
      emailContent = substituteVariables(template.html_body, variables);
      textContent = substituteVariables(template.text_body, variables);
    } else {
      // Fallback to hardcoded template
      subject = `${siteName} SMTP Test Email`;
      emailContent = `
        <h2 style="color: #333;">${siteName} SMTP Test Email</h2>
        <p>This is a test email from <strong>${siteName} (KeyData Asset Registration System)</strong>.</p>
        <p>If you received this email, your SMTP settings are configured correctly.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          <strong>SMTP Server:</strong> ${settings.host}:${settings.port}<br>
          <strong>Sent at:</strong> ${new Date().toISOString()}
        </p>
      `;
      textContent = `This is a test email from ${siteName} (KeyData Asset Registration System).

If you received this email, your SMTP settings are configured correctly.

SMTP Server: ${settings.host}:${settings.port}
Sent at: ${new Date().toISOString()}`;
    }
    
    const mailOptions = {
      from: `"${settings.from_name || `${siteName} Notifications`}" <${settings.from_email}>`,
      to: toEmail,
      subject,
      text: textContent,
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
    
    // Try to get template from database
    const template = await emailTemplateDb.getByKey('password_reset');
    
    // Prepare variables for substitution
    const variables = {
      siteName,
      resetUrl,
      expiryTime: '1 hour'
    };
    
    // Use template if available, otherwise fall back to hardcoded default
    let subject, emailContent, textContent;
    
    if (template) {
      subject = substituteVariables(template.subject, variables);
      emailContent = substituteVariables(template.html_body, variables);
      textContent = substituteVariables(template.text_body, variables);
    } else {
      // Fallback to hardcoded template
      subject = `Password Reset Request - ${siteName}`;
      emailContent = `
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
      textContent = `You recently requested to reset your password for your ${siteName} account.

Click the link below to reset your password. This link will expire in 1 hour.

${resetUrl}

If you didn't request a password reset, please ignore this email or contact support if you have concerns.`;
    }
    
    const mailOptions = {
      from: `"${settings.from_name || `${siteName} Notifications`}" <${settings.from_email}>`,
      to: recipient,
      subject,
      text: textContent,
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
    
    // Construct attestation URL using fallback priority: provided URL -> app_url
    if (!attestationUrl) {
      const baseUrl = await getAppUrl();
      attestationUrl = `${baseUrl}/my-attestations`;
    }
    
    // Try to get template from database
    const template = await emailTemplateDb.getByKey('attestation_launch');
    
    // Prepare variables for substitution
    const variables = {
      siteName,
      campaignName: campaign.name,
      campaignDescription: campaign.description || '',
      attestationUrl
    };
    
    // Use template if available, otherwise fall back to hardcoded default
    let subject, emailContent, textContent;
    
    if (template) {
      subject = substituteVariables(template.subject, variables);
      emailContent = substituteVariables(template.html_body, variables);
      textContent = substituteVariables(template.text_body, variables);
    } else {
      // Fallback to hardcoded template
      subject = `Action Required: Asset Attestation - ${campaign.name}`;
      emailContent = `
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
      textContent = `A new asset attestation campaign has been launched: ${campaign.name}
${campaign.description ? '\n' + campaign.description + '\n' : ''}
Please review and attest to the status of all your registered assets. You can also add any missing assets that aren't currently registered.

Complete your attestation here: ${attestationUrl}`;
    }
    
    const mailOptions = {
      from: `"${settings.from_name || `${siteName} Notifications`}" <${settings.from_email}>`,
      to: recipient,
      subject,
      text: textContent,
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
    
    // Construct attestation URL using fallback priority: provided URL -> app_url
    if (!attestationUrl) {
      const baseUrl = await getAppUrl();
      attestationUrl = `${baseUrl}/my-attestations`;
    }
    
    // Try to get template from database
    const template = await emailTemplateDb.getByKey('attestation_reminder');
    
    // Prepare variables for substitution
    const variables = {
      siteName,
      campaignName: campaign.name,
      attestationUrl
    };
    
    // Use template if available, otherwise fall back to hardcoded default
    let subject, emailContent, textContent;
    
    if (template) {
      subject = substituteVariables(template.subject, variables);
      emailContent = substituteVariables(template.html_body, variables);
      textContent = substituteVariables(template.text_body, variables);
    } else {
      // Fallback to hardcoded template
      subject = `Reminder: Asset Attestation Pending - ${campaign.name}`;
      emailContent = `
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
      textContent = `This is a friendly reminder that you have a pending asset attestation for: ${campaign.name}

Please complete your attestation as soon as possible to help us maintain accurate asset records.

Complete your attestation here: ${attestationUrl}`;
    }
    
    const mailOptions = {
      from: `"${settings.from_name || `${siteName} Notifications`}" <${settings.from_email}>`,
      to: recipient,
      subject,
      text: textContent,
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
    
    // Try to get template from database
    const template = await emailTemplateDb.getByKey('attestation_escalation');
    
    // Prepare variables for substitution
    const variables = {
      siteName,
      campaignName: campaign.name,
      employeeName,
      employeeEmail,
      escalationDays: campaign.escalation_days || 10
    };
    
    // Use template if available, otherwise fall back to hardcoded default
    let subject, emailContent, textContent;
    
    if (template) {
      subject = substituteVariables(template.subject, variables);
      emailContent = substituteVariables(template.html_body, variables);
      textContent = substituteVariables(template.text_body, variables);
    } else {
      // Fallback to hardcoded template
      subject = `Team Attestation Outstanding: ${employeeName} - ${campaign.name}`;
      emailContent = `
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
      textContent = `This is a notification that one of your team members has not yet completed their asset attestation.

Employee: ${employeeName} (${employeeEmail})
Campaign: ${campaign.name}

Please follow up with this team member to ensure they complete their asset attestation promptly.

This is an automated escalation notification sent because the attestation has been outstanding for ${campaign.escalation_days} days.`;
    }
    
    const mailOptions = {
      from: `"${settings.from_name || `${siteName} Notifications`}" <${settings.from_email}>`,
      to: managerEmail,
      subject,
      text: textContent,
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
    
    // Try to get template from database
    const template = await emailTemplateDb.getByKey('attestation_complete');
    
    // Prepare variables for substitution
    const variables = {
      siteName,
      campaignName: campaign.name,
      employeeName,
      employeeEmail,
      completedAt: new Date().toLocaleString()
    };
    
    // Use template if available, otherwise fall back to hardcoded default
    let subject, emailContent, textContent;
    
    if (template) {
      subject = substituteVariables(template.subject, variables);
      emailContent = substituteVariables(template.html_body, variables);
      textContent = substituteVariables(template.text_body, variables);
    } else {
      // Fallback to hardcoded template
      subject = `Attestation Completed: ${employeeName} - ${campaign.name}`;
      emailContent = `
        <h2 style="color: #333;">Asset Attestation Completed</h2>
        <p>An employee has completed their asset attestation.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Employee:</strong> ${employeeName} (${employeeEmail})</p>
          <p style="margin: 5px 0;"><strong>Campaign:</strong> ${campaign.name}</p>
          <p style="margin: 5px 0;"><strong>Completed:</strong> ${new Date().toLocaleString()}</p>
        </div>
      `;
      textContent = `An employee has completed their asset attestation.

Employee: ${employeeName} (${employeeEmail})
Campaign: ${campaign.name}
Completed: ${new Date().toLocaleString()}`;
    }
    
    const mailOptions = {
      from: `"${settings.from_name || `${siteName} Notifications`}" <${settings.from_email}>`,
      to: adminEmails.join(', '),
      subject,
      text: textContent,
      html: buildEmailHtml(branding, siteName, emailContent)
    };
    
    await transport.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Failed to send attestation completion notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send attestation invitation to unregistered asset owner
 * @param {string} email - Recipient email
 * @param {string} firstName - Recipient first name
 * @param {string} lastName - Recipient last name  
 * @param {Object} campaign - Campaign object
 * @param {string} inviteToken - Secure registration token
 * @param {number} assetCount - Number of assets requiring attestation
 * @param {boolean} ssoEnabled - Whether SSO is enabled
 * @param {string} ssoButtonText - SSO button text from settings
 * @returns {Promise<Object>} Result object with success status and message
 */
export const sendAttestationRegistrationInvite = async (email, firstName, lastName, campaign, inviteToken, assetCount, ssoEnabled = false, ssoButtonText = 'Sign In with SSO') => {
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
    
    // Construct registration URLs
    const baseUrl = await getAppUrl();
    const manualRegisterUrl = `${baseUrl}/register?token=${inviteToken}`;
    const ssoLoginUrl = `${baseUrl}/login`;
    
    const fullName = `${firstName || ''} ${lastName || ''}`.trim() || 'there';
    const assetText = assetCount === 1 ? '1 asset' : `${assetCount} assets`;
    
    // Try to get template from database
    const template = await emailTemplateDb.getByKey('attestation_registration_invite');
    
    // Prepare variables for substitution
    const variables = {
      siteName,
      firstName: firstName || 'there',
      lastName: lastName || '',
      fullName,
      assetCount,
      assetText,
      campaignName: campaign.name,
      campaignDescription: campaign.description || '',
      endDate: campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : '',
      registerUrl: manualRegisterUrl,
      ssoLoginUrl,
      ssoButtonText,
      ssoEnabled: ssoEnabled ? 'true' : 'false'
    };
    
    // Use template if available, otherwise fall back to hardcoded default
    let subject, emailContent, textContent;
    
    if (template) {
      subject = substituteVariables(template.subject, variables);
      emailContent = substituteVariables(template.html_body, variables);
      textContent = substituteVariables(template.text_body, variables);
    } else {
      // Fallback to hardcoded template
      subject = `Action Required: Register for Asset Attestation - ${campaign.name}`;
      
      const ssoSection = ssoEnabled ? `
        <div style="margin: 30px 0;">
          <h3 style="color: #333; font-size: 18px; margin-bottom: 15px;">Option 1: Sign in with SSO (Recommended)</h3>
          <p>Your account will be created automatically when you sign in:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${ssoLoginUrl}" style="background-color: #10B981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">🔐 ${ssoButtonText}</a>
          </div>
          <p style="color: #666; font-size: 14px; text-align: center; margin-top: 10px;">
            Your account will be created automatically
          </p>
        </div>
        <div style="margin: 30px 0; text-align: center;">
          <div style="border-top: 1px solid #ddd; padding-top: 20px;">
            <span style="background: white; padding: 0 15px; color: #666;">OR</span>
          </div>
        </div>
        <div style="margin: 30px 0;">
          <h3 style="color: #333; font-size: 18px; margin-bottom: 15px;">Option 2: Register Manually</h3>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${manualRegisterUrl}" style="background-color: #3B82F6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">Create Account</a>
          </div>
        </div>
      ` : `
        <div style="margin: 30px 0; text-align: center;">
          <a href="${manualRegisterUrl}" style="background-color: #3B82F6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">Create Your Account</a>
        </div>
      `;
      
      emailContent = `
        <h2 style="color: #333;">Asset Attestation Required</h2>
        <p>Hello ${fullName},</p>
        <p>You have been identified as the owner of <strong>${assetText}</strong> that require attestation for the campaign: <strong>${campaign.name}</strong></p>
        ${campaign.description ? `<p style="color: #666;">${campaign.description}</p>` : ''}
        <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #92400E;"><strong>📋 What is attestation?</strong></p>
          <p style="margin: 5px 0 0 0; color: #92400E;">Asset attestation is a process where you review and confirm the status of all assets assigned to you. This helps us maintain accurate records of company equipment.</p>
        </div>
        <p>To complete your attestation, you'll need to register for a ${siteName} account first:</p>
        ${ssoSection}
        <p style="color: #666; font-size: 14px;">
          If the buttons don't work, you can copy and paste these links into your browser:<br>
          ${ssoEnabled ? `<strong>SSO Login:</strong> <a href="${ssoLoginUrl}" style="color: #3B82F6; word-break: break-all;">${ssoLoginUrl}</a><br>` : ''}
          <strong>Manual Registration:</strong> <a href="${manualRegisterUrl}" style="color: #3B82F6; word-break: break-all;">${manualRegisterUrl}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          This invitation is valid until the campaign ends${campaign.end_date ? ` on ${new Date(campaign.end_date).toLocaleDateString()}` : ''}. Please register and complete your attestation as soon as possible.
        </p>
      `;
      
      textContent = `Asset Attestation Required

Hello ${fullName},

You have been identified as the owner of ${assetText} that require attestation for the campaign: ${campaign.name}
${campaign.description ? '\n' + campaign.description + '\n' : ''}
What is attestation?
Asset attestation is a process where you review and confirm the status of all assets assigned to you. This helps us maintain accurate records of company equipment.

To complete your attestation, you'll need to register for a ${siteName} account first:

${ssoEnabled ? `Option 1: Sign in with SSO (Recommended)
Your account will be created automatically when you sign in: ${ssoLoginUrl}

OR

Option 2: Register Manually
` : ''}Create your account here: ${manualRegisterUrl}

This invitation is valid until the campaign ends${campaign.end_date ? ` on ${new Date(campaign.end_date).toLocaleDateString()}` : ''}. Please register and complete your attestation as soon as possible.`;
    }
    
    const mailOptions = {
      from: `"${settings.from_name || `${siteName} Notifications`}" <${settings.from_email}>`,
      to: email,
      subject,
      text: textContent,
      html: buildEmailHtml(branding, siteName, emailContent)
    };
    
    await transport.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Failed to send attestation registration invite:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send reminder email to unregistered asset owner
 * @param {string} email - Recipient email
 * @param {string} firstName - Recipient first name
 * @param {string} lastName - Recipient last name
 * @param {Object} campaign - Campaign object
 * @param {string} inviteToken - Secure registration token
 * @param {number} assetCount - Number of assets requiring attestation
 * @param {boolean} ssoEnabled - Whether SSO is enabled
 * @param {string} ssoButtonText - SSO button text from settings
 * @returns {Promise<Object>} Result object with success status and message
 */
export const sendAttestationUnregisteredReminder = async (email, firstName, lastName, campaign, inviteToken, assetCount, ssoEnabled = false, ssoButtonText = 'Sign In with SSO') => {
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
    
    // Construct registration URLs
    const baseUrl = await getAppUrl();
    const manualRegisterUrl = `${baseUrl}/register?token=${inviteToken}`;
    const ssoLoginUrl = `${baseUrl}/login`;
    
    const fullName = `${firstName || ''} ${lastName || ''}`.trim() || 'there';
    const assetText = assetCount === 1 ? '1 asset' : `${assetCount} assets`;
    
    // Try to get template from database
    const template = await emailTemplateDb.getByKey('attestation_unregistered_reminder');
    
    // Prepare variables for substitution
    const variables = {
      siteName,
      firstName: firstName || 'there',
      lastName: lastName || '',
      fullName,
      assetCount,
      assetText,
      campaignName: campaign.name,
      endDate: campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : '',
      registerUrl: manualRegisterUrl,
      ssoLoginUrl,
      ssoButtonText,
      ssoEnabled: ssoEnabled ? 'true' : 'false'
    };
    
    // Use template if available, otherwise fall back to hardcoded default
    let subject, emailContent, textContent;
    
    if (template) {
      subject = substituteVariables(template.subject, variables);
      emailContent = substituteVariables(template.html_body, variables);
      textContent = substituteVariables(template.text_body, variables);
    } else {
      // Fallback to hardcoded template
      subject = `Reminder: Register for Asset Attestation - ${campaign.name}`;
      
      const ssoSection = ssoEnabled ? `
        <div style="margin: 30px 0; text-align: center;">
          <a href="${ssoLoginUrl}" style="background-color: #10B981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px; margin: 0 10px;">🔐 ${ssoButtonText}</a>
          <a href="${manualRegisterUrl}" style="background-color: #3B82F6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px; margin: 0 10px;">Register Manually</a>
        </div>
      ` : `
        <div style="margin: 30px 0; text-align: center;">
          <a href="${manualRegisterUrl}" style="background-color: #3B82F6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">Register Now</a>
        </div>
      `;
      
      emailContent = `
        <h2 style="color: #333;">⏰ Attestation Reminder</h2>
        <p>Hello ${fullName},</p>
        <p>This is a friendly reminder that you still need to register to complete your asset attestation.</p>
        <div style="background-color: #DBEAFE; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #1E40AF;"><strong>Campaign:</strong> ${campaign.name}</p>
          <p style="margin: 5px 0 0 0; color: #1E40AF;"><strong>Assets awaiting attestation:</strong> ${assetText}</p>
          ${campaign.end_date ? `<p style="margin: 5px 0 0 0; color: #1E40AF;"><strong>Deadline:</strong> ${new Date(campaign.end_date).toLocaleDateString()}</p>` : ''}
        </div>
        <p>Please register for your ${siteName} account to complete your attestation:</p>
        ${ssoSection}
        <p style="color: #666; font-size: 14px;">
          If the buttons don't work, you can copy and paste these links:<br>
          ${ssoEnabled ? `SSO: <a href="${ssoLoginUrl}" style="color: #3B82F6;">${ssoLoginUrl}</a><br>` : ''}
          Manual: <a href="${manualRegisterUrl}" style="color: #3B82F6;">${manualRegisterUrl}</a>
        </p>
      `;
      
      textContent = `Attestation Reminder

Hello ${fullName},

This is a friendly reminder that you still need to register to complete your asset attestation.

Campaign: ${campaign.name}
Assets awaiting attestation: ${assetText}
${campaign.end_date ? `Deadline: ${new Date(campaign.end_date).toLocaleDateString()}` : ''}

Please register for your ${siteName} account to complete your attestation:

${ssoEnabled ? `SSO Login: ${ssoLoginUrl}\n\n` : ''}Register Manually: ${manualRegisterUrl}`;
    }
    
    const mailOptions = {
      from: `"${settings.from_name || `${siteName} Notifications`}" <${settings.from_email}>`,
      to: email,
      subject,
      text: textContent,
      html: buildEmailHtml(branding, siteName, emailContent)
    };
    
    await transport.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Failed to send attestation unregistered reminder:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send escalation email to manager about unregistered employee
 * @param {string} managerEmail - Manager's email address
 * @param {string} managerName - Manager's name
 * @param {string} employeeEmail - Employee's email
 * @param {string} employeeName - Employee's name
 * @param {Object} campaign - Campaign object
 * @param {number} assetCount - Number of assets requiring attestation
 * @returns {Promise<Object>} Result object with success status and message
 */
export const sendAttestationUnregisteredEscalation = async (managerEmail, managerName, employeeEmail, employeeName, campaign, assetCount) => {
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
    
    const assetText = assetCount === 1 ? '1 asset' : `${assetCount} assets`;
    
    // Try to get template from database
    const template = await emailTemplateDb.getByKey('attestation_unregistered_escalation');
    
    // Prepare variables for substitution
    const variables = {
      siteName,
      managerName: managerName || 'Manager',
      employeeEmail,
      employeeName,
      campaignName: campaign.name,
      assetCount,
      assetText
    };
    
    // Use template if available, otherwise fall back to hardcoded default
    let subject, emailContent, textContent;
    
    if (template) {
      subject = substituteVariables(template.subject, variables);
      emailContent = substituteVariables(template.html_body, variables);
      textContent = substituteVariables(template.text_body, variables);
    } else {
      // Fallback to hardcoded template
      subject = `Manager Alert: Team Member Not Registered for Attestation - ${campaign.name}`;
      
      emailContent = `
        <h2 style="color: #333;">👤 Team Member Registration Required</h2>
        <p>Hello ${managerName || 'Manager'},</p>
        <p>One of your team members has not yet registered for ${siteName} to complete their asset attestation.</p>
        <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #92400E;"><strong>Team Member:</strong> ${employeeName} (${employeeEmail})</p>
          <p style="margin: 5px 0 0 0; color: #92400E;"><strong>Campaign:</strong> ${campaign.name}</p>
          <p style="margin: 5px 0 0 0; color: #92400E;"><strong>Assets pending attestation:</strong> ${assetText}</p>
        </div>
        <p>Please remind <strong>${employeeName}</strong> to register and complete their asset attestation. They should have received an invitation email with registration instructions.</p>
        <p style="color: #666; font-size: 14px;">If they did not receive the invitation email, they can contact support or use the registration link provided in the campaign details.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          This is an automated escalation notification to help ensure timely completion of asset attestations.
        </p>
      `;
      
      textContent = `Team Member Registration Required

Hello ${managerName || 'Manager'},

One of your team members has not yet registered for ${siteName} to complete their asset attestation.

Team Member: ${employeeName} (${employeeEmail})
Campaign: ${campaign.name}
Assets pending attestation: ${assetText}

Please remind ${employeeName} to register and complete their asset attestation. They should have received an invitation email with registration instructions.

This is an automated escalation notification to help ensure timely completion of asset attestations.`;
    }
    
    const mailOptions = {
      from: `"${settings.from_name || `${siteName} Notifications`}" <${settings.from_email}>`,
      to: managerEmail,
      subject,
      text: textContent,
      html: buildEmailHtml(branding, siteName, emailContent)
    };
    
    await transport.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Failed to send attestation unregistered escalation:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send confirmation email after registration that attestation is ready
 * @param {string} email - User's email address
 * @param {string} firstName - User's first name
 * @param {Object} campaign - Campaign object
 * @returns {Promise<Object>} Result object with success status and message
 */
export const sendAttestationReadyEmail = async (email, firstName, campaign) => {
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
    
    // Construct attestation URL
    const baseUrl = await getAppUrl();
    const attestationUrl = `${baseUrl}/my-attestations`;
    
    // Try to get template from database
    const template = await emailTemplateDb.getByKey('attestation_ready');
    
    // Prepare variables for substitution
    const variables = {
      siteName,
      firstName: firstName || '',
      campaignName: campaign.name,
      campaignDescription: campaign.description || '',
      endDate: campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : '',
      attestationUrl
    };
    
    // Use template if available, otherwise fall back to hardcoded default
    let subject, emailContent, textContent;
    
    if (template) {
      subject = substituteVariables(template.subject, variables);
      emailContent = substituteVariables(template.html_body, variables);
      textContent = substituteVariables(template.text_body, variables);
    } else {
      // Fallback to hardcoded template
      subject = `Welcome! Your Attestation is Ready - ${campaign.name}`;
      
      emailContent = `
        <h2 style="color: #333;">✅ Account Created Successfully</h2>
        <p>Welcome ${firstName}!</p>
        <p>Your ${siteName} account has been created and your pending attestation is now ready to complete.</p>
        <div style="background-color: #D1FAE5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #065F46;"><strong>Campaign:</strong> ${campaign.name}</p>
          ${campaign.description ? `<p style="margin: 5px 0 0 0; color: #065F46;">${campaign.description}</p>` : ''}
          ${campaign.end_date ? `<p style="margin: 5px 0 0 0; color: #065F46;"><strong>Deadline:</strong> ${new Date(campaign.end_date).toLocaleDateString()}</p>` : ''}
        </div>
        <p>You can now log in and complete your asset attestation:</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${attestationUrl}" style="background-color: #3B82F6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">Complete Attestation</a>
        </div>
        <p style="color: #666; font-size: 14px;">
          If the button doesn't work, copy and paste this link:<br>
          <a href="${attestationUrl}" style="color: #3B82F6; word-break: break-all;">${attestationUrl}</a>
        </p>
      `;
      
      textContent = `Account Created Successfully

Welcome ${firstName}!

Your ${siteName} account has been created and your pending attestation is now ready to complete.

Campaign: ${campaign.name}
${campaign.description ? campaign.description + '\n' : ''}${campaign.end_date ? `Deadline: ${new Date(campaign.end_date).toLocaleDateString()}` : ''}

You can now log in and complete your asset attestation: ${attestationUrl}`;
    }
    
    const mailOptions = {
      from: `"${settings.from_name || `${siteName} Notifications`}" <${settings.from_email}>`,
      to: email,
      subject,
      text: textContent,
      html: buildEmailHtml(branding, siteName, emailContent)
    };
    
    await transport.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Failed to send attestation ready email:', error);
    return { success: false, error: error.message };
  }
};
