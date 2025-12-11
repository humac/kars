import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, isAbsolute } from 'path';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use data directory for database (for Docker volume mounting)
const dataDir = process.env.DATA_DIR || join(__dirname, 'data');
try {
  mkdirSync(dataDir, { recursive: true });
} catch (err) {
  // Directory already exists
}

const configPath = join(dataDir, 'database.config.json');

const defaultConfig = {
  engine: 'sqlite',
  postgresUrl: ''
};

const loadConfig = () => {
  try {
    const raw = readFileSync(configPath, 'utf-8');
    return { ...defaultConfig, ...JSON.parse(raw) };
  } catch (err) {
    // Create default config if it doesn't exist
    try {
      writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    } catch (writeErr) {
      console.error('Unable to persist default database config:', writeErr.message);
    }
    return { ...defaultConfig };
  }
};

const saveConfig = (config) => {
  writeFileSync(configPath, JSON.stringify(config, null, 2));
};

const envEngine = (process.env.DB_CLIENT || '').toLowerCase();
const envPostgresUrl = process.env.POSTGRES_URL || '';
const configFile = loadConfig();

const configuredEngine = (configFile.engine || defaultConfig.engine).toLowerCase();
const configuredPostgresUrl = configFile.postgresUrl || '';
const wantsPostgres = (envEngine || configuredEngine) === 'postgres';
const postgresUrl = envPostgresUrl || configuredPostgresUrl || '';

/**
 * Validate that a path is absolute and doesn't contain path traversal sequences
 * @param {string} filePath - The file path to validate
 * @returns {boolean} True if the path is safe to use
 */
const isValidCertPath = (filePath) => {
  if (!filePath) return false;
  
  // Must be an absolute path
  if (!isAbsolute(filePath)) {
    return false;
  }
  
  // Check for .. sequences (both regular and URL-encoded)
  // This catches most common traversal attempts before normalization
  if (filePath.includes('..') || filePath.includes('%2e%2e') || filePath.includes('%2E%2E')) {
    return false;
  }
  
  // Normalize the path to resolve any symbolic links or relative components
  // This ensures the path is in canonical form
  const resolvedPath = resolve(filePath);
  
  // If resolve() significantly changed the path (beyond normalization of slashes),
  // it likely contained traversal sequences or symlinks
  // We check that the resolved path maintains the same structure
  const pathSegments = filePath.split(/[/\\]/).filter(s => s && s !== '.');
  const resolvedSegments = resolvedPath.split(/[/\\]/).filter(s => s && s !== '.');
  
  // The resolved path should not have fewer segments (indicates .. was processed)
  // This catches cases like /etc/../../../etc/passwd
  if (resolvedSegments.length < pathSegments.length) {
    return false;
  }
  
  return true;
};

/**
 * Validates that a column name from PRAGMA table_info is safe to use in dynamic SQL.
 * 
 * This function provides defense-in-depth validation for column names retrieved from
 * database schema introspection (PRAGMA table_info for SQLite, information_schema for PostgreSQL).
 * 
 * SECURITY NOTE: Column names from PRAGMA table_info are already trusted since they come
 * directly from the database schema, not from user input. However, this validation provides
 * an additional safety layer to:
 * 1. Catch potential bugs in schema parsing
 * 2. Prevent future vulnerabilities if code is modified to accept untrusted sources
 * 3. Document expected column name format explicitly
 * 
 * Valid column names must:
 * - Only contain alphanumeric characters, underscores, and hyphens
 * - Start with a letter or underscore
 * - Be 1-64 characters in length
 * 
 * @param {string} columnName - Column name to validate
 * @returns {boolean} True if the column name is safe, false otherwise
 * @throws {TypeError} If columnName is not a string
 */
const isValidColumnName = (columnName) => {
  if (typeof columnName !== 'string') {
    throw new TypeError('Column name must be a string');
  }

  // Column name must not be empty and must have reasonable length
  if (columnName.length === 0 || columnName.length > 64) {
    return false;
  }

  // Valid SQL identifiers: start with letter or underscore, contain only alphanumeric, underscore, or hyphen
  // This pattern is stricter than SQL standard but appropriate for our schema
  const validColumnNamePattern = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
  
  return validColumnNamePattern.test(columnName);
};

/**
 * Safely constructs a SQL SELECT expression for a column, with validation.
 * 
 * This function is used during database migrations when we need to dynamically select
 * columns based on schema introspection. It validates column names before using them
 * in SQL to prevent SQL injection (defense-in-depth).
 * 
 * USAGE REQUIREMENTS:
 * - Only use with column names from PRAGMA table_info or information_schema
 * - Never use with user-provided input or external data
 * - Always prefer static column references when possible
 * 
 * @param {string} columnName - Column name from PRAGMA table_info
 * @param {string} [alias] - Optional alias for the column in SELECT
 * @returns {string} Safe SQL SELECT expression
 * @throws {Error} If column name is invalid
 */
const buildSafeColumnExpression = (columnName, alias = null) => {
  if (!isValidColumnName(columnName)) {
    throw new Error(`Invalid column name for SQL expression: "${columnName}"`);
  }

  // Build the expression
  let expr = columnName;
  if (alias) {
    if (!isValidColumnName(alias)) {
      throw new Error(`Invalid alias name for SQL expression: "${alias}"`);
    }
    expr = `${columnName} AS ${alias}`;
  }

  return expr;
};

/**
 * Build PostgreSQL SSL configuration from environment variables
 * @returns {undefined|object} SSL configuration object or undefined if SSL not enabled
 */
const buildSslConfig = () => {
  if (process.env.POSTGRES_SSL !== 'true') {
    return undefined;
  }

  // Default to secure SSL with certificate validation
  const sslConfig = {
    rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false'
  };

  // Support custom CA certificate for production use
  if (process.env.POSTGRES_SSL_CA) {
    const caPath = process.env.POSTGRES_SSL_CA;
    if (!isValidCertPath(caPath)) {
      console.warn('POSTGRES_SSL_CA must be a valid absolute path without traversal sequences, skipping');
    } else {
      try {
        // Reading certificate files synchronously is acceptable during startup
        // Note: Certificates are public data and don't require special memory handling
        sslConfig.ca = readFileSync(caPath, 'utf-8');
      } catch (err) {
        console.warn('Failed to read POSTGRES_SSL_CA certificate file:', err.message);
      }
    }
  }

  // Support client certificate authentication
  if (process.env.POSTGRES_SSL_CERT && process.env.POSTGRES_SSL_KEY) {
    const certPath = process.env.POSTGRES_SSL_CERT;
    const keyPath = process.env.POSTGRES_SSL_KEY;
    
    if (!isValidCertPath(certPath) || !isValidCertPath(keyPath)) {
      console.warn('POSTGRES_SSL_CERT and POSTGRES_SSL_KEY must be valid absolute paths without traversal sequences, skipping');
    } else {
      try {
        // Reading during startup/initialization is acceptable
        // Note: Private keys are sensitive but this is the standard pattern for TLS configuration
        sslConfig.cert = readFileSync(certPath, 'utf-8');
        sslConfig.key = readFileSync(keyPath, 'utf-8');
      } catch (err) {
        console.warn('Failed to read POSTGRES_SSL_CERT/KEY files:', err.message);
      }
    }
  }

  return sslConfig;
};

let sqliteDb = null;
let pgPool = null;
let selectedEngine = 'sqlite';
let selectedPostgresUrl = '';

if (wantsPostgres && postgresUrl) {
  try {
    pgPool = new Pool({
      connectionString: postgresUrl,
      ssl: buildSslConfig()
    });
    selectedEngine = 'postgres';
    selectedPostgresUrl = postgresUrl;
  } catch (err) {
    console.warn('Failed to initialize PostgreSQL, falling back to SQLite:', err.message);
  }
} else if (wantsPostgres && !postgresUrl) {
  console.warn('DB_CLIENT=postgres requested but no POSTGRES_URL provided; falling back to SQLite');
}

const isPostgres = selectedEngine === 'postgres';

if (!isPostgres) {
  sqliteDb = new Database(join(dataDir, 'assets.db'));
}

const transformPlaceholders = (sql) => {
  if (!isPostgres) return sql;
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
};

const dbAll = async (sql, params = []) => {
  if (isPostgres) {
    const result = await pgPool.query(transformPlaceholders(sql), params);
    return result.rows;
  }
  const stmt = sqliteDb.prepare(sql);
  return stmt.all(...params);
};

const dbGet = async (sql, params = []) => {
  if (isPostgres) {
    const result = await pgPool.query(transformPlaceholders(sql), params);
    return result.rows[0] || null;
  }
  const stmt = sqliteDb.prepare(sql);
  return stmt.get(...params) || null;
};

const dbRun = async (sql, params = []) => {
  if (isPostgres) {
    const result = await pgPool.query(transformPlaceholders(sql), params);
    return {
      rows: result.rows,
      changes: result.rowCount,
      lastInsertRowid: result.rows?.[0]?.id || null
    };
  }
  const stmt = sqliteDb.prepare(sql);
  const info = stmt.run(...params);
  return { ...info };
};

const ensureConfigSync = () => {
  // keep config file in sync with environment overrides for transparency
  const persisted = loadConfig();
  const merged = {
    ...persisted,
    engine: envEngine || selectedEngine || persisted.engine || defaultConfig.engine,
    postgresUrl: envPostgresUrl || persisted.postgresUrl || selectedPostgresUrl || defaultConfig.postgresUrl
  };
  saveConfig(merged);
};

ensureConfigSync();

const initDb = async () => {
  const assetsTable = isPostgres ? `
    CREATE TABLE IF NOT EXISTS assets (
      id SERIAL PRIMARY KEY,
      employee_first_name TEXT NOT NULL,
      employee_last_name TEXT NOT NULL,
      employee_email TEXT NOT NULL,
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      manager_first_name TEXT,
      manager_last_name TEXT,
      manager_email TEXT,
      manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
      asset_type TEXT NOT NULL,
      make TEXT DEFAULT '',
      model TEXT DEFAULT '',
      serial_number TEXT NOT NULL UNIQUE,
      asset_tag TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      registration_date TIMESTAMP NOT NULL,
      last_updated TIMESTAMP NOT NULL,
      notes TEXT
    )
  ` : `
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_first_name TEXT NOT NULL,
      employee_last_name TEXT NOT NULL,
      employee_email TEXT NOT NULL,
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      manager_first_name TEXT,
      manager_last_name TEXT,
      manager_email TEXT,
      manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
      asset_type TEXT NOT NULL,
      make TEXT,
      model TEXT,
      serial_number TEXT NOT NULL UNIQUE,
      asset_tag TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      registration_date TEXT NOT NULL,
      last_updated TEXT NOT NULL,
      notes TEXT
    )
  `;

  const companiesTable = isPostgres ? `
    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_date TIMESTAMP NOT NULL,
      hubspot_id TEXT UNIQUE,
      hubspot_synced_at TIMESTAMP
    )
  ` : `
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_date TEXT NOT NULL,
      hubspot_id TEXT UNIQUE,
      hubspot_synced_at TEXT
    )
  `;

  const auditLogsTable = isPostgres ? `
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      entity_name TEXT,
      details TEXT,
      timestamp TIMESTAMP NOT NULL,
      user_email TEXT
    )
  ` : `
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      entity_name TEXT,
      details TEXT,
      timestamp TEXT NOT NULL,
      user_email TEXT
    )
  `;

  const usersTable = isPostgres ? `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      created_at TIMESTAMP NOT NULL,
      last_login TIMESTAMP,
      first_name TEXT,
      last_name TEXT,
      manager_name TEXT,
      manager_first_name TEXT,
      manager_last_name TEXT,
      manager_email TEXT,
      profile_image TEXT,
      oidc_sub TEXT UNIQUE,
      mfa_enabled INTEGER DEFAULT 0,
      mfa_secret TEXT,
      mfa_backup_codes TEXT,
      profile_complete INTEGER DEFAULT 1
    )
  ` : `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      created_at TEXT NOT NULL,
      last_login TEXT,
      first_name TEXT,
      last_name TEXT,
      manager_name TEXT,
      manager_first_name TEXT,
      manager_last_name TEXT,
      manager_email TEXT,
      profile_image TEXT,
      oidc_sub TEXT,
      mfa_enabled INTEGER DEFAULT 0,
      mfa_secret TEXT,
      mfa_backup_codes TEXT,
      profile_complete INTEGER DEFAULT 1
    )
  `;

  const passkeysTable = isPostgres ? `
    CREATE TABLE IF NOT EXISTS passkeys (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      transports TEXT,
      created_at TIMESTAMP NOT NULL,
      last_used_at TIMESTAMP
    )
  ` : `
    CREATE TABLE IF NOT EXISTS passkeys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      transports TEXT,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  const oidcSettingsTable = isPostgres ? `
    CREATE TABLE IF NOT EXISTS oidc_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 0,
      issuer_url TEXT,
      client_id TEXT,
      client_secret TEXT,
      redirect_uri TEXT,
      scope TEXT DEFAULT 'openid email profile',
      role_claim_path TEXT DEFAULT 'roles',
      default_role TEXT DEFAULT 'employee',
      sso_button_text TEXT DEFAULT 'Sign In with SSO',
      sso_button_help_text TEXT,
      sso_button_variant TEXT DEFAULT 'outline',
      updated_at TIMESTAMP NOT NULL,
      updated_by TEXT
    )
  ` : `
    CREATE TABLE IF NOT EXISTS oidc_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 0,
      issuer_url TEXT,
      client_id TEXT,
      client_secret TEXT,
      redirect_uri TEXT,
      scope TEXT DEFAULT 'openid email profile',
      role_claim_path TEXT DEFAULT 'roles',
      default_role TEXT DEFAULT 'employee',
      sso_button_text TEXT DEFAULT 'Sign In with SSO',
      sso_button_help_text TEXT,
      sso_button_variant TEXT DEFAULT 'outline',
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )
  `;

  const brandingSettingsTable = isPostgres ? `
    CREATE TABLE IF NOT EXISTS branding_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      logo_data TEXT,
      logo_filename TEXT,
      logo_content_type TEXT,
      updated_at TIMESTAMP NOT NULL,
      updated_by TEXT
    )
  ` : `
    CREATE TABLE IF NOT EXISTS branding_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      logo_data TEXT,
      logo_filename TEXT,
      logo_content_type TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )
  `;

  const passkeySettingsTable = isPostgres ? `
    CREATE TABLE IF NOT EXISTS passkey_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      rp_id TEXT DEFAULT 'localhost',
      rp_name TEXT DEFAULT 'KARS - KeyData Asset Registration System',
      origin TEXT DEFAULT 'http://localhost:5173',
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL,
      updated_by TEXT
    )
  ` : `
    CREATE TABLE IF NOT EXISTS passkey_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      rp_id TEXT DEFAULT 'localhost',
      rp_name TEXT DEFAULT 'KARS - KeyData Asset Registration System',
      origin TEXT DEFAULT 'http://localhost:5173',
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )
  `;

  const hubspotSettingsTable = isPostgres ? `
    CREATE TABLE IF NOT EXISTS hubspot_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER DEFAULT 0,
      access_token TEXT,
      auto_sync_enabled INTEGER DEFAULT 0,
      sync_interval TEXT DEFAULT 'daily',
      last_sync TIMESTAMP,
      last_sync_status TEXT,
      companies_synced INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  ` : `
    CREATE TABLE IF NOT EXISTS hubspot_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER DEFAULT 0,
      access_token TEXT,
      auto_sync_enabled INTEGER DEFAULT 0,
      sync_interval TEXT DEFAULT 'daily',
      last_sync TEXT,
      last_sync_status TEXT,
      companies_synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const hubspotSyncLogTable = isPostgres ? `
    CREATE TABLE IF NOT EXISTS hubspot_sync_log (
      id SERIAL PRIMARY KEY,
      sync_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sync_completed_at TIMESTAMP,
      status TEXT,
      companies_found INTEGER,
      companies_created INTEGER,
      companies_updated INTEGER,
      error_message TEXT
    )
  ` : `
    CREATE TABLE IF NOT EXISTS hubspot_sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      sync_completed_at TEXT,
      status TEXT,
      companies_found INTEGER,
      companies_created INTEGER,
      companies_updated INTEGER,
      error_message TEXT
    )
  `;

  const smtpSettingsTable = isPostgres ? `
    CREATE TABLE IF NOT EXISTS smtp_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER DEFAULT 0,
      host TEXT,
      port INTEGER,
      use_tls INTEGER DEFAULT 1,
      username TEXT,
      password_encrypted TEXT,
      auth_method TEXT DEFAULT 'plain',
      from_name TEXT DEFAULT 'KARS Notifications',
      from_email TEXT,
      default_recipient TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  ` : `
    CREATE TABLE IF NOT EXISTS smtp_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER DEFAULT 0,
      host TEXT,
      port INTEGER,
      use_tls INTEGER DEFAULT 1,
      username TEXT,
      password_encrypted TEXT,
      auth_method TEXT DEFAULT 'plain',
      from_name TEXT DEFAULT 'KARS Notifications',
      from_email TEXT,
      default_recipient TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // Create tables in dependency order to satisfy foreign key constraints
  await dbRun(usersTable);           // 1. Create users first (no dependencies)
  await dbRun(companiesTable);       // 2. Create companies (no dependencies)
  await dbRun(assetsTable);          // 3. Create assets (depends on users via owner_id and manager_id)
  await dbRun(auditLogsTable);       // 4. Create audit_logs (no dependencies)
  await dbRun(oidcSettingsTable);    // 5. Create OIDC settings table
  await dbRun(brandingSettingsTable); // 6. Create branding settings table
  await dbRun(passkeySettingsTable); // 7. Create passkey settings table
  await dbRun(passkeysTable);        // 8. Create passkeys (depends on users)
  await dbRun(hubspotSettingsTable); // 9. Create HubSpot settings table
  await dbRun(hubspotSyncLogTable);  // 10. Create HubSpot sync log table
  await dbRun(smtpSettingsTable);    // 11. Create SMTP settings table

  // === Migration: company_name -> company_id ===
  // Check if assets table has old schema (company_name) instead of new schema (company_id)
  try {
    const assetCols = isPostgres
      ? await dbAll(`
          SELECT column_name as name
          FROM information_schema.columns
          WHERE table_name = 'assets'
        `)
      : await dbAll("PRAGMA table_info(assets)");

    const hasCompanyName = assetCols.some(col => col.name === 'company_name');
    const hasCompanyId = assetCols.some(col => col.name === 'company_id');

    if (hasCompanyName && !hasCompanyId) {
      console.log('Migrating assets table: company_name -> company_id...');

      // Step 1: Add company_id column (nullable initially)
      if (isPostgres) {
        await dbRun('ALTER TABLE assets ADD COLUMN company_id INTEGER REFERENCES companies(id)');
      } else {
        await dbRun('ALTER TABLE assets ADD COLUMN company_id INTEGER REFERENCES companies(id)');
      }

      // Step 2: Populate company_id from company_name
      // Get all unique company names from assets
      const assetCompanies = await dbAll('SELECT DISTINCT company_name FROM assets WHERE company_name IS NOT NULL');
      for (const row of assetCompanies) {
        const company = await dbGet('SELECT id FROM companies WHERE name = ?', [row.company_name]);
        if (company) {
          await dbRun('UPDATE assets SET company_id = ? WHERE company_name = ?', [company.id, row.company_name]);
        } else {
          // Create the company if it doesn't exist
          const now = new Date().toISOString();
          const insertQuery = isPostgres
            ? 'INSERT INTO companies (name, description, created_date) VALUES ($1, $2, $3) RETURNING id'
            : 'INSERT INTO companies (name, description, created_date) VALUES (?, ?, ?)';
          const result = await dbRun(insertQuery, [row.company_name, '', now]);
          const newCompanyId = isPostgres ? result.rows?.[0]?.id : result.lastInsertRowid;
          await dbRun('UPDATE assets SET company_id = ? WHERE company_name = ?', [newCompanyId, row.company_name]);
          console.log(`  Created company "${row.company_name}" with id ${newCompanyId}`);
        }
      }

      // Step 3: For SQLite, we need to recreate the table to drop the column
      // For PostgreSQL, we can just drop it
      if (isPostgres) {
        // Make company_id NOT NULL after populating
        await dbRun('ALTER TABLE assets ALTER COLUMN company_id SET NOT NULL');
        // Drop the old column
        await dbRun('ALTER TABLE assets DROP COLUMN company_name');
      } else {
        // SQLite doesn't support DROP COLUMN in older versions, so we recreate the table
        // First, verify all assets have company_id set
        const nullCompanyAssets = await dbGet('SELECT COUNT(*) as count FROM assets WHERE company_id IS NULL');
        if (nullCompanyAssets.count > 0) {
          console.warn(`Warning: ${nullCompanyAssets.count} assets have NULL company_id, setting to first company`);
          const firstCompany = await dbGet('SELECT id FROM companies ORDER BY id LIMIT 1');
          if (firstCompany) {
            await dbRun('UPDATE assets SET company_id = ? WHERE company_id IS NULL', [firstCompany.id]);
          }
        }

        // Create new table with correct schema
        await dbRun(`
          CREATE TABLE assets_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_first_name TEXT NOT NULL,
            employee_last_name TEXT NOT NULL,
            employee_email TEXT NOT NULL,
            owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            manager_first_name TEXT,
            manager_last_name TEXT,
            manager_email TEXT,
            manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            asset_type TEXT NOT NULL,
            make TEXT,
            model TEXT,
            serial_number TEXT NOT NULL UNIQUE,
            asset_tag TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'active',
            registration_date TEXT NOT NULL,
            last_updated TEXT NOT NULL,
            notes TEXT
          )
        `);

        // Copy data
        await dbRun(`
          INSERT INTO assets_new (id, employee_first_name, employee_last_name, employee_email, owner_id,
            manager_first_name, manager_last_name, manager_email, manager_id, company_id, asset_type,
            make, model, serial_number, asset_tag, status, registration_date, last_updated, notes)
          SELECT id, employee_first_name, employee_last_name, employee_email, owner_id,
            manager_first_name, manager_last_name, manager_email, manager_id, company_id, asset_type,
            make, model, serial_number, asset_tag, status, registration_date, last_updated, notes
          FROM assets
        `);

        // Drop old table and rename new one
        await dbRun('DROP TABLE assets');
        await dbRun('ALTER TABLE assets_new RENAME TO assets');
      }

      console.log('Migration complete: assets.company_name -> assets.company_id');
    }
  } catch (err) {
    console.error('Migration error (company_name -> company_id):', err.message);
    // Don't fail initialization - the table might be new with correct schema
  }

  // Migration: Add profile_complete column to users table
  try {
    const userCols = isPostgres
      ? await dbAll(`
          SELECT column_name as name
          FROM information_schema.columns
          WHERE table_name = 'users'
        `)
      : await dbAll("PRAGMA table_info(users)");

    const hasProfileComplete = userCols.some(col => col.name === 'profile_complete');

    if (!hasProfileComplete) {
      console.log('Migrating users table: adding profile_complete column...');
      
      // Add profile_complete column with default value of 1 (true) for existing users
      await dbRun('ALTER TABLE users ADD COLUMN profile_complete INTEGER DEFAULT 1');
      
      // Ensure all existing users have profile_complete = 1
      await dbRun('UPDATE users SET profile_complete = 1 WHERE profile_complete IS NULL');
      
      console.log('Migration complete: Added profile_complete column to users table');
    }
  } catch (err) {
    console.error('Migration error (profile_complete column):', err.message);
    // Don't fail initialization - the table might be new with correct schema
  }

  // Insert default OIDC settings if not exists
  const checkSettings = await dbGet('SELECT id FROM oidc_settings WHERE id = 1');
  if (!checkSettings) {
    const now = new Date().toISOString();
    await dbRun(`
      INSERT INTO oidc_settings (id, enabled, sso_button_text, sso_button_help_text, sso_button_variant, updated_at)
      VALUES (1, 0, 'Sign In with SSO', '', 'outline', ?)
    `, [now]);
  } else {
    await dbRun(`
      UPDATE oidc_settings
      SET sso_button_text = COALESCE(sso_button_text, 'Sign In with SSO'),
          sso_button_help_text = COALESCE(sso_button_help_text, ''),
          sso_button_variant = COALESCE(sso_button_variant, 'outline')
      WHERE id = 1
    `);
  }

  // Insert default branding settings if not exists
  const checkBranding = await dbGet('SELECT id FROM branding_settings WHERE id = 1');
  if (!checkBranding) {
    const now = new Date().toISOString();
    await dbRun(`
      INSERT INTO branding_settings (id, updated_at)
      VALUES (1, ?)
    `, [now]);
  }

  // Insert default HubSpot settings if not exists
  const checkHubSpot = await dbGet('SELECT id FROM hubspot_settings WHERE id = 1');
  if (!checkHubSpot) {
    const now = new Date().toISOString();
    await dbRun(`
      INSERT INTO hubspot_settings (id, enabled, auto_sync_enabled, sync_interval, created_at, updated_at)
      VALUES (1, 0, 0, 'daily', ?, ?)
    `, [now, now]);
  }

  // Insert default SMTP settings if not exists
  const checkSmtp = await dbGet('SELECT id FROM smtp_settings WHERE id = 1');
  if (!checkSmtp) {
    const now = new Date().toISOString();
    await dbRun(`
      INSERT INTO smtp_settings (id, enabled, created_at, updated_at)
      VALUES (1, 0, ?, ?)
    `, [now, now]);
  }

  // Indexes
  await dbRun('CREATE INDEX IF NOT EXISTS idx_employee_first_name ON assets(employee_first_name)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_employee_last_name ON assets(employee_last_name)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_employee_email ON assets(employee_email)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_owner_id ON assets(owner_id)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_manager_first_name ON assets(manager_first_name)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_manager_last_name ON assets(manager_last_name)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_manager_email ON assets(manager_email)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_manager_id ON assets(manager_id)');
  // Only create company_id index if the column exists (handles migration case)
  try {
    await dbRun('CREATE INDEX IF NOT EXISTS idx_company_id ON assets(company_id)');
  } catch (err) {
    console.warn('Could not create idx_company_id index:', err.message);
  }
  await dbRun('CREATE INDEX IF NOT EXISTS idx_status ON assets(status)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_serial_number ON assets(serial_number)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_asset_tag ON assets(asset_tag)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_company_name ON companies(name)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_user_email ON users(email)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_user_manager_email ON users(manager_email)');
  // Only create oidc_sub index if the column exists (older DBs may not have oidc_sub)
  try {
    const userCols = isPostgres
      ? await dbAll(`
          SELECT column_name as name
          FROM information_schema.columns
          WHERE table_name = $1
        `, ['users'])
      : await dbAll("PRAGMA table_info(users)");
    const hasOidcSub = userCols.some(col => col.name === 'oidc_sub');
    if (hasOidcSub) {
      await dbRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_user_oidc_sub ON users(oidc_sub)');
    }
  } catch (err) {
    console.warn('Could not create idx_user_oidc_sub index:', err.message);
  }

  console.log(`Database initialized using ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);
};

/**
 * Normalize dates to ensure consistent UTC handling across SQLite and PostgreSQL
 * 
 * Both SQLite (which stores dates as TEXT) and PostgreSQL (which returns Date objects)
 * are normalized to ISO 8601 UTC strings to ensure timezone consistency in multi-region
 * deployments and when transforming between database engines.
 * 
 * @param {string|Date|null} date - The date to normalize
 * @returns {string|null} ISO 8601 UTC string (e.g., '2024-01-15T10:30:00.000Z') or null
 */
const normalizeDates = (date = null) => {
  if (!date) return null;
  
  // If date is already a string in ISO format, validate and ensure it's UTC
  if (typeof date === 'string') {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid date string: ${date}`);
    }
    return parsed.toISOString();
  }
  
  // If date is a Date object (from PostgreSQL), convert to ISO string
  if (date instanceof Date) {
    if (isNaN(date.getTime())) {
      throw new Error('Invalid Date object');
    }
    return date.toISOString();
  }
  
  // Unexpected type
  throw new Error(`Unexpected date type: ${typeof date}`);
};

export const assetDb = {
  init: initDb,
  create: async (asset) => {
    const now = new Date().toISOString();

    // Look up owner_id from employee_email
    let ownerId = null;
    if (asset.employee_email) {
      const owner = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [asset.employee_email]);
      ownerId = owner?.id || null;
    }

    // Look up manager_id from manager_email
    let managerId = null;
    if (asset.manager_email) {
      const manager = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [asset.manager_email]);
      managerId = manager?.id || null;
    }

    // Look up company_id from company_name (or use provided company_id)
    let companyId = asset.company_id || null;
    if (!companyId && asset.company_name) {
      const company = await dbGet('SELECT id FROM companies WHERE name = ?', [asset.company_name]);
      if (!company) {
        throw new Error(`Company not found: ${asset.company_name}`);
      }
      companyId = company.id;
    }
    if (!companyId) {
      throw new Error('Company is required');
    }

    const insertQuery = `
      INSERT INTO assets (
        employee_first_name, employee_last_name, employee_email, owner_id,
        manager_first_name, manager_last_name, manager_email, manager_id,
        company_id, asset_type, make, model, serial_number, asset_tag,
        status, registration_date, last_updated, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ${isPostgres ? 'RETURNING id' : ''}
    `;

    // Store denormalized fields for backward compatibility and unregistered users
    // JOINs will override these values when user records exist
    const result = await dbRun(insertQuery, [
      asset.employee_first_name || '', // stored for unregistered users
      asset.employee_last_name || '', // stored for unregistered users
      asset.employee_email || '', // keep email for backward compat lookups
      ownerId,
      asset.manager_first_name || '', // stored for unregistered managers
      asset.manager_last_name || '', // stored for unregistered managers
      asset.manager_email || '', // keep email for backward compat lookups
      managerId,
      companyId,
      asset.asset_type,
      asset.make || '',
      asset.model || '',
      asset.serial_number,
      asset.asset_tag,
      asset.status || 'active',
      now,
      now,
      asset.notes || ''
    ]);

    const newId = isPostgres ? result.rows?.[0]?.id : result.lastInsertRowid;
    return { id: newId };
  },
  getAll: async () => {
    const query = `
      SELECT
        assets.*,
        companies.name as company_name,
        COALESCE(owner.first_name, assets.employee_first_name) as employee_first_name,
        COALESCE(owner.last_name, assets.employee_last_name) as employee_last_name,
        COALESCE(owner.email, assets.employee_email) as employee_email,
        COALESCE(manager.first_name, assets.manager_first_name) as manager_first_name,
        COALESCE(manager.last_name, assets.manager_last_name) as manager_last_name,
        COALESCE(manager.email, assets.manager_email) as manager_email
      FROM assets
      INNER JOIN companies ON assets.company_id = companies.id
      LEFT JOIN users owner ON assets.owner_id = owner.id
      LEFT JOIN users manager ON assets.manager_id = manager.id
      ORDER BY assets.registration_date DESC
    `;
    const rows = await dbAll(query);
    return rows.map((row) => ({
      ...row,
      registration_date: normalizeDates(row.registration_date),
      last_updated: normalizeDates(row.last_updated)
    }));
  },
  getById: async (id) => {
    const query = `
      SELECT
        assets.*,
        companies.name as company_name,
        COALESCE(owner.first_name, assets.employee_first_name) as employee_first_name,
        COALESCE(owner.last_name, assets.employee_last_name) as employee_last_name,
        COALESCE(owner.email, assets.employee_email) as employee_email,
        COALESCE(manager.first_name, assets.manager_first_name) as manager_first_name,
        COALESCE(manager.last_name, assets.manager_last_name) as manager_last_name,
        COALESCE(manager.email, assets.manager_email) as manager_email
      FROM assets
      INNER JOIN companies ON assets.company_id = companies.id
      LEFT JOIN users owner ON assets.owner_id = owner.id
      LEFT JOIN users manager ON assets.manager_id = manager.id
      WHERE assets.id = ?
    `;
    const row = await dbGet(query, [id]);
    if (!row) return null;
    return {
      ...row,
      registration_date: normalizeDates(row.registration_date),
      last_updated: normalizeDates(row.last_updated)
    };
  },
  search: async (filters) => {
    let query = `
      SELECT
        assets.*,
        companies.name as company_name,
        COALESCE(owner.first_name, assets.employee_first_name) as employee_first_name,
        COALESCE(owner.last_name, assets.employee_last_name) as employee_last_name,
        COALESCE(owner.email, assets.employee_email) as employee_email,
        COALESCE(manager.first_name, assets.manager_first_name) as manager_first_name,
        COALESCE(manager.last_name, assets.manager_last_name) as manager_last_name,
        COALESCE(manager.email, assets.manager_email) as manager_email
      FROM assets
      INNER JOIN companies ON assets.company_id = companies.id
      LEFT JOIN users owner ON assets.owner_id = owner.id
      LEFT JOIN users manager ON assets.manager_id = manager.id
      WHERE 1=1
    `;
    const params = [];

    // TODO: Performance optimization - Consider using full-text search or computed columns for name searches on large datasets
    if (filters.employee_name) {
      query += ` AND (COALESCE(owner.first_name, assets.employee_first_name) LIKE ? OR COALESCE(owner.last_name, assets.employee_last_name) LIKE ? OR (COALESCE(owner.first_name, assets.employee_first_name) || ' ' || COALESCE(owner.last_name, assets.employee_last_name)) LIKE ?)`;
      params.push(`%${filters.employee_name}%`, `%${filters.employee_name}%`, `%${filters.employee_name}%`);
    }

    if (filters.manager_name) {
      query += ` AND (COALESCE(manager.first_name, assets.manager_first_name) LIKE ? OR COALESCE(manager.last_name, assets.manager_last_name) LIKE ? OR (COALESCE(manager.first_name, assets.manager_first_name) || ' ' || COALESCE(manager.last_name, assets.manager_last_name)) LIKE ?)`;
      params.push(`%${filters.manager_name}%`, `%${filters.manager_name}%`, `%${filters.manager_name}%`);
    }

    if (filters.company_name) {
      query += ' AND companies.name LIKE ?';
      params.push(`%${filters.company_name}%`);
    }

    if (filters.status) {
      query += ' AND assets.status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY assets.registration_date DESC';

    const rows = await dbAll(query, params);
    return rows.map((row) => ({
      ...row,
      registration_date: normalizeDates(row.registration_date),
      last_updated: normalizeDates(row.last_updated)
    }));
  },
  updateStatus: async (id, status, notes) => {
    const now = new Date().toISOString();
    return dbRun(`
      UPDATE assets
      SET status = ?, last_updated = ?, notes = ?
      WHERE id = ?
    `, [status, now, notes || '', id]);
  },
  update: async (id, asset) => {
    const now = new Date().toISOString();

    // Look up owner_id from employee_email
    let ownerId = null;
    if (asset.employee_email) {
      const owner = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [asset.employee_email]);
      ownerId = owner?.id || null;
    }

    // Look up manager_id from manager_email
    let managerId = null;
    if (asset.manager_email) {
      const manager = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [asset.manager_email]);
      managerId = manager?.id || null;
    }

    // Look up company_id from company_name (or use provided company_id)
    let companyId = asset.company_id || null;
    if (!companyId && asset.company_name) {
      const company = await dbGet('SELECT id FROM companies WHERE name = ?', [asset.company_name]);
      if (!company) {
        throw new Error(`Company not found: ${asset.company_name}`);
      }
      companyId = company.id;
    }
    if (!companyId) {
      throw new Error('Company is required');
    }

    // Store denormalized fields for backward compatibility and unregistered users
    // JOINs will override these values when user records exist
    return dbRun(`
      UPDATE assets
      SET employee_first_name = ?, employee_last_name = ?, employee_email = ?, owner_id = ?,
          manager_first_name = ?, manager_last_name = ?, manager_email = ?, manager_id = ?,
          company_id = ?, asset_type = ?, make = ?, model = ?, serial_number = ?, asset_tag = ?,
          status = ?, last_updated = ?, notes = ?
      WHERE id = ?
    `, [
      asset.employee_first_name || '', // stored for unregistered users
      asset.employee_last_name || '', // stored for unregistered users
      asset.employee_email || '', // keep email for backward compat lookups
      ownerId,
      asset.manager_first_name || '', // stored for unregistered managers
      asset.manager_last_name || '', // stored for unregistered managers
      asset.manager_email || '', // keep email for backward compat lookups
      managerId,
      companyId,
      asset.asset_type,
      asset.make || '',
      asset.model || '',
      asset.serial_number,
      asset.asset_tag,
      asset.status,
      now,
      asset.notes || '',
      id
    ]);
  },
  delete: async (id) => dbRun('DELETE FROM assets WHERE id = ?', [id]),
  getByEmployeeEmail: async (email) => {
    const query = `
      SELECT
        assets.*,
        companies.name as company_name,
        COALESCE(owner.first_name, assets.employee_first_name) as employee_first_name,
        COALESCE(owner.last_name, assets.employee_last_name) as employee_last_name,
        COALESCE(owner.email, assets.employee_email) as employee_email,
        COALESCE(manager.first_name, assets.manager_first_name) as manager_first_name,
        COALESCE(manager.last_name, assets.manager_last_name) as manager_last_name,
        COALESCE(manager.email, assets.manager_email) as manager_email
      FROM assets
      INNER JOIN companies ON assets.company_id = companies.id
      LEFT JOIN users owner ON assets.owner_id = owner.id
      LEFT JOIN users manager ON assets.manager_id = manager.id
      WHERE COALESCE(owner.email, assets.employee_email) = ?
    `;
    const rows = await dbAll(query, [email]);
    return rows.map((row) => ({
      ...row,
      registration_date: normalizeDates(row.registration_date),
      last_updated: normalizeDates(row.last_updated)
    }));
  },
  linkAssetsToUser: async (employeeEmail, managerFirstName, managerLastName, managerEmail) => {
    const now = new Date().toISOString();
    
    // Look up manager_id from manager_email
    let managerId = null;
    if (managerEmail) {
      const manager = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [managerEmail]);
      managerId = manager?.id || null;
    }
    
    // Store denormalized fields for unregistered managers
    // JOINs will override these values when user records exist
    return dbRun(`
      UPDATE assets
      SET manager_first_name = ?, manager_last_name = ?, manager_email = ?, manager_id = ?, last_updated = ?
      WHERE employee_email = ?
    `, [managerFirstName || '', managerLastName || '', managerEmail || '', managerId, now, employeeEmail]);
  },
  updateManagerForEmployee: async (employeeEmail, managerName, managerEmail) => {
    const now = new Date().toISOString();
    
    // Debug logging to catch data corruption
    console.log('updateManagerForEmployee called:', {
      employeeEmail,
      managerName,
      managerEmail
    });
    
    // Look up manager_id from manager_email
    let managerId = null;
    if (managerEmail) {
      const manager = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [managerEmail]);
      managerId = manager?.id || null;
    }

    // Split manager name into first and last name
    // Store denormalized fields for unregistered managers
    // JOINs will override these values when user records exist
    const trimmedName = (managerName || '').trim();
    const nameParts = trimmedName ? trimmedName.split(/\s+/) : [];
    const managerFirstName = nameParts[0] || '';
    const managerLastName = nameParts.slice(1).join(' ') || '';
    
    console.log('Split manager name:', {
      managerFirstName,
      managerLastName,
      managerId
    });
    
    // Get the owner_id for this employee to update by both email AND ID
    const employee = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [employeeEmail]);
    const employeeId = employee?.id || null;
    
    return dbRun(`
      UPDATE assets
      SET manager_first_name = ?, manager_last_name = ?, manager_email = ?, manager_id = ?, last_updated = ?
      WHERE LOWER(employee_email) = LOWER(?) OR (owner_id = ? AND owner_id IS NOT NULL)
    `, [managerFirstName, managerLastName, managerEmail || '', managerId, now, employeeEmail, employeeId]);
  },
  updateManagerIdForOwner: async (ownerId, managerId) => {
    const now = new Date().toISOString();
    return dbRun(`
      UPDATE assets
      SET manager_id = ?, last_updated = ?
      WHERE owner_id = ?
    `, [managerId, now, ownerId]);
  },
  getByIds: async (ids) => {
    if (!ids || ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const query = `
      SELECT
        assets.*,
        companies.name as company_name,
        COALESCE(owner.first_name, assets.employee_first_name) as employee_first_name,
        COALESCE(owner.last_name, assets.employee_last_name) as employee_last_name,
        COALESCE(owner.email, assets.employee_email) as employee_email,
        COALESCE(manager.first_name, assets.manager_first_name) as manager_first_name,
        COALESCE(manager.last_name, assets.manager_last_name) as manager_last_name,
        COALESCE(manager.email, assets.manager_email) as manager_email
      FROM assets
      INNER JOIN companies ON assets.company_id = companies.id
      LEFT JOIN users owner ON assets.owner_id = owner.id
      LEFT JOIN users manager ON assets.manager_id = manager.id
      WHERE assets.id IN (${placeholders})
    `;
    const rows = await dbAll(query, ids);
    return rows.map((row) => ({
      ...row,
      registration_date: normalizeDates(row.registration_date),
      last_updated: normalizeDates(row.last_updated)
    }));
  },
  bulkUpdateStatus: async (ids, status, notes) => {
    if (!ids || ids.length === 0) return { changes: 0 };
    const now = new Date().toISOString();
    const placeholders = ids.map(() => '?').join(',');
    const query = `
      UPDATE assets
      SET status = ?, last_updated = ?, notes = ?
      WHERE id IN (${placeholders})
    `;
    return dbRun(query, [status, now, notes || '', ...ids]);
  },
  bulkDelete: async (ids) => {
    if (!ids || ids.length === 0) return { changes: 0 };
    const placeholders = ids.map(() => '?').join(',');
    const query = `DELETE FROM assets WHERE id IN (${placeholders})`;
    return dbRun(query, ids);
  },
  bulkUpdateManager: async (ids, managerFirstName, managerLastName, managerEmail) => {
    if (!ids || ids.length === 0) return { changes: 0 };
    const now = new Date().toISOString();
    
    // Look up manager_id from manager_email
    let managerId = null;
    if (managerEmail) {
      const manager = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [managerEmail]);
      managerId = manager?.id || null;
    }
    
    const placeholders = ids.map(() => '?').join(',');
    const query = `
      UPDATE assets
      SET manager_first_name = ?, manager_last_name = ?, manager_email = ?, manager_id = ?, last_updated = ?
      WHERE id IN (${placeholders})
    `;
    // Store denormalized fields for unregistered managers
    // JOINs will override these values when user records exist
    return dbRun(query, [managerFirstName || '', managerLastName || '', managerEmail || '', managerId, now, ...ids]);
  },
  getEmployeeEmailsByManager: async (managerEmail) => {
    const rows = await dbAll('SELECT DISTINCT employee_email FROM assets WHERE manager_email = ?', [managerEmail]);
    return rows.map(row => row.employee_email);
  },
  getScopedForUser: async (user) => {
    // Return assets scoped based on user role
    // Admin: all assets
    // Manager: own assets + direct reports' assets
    // Employee: only own assets

    let baseQuery = `
      SELECT
        assets.*,
        companies.name as company_name,
        COALESCE(owner.first_name, assets.employee_first_name) as employee_first_name,
        COALESCE(owner.last_name, assets.employee_last_name) as employee_last_name,
        COALESCE(owner.email, assets.employee_email) as employee_email,
        COALESCE(manager.first_name, assets.manager_first_name) as manager_first_name,
        COALESCE(manager.last_name, assets.manager_last_name) as manager_last_name,
        COALESCE(manager.email, assets.manager_email) as manager_email
      FROM assets
      INNER JOIN companies ON assets.company_id = companies.id
      LEFT JOIN users owner ON assets.owner_id = owner.id
      LEFT JOIN users manager ON assets.manager_id = manager.id
    `;
    let params = [];

    if (user.role === 'admin') {
      // Admin sees all
      baseQuery += ' ORDER BY assets.registration_date DESC';
    } else if (user.role === 'manager') {
      // Manager sees own + direct reports (check both ID and email fields)
      baseQuery += ` WHERE (assets.owner_id = ? OR LOWER(assets.employee_email) = LOWER(?))
                     OR (assets.manager_id = ? OR LOWER(assets.manager_email) = LOWER(?))
                     ORDER BY assets.registration_date DESC`;
      params = [user.id, user.email, user.id, user.email];
    } else {
      // Employee sees only own (check both owner_id and employee_email)
      baseQuery += ` WHERE assets.owner_id = ? OR LOWER(assets.employee_email) = LOWER(?)
                     ORDER BY assets.registration_date DESC`;
      params = [user.id, user.email];
    }

    const rows = await dbAll(baseQuery, params);
    return rows.map((row) => ({
      ...row,
      registration_date: normalizeDates(row.registration_date),
      last_updated: normalizeDates(row.last_updated)
    }));
  }
};

/**
 * Sync asset ownership by backfilling owner_id and manager_id when users register
 * @param {string} email - The email address to sync assets for
 * @returns {Promise<{ownerUpdates: number, managerUpdates: number}>}
 */
export const syncAssetOwnership = async (email) => {
  const user = await userDb.getByEmail(email);
  if (!user) return { ownerUpdates: 0, managerUpdates: 0 };

  // Update assets where this user is the employee
  const ownerResult = await dbRun(`
    UPDATE assets 
    SET owner_id = ?, last_updated = ? 
    WHERE LOWER(employee_email) = LOWER(?) AND owner_id IS NULL
  `, [user.id, new Date().toISOString(), email]);

  // Update assets where this user is the manager
  const managerResult = await dbRun(`
    UPDATE assets 
    SET manager_id = ?, last_updated = ?
    WHERE LOWER(manager_email) = LOWER(?) AND manager_id IS NULL
  `, [user.id, new Date().toISOString(), email]);

  return {
    ownerUpdates: ownerResult.changes || 0,
    managerUpdates: managerResult.changes || 0
  };
};

export const companyDb = {
  create: async (company) => {
    const now = new Date().toISOString();
    const insertQuery = `
      INSERT INTO companies (name, description, created_date)
      VALUES (?, ?, ?)
      ${isPostgres ? 'RETURNING id' : ''}
    `;
    const result = await dbRun(insertQuery, [company.name, company.description || '', now]);
    const id = isPostgres ? result.rows?.[0]?.id : result.lastInsertRowid;
    return { id };
  },
  createWithHubSpotId: async (company) => {
    const now = new Date().toISOString();
    const insertQuery = `
      INSERT INTO companies (name, description, created_date, hubspot_id, hubspot_synced_at)
      VALUES (?, ?, ?, ?, ?)
      ${isPostgres ? 'RETURNING id' : ''}
    `;
    const result = await dbRun(insertQuery, [
      company.name,
      company.description || '',
      now,
      company.hubspot_id,
      now
    ]);
    const id = isPostgres ? result.rows?.[0]?.id : result.lastInsertRowid;
    return { id };
  },
  getAll: async () => {
    const rows = await dbAll('SELECT * FROM companies ORDER BY name ASC');
    return rows.map((row) => ({ 
      ...row, 
      created_date: normalizeDates(row.created_date),
      hubspot_synced_at: normalizeDates(row.hubspot_synced_at)
    }));
  },
  getById: async (id) => {
    const row = await dbGet('SELECT * FROM companies WHERE id = ?', [id]);
    return row ? { 
      ...row, 
      created_date: normalizeDates(row.created_date),
      hubspot_synced_at: normalizeDates(row.hubspot_synced_at)
    } : null;
  },
  getByName: async (name) => {
    const row = await dbGet('SELECT * FROM companies WHERE name = ?', [name]);
    return row ? { 
      ...row, 
      created_date: normalizeDates(row.created_date),
      hubspot_synced_at: normalizeDates(row.hubspot_synced_at)
    } : null;
  },
  getByHubSpotId: async (hubspotId) => {
    const row = await dbGet('SELECT * FROM companies WHERE hubspot_id = ?', [hubspotId]);
    return row ? { 
      ...row, 
      created_date: normalizeDates(row.created_date),
      hubspot_synced_at: normalizeDates(row.hubspot_synced_at)
    } : null;
  },
  update: async (id, company) => dbRun(`
    UPDATE companies
    SET name = ?, description = ?
    WHERE id = ?
  `, [company.name, company.description || '', id]),
  updateByHubSpotId: async (hubspotId, company) => {
    const now = new Date().toISOString();
    return dbRun(`
      UPDATE companies
      SET name = ?, description = ?, hubspot_synced_at = ?
      WHERE hubspot_id = ?
    `, [company.name, company.description || '', now, hubspotId]);
  },
  setHubSpotId: async (id, hubspotId) => {
    const now = new Date().toISOString();
    return dbRun(`
      UPDATE companies
      SET hubspot_id = ?, hubspot_synced_at = ?
      WHERE id = ?
    `, [hubspotId, now, id]);
  },
  delete: async (id) => dbRun('DELETE FROM companies WHERE id = ?', [id]),
  hasAssets: async (companyId) => {
    const row = await dbGet('SELECT COUNT(*) as count FROM assets WHERE company_id = ?', [companyId]);
    return (row?.count || 0) > 0;
  },
  getAssetCount: async (companyId) => {
    const row = await dbGet('SELECT COUNT(*) as count FROM assets WHERE company_id = ?', [companyId]);
    return row?.count || 0;
  }
};

export const auditDb = {
  log: async (action, entityType, entityId, entityName, details, userEmail = null) => {
    const now = new Date().toISOString();
    const detailsJson = typeof details === 'string' ? details : JSON.stringify(details);

    return dbRun(`
      INSERT INTO audit_logs (action, entity_type, entity_id, entity_name, details, timestamp, user_email)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [action, entityType, entityId, entityName, detailsJson, now, userEmail]);
  },
  getAll: async (options = {}) => {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (options.entityType) {
      query += ' AND entity_type = ?';
      params.push(options.entityType);
    }

    if (options.entityId) {
      query += ' AND entity_id = ?';
      params.push(options.entityId);
    }

    if (options.action) {
      query += ' AND action = ?';
      params.push(options.action);
    }

    if (options.startDate) {
      query += ' AND timestamp >= ?';
      params.push(options.startDate);
    }

    if (options.endDate) {
      query += ' AND timestamp <= ?';
      params.push(options.endDate);
    }

    if (options.userEmail) {
      query += ' AND user_email = ?';
      params.push(options.userEmail);
    }

    query += ' ORDER BY timestamp DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = await dbAll(query, params);
    return rows.map((row) => ({
      ...row,
      timestamp: normalizeDates(row.timestamp)
    }));
  },
  getByEntity: async (entityType, entityId) => {
    const rows = await dbAll(`
      SELECT * FROM audit_logs
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY timestamp DESC
    `, [entityType, entityId]);
    return rows.map((row) => ({ ...row, timestamp: normalizeDates(row.timestamp) }));
  },
  getRecent: async (limit = 100) => {
    const rows = await dbAll('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?', [limit]);
    return rows.map((row) => ({ ...row, timestamp: normalizeDates(row.timestamp) }));
  },
  getStats: async (startDate = null, endDate = null) => {
    let query = `
      SELECT
        action,
        entity_type,
        COUNT(*) as count
      FROM audit_logs
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      query += ' AND timestamp >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND timestamp <= ?';
      params.push(endDate);
    }

    query += ' GROUP BY action, entity_type';

    const rows = await dbAll(query, params);
    return rows;
  }
};

export const userDb = {
  create: async (user) => {
    const now = new Date().toISOString();
    const insertQuery = `
      INSERT INTO users (email, password_hash, name, role, created_at, first_name, last_name, manager_first_name, manager_last_name, manager_email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ${isPostgres ? 'RETURNING id' : ''}
    `;
    const result = await dbRun(insertQuery, [
      user.email,
      user.password_hash,
      user.name,
      user.role || 'employee',
      now,
      user.first_name || null,
      user.last_name || null,
      user.manager_first_name || null,
      user.manager_last_name || null,
      user.manager_email || null
    ]);
    const id = isPostgres ? result.rows?.[0]?.id : result.lastInsertRowid;
    return { id };
  },
  getByEmail: async (email) => {
    const row = await dbGet('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (!row) return null;
    return {
      ...row,
      created_at: normalizeDates(row.created_at),
      last_login: normalizeDates(row.last_login)
    };
  },
  getById: async (id) => {
    const row = await dbGet('SELECT * FROM users WHERE id = ?', [id]);
    if (!row) return null;
    return {
      ...row,
      created_at: normalizeDates(row.created_at),
      last_login: normalizeDates(row.last_login)
    };
  },
  getAll: async () => {
    const rows = await dbAll('SELECT * FROM users ORDER BY created_at DESC');
    return rows.map((row) => ({
      ...row,
      created_at: normalizeDates(row.created_at),
      last_login: normalizeDates(row.last_login)
    }));
  },
  getByManagerEmail: async (managerEmail) => {
    const rows = await dbAll('SELECT * FROM users WHERE manager_email = ?', [managerEmail]);
    return rows.map((row) => ({
      ...row,
      created_at: normalizeDates(row.created_at),
      last_login: normalizeDates(row.last_login)
    }));
  },
  updateRole: async (id, role) => dbRun('UPDATE users SET role = ? WHERE id = ?', [role, id]),
  updateLastLogin: async (id) => {
    const now = new Date().toISOString();
    return dbRun('UPDATE users SET last_login = ? WHERE id = ?', [now, id]);
  },
  delete: async (id) => dbRun('DELETE FROM users WHERE id = ?', [id]),
  updateProfile: async (id, profile) => dbRun(`
    UPDATE users
    SET name = ?, first_name = ?, last_name = ?, manager_first_name = ?, manager_last_name = ?, manager_email = ?, profile_image = ?
    WHERE id = ?
  `, [
    profile.name,
    profile.first_name || null,
    profile.last_name || null,
    profile.manager_first_name || null,
    profile.manager_last_name || null,
    profile.manager_email || null,
    profile.profile_image ?? null,
    id
  ]),
  updatePassword: async (id, passwordHash) => dbRun('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]),
  getByOIDCSub: async (oidcSub) => {
    const row = await dbGet('SELECT * FROM users WHERE oidc_sub = ?', [oidcSub]);
    if (!row) return null;
    return {
      ...row,
      created_at: normalizeDates(row.created_at),
      last_login: normalizeDates(row.last_login)
    };
  },
  createFromOIDC: async (userData) => {
    const now = new Date().toISOString();
    
    // Determine if profile is complete based on manager data presence
    const hasManagerData = userData.manager_first_name && 
                          userData.manager_last_name && 
                          userData.manager_email;
    const profileComplete = hasManagerData ? 1 : 0;
    
    const insertQuery = `
      INSERT INTO users (email, password_hash, name, role, created_at, first_name, last_name, manager_first_name, manager_last_name, manager_email, oidc_sub, profile_complete)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ${isPostgres ? 'RETURNING id' : ''}
    `;
    const result = await dbRun(insertQuery, [
      userData.email,
      'OIDC_USER_NO_PASSWORD',
      userData.name,
      userData.role || 'employee',
      now,
      userData.first_name || null,
      userData.last_name || null,
      userData.manager_first_name || null,
      userData.manager_last_name || null,
      userData.manager_email || null,
      userData.oidcSub,
      profileComplete
    ]);
    const id = isPostgres ? result.rows?.[0]?.id : result.lastInsertRowid;
    return { id };
  },
  linkOIDC: async (userId, oidcSub) => dbRun('UPDATE users SET oidc_sub = ? WHERE id = ?', [oidcSub, userId]),
  enableMFA: async (userId, secret, backupCodes) => dbRun(`
    UPDATE users
    SET mfa_enabled = 1, mfa_secret = ?, mfa_backup_codes = ?
    WHERE id = ?
  `, [secret, JSON.stringify(backupCodes), userId]),
  disableMFA: async (userId) => dbRun(`
    UPDATE users
    SET mfa_enabled = 0, mfa_secret = NULL, mfa_backup_codes = NULL
    WHERE id = ?
  `, [userId]),
  getMFAStatus: async (userId) => dbGet('SELECT mfa_enabled, mfa_secret, mfa_backup_codes FROM users WHERE id = ?', [userId]),
  completeProfile: async (userId, managerData) => dbRun(`
    UPDATE users
    SET manager_first_name = ?, manager_last_name = ?, manager_email = ?, profile_complete = 1
    WHERE id = ?
  `, [managerData.manager_first_name, managerData.manager_last_name, managerData.manager_email, userId]),
  useBackupCode: async (userId, code) => {
    const user = await userDb.getMFAStatus(userId);
    
    // Defensive check: ensure user exists and has backup codes
    if (!user || !user.mfa_backup_codes) return false;
    
    // Additional defensive check for empty string edge case
    const backupCodesStr = user.mfa_backup_codes;
    if (backupCodesStr.trim() === '') {
      console.error('MFA backup codes for user', userId, 'is an empty string');
      return false;
    }

    let backupCodes;
    try {
      backupCodes = JSON.parse(backupCodesStr);
      
      // Validate that parsed result is an array
      if (!Array.isArray(backupCodes)) {
        console.error('MFA backup codes for user', userId, 'is not an array after parsing');
        return false;
      }
    } catch (error) {
      console.error('Failed to parse MFA backup codes for user', userId, ':', error.message);
      return false;
    }

    const codeIndex = backupCodes.indexOf(code);

    if (codeIndex === -1) return false;

    backupCodes.splice(codeIndex, 1);
    await dbRun('UPDATE users SET mfa_backup_codes = ? WHERE id = ?', [JSON.stringify(backupCodes), userId]);
    return true;
  },
  getByEmails: async (emails) => {
    if (!emails || emails.length === 0) return [];
    // Case-insensitive matching using OR conditions to leverage indexes
    // Build multiple OR conditions for case-insensitive matching
    const normalizedEmails = [...new Set(emails.map(e => e.toLowerCase()))];
    
    if (normalizedEmails.length === 1) {
      // Single email - use existing indexed getByEmail logic
      return [await userDb.getByEmail(normalizedEmails[0])].filter(Boolean);
    }
    
    // Multiple emails - use IN clause with LOWER on both sides
    // Note: In production, consider adding a functional index on LOWER(email)
    // or storing emails in lowercase for optimal index usage
    const placeholders = normalizedEmails.map(() => '?').join(',');
    const query = `SELECT * FROM users WHERE LOWER(email) IN (${placeholders})`;
    const rows = await dbAll(query, normalizedEmails);
    return rows.map((row) => ({
      ...row,
      created_at: normalizeDates(row.created_at),
      last_login: normalizeDates(row.last_login)
    }));
  }
};

export const passkeyDb = {
  listByUser: async (userId) => {
    const rows = await dbAll('SELECT * FROM passkeys WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    return rows.map((row) => ({
      ...row,
      created_at: normalizeDates(row.created_at),
      last_used_at: normalizeDates(row.last_used_at)
    }));
  },
  getByCredentialId: async (credentialId) => {
    const row = await dbGet('SELECT * FROM passkeys WHERE credential_id = ?', [credentialId]);
    if (!row) return null;
    return {
      ...row,
      created_at: normalizeDates(row.created_at),
      last_used_at: normalizeDates(row.last_used_at)
    };
  },
  getById: async (id) => {
    const row = await dbGet('SELECT * FROM passkeys WHERE id = ?', [id]);
    if (!row) return null;
    return {
      ...row,
      created_at: normalizeDates(row.created_at),
      last_used_at: normalizeDates(row.last_used_at)
    };
  },
  create: async ({ userId, name, credentialId, publicKey, counter, transports }) => {
    const now = new Date().toISOString();
    const insertQuery = `
      INSERT INTO passkeys (user_id, name, credential_id, public_key, counter, transports, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ${isPostgres ? 'RETURNING id' : ''}
    `;

    const result = await dbRun(insertQuery, [
      userId,
      name,
      credentialId,
      publicKey,
      counter || 0,
      transports ? JSON.stringify(transports) : null,
      now
    ]);

    const id = isPostgres ? result.rows?.[0]?.id : result.lastInsertRowid;
    return { id, created_at: now };
  },
  delete: async (id) => dbRun('DELETE FROM passkeys WHERE id = ?', [id]),
  updateCounter: async (id, counter) => dbRun('UPDATE passkeys SET counter = ?, last_used_at = ? WHERE id = ?', [counter, new Date().toISOString(), id])
};

export const oidcSettingsDb = {
  get: async () => {
    const row = await dbGet('SELECT * FROM oidc_settings WHERE id = 1');
    if (!row) return null;
    return {
      ...row,
      updated_at: normalizeDates(row.updated_at)
    };
  },
  update: async (settings, userEmail) => {
    const now = new Date().toISOString();
    return dbRun(`
      UPDATE oidc_settings
      SET enabled = ?,
          issuer_url = ?,
          client_id = ?,
          client_secret = ?,
          redirect_uri = ?,
          scope = ?,
          role_claim_path = ?,
          default_role = ?,
          sso_button_text = ?,
          sso_button_help_text = ?,
          sso_button_variant = ?,
          updated_at = ?,
          updated_by = ?
      WHERE id = 1
    `, [
      settings.enabled ? 1 : 0,
      settings.issuer_url || null,
      settings.client_id || null,
      settings.client_secret || null,
      settings.redirect_uri || null,
      settings.scope || 'openid email profile',
      settings.role_claim_path || 'roles',
      settings.default_role || 'employee',
      settings.sso_button_text || 'Sign In with SSO',
      settings.sso_button_help_text || null,
      settings.sso_button_variant || 'outline',
      now,
      userEmail
    ]);
  }
};

export const brandingSettingsDb = {
  get: async () => dbGet('SELECT * FROM branding_settings WHERE id = 1'),
  update: async (settings, userEmail) => {
    const now = new Date().toISOString();
    return dbRun(`
      UPDATE branding_settings
      SET logo_data = ?,
          logo_filename = ?,
          logo_content_type = ?,
          updated_at = ?,
          updated_by = ?
      WHERE id = 1
    `, [
      settings.logo_data || null,
      settings.logo_filename || null,
      settings.logo_content_type || null,
      now,
      userEmail
    ]);
  },
  delete: async () => {
    const now = new Date().toISOString();
    return dbRun(`
      UPDATE branding_settings
      SET logo_data = NULL,
          logo_filename = NULL,
          logo_content_type = NULL,
          updated_at = ?
      WHERE id = 1
    `, [now]);
  }
};

export const passkeySettingsDb = {
  get: async () => {
    let settings = await dbGet('SELECT * FROM passkey_settings WHERE id = 1');

    // If no settings exist, create default row
    if (!settings) {
      const now = new Date().toISOString();
      await dbRun(`
        INSERT INTO passkey_settings (id, rp_id, rp_name, origin, enabled, updated_at)
        VALUES (1, 'localhost', 'KARS - KeyData Asset Registration System', 'http://localhost:5173', 1, ?)
      `, [now]);
      settings = await dbGet('SELECT * FROM passkey_settings WHERE id = 1');
    }

    return {
      ...settings,
      enabled: settings.enabled ?? 1
    };
  },
  update: async (settings, userEmail) => {
    const now = new Date().toISOString();

    // Ensure row exists first
    const existing = await dbGet('SELECT * FROM passkey_settings WHERE id = 1');
    if (!existing) {
      await dbRun(`
        INSERT INTO passkey_settings (id, rp_id, rp_name, origin, enabled, updated_at, updated_by)
        VALUES (1, ?, ?, ?, ?, ?, ?)
      `, [
        settings.rp_id || 'localhost',
        settings.rp_name || 'KARS - KeyData Asset Registration System',
        settings.origin || 'http://localhost:5173',
        settings.enabled ? 1 : 0,
        now,
        userEmail
      ]);
    } else {
      await dbRun(`
        UPDATE passkey_settings
        SET rp_id = ?,
            rp_name = ?,
            origin = ?,
            enabled = ?,
            updated_at = ?,
            updated_by = ?
        WHERE id = 1
      `, [
        settings.rp_id || 'localhost',
        settings.rp_name || 'KARS - KeyData Asset Registration System',
        settings.origin || 'http://localhost:5173',
        settings.enabled ? 1 : 0,
        now,
        userEmail
      ]);
    }
  }
};

export const hubspotSettingsDb = {
  get: async () => {
    let settings = await dbGet('SELECT * FROM hubspot_settings WHERE id = 1');

    // If no settings exist, create default row
    if (!settings) {
      const now = new Date().toISOString();
      await dbRun(`
        INSERT INTO hubspot_settings (id, enabled, auto_sync_enabled, sync_interval, created_at, updated_at)
        VALUES (1, 0, 0, 'daily', ?, ?)
      `, [now, now]);
      settings = await dbGet('SELECT * FROM hubspot_settings WHERE id = 1');
    }

    return {
      ...settings,
      enabled: settings.enabled ?? 0,
      auto_sync_enabled: settings.auto_sync_enabled ?? 0,
      has_access_token: !!settings.access_token,
      // Don't return the actual access token for security
      access_token: undefined,
      last_sync: normalizeDates(settings.last_sync),
      created_at: normalizeDates(settings.created_at),
      updated_at: normalizeDates(settings.updated_at)
    };
  },
  getAccessToken: async () => {
    const settings = await dbGet('SELECT access_token FROM hubspot_settings WHERE id = 1');
    return settings?.access_token || null;
  },
  update: async (settings) => {
    const now = new Date().toISOString();

    // Build update fields dynamically
    const updates = [];
    const params = [];

    if (settings.enabled !== undefined) {
      updates.push('enabled = ?');
      params.push(settings.enabled ? 1 : 0);
    }
    if (settings.access_token !== undefined && settings.access_token !== '') {
      updates.push('access_token = ?');
      params.push(settings.access_token);
    }
    if (settings.auto_sync_enabled !== undefined) {
      updates.push('auto_sync_enabled = ?');
      params.push(settings.auto_sync_enabled ? 1 : 0);
    }
    if (settings.sync_interval !== undefined) {
      updates.push('sync_interval = ?');
      params.push(settings.sync_interval);
    }

    updates.push('updated_at = ?');
    params.push(now);

    if (updates.length === 0) {
      return;
    }

    await dbRun(`
      UPDATE hubspot_settings
      SET ${updates.join(', ')}
      WHERE id = 1
    `, params);
  },
  updateSyncStatus: async (status, companiesSynced) => {
    const now = new Date().toISOString();
    await dbRun(`
      UPDATE hubspot_settings
      SET last_sync = ?,
          last_sync_status = ?,
          companies_synced = ?,
          updated_at = ?
      WHERE id = 1
    `, [now, status, companiesSynced, now]);
  }
};

export const hubspotSyncLogDb = {
  log: async (syncData) => {
    const insertQuery = `
      INSERT INTO hubspot_sync_log (sync_started_at, sync_completed_at, status, companies_found, companies_created, companies_updated, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ${isPostgres ? 'RETURNING id' : ''}
    `;
    const result = await dbRun(insertQuery, [
      syncData.sync_started_at,
      syncData.sync_completed_at,
      syncData.status,
      syncData.companies_found || 0,
      syncData.companies_created || 0,
      syncData.companies_updated || 0,
      syncData.error_message || null
    ]);
    const id = isPostgres ? result.rows?.[0]?.id : result.lastInsertRowid;
    return { id };
  },
  getHistory: async (limit = 10) => {
    const rows = await dbAll(`
      SELECT * FROM hubspot_sync_log
      ORDER BY sync_started_at DESC
      LIMIT ?
    `, [limit]);
    return rows.map(row => ({
      ...row,
      sync_started_at: normalizeDates(row.sync_started_at),
      sync_completed_at: normalizeDates(row.sync_completed_at)
    }));
  }
};

export const smtpSettingsDb = {
  get: async () => {
    let settings = await dbGet('SELECT * FROM smtp_settings WHERE id = 1');

    // If no settings exist, create default row
    if (!settings) {
      const now = new Date().toISOString();
      await dbRun(`
        INSERT INTO smtp_settings (id, enabled, created_at, updated_at)
        VALUES (1, 0, ?, ?)
      `, [now, now]);
      settings = await dbGet('SELECT * FROM smtp_settings WHERE id = 1');
    }

    return {
      ...settings,
      enabled: settings.enabled ?? 0,
      has_password: !!settings.password_encrypted,
      // Don't return the encrypted password for security
      password_encrypted: undefined,
      created_at: normalizeDates(settings.created_at),
      updated_at: normalizeDates(settings.updated_at)
    };
  },
  getPassword: async () => {
    const settings = await dbGet('SELECT password_encrypted FROM smtp_settings WHERE id = 1');
    return settings?.password_encrypted || null;
  },
  update: async (settings) => {
    const now = new Date().toISOString();

    // Build update fields dynamically
    const updates = [];
    const params = [];

    if (settings.enabled !== undefined) {
      updates.push('enabled = ?');
      params.push(settings.enabled ? 1 : 0);
    }
    if (settings.host !== undefined) {
      updates.push('host = ?');
      params.push(settings.host || null);
    }
    if (settings.port !== undefined) {
      updates.push('port = ?');
      params.push(settings.port || null);
    }
    if (settings.use_tls !== undefined) {
      updates.push('use_tls = ?');
      params.push(settings.use_tls ? 1 : 0);
    }
    if (settings.username !== undefined) {
      updates.push('username = ?');
      params.push(settings.username || null);
    }
    // Only update password if explicitly provided
    if (settings.password_encrypted !== undefined && settings.password_encrypted !== null) {
      updates.push('password_encrypted = ?');
      params.push(settings.password_encrypted);
    }
    // Clear password if clear_password flag is set
    if (settings.clear_password === true) {
      updates.push('password_encrypted = ?');
      params.push(null);
    }
    if (settings.auth_method !== undefined) {
      updates.push('auth_method = ?');
      params.push(settings.auth_method || 'plain');
    }
    if (settings.from_name !== undefined) {
      updates.push('from_name = ?');
      params.push(settings.from_name || 'KARS Notifications');
    }
    if (settings.from_email !== undefined) {
      updates.push('from_email = ?');
      params.push(settings.from_email || null);
    }
    if (settings.default_recipient !== undefined) {
      updates.push('default_recipient = ?');
      params.push(settings.default_recipient || null);
    }

    updates.push('updated_at = ?');
    params.push(now);

    if (updates.length === 1) {
      // Only updated_at, nothing to do
      return;
    }

    await dbRun(`
      UPDATE smtp_settings
      SET ${updates.join(', ')}
      WHERE id = 1
    `, params);
  }
};

const testPostgresConnection = async (connectionString) => {
  const pool = new Pool({
    connectionString,
    ssl: buildSslConfig()
  });

  try {
    await pool.query('SELECT 1');
    await pool.end();
    return true;
  } catch (err) {
    await pool.end();
    throw err;
  }
};

export const databaseSettings = {
  get: () => ({
    engine: selectedEngine,
    postgresUrl: selectedPostgresUrl,
    managedByEnv: Boolean(envEngine || envPostgresUrl)
  }),
  update: async ({ engine, postgresUrl }) => {
    if (!['sqlite', 'postgres'].includes(engine)) {
      throw new Error('Engine must be sqlite or postgres');
    }

    if (engine === 'postgres') {
      if (!postgresUrl) {
        throw new Error('PostgreSQL connection string is required');
      }
      await testPostgresConnection(postgresUrl);
    }

    const persisted = loadConfig();
    const updated = {
      ...persisted,
      engine,
      postgresUrl: postgresUrl || persisted.postgresUrl
    };

    saveConfig(updated);
    return {
      engine,
      postgresUrl: updated.postgresUrl,
      managedByEnv: Boolean(envEngine || envPostgresUrl)
    };
  }
};

export const databaseEngine = selectedEngine;

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export const importSqliteDatabase = async (sqlitePath) => {
  if (!isPostgres || !pgPool) {
    throw new Error('PostgreSQL engine must be active to import SQLite data');
  }

  const sqlite = new Database(sqlitePath, { readonly: true });
  const client = await pgPool.connect();

  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE TABLE audit_logs, assets, companies, users RESTART IDENTITY CASCADE');

    const assets = sqlite.prepare('SELECT * FROM assets').all();
    const companies = sqlite.prepare('SELECT * FROM companies').all();
    const auditLogs = sqlite.prepare('SELECT * FROM audit_logs').all();
    const users = sqlite.prepare('SELECT * FROM users').all();

    for (const row of companies) {
      await client.query(
        `INSERT INTO companies (id, name, description, created_date)
         VALUES ($1, $2, $3, $4)` ,
        [row.id, row.name, row.description || '', parseDate(row.created_date)]
      );
    }

    for (const row of assets) {
      await client.query(
        `INSERT INTO assets (
          id, employee_name, employee_email, manager_name, manager_email,
          company_name, laptop_serial_number, laptop_asset_tag, laptop_make, laptop_model,
          status, registration_date, last_updated, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)` ,
        [
          row.id,
          row.employee_name,
          row.employee_email,
          row.manager_name,
          row.manager_email,
          row.company_name,
          row.laptop_serial_number,
          row.laptop_asset_tag,
          row.laptop_make || '',
          row.laptop_model || '',
          row.status,
          parseDate(row.registration_date),
          parseDate(row.last_updated),
          row.notes || ''
        ]
      );
    }

    for (const row of users) {
      await client.query(
        `INSERT INTO users (
          id, email, password_hash, name, role, created_at, last_login,
          first_name, last_name, manager_name, manager_email, oidc_sub, mfa_enabled, mfa_secret, mfa_backup_codes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)` ,
        [
          row.id,
          row.email,
          row.password_hash,
          row.name,
          row.role,
          parseDate(row.created_at),
          parseDate(row.last_login),
          row.first_name || null,
          row.last_name || null,
          row.manager_name || null,
          row.manager_email || null,
          row.oidc_sub || null,
          row.mfa_enabled || 0,
          row.mfa_secret || null,
          row.mfa_backup_codes || null
        ]
      );
    }

    for (const row of auditLogs) {
      await client.query(
        `INSERT INTO audit_logs (
          id, action, entity_type, entity_id, entity_name, details, timestamp, user_email
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)` ,
        [
          row.id,
          row.action,
          row.entity_type,
          row.entity_id,
          row.entity_name,
          row.details || '',
          parseDate(row.timestamp),
          row.user_email || null
        ]
      );
    }

    await client.query("SELECT setval(pg_get_serial_sequence('companies', 'id'), COALESCE(MAX(id), 0)) FROM companies");
    await client.query("SELECT setval(pg_get_serial_sequence('assets', 'id'), COALESCE(MAX(id), 0)) FROM assets");
    await client.query("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 0)) FROM users");
    await client.query("SELECT setval(pg_get_serial_sequence('audit_logs', 'id'), COALESCE(MAX(id), 0)) FROM audit_logs");

    await client.query('COMMIT');

    return {
      companies: companies.length,
      assets: assets.length,
      users: users.length,
      auditLogs: auditLogs.length
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    sqlite.close();
    client.release();
  }
};

export default { databaseEngine };
