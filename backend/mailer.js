import nodemailer from 'nodemailer';
import { notificationSettingsDb } from './database.js';

/**
 * Creates a nodemailer transporter based on stored SMTP settings
 * @returns {Promise<object>} Nodemailer transporter instance
 */
const createTransporter = async () => {
  const settings = await notificationSettingsDb.get();
  
  if (!settings.enabled) {
    throw new Error('Email notifications are not enabled');
  }

  if (!settings.smtp_host) {
    throw new Error('SMTP host is not configured');
  }

  if (!settings.smtp_from_email) {
    throw new Error('From email address is not configured');
  }

  // Get the decrypted password
  const password = await notificationSettingsDb.getSmtpPassword();

  const transportConfig = {
    host: settings.smtp_host,
    port: settings.smtp_port || 587,
    secure: settings.smtp_use_tls === 1, // true for 465, false for other ports
  };

  // Only add auth if username is present
  if (settings.smtp_username) {
    transportConfig.auth = {
      user: settings.smtp_username,
      pass: password || ''
    };
  }

  return nodemailer.createTransport(transportConfig);
};

/**
 * Sends an email using the configured SMTP settings
 * @param {object} options - Email options (to, subject, text, html)
 * @returns {Promise<object>} Email send result
 */
export const sendEmail = async (options) => {
  const settings = await notificationSettingsDb.get();
  const transporter = await createTransporter();

  const mailOptions = {
    from: settings.smtp_from_name 
      ? `"${settings.smtp_from_name}" <${settings.smtp_from_email}>`
      : settings.smtp_from_email,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    };
  } catch (error) {
    console.error('Email send error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Sends a test email to verify SMTP configuration
 * @param {string} recipientEmail - Email address to send test email to
 * @returns {Promise<object>} Test result with success status and details
 */
export const sendTestEmail = async (recipientEmail) => {
  try {
    const settings = await notificationSettingsDb.get();
    
    if (!recipientEmail) {
      throw new Error('Recipient email address is required');
    }

    const result = await sendEmail({
      to: recipientEmail,
      subject: 'KARS Test Email - SMTP Configuration Verified',
      text: `This is a test email from KARS (KeyData Asset Registration System).

If you received this email, your SMTP configuration is working correctly.

SMTP Settings:
- Host: ${settings.smtp_host}
- Port: ${settings.smtp_port}
- TLS/SSL: ${settings.smtp_use_tls ? 'Enabled' : 'Disabled'}
- From: ${settings.smtp_from_email}

Sent at: ${new Date().toISOString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">KARS Test Email</h2>
          <p>This is a test email from <strong>KARS (KeyData Asset Registration System)</strong>.</p>
          <p>If you received this email, your SMTP configuration is working correctly.</p>
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">SMTP Settings:</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Host:</strong> ${settings.smtp_host}</li>
              <li><strong>Port:</strong> ${settings.smtp_port}</li>
              <li><strong>TLS/SSL:</strong> ${settings.smtp_use_tls ? 'Enabled' : 'Disabled'}</li>
              <li><strong>From:</strong> ${settings.smtp_from_email}</li>
            </ul>
          </div>
          
          <p style="color: #6b7280; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
        </div>
      `
    });

    return {
      success: true,
      message: 'Test email sent successfully',
      details: result
    };
  } catch (error) {
    console.error('Test email error:', error);
    return {
      success: false,
      message: error.message,
      error: error.toString()
    };
  }
};
