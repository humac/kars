/**
 * Email Templates Seeding Test
 * 
 * This test verifies that email templates are properly seeded into the database
 * during initialization and that the seeding logic handles various scenarios correctly.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';
import { assetDb, emailTemplateDb } from './database.js';

const TEST_DB_DIR = join(process.cwd(), 'test-data-email-templates');
const TEST_DB_PATH = join(TEST_DB_DIR, 'assets.db');

describe('Email Templates Seeding', () => {
  beforeAll(() => {
    // Create clean test directory
    try {
      rmSync(TEST_DB_DIR, { recursive: true, force: true });
    } catch (err) {
      // Directory doesn't exist, that's fine
    }
    mkdirSync(TEST_DB_DIR, { recursive: true });
    
    // Set DATA_DIR to test directory
    process.env.DATA_DIR = TEST_DB_DIR;
  });

  afterAll(() => {
    // Clean up test directory
    try {
      rmSync(TEST_DB_DIR, { recursive: true, force: true });
    } catch (err) {
      console.error('Failed to clean up test directory:', err);
    }
  });

  it('should seed email templates when database is initialized', async () => {
    // Initialize database (this should create tables and seed data)
    await assetDb.init();
    
    // Verify templates were seeded
    const templates = await emailTemplateDb.getAll();
    
    expect(templates).toBeDefined();
    expect(templates.length).toBe(6);
    
    // Verify all expected templates exist
    const templateKeys = templates.map(t => t.template_key);
    expect(templateKeys).toContain('test_email');
    expect(templateKeys).toContain('password_reset');
    expect(templateKeys).toContain('attestation_launch');
    expect(templateKeys).toContain('attestation_reminder');
    expect(templateKeys).toContain('attestation_escalation');
    expect(templateKeys).toContain('attestation_complete');
  });

  it('should have correct structure for each template', async () => {
    const templates = await emailTemplateDb.getAll();
    
    templates.forEach(template => {
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('template_key');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('subject');
      expect(template).toHaveProperty('html_body');
      expect(template).toHaveProperty('text_body');
      expect(template).toHaveProperty('variables');
      expect(template).toHaveProperty('is_custom');
      expect(template).toHaveProperty('updated_at');
      
      // Verify required fields are not empty
      expect(template.template_key).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.subject).toBeTruthy();
      expect(template.html_body).toBeTruthy();
      expect(template.text_body).toBeTruthy();
      
      // Verify is_custom is 0 (not customized)
      expect(template.is_custom).toBe(0);
    });
  });

  it('should not reseed templates if they already exist', async () => {
    // Get current template count
    const templatesBefore = await emailTemplateDb.getAll();
    const countBefore = templatesBefore.length;
    
    // Re-initialize database (should not reseed)
    await assetDb.init();
    
    // Verify count hasn't changed
    const templatesAfter = await emailTemplateDb.getAll();
    const countAfter = templatesAfter.length;
    
    expect(countAfter).toBe(countBefore);
    expect(countAfter).toBe(6);
  });

  it('should allow retrieval of individual templates by key', async () => {
    const testEmail = await emailTemplateDb.getByKey('test_email');
    
    expect(testEmail).toBeDefined();
    expect(testEmail.template_key).toBe('test_email');
    expect(testEmail.name).toBe('Test Email');
    expect(testEmail.subject).toContain('SMTP Test Email');
    expect(testEmail.html_body).toContain('{{siteName}}');
    expect(testEmail.text_body).toContain('test email');
  });

  it('should return null for non-existent template keys', async () => {
    const nonExistent = await emailTemplateDb.getByKey('non_existent_template');
    expect(nonExistent).toBeNull();
  });

  it('should handle various count types correctly with parseInt', () => {
    // This test verifies that parseInt with radix 10 handles various input types
    
    // Test with numeric count (SQLite returns this as number)
    const numericCount = 6;
    const count1 = parseInt(numericCount, 10) || 0;
    expect(count1).toBe(6);
    
    // Test with string count (PostgreSQL might return this as string)
    const stringCount = '6';
    const count2 = parseInt(stringCount, 10) || 0;
    expect(count2).toBe(6);
    
    // Test with undefined (edge case)
    const count3 = parseInt(undefined, 10) || 0;
    expect(count3).toBe(0);
    
    // Test with null (edge case)
    const count4 = parseInt(null, 10) || 0;
    expect(count4).toBe(0);
    
    // Test with empty string (edge case)
    const count5 = parseInt('', 10) || 0;
    expect(count5).toBe(0);
  });
});
