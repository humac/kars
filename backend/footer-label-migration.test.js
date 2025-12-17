/**
 * Test for footer_label column migration
 * 
 * This test verifies that the migration correctly adds the footer_label column
 * to the branding_settings table if it doesn't exist.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import Database from 'better-sqlite3';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const testDbPath = join(process.cwd(), 'test-footer-migration.db');

describe('footer_label column migration', () => {
  let db;

  beforeAll(() => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    // Create a fresh database with the old schema (without footer_label)
    db = new Database(testDbPath);
    
    // Create branding_settings table without footer_label column
    db.exec(`
      CREATE TABLE branding_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        logo_data TEXT,
        logo_filename TEXT,
        logo_content_type TEXT,
        site_name TEXT DEFAULT 'KARS',
        sub_title TEXT DEFAULT 'KeyData Asset Registration System',
        favicon_data TEXT,
        favicon_filename TEXT,
        favicon_content_type TEXT,
        primary_color TEXT DEFAULT '#3B82F6',
        include_logo_in_emails INTEGER DEFAULT 0,
        app_url TEXT,
        updated_at TEXT NOT NULL,
        updated_by TEXT
      )
    `);

    // Insert default row
    db.prepare(`
      INSERT INTO branding_settings (id, updated_at)
      VALUES (1, datetime('now'))
    `).run();
  });

  afterAll(() => {
    if (db) {
      db.close();
    }
    // Clean up test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  it('should not have footer_label column initially', () => {
    const columns = db.prepare('PRAGMA table_info(branding_settings)').all();
    const hasFooterLabel = columns.some(col => col.name === 'footer_label');
    
    expect(hasFooterLabel).toBe(false);
  });

  it('should add footer_label column with migration', () => {
    // This simulates the migration code in database.js
    const columns = db.prepare('PRAGMA table_info(branding_settings)').all();
    const hasFooterLabel = columns.some(col => col.name === 'footer_label');

    if (!hasFooterLabel) {
      db.prepare(
        "ALTER TABLE branding_settings ADD COLUMN footer_label TEXT DEFAULT 'SOC2 Compliance - KeyData Asset Registration System'"
      ).run();
    }

    // Verify column was added
    const updatedColumns = db.prepare('PRAGMA table_info(branding_settings)').all();
    const hasFooterLabelAfter = updatedColumns.some(col => col.name === 'footer_label');
    
    expect(hasFooterLabelAfter).toBe(true);
  });

  it('should have correct default value', () => {
    const row = db.prepare('SELECT footer_label FROM branding_settings WHERE id = 1').get();
    
    expect(row.footer_label).toBe('SOC2 Compliance - KeyData Asset Registration System');
  });

  it('should allow updating footer_label', () => {
    const testValue = 'Custom Footer Text';
    
    // Update the footer_label
    db.prepare(`
      UPDATE branding_settings
      SET footer_label = ?
      WHERE id = 1
    `).run(testValue);

    // Verify the update
    const row = db.prepare('SELECT footer_label FROM branding_settings WHERE id = 1').get();
    
    expect(row.footer_label).toBe(testValue);
  });

  it('should handle null footer_label', () => {
    // Update to null
    db.prepare(`
      UPDATE branding_settings
      SET footer_label = NULL
      WHERE id = 1
    `).run();

    // Verify null value
    const row = db.prepare('SELECT footer_label FROM branding_settings WHERE id = 1').get();
    
    expect(row.footer_label).toBeNull();
  });

  it('should handle empty string footer_label', () => {
    // Update to empty string
    db.prepare(`
      UPDATE branding_settings
      SET footer_label = ?
      WHERE id = 1
    `).run('');

    // Verify empty string
    const row = db.prepare('SELECT footer_label FROM branding_settings WHERE id = 1').get();
    
    expect(row.footer_label).toBe('');
  });
});
