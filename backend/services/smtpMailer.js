import nodemailer from 'nodemailer';
import { smtpSettingsDb } from '../database.js';
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
  const transportConfig = {
    host: settings.host,
    port: settings.port,
    secure: settings.use_tls === 1 || settings.use_tls === true, // true for 465, false for other ports
    auth: auth,
    connectionTimeout: 10000, // 10 second connection timeout
    greetingTimeout: 5000,    // 5 second greeting timeout
    socketTimeout: 15000,     // 15 second socket timeout
    // Reject unauthorized only in production
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  };
  
  return nodemailer.createTransport(transportConfig);
};

/**
 * Sends a test email to verify SMTP configuration
 * @param {string} recipient - Email address to send the test email to
 * @returns {Promise<Object>} Result object with success status and message
 */
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
    
    const mailOptions = {
      from: `"${settings.from_name || 'KARS Notifications'}" <${settings.from_email}>`,
      to: toEmail,
      subject: 'KARS SMTP Test Email',
      text: `This is a test email from KARS (KeyData Asset Registration System).

If you received this email, your SMTP settings are configured correctly.

SMTP Server: ${settings.host}:${settings.port}
Sent at: ${new Date().toISOString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">KARS SMTP Test Email</h2>
          <p>This is a test email from <strong>KARS (KeyData Asset Registration System)</strong>.</p>
          <p>If you received this email, your SMTP settings are configured correctly.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            <strong>SMTP Server:</strong> ${settings.host}:${settings.port}<br>
            <strong>Sent at:</strong> ${new Date().toISOString()}
          </p>
        </div>
      `
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
    
    console.error('SMTP test email failed:', error);
    
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
    console.error('SMTP connection verification failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
