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
      employee_name TEXT NOT NULL,
      employee_email TEXT NOT NULL,
      manager_name TEXT,
      manager_email TEXT,
      company_name TEXT NOT NULL,
      laptop_serial_number TEXT NOT NULL UNIQUE,
      laptop_asset_tag TEXT NOT NULL UNIQUE,
      laptop_make TEXT DEFAULT '',
      laptop_model TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      registration_date TIMESTAMP NOT NULL,
      last_updated TIMESTAMP NOT NULL,
      notes TEXT
    )
  ` : `
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_name TEXT NOT NULL,
      employee_email TEXT NOT NULL,
      manager_name TEXT,
      manager_email TEXT,
      company_name TEXT NOT NULL,
      laptop_serial_number TEXT NOT NULL UNIQUE,
      laptop_asset_tag TEXT NOT NULL UNIQUE,
      laptop_make TEXT,
      laptop_model TEXT,
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
      created_date TIMESTAMP NOT NULL
    )
  ` : `
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_date TEXT NOT NULL
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
      manager_email TEXT,
      profile_image TEXT,
      oidc_sub TEXT UNIQUE,
      mfa_enabled INTEGER DEFAULT 0,
      mfa_secret TEXT,
      mfa_backup_codes TEXT
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
      manager_email TEXT,
      profile_image TEXT,
      oidc_sub TEXT,
      mfa_enabled INTEGER DEFAULT 0,
      mfa_secret TEXT,
      mfa_backup_codes TEXT
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

  await dbRun(assetsTable);
  await dbRun(companiesTable);
  await dbRun(auditLogsTable);
  await dbRun(usersTable);
  await dbRun(oidcSettingsTable);
  await dbRun(brandingSettingsTable);
  await dbRun(passkeySettingsTable);
  await dbRun(passkeysTable);

  // Migrate existing databases to add manager fields to users table
  try {
    if (isPostgres) {
      await dbRun('ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_name TEXT');
      await dbRun('ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_email TEXT');
      await dbRun('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image TEXT');
      await dbRun('ALTER TABLE passkey_settings ADD COLUMN IF NOT EXISTS enabled INTEGER NOT NULL DEFAULT 1');
      await dbRun("ALTER TABLE oidc_settings ADD COLUMN IF NOT EXISTS sso_button_text TEXT DEFAULT 'Sign In with SSO'");
      await dbRun('ALTER TABLE oidc_settings ADD COLUMN IF NOT EXISTS sso_button_help_text TEXT');
      await dbRun("ALTER TABLE oidc_settings ADD COLUMN IF NOT EXISTS sso_button_variant TEXT DEFAULT 'outline'");
    } else {
      // SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so check first
      const columns = await dbAll("PRAGMA table_info(users)");
      const hasManagerName = columns.some(col => col.name === 'manager_name');
      const hasManagerEmail = columns.some(col => col.name === 'manager_email');
      const hasProfileImage = columns.some(col => col.name === 'profile_image');
      const passkeyColumns = await dbAll("PRAGMA table_info(passkey_settings)");
      const hasPasskeyEnabled = passkeyColumns.some(col => col.name === 'enabled');
      const oidcColumns = await dbAll("PRAGMA table_info(oidc_settings)");
      const hasOidcButtonText = oidcColumns.some(col => col.name === 'sso_button_text');
      const hasOidcButtonHelp = oidcColumns.some(col => col.name === 'sso_button_help_text');
      const hasOidcButtonVariant = oidcColumns.some(col => col.name === 'sso_button_variant');

      if (!hasManagerName) {
        await dbRun('ALTER TABLE users ADD COLUMN manager_name TEXT');
      }
      if (!hasManagerEmail) {
        await dbRun('ALTER TABLE users ADD COLUMN manager_email TEXT');
      }
      if (!hasProfileImage) {
        await dbRun('ALTER TABLE users ADD COLUMN profile_image TEXT');
      }
      if (!hasPasskeyEnabled) {
        await dbRun('ALTER TABLE passkey_settings ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1');
      }
      if (!hasOidcButtonText) {
        await dbRun("ALTER TABLE oidc_settings ADD COLUMN sso_button_text TEXT DEFAULT 'Sign In with SSO'");
      }
      if (!hasOidcButtonHelp) {
        await dbRun('ALTER TABLE oidc_settings ADD COLUMN sso_button_help_text TEXT');
      }
      if (!hasOidcButtonVariant) {
        await dbRun("ALTER TABLE oidc_settings ADD COLUMN sso_button_variant TEXT DEFAULT 'outline'");
      }
    }
  } catch (err) {
    console.log('Profile/manager columns may already exist in users table:', err.message);
  }

  // Migrate existing assets table to make manager fields nullable
  // This is needed for supporting unregistered employees
  try {
    if (isPostgres) {
      // PostgreSQL: Check if columns have NOT NULL constraint before trying to drop it
      const checkConstraint = await dbAll(`
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'assets'
        AND column_name IN ('manager_name', 'manager_email')
      `);

      for (const col of checkConstraint) {
        if (col.is_nullable === 'NO') {
          await dbRun(`ALTER TABLE assets ALTER COLUMN ${col.column_name} DROP NOT NULL`);
          console.log(`PostgreSQL: Dropped NOT NULL constraint from ${col.column_name}`);
        }
      }
    } else {
      // SQLite: Check if migration is needed by looking at table structure
      // SQLite requires recreating the table to change constraints
      const columns = await dbAll("PRAGMA table_info(assets)");
      const managerNameCol = columns.find(col => col.name === 'manager_name');
      const managerEmailCol = columns.find(col => col.name === 'manager_email');

      console.log('Checking assets table schema:', {
        manager_name_notnull: managerNameCol?.notnull,
        manager_email_notnull: managerEmailCol?.notnull
      });

      // Check if columns are NOT NULL (notnull === 1 means NOT NULL)
      if ((managerNameCol && managerNameCol.notnull === 1) || (managerEmailCol && managerEmailCol.notnull === 1)) {
        console.log('Migration needed: manager fields have NOT NULL constraint, recreating table...');

        // Need to recreate the table with nullable columns
        await dbRun('BEGIN TRANSACTION');

        try {
          // Create new table with nullable manager fields
          await dbRun(`
            CREATE TABLE assets_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              employee_name TEXT NOT NULL,
              employee_email TEXT NOT NULL,
              manager_name TEXT,
              manager_email TEXT,
              company_name TEXT NOT NULL,
              laptop_serial_number TEXT NOT NULL UNIQUE,
              laptop_asset_tag TEXT NOT NULL UNIQUE,
              laptop_make TEXT,
              laptop_model TEXT,
              status TEXT NOT NULL DEFAULT 'active',
              registration_date TEXT NOT NULL,
              last_updated TEXT NOT NULL,
              notes TEXT
            )
          `);

          // Copy data from old table to new table
          // Avoid referencing columns that may not exist (older schemas used `client_name`).
          // Detect which column exists and build the SELECT expression accordingly.
          const existingCols = await dbAll("PRAGMA table_info(assets)");
          const hasCompanyName = existingCols.some(col => col.name === 'company_name');
          const hasClientName = existingCols.some(col => col.name === 'client_name');
          const hasLaptopMake = existingCols.some(col => col.name === 'laptop_make');
          const hasLaptopModel = existingCols.some(col => col.name === 'laptop_model');
          const hasNotes = existingCols.some(col => col.name === 'notes');

          let companyExpr;
          if (hasCompanyName) {
            companyExpr = 'company_name AS company_name';
          } else if (hasClientName) {
            companyExpr = 'client_name AS company_name';
          } else {
            companyExpr = "'' AS company_name";
          }

          const laptopMakeExpr = hasLaptopMake ? 'laptop_make' : "''";
          const laptopModelExpr = hasLaptopModel ? 'laptop_model' : "''";
          const notesExpr = hasNotes ? 'notes' : "''";

          const copySql = `
            INSERT INTO assets_new (id, employee_name, employee_email, manager_name, manager_email,
                                     company_name, laptop_serial_number, laptop_asset_tag,
                                     laptop_make, laptop_model, status, registration_date, last_updated, notes)
            SELECT id, employee_name, employee_email, manager_name, manager_email,
                   ${companyExpr},
                   laptop_serial_number, laptop_asset_tag,
                   ${laptopMakeExpr}, ${laptopModelExpr}, status, registration_date, last_updated, ${notesExpr}
            FROM assets
          `;

          await dbRun(copySql);

          // Drop old table
          await dbRun('DROP TABLE assets');

          // Rename new table
          await dbRun('ALTER TABLE assets_new RENAME TO assets');

          // Recreate indexes
          await dbRun('CREATE INDEX IF NOT EXISTS idx_employee_name ON assets(employee_name)');
          await dbRun('CREATE INDEX IF NOT EXISTS idx_manager_name ON assets(manager_name)');
          await dbRun('CREATE INDEX IF NOT EXISTS idx_company_name ON assets(company_name)');
          await dbRun('CREATE INDEX IF NOT EXISTS idx_status ON assets(status)');

          await dbRun('COMMIT');
          console.log('✓ SQLite assets table successfully migrated to support nullable manager fields');

          // Verify migration succeeded
          const newColumns = await dbAll("PRAGMA table_info(assets)");
          const newManagerNameCol = newColumns.find(col => col.name === 'manager_name');
          const newManagerEmailCol = newColumns.find(col => col.name === 'manager_email');
          console.log('Migration verified:', {
            manager_name_notnull: newManagerNameCol?.notnull,
            manager_email_notnull: newManagerEmailCol?.notnull
          });
        } catch (innerErr) {
          await dbRun('ROLLBACK').catch(() => {});
          throw innerErr;
        }
      } else {
        console.log('No migration needed: manager fields are already nullable');
      }
    }
  } catch (err) {
    console.error('Asset manager fields migration FAILED:', err.message);
    console.error('Stack trace:', err.stack);
    throw new Error(`Failed to migrate assets table: ${err.message}`);
  }

  // Migrate client_name to company_name
  try {
    if (isPostgres) {
      // Check if client_name column exists
      const checkColumn = await dbAll(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'assets'
        AND column_name = 'client_name'
      `);

      if (checkColumn.length > 0) {
        await dbRun('ALTER TABLE assets RENAME COLUMN client_name TO company_name');
        console.log('PostgreSQL: Renamed client_name to company_name');
      }
    } else {
      // SQLite: Check if client_name exists
      const columns = await dbAll("PRAGMA table_info(assets)");
      const clientNameCol = columns.find(col => col.name === 'client_name');

      if (clientNameCol) {
        console.log('SQLite: Renaming client_name to company_name...');

        await dbRun('BEGIN TRANSACTION');

        try {
          // Create new table with company_name
          await dbRun(`
            CREATE TABLE assets_temp (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              employee_name TEXT NOT NULL,
              employee_email TEXT NOT NULL,
              manager_name TEXT,
              manager_email TEXT,
              company_name TEXT NOT NULL,
              laptop_serial_number TEXT NOT NULL UNIQUE,
              laptop_asset_tag TEXT NOT NULL UNIQUE,
              laptop_make TEXT,
              laptop_model TEXT,
              status TEXT NOT NULL DEFAULT 'active',
              registration_date TEXT NOT NULL,
              last_updated TEXT NOT NULL,
              notes TEXT
            )
          `);

          // Copy data, renaming client_name to company_name
          // Detect optional columns so older schemas without laptop_make/model/notes don't cause errors
          const srcCols = await dbAll("PRAGMA table_info(assets)");
          const srcHasLaptopMake = srcCols.some(col => col.name === 'laptop_make');
          const srcHasLaptopModel = srcCols.some(col => col.name === 'laptop_model');
          const srcHasNotes = srcCols.some(col => col.name === 'notes');

          const laptopMakeSrc = srcHasLaptopMake ? 'laptop_make' : "''";
          const laptopModelSrc = srcHasLaptopModel ? 'laptop_model' : "''";
          const notesSrc = srcHasNotes ? 'notes' : "''";

          await dbRun(`
            INSERT INTO assets_temp (id, employee_name, employee_email, manager_name, manager_email,
                                     company_name, laptop_serial_number, laptop_asset_tag,
                                     laptop_make, laptop_model, status, registration_date, last_updated, notes)
            SELECT id, employee_name, employee_email, manager_name, manager_email,
                   client_name, laptop_serial_number, laptop_asset_tag,
                   ${laptopMakeSrc}, ${laptopModelSrc}, status, registration_date, last_updated, ${notesSrc}
            FROM assets
          `);

          // Drop old table
          await dbRun('DROP TABLE assets');

          // Rename temp table
          await dbRun('ALTER TABLE assets_temp RENAME TO assets');

          await dbRun('COMMIT');
          console.log('✓ SQLite: Successfully renamed client_name to company_name');
        } catch (error) {
          await dbRun('ROLLBACK');
          throw error;
        }
      }
    }
  } catch (err) {
    console.error('Column rename migration failed:', err.message);
    console.error('Stack trace:', err.stack);
    throw new Error(`Failed to rename client_name to company_name: ${err.message}`);
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

  // Indexes
  await dbRun('CREATE INDEX IF NOT EXISTS idx_employee_name ON assets(employee_name)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_employee_email ON assets(employee_email)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_manager_name ON assets(manager_name)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_manager_email ON assets(manager_email)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_company_name ON assets(company_name)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_status ON assets(status)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_company_name ON companies(name)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_user_email ON users(email)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_user_manager_email ON users(manager_email)');
  // Only create oidc_sub index if the column exists (older DBs may not have oidc_sub)
  try {
    const userCols = await dbAll("PRAGMA table_info(users)");
    const hasOidcSub = userCols.some(col => col.name === 'oidc_sub');
    if (hasOidcSub) {
      await dbRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_user_oidc_sub ON users(oidc_sub)');
    }
  } catch (err) {
    console.warn('Could not create idx_user_oidc_sub index:', err.message);
  }

  console.log(`Database initialized using ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);
};

const normalizeDates = (date = null) => {
  if (!date) return null;
  return isPostgres ? new Date(date) : date;
};

export const assetDb = {
  init: initDb,
  create: async (asset) => {
    const now = new Date().toISOString();
    const insertQuery = `
      INSERT INTO assets (
        employee_name, employee_email, manager_name, manager_email,
        company_name, laptop_make, laptop_model, laptop_serial_number, laptop_asset_tag,
        status, registration_date, last_updated, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ${isPostgres ? 'RETURNING id' : ''}
    `;

    const result = await dbRun(insertQuery, [
      asset.employee_name,
      asset.employee_email,
      asset.manager_name,
      asset.manager_email,
      asset.company_name,
      asset.laptop_make || '',
      asset.laptop_model || '',
      asset.laptop_serial_number,
      asset.laptop_asset_tag,
      asset.status || 'active',
      now,
      now,
      asset.notes || ''
    ]);

    const newId = isPostgres ? result.rows?.[0]?.id : result.lastInsertRowid;
    return { id: newId };
  },
  getAll: async () => {
    const rows = await dbAll('SELECT * FROM assets ORDER BY registration_date DESC');
    return rows.map((row) => ({
      ...row,
      registration_date: normalizeDates(row.registration_date),
      last_updated: normalizeDates(row.last_updated)
    }));
  },
  getById: async (id) => {
    const row = await dbGet('SELECT * FROM assets WHERE id = ?', [id]);
    if (!row) return null;
    return {
      ...row,
      registration_date: normalizeDates(row.registration_date),
      last_updated: normalizeDates(row.last_updated)
    };
  },
  search: async (filters) => {
    let query = 'SELECT * FROM assets WHERE 1=1';
    const params = [];

    if (filters.employee_name) {
      query += ' AND employee_name LIKE ?';
      params.push(`%${filters.employee_name}%`);
    }

    if (filters.manager_name) {
      query += ' AND manager_name LIKE ?';
      params.push(`%${filters.manager_name}%`);
    }

    if (filters.company_name) {
      query += ' AND company_name LIKE ?';
      params.push(`%${filters.company_name}%`);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY registration_date DESC';

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
    return dbRun(`
      UPDATE assets
      SET employee_name = ?, employee_email = ?, manager_name = ?, manager_email = ?,
          company_name = ?, laptop_serial_number = ?, laptop_asset_tag = ?,
          status = ?, last_updated = ?, notes = ?
      WHERE id = ?
    `, [
      asset.employee_name,
      asset.employee_email,
      asset.manager_name,
      asset.manager_email,
      asset.company_name,
      asset.laptop_serial_number,
      asset.laptop_asset_tag,
      asset.status,
      now,
      asset.notes || '',
      id
    ]);
  },
  delete: async (id) => dbRun('DELETE FROM assets WHERE id = ?', [id]),
  getByEmployeeEmail: async (email) => {
    const rows = await dbAll('SELECT * FROM assets WHERE employee_email = ?', [email]);
    return rows.map((row) => ({
      ...row,
      registration_date: normalizeDates(row.registration_date),
      last_updated: normalizeDates(row.last_updated)
    }));
  },
  linkAssetsToUser: async (employeeEmail, managerName, managerEmail) => {
    const now = new Date().toISOString();
    return dbRun(`
      UPDATE assets
      SET manager_name = ?, manager_email = ?, last_updated = ?
      WHERE employee_email = ?
    `, [managerName, managerEmail, now, employeeEmail]);
  },
  updateManagerForEmployee: async (employeeEmail, managerName, managerEmail) => {
    const now = new Date().toISOString();
    return dbRun(`
      UPDATE assets
      SET manager_name = ?, manager_email = ?, last_updated = ?
      WHERE employee_email = ?
    `, [managerName, managerEmail, now, employeeEmail]);
  },
  getByIds: async (ids) => {
    if (!ids || ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const query = `SELECT * FROM assets WHERE id IN (${placeholders})`;
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
  bulkUpdateManager: async (ids, managerName, managerEmail) => {
    if (!ids || ids.length === 0) return { changes: 0 };
    const now = new Date().toISOString();
    const placeholders = ids.map(() => '?').join(',');
    const query = `
      UPDATE assets
      SET manager_name = ?, manager_email = ?, last_updated = ?
      WHERE id IN (${placeholders})
    `;
    return dbRun(query, [managerName, managerEmail, now, ...ids]);
  },
  getEmployeeEmailsByManager: async (managerEmail) => {
    const rows = await dbAll('SELECT DISTINCT employee_email FROM assets WHERE manager_email = ?', [managerEmail]);
    return rows.map(row => row.employee_email);
  }
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
  getAll: async () => {
    const rows = await dbAll('SELECT * FROM companies ORDER BY name ASC');
    return rows.map((row) => ({ ...row, created_date: normalizeDates(row.created_date) }));
  },
  getById: async (id) => {
    const row = await dbGet('SELECT * FROM companies WHERE id = ?', [id]);
    return row ? { ...row, created_date: normalizeDates(row.created_date) } : null;
  },
  getByName: async (name) => dbGet('SELECT * FROM companies WHERE name = ?', [name]),
  update: async (id, company) => dbRun(`
    UPDATE companies
    SET name = ?, description = ?
    WHERE id = ?
  `, [company.name, company.description || '', id]),
  delete: async (id) => dbRun('DELETE FROM companies WHERE id = ?', [id]),
  hasAssets: async (companyName) => {
    const row = await dbGet('SELECT COUNT(*) as count FROM assets WHERE company_name = ?', [companyName]);
    return (row?.count || 0) > 0;
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
      INSERT INTO users (email, password_hash, name, role, created_at, first_name, last_name, manager_name, manager_email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      user.manager_name || null,
      user.manager_email || null
    ]);
    const id = isPostgres ? result.rows?.[0]?.id : result.lastInsertRowid;
    return { id };
  },
  getByEmail: async (email) => dbGet('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]),
  getById: async (id) => dbGet('SELECT * FROM users WHERE id = ?', [id]),
  getAll: async () => dbAll('SELECT * FROM users ORDER BY created_at DESC'),
  getByManagerEmail: async (managerEmail) => dbAll('SELECT * FROM users WHERE manager_email = ?', [managerEmail]),
  updateRole: async (id, role) => dbRun('UPDATE users SET role = ? WHERE id = ?', [role, id]),
  updateLastLogin: async (id) => {
    const now = new Date().toISOString();
    return dbRun('UPDATE users SET last_login = ? WHERE id = ?', [now, id]);
  },
  delete: async (id) => dbRun('DELETE FROM users WHERE id = ?', [id]),
  updateProfile: async (id, profile) => dbRun(`
    UPDATE users
    SET name = ?, first_name = ?, last_name = ?, manager_name = ?, manager_email = ?, profile_image = ?
    WHERE id = ?
  `, [
    profile.name,
    profile.first_name || null,
    profile.last_name || null,
    profile.manager_name || null,
    profile.manager_email || null,
    profile.profile_image ?? null,
    id
  ]),
  updatePassword: async (id, passwordHash) => dbRun('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]),
  getByOIDCSub: async (oidcSub) => dbGet('SELECT * FROM users WHERE oidc_sub = ?', [oidcSub]),
  createFromOIDC: async (userData) => {
    const now = new Date().toISOString();
    const insertQuery = `
      INSERT INTO users (email, password_hash, name, role, created_at, first_name, last_name, manager_name, manager_email, oidc_sub)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      userData.manager_name || null,
      userData.manager_email || null,
      userData.oidcSub
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
  useBackupCode: async (userId, code) => {
    const user = await userDb.getMFAStatus(userId);
    if (!user || !user.mfa_backup_codes) return false;

    let backupCodes;
    try {
      backupCodes = JSON.parse(user.mfa_backup_codes);
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
    return dbAll(query, normalizedEmails);
  }
};

export const passkeyDb = {
  listByUser: async (userId) => dbAll('SELECT * FROM passkeys WHERE user_id = ? ORDER BY created_at DESC', [userId]),
  getByCredentialId: async (credentialId) => dbGet('SELECT * FROM passkeys WHERE credential_id = ?', [credentialId]),
  getById: async (id) => dbGet('SELECT * FROM passkeys WHERE id = ?', [id]),
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
  get: async () => dbGet('SELECT * FROM oidc_settings WHERE id = 1'),
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
