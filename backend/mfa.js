import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

// Generate MFA secret and QR code
export async function generateMFASecret(userEmail, issuer = 'ACS') {
  const secret = speakeasy.generateSecret({
    name: `${issuer} (${userEmail})`,
    issuer: issuer,
    length: 32
  });

  // Generate QR code as data URL
  const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32,
    qrCode: qrCodeDataUrl,
    otpauthUrl: secret.otpauth_url
  };
}

// Verify TOTP token
export function verifyTOTP(secret, token) {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2 // Allow 2 time steps before/after for clock drift
  });
}

// Generate backup codes
export function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

// Format backup codes for display (add dashes for readability)
export function formatBackupCode(code) {
  if (!code) return '';
  return code.match(/.{1,4}/g).join('-');
}

// Verify backup code format
export function isValidBackupCodeFormat(code) {
  // Check if code is a string
  if (typeof code !== 'string') return false;
  // Remove dashes and check if it's 8 hex characters
  const cleaned = code.replace(/-/g, '');
  return /^[0-9A-F]{8}$/i.test(cleaned);
}
