import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Tests for SQL column name validation and dynamic column selection safety
 * 
 * These tests verify that:
 * 1. Column names from PRAGMA table_info are properly validated
 * 2. Invalid column names are rejected before being used in SQL
 * 3. SQL injection attempts through malformed column names are prevented
 * 4. Migration code handles schema evolution correctly with validation
 * 
 * SECURITY NOTE: This test suite validates defense-in-depth measures.
 * Column names from PRAGMA table_info are already trusted, but validation
 * provides protection against:
 * - Future code changes that might accept untrusted sources
 * - Bugs in schema parsing
 * - Database corruption or schema manipulation
 */

// Helper functions extracted from database.js for testing
// These should match the implementation in database.js

/**
 * Validates that a column name is safe to use in dynamic SQL
 */
const isValidColumnName = (columnName) => {
  if (typeof columnName !== 'string') {
    throw new TypeError('Column name must be a string');
  }

  if (columnName.length === 0 || columnName.length > 64) {
    return false;
  }

  const validColumnNamePattern = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
  return validColumnNamePattern.test(columnName);
};

/**
 * Safely constructs a SQL SELECT expression for a column, with validation
 */
const buildSafeColumnExpression = (columnName, alias = null) => {
  if (!isValidColumnName(columnName)) {
    throw new Error(`Invalid column name for SQL expression: "${columnName}"`);
  }

  let expr = columnName;
  if (alias) {
    if (!isValidColumnName(alias)) {
      throw new Error(`Invalid alias name for SQL expression: "${alias}"`);
    }
    expr = `${columnName} AS ${alias}`;
  }

  return expr;
};

describe('SQL Column Name Validation', () => {
  describe('isValidColumnName()', () => {
    describe('Valid column names', () => {
      it('should accept simple lowercase column names', () => {
        expect(isValidColumnName('id')).toBe(true);
        expect(isValidColumnName('name')).toBe(true);
        expect(isValidColumnName('email')).toBe(true);
      });

      it('should accept column names with underscores', () => {
        expect(isValidColumnName('employee_name')).toBe(true);
        expect(isValidColumnName('company_name')).toBe(true);
        expect(isValidColumnName('laptop_serial_number')).toBe(true);
        expect(isValidColumnName('_private')).toBe(true);
      });

      it('should accept column names starting with underscore', () => {
        expect(isValidColumnName('_id')).toBe(true);
        expect(isValidColumnName('__internal')).toBe(true);
      });

      it('should accept column names with numbers', () => {
        expect(isValidColumnName('field1')).toBe(true);
        expect(isValidColumnName('col_2')).toBe(true);
        expect(isValidColumnName('test123')).toBe(true);
      });

      it('should accept column names with hyphens (used in some schemas)', () => {
        expect(isValidColumnName('created-at')).toBe(true);
        expect(isValidColumnName('user-id')).toBe(true);
      });

      it('should accept mixed case column names', () => {
        expect(isValidColumnName('employeeName')).toBe(true);
        expect(isValidColumnName('CompanyID')).toBe(true);
        expect(isValidColumnName('UPPERCASE')).toBe(true);
      });
    });

    describe('Invalid column names (SQL injection attempts)', () => {
      it('should reject column names with spaces', () => {
        expect(isValidColumnName('employee name')).toBe(false);
        expect(isValidColumnName('DROP TABLE')).toBe(false);
      });

      it('should reject column names with special SQL characters', () => {
        expect(isValidColumnName('id;DROP TABLE users--')).toBe(false);
        expect(isValidColumnName("id' OR '1'='1")).toBe(false);
        expect(isValidColumnName('id/**/OR/**/1=1')).toBe(false);
        expect(isValidColumnName('id UNION SELECT')).toBe(false);
      });

      it('should reject column names with semicolons', () => {
        expect(isValidColumnName('id;')).toBe(false);
        expect(isValidColumnName(';DROP TABLE users')).toBe(false);
      });

      it('should reject column names with quotes', () => {
        expect(isValidColumnName("id'")).toBe(false);
        expect(isValidColumnName('id"')).toBe(false);
        expect(isValidColumnName("`id`")).toBe(false);
      });

      it('should reject column names with parentheses', () => {
        expect(isValidColumnName('id()')).toBe(false);
        expect(isValidColumnName('COUNT(*)')).toBe(false);
      });

      it('should reject column names with operators', () => {
        expect(isValidColumnName('id=1')).toBe(false);
        expect(isValidColumnName('id+1')).toBe(false);
        expect(isValidColumnName('id*2')).toBe(false);
        expect(isValidColumnName('id/2')).toBe(false);
      });

      it('should reject column names starting with numbers', () => {
        expect(isValidColumnName('1id')).toBe(false);
        expect(isValidColumnName('123')).toBe(false);
      });

      it('should reject empty column names', () => {
        expect(isValidColumnName('')).toBe(false);
      });

      it('should reject column names that are too long', () => {
        const tooLong = 'a'.repeat(65);
        expect(isValidColumnName(tooLong)).toBe(false);
      });

      it('should reject column names with dots (table.column notation)', () => {
        expect(isValidColumnName('users.id')).toBe(false);
        expect(isValidColumnName('table.column')).toBe(false);
      });

      it('should reject column names with backslashes', () => {
        expect(isValidColumnName('id\\n')).toBe(false);
        expect(isValidColumnName('id\\0')).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should accept maximum length column names (64 characters)', () => {
        const maxLength = 'a'.repeat(64);
        expect(isValidColumnName(maxLength)).toBe(true);
      });

      it('should reject non-string inputs', () => {
        expect(() => isValidColumnName(null)).toThrow(TypeError);
        expect(() => isValidColumnName(undefined)).toThrow(TypeError);
        expect(() => isValidColumnName(123)).toThrow(TypeError);
        expect(() => isValidColumnName({})).toThrow(TypeError);
        expect(() => isValidColumnName([])).toThrow(TypeError);
      });

      it('should handle unicode characters (reject them)', () => {
        expect(isValidColumnName('naïve')).toBe(false);
        expect(isValidColumnName('用户名')).toBe(false);
        expect(isValidColumnName('имя')).toBe(false);
      });
    });
  });

  describe('buildSafeColumnExpression()', () => {
    describe('Basic column expressions', () => {
      it('should build simple column expression', () => {
        expect(buildSafeColumnExpression('id')).toBe('id');
        expect(buildSafeColumnExpression('employee_name')).toBe('employee_name');
      });

      it('should build column expression with alias', () => {
        expect(buildSafeColumnExpression('client_name', 'company_name')).toBe('client_name AS company_name');
        expect(buildSafeColumnExpression('id', 'user_id')).toBe('id AS user_id');
      });

      it('should handle column names with underscores', () => {
        expect(buildSafeColumnExpression('laptop_serial_number')).toBe('laptop_serial_number');
      });
    });

    describe('Invalid column expressions', () => {
      it('should reject invalid column names', () => {
        expect(() => buildSafeColumnExpression('DROP TABLE users')).toThrow(Error);
        expect(() => buildSafeColumnExpression("id' OR '1'='1")).toThrow(Error);
        expect(() => buildSafeColumnExpression('id;')).toThrow(Error);
      });

      it('should reject invalid aliases', () => {
        expect(() => buildSafeColumnExpression('id', 'DROP TABLE')).toThrow(Error);
        expect(() => buildSafeColumnExpression('id', "'; DROP TABLE users--")).toThrow(Error);
      });

      it('should reject empty column names', () => {
        expect(() => buildSafeColumnExpression('')).toThrow(Error);
      });
    });

    describe('SQL injection prevention', () => {
      it('should prevent injection through column name', () => {
        const injectionAttempts = [
          "id; DROP TABLE users--",
          "id' OR '1'='1",
          "id UNION SELECT password FROM users",
          "id/**/OR/**/1=1",
          "id, password FROM users--"
        ];

        injectionAttempts.forEach(attempt => {
          expect(() => buildSafeColumnExpression(attempt)).toThrow(Error);
        });
      });

      it('should prevent injection through alias', () => {
        const injectionAttempts = [
          "x; DROP TABLE users--",
          "x' OR '1'='1",
          "x UNION SELECT password",
        ];

        injectionAttempts.forEach(attempt => {
          expect(() => buildSafeColumnExpression('id', attempt)).toThrow(Error);
        });
      });
    });
  });
});

describe('Schema Evolution Scenarios', () => {
  let tempDir;
  let db;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'kars-test-'));
    const dbPath = join(tempDir, 'test.db');
    db = new Database(dbPath);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Column name validation from PRAGMA table_info', () => {
    it('should validate all columns from a normal table schema', () => {
      // Create a table with various column types
      db.exec(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          employee_name TEXT,
          employee_email TEXT,
          company_name TEXT,
          laptop_serial_number TEXT,
          created_at TEXT
        )
      `);

      const columns = db.prepare("PRAGMA table_info(test_table)").all();
      
      // All column names should be valid
      columns.forEach(col => {
        expect(isValidColumnName(col.name)).toBe(true);
      });
    });

    it('should detect migration between client_name and company_name', () => {
      // Simulate old schema with client_name
      db.exec(`
        CREATE TABLE assets (
          id INTEGER PRIMARY KEY,
          employee_name TEXT,
          client_name TEXT
        )
      `);

      const columns = db.prepare("PRAGMA table_info(assets)").all();
      
      // Validate all columns
      columns.forEach(col => {
        expect(isValidColumnName(col.name)).toBe(true);
      });

      const hasCompanyName = columns.some(col => col.name === 'company_name');
      const hasClientName = columns.some(col => col.name === 'client_name');

      expect(hasCompanyName).toBe(false);
      expect(hasClientName).toBe(true);

      // Build safe expression for migration
      let companyExpr;
      if (hasCompanyName) {
        companyExpr = buildSafeColumnExpression('company_name', 'company_name');
      } else if (hasClientName) {
        companyExpr = buildSafeColumnExpression('client_name', 'company_name');
      } else {
        companyExpr = "'' AS company_name";
      }

      expect(companyExpr).toBe('client_name AS company_name');
    });

    it('should handle optional columns (laptop_make, laptop_model, notes)', () => {
      // Create minimal schema without optional columns
      db.exec(`
        CREATE TABLE assets_minimal (
          id INTEGER PRIMARY KEY,
          employee_name TEXT,
          company_name TEXT
        )
      `);

      const columns = db.prepare("PRAGMA table_info(assets_minimal)").all();
      
      // Validate all columns
      columns.forEach(col => {
        expect(isValidColumnName(col.name)).toBe(true);
      });

      const hasLaptopMake = columns.some(col => col.name === 'laptop_make');
      const hasLaptopModel = columns.some(col => col.name === 'laptop_model');
      const hasNotes = columns.some(col => col.name === 'notes');

      expect(hasLaptopMake).toBe(false);
      expect(hasLaptopModel).toBe(false);
      expect(hasNotes).toBe(false);

      // Build safe expressions - these should default to empty strings
      const laptopMakeExpr = hasLaptopMake ? buildSafeColumnExpression('laptop_make') : "''";
      const laptopModelExpr = hasLaptopModel ? buildSafeColumnExpression('laptop_model') : "''";
      const notesExpr = hasNotes ? buildSafeColumnExpression('notes') : "''";

      expect(laptopMakeExpr).toBe("''");
      expect(laptopModelExpr).toBe("''");
      expect(notesExpr).toBe("''");
    });

    it('should handle schema with all expected columns', () => {
      // Create full modern schema
      db.exec(`
        CREATE TABLE assets_full (
          id INTEGER PRIMARY KEY,
          employee_name TEXT,
          company_name TEXT,
          laptop_make TEXT,
          laptop_model TEXT,
          notes TEXT
        )
      `);

      const columns = db.prepare("PRAGMA table_info(assets_full)").all();
      
      // Validate all columns
      columns.forEach(col => {
        expect(isValidColumnName(col.name)).toBe(true);
      });

      const hasCompanyName = columns.some(col => col.name === 'company_name');
      const hasLaptopMake = columns.some(col => col.name === 'laptop_make');
      const hasLaptopModel = columns.some(col => col.name === 'laptop_model');
      const hasNotes = columns.some(col => col.name === 'notes');

      expect(hasCompanyName).toBe(true);
      expect(hasLaptopMake).toBe(true);
      expect(hasLaptopModel).toBe(true);
      expect(hasNotes).toBe(true);

      // Build safe expressions - all should reference actual columns
      const companyExpr = buildSafeColumnExpression('company_name', 'company_name');
      const laptopMakeExpr = buildSafeColumnExpression('laptop_make');
      const laptopModelExpr = buildSafeColumnExpression('laptop_model');
      const notesExpr = buildSafeColumnExpression('notes');

      expect(companyExpr).toBe('company_name AS company_name');
      expect(laptopMakeExpr).toBe('laptop_make');
      expect(laptopModelExpr).toBe('laptop_model');
      expect(notesExpr).toBe('notes');
    });
  });

  describe('Security: Defense against schema corruption', () => {
    it('should detect and reject if schema somehow contains malicious column name', () => {
      // This test documents what SHOULD happen if the database was corrupted
      // or manipulated to have invalid column names. In practice, SQLite won't
      // allow creating such columns through normal means, but validation provides
      // defense-in-depth.
      
      const maliciousColumnNames = [
        "id; DROP TABLE users--",
        "id' OR '1'='1",
        "name UNION SELECT password",
      ];

      maliciousColumnNames.forEach(maliciousName => {
        // Validation should reject these
        expect(isValidColumnName(maliciousName)).toBe(false);
        expect(() => buildSafeColumnExpression(maliciousName)).toThrow(Error);
      });
    });

    it('should validate columns before using them in migration SQL', () => {
      // Simulate the validation pattern used in database.js migrations
      db.exec(`
        CREATE TABLE test_assets (
          id INTEGER PRIMARY KEY,
          employee_name TEXT,
          company_name TEXT
        )
      `);

      const existingCols = db.prepare("PRAGMA table_info(test_assets)").all();
      
      // This is the pattern from database.js - validate all columns
      const validateAllColumns = () => {
        existingCols.forEach(col => {
          if (!isValidColumnName(col.name)) {
            throw new Error(`Database schema contains invalid column name: "${col.name}"`);
          }
        });
      };

      // Should not throw for valid schema
      expect(validateAllColumns).not.toThrow();

      // All columns should pass individual validation
      existingCols.forEach(col => {
        expect(isValidColumnName(col.name)).toBe(true);
      });
    });
  });
});

describe('Documentation and Requirements', () => {
  it('should document that PRAGMA table_info is the trusted source', () => {
    // This test serves as documentation that column names must come from
    // PRAGMA table_info or information_schema, never from user input
    const trustedSources = [
      'PRAGMA table_info(table_name)',
      'information_schema.columns (PostgreSQL)'
    ];

    const untrustedSources = [
      'User input',
      'HTTP request parameters',
      'Form data',
      'External APIs',
      'Environment variables (unless strictly controlled)',
      'Configuration files from untrusted sources'
    ];

    // This test exists purely for documentation
    expect(trustedSources.length).toBeGreaterThan(0);
    expect(untrustedSources.length).toBeGreaterThan(0);
  });

  it('should document the validation rules for column names', () => {
    // Column name requirements:
    const requirements = {
      'Must start with letter or underscore': /^[a-zA-Z_]/,
      'Can contain alphanumeric, underscore, hyphen': /^[a-zA-Z_][a-zA-Z0-9_-]*$/,
      'Length must be 1-64 characters': { min: 1, max: 64 },
      'Must be a string': 'string'
    };

    // Valid examples
    expect(isValidColumnName('id')).toBe(true);
    expect(isValidColumnName('_private')).toBe(true);
    expect(isValidColumnName('column_name')).toBe(true);
    expect(isValidColumnName('col-name')).toBe(true);
    expect(isValidColumnName('Column1')).toBe(true);

    // Invalid examples
    expect(isValidColumnName('1column')).toBe(false); // starts with number
    expect(isValidColumnName('col name')).toBe(false); // contains space
    expect(isValidColumnName('col;DROP')).toBe(false); // contains semicolon
    expect(isValidColumnName('')).toBe(false); // empty
    expect(isValidColumnName('a'.repeat(65))).toBe(false); // too long

    expect(requirements).toBeDefined();
  });
});
