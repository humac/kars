import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Encryption utilities for securing sensitive data at rest
 * Uses AES-256-GCM for authenticated encryption
 */

// Get master key from environment variable
const getMasterKey = () => {
  const key = process.env.KARS_MASTER_KEY;
  
  if (!key) {
    throw new Error('KARS_MASTER_KEY environment variable is not set. Please set a 256-bit (32-byte) key encoded as base64 or hex.');
  }
  
  // Try to decode as base64 first, then hex
  let keyBuffer;
  try {
    keyBuffer = Buffer.from(key, 'base64');
    if (keyBuffer.length !== 32) {
      // Try hex if base64 didn't produce 32 bytes
      keyBuffer = Buffer.from(key, 'hex');
    }
  } catch (err) {
    keyBuffer = Buffer.from(key, 'hex');
  }
  
  if (keyBuffer.length !== 32) {
    throw new Error(`KARS_MASTER_KEY must be exactly 32 bytes (256 bits). Current length: ${keyBuffer.length} bytes. Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`);
  }
  
  return keyBuffer;
};

/**
 * Encrypts a string value using AES-256-GCM
 * @param {string} plaintext - The value to encrypt
 * @returns {string} Encrypted value in format: iv:authTag:ciphertext (all base64-encoded)
 * @throws {Error} If encryption fails or KARS_MASTER_KEY is not set
 */
export const encryptValue = (plaintext) => {
  if (!plaintext) {
    return null;
  }
  
  try {
    const key = getMasterKey();
    
    // Generate random IV (12 bytes is recommended for GCM)
    const iv = randomBytes(12);
    
    // Create cipher
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    
    // Encrypt the data
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get the auth tag
    const authTag = cipher.getAuthTag();
    
    // Return format: iv:authTag:ciphertext (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

/**
 * Decrypts a string value that was encrypted with encryptValue
 * @param {string} encryptedData - The encrypted value in format: iv:authTag:ciphertext
 * @returns {string} Decrypted plaintext value
 * @throws {Error} If decryption fails, auth tag verification fails, or format is invalid
 */
export const decryptValue = (encryptedData) => {
  if (!encryptedData) {
    return null;
  }
  
  try {
    const key = getMasterKey();
    
    // Parse the encrypted data
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format. Expected format: iv:authTag:ciphertext');
    }
    
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encrypted = parts[2];
    
    // Create decipher
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt the data
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

/**
 * Generates a random 256-bit key suitable for KARS_MASTER_KEY
 * @param {string} encoding - The encoding format ('base64' or 'hex')
 * @returns {string} Random 32-byte key in the specified encoding
 */
export const generateMasterKey = (encoding = 'base64') => {
  const key = randomBytes(32);
  return key.toString(encoding);
};
