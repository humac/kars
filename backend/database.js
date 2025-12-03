import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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

let sqliteDb = null;
let pgPool = null;
let selectedEngine = 'sqlite';
let selectedPostgresUrl = '';

if (wantsPostgres && postgresUrl) {
  try {
    pgPool = new Pool({
      connectionString: postgresUrl,
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined
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
      manager_name TEXT NOT NULL,
      manager_email TEXT NOT NULL,
      client_name TEXT NOT NULL,
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
      manager_name TEXT NOT NULL,
      manager_email TEXT NOT NULL,
      client_name TEXT NOT NULL,
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
      oidc_sub TEXT,
      mfa_enabled INTEGER DEFAULT 0,
      mfa_secret TEXT,
      mfa_backup_codes TEXT
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
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )
  `;

  await dbRun(assetsTable);
  await dbRun(companiesTable);
  await dbRun(auditLogsTable);
  await dbRun(usersTable);
  await dbRun(oidcSettingsTable);

  // Insert default OIDC settings if not exists
  const checkSettings = await dbGet('SELECT id FROM oidc_settings WHERE id = 1');
  if (!checkSettings) {
    const now = new Date().toISOString();
    await dbRun(`
      INSERT INTO oidc_settings (id, enabled, updated_at)
      VALUES (1, 0, ?)
    `, [now]);
  }

  // Indexes
  await dbRun('CREATE INDEX IF NOT EXISTS idx_employee_name ON assets(employee_name)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_manager_name ON assets(manager_name)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_client_name ON assets(client_name)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_status ON assets(status)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_company_name ON companies(name)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id)');
  await dbRun('CREATE INDEX IF NOT EXISTS idx_user_email ON users(email)');
  await dbRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_user_oidc_sub ON users(oidc_sub)');

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
        client_name, laptop_make, laptop_model, laptop_serial_number, laptop_asset_tag,
        status, registration_date, last_updated, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ${isPostgres ? 'RETURNING id' : ''}
    `;

    const result = await dbRun(insertQuery, [
      asset.employee_name,
      asset.employee_email,
      asset.manager_name,
      asset.manager_email,
      asset.client_name,
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

    if (filters.client_name) {
      query += ' AND client_name LIKE ?';
      params.push(`%${filters.client_name}%`);
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
          client_name = ?, laptop_serial_number = ?, laptop_asset_tag = ?,
          status = ?, last_updated = ?, notes = ?
      WHERE id = ?
    `, [
      asset.employee_name,
      asset.employee_email,
      asset.manager_name,
      asset.manager_email,
      asset.client_name,
      asset.laptop_serial_number,
      asset.laptop_asset_tag,
      asset.status,
      now,
      asset.notes || '',
      id
    ]);
  },
  delete: async (id) => dbRun('DELETE FROM assets WHERE id = ?', [id])
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
    const row = await dbGet('SELECT COUNT(*) as count FROM assets WHERE client_name = ?', [companyName]);
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
      INSERT INTO users (email, password_hash, name, role, created_at, first_name, last_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ${isPostgres ? 'RETURNING id' : ''}
    `;
    const result = await dbRun(insertQuery, [
      user.email,
      user.password_hash,
      user.name,
      user.role || 'employee',
      now,
      user.first_name || null,
      user.last_name || null
    ]);
    const id = isPostgres ? result.rows?.[0]?.id : result.lastInsertRowid;
    return { id };
  },
  getByEmail: async (email) => dbGet('SELECT * FROM users WHERE email = ?', [email]),
  getById: async (id) => dbGet('SELECT * FROM users WHERE id = ?', [id]),
  getAll: async () => dbAll('SELECT * FROM users ORDER BY created_at DESC'),
  updateRole: async (id, role) => dbRun('UPDATE users SET role = ? WHERE id = ?', [role, id]),
  updateLastLogin: async (id) => {
    const now = new Date().toISOString();
    return dbRun('UPDATE users SET last_login = ? WHERE id = ?', [now, id]);
  },
  delete: async (id) => dbRun('DELETE FROM users WHERE id = ?', [id]),
  updateProfile: async (id, profile) => dbRun(`
    UPDATE users
    SET name = ?, first_name = ?, last_name = ?
    WHERE id = ?
  `, [profile.name, profile.first_name || null, profile.last_name || null, id]),
  updatePassword: async (id, passwordHash) => dbRun('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]),
  getByOIDCSub: async (oidcSub) => dbGet('SELECT * FROM users WHERE oidc_sub = ?', [oidcSub]),
  createFromOIDC: async (userData) => {
    const now = new Date().toISOString();
    const insertQuery = `
      INSERT INTO users (email, password_hash, name, role, created_at, first_name, last_name, oidc_sub)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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

    const backupCodes = JSON.parse(user.mfa_backup_codes);
    const codeIndex = backupCodes.indexOf(code);

    if (codeIndex === -1) return false;

    backupCodes.splice(codeIndex, 1);
    await dbRun('UPDATE users SET mfa_backup_codes = ? WHERE id = ?', [JSON.stringify(backupCodes), userId]);
    return true;
  }
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
      now,
      userEmail
    ]);
  }
};

const testPostgresConnection = async (connectionString) => {
  const pool = new Pool({
    connectionString,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined
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
          client_name, laptop_serial_number, laptop_asset_tag, laptop_make, laptop_model,
          status, registration_date, last_updated, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)` ,
        [
          row.id,
          row.employee_name,
          row.employee_email,
          row.manager_name,
          row.manager_email,
          row.client_name,
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
          first_name, last_name, oidc_sub, mfa_enabled, mfa_secret, mfa_backup_codes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)` ,
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
