import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use data directory for database (for Docker volume mounting)
const dataDir = process.env.DATA_DIR || join(__dirname, 'data');
try {
  mkdirSync(dataDir, { recursive: true });
} catch (err) {
  // Directory already exists
}

const db = new Database(join(dataDir, 'assets.db'));

// Initialize database schema
const initDb = () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_name TEXT NOT NULL,
      employee_email TEXT NOT NULL,
      manager_name TEXT NOT NULL,
      manager_email TEXT NOT NULL,
      client_name TEXT NOT NULL,
      laptop_serial_number TEXT NOT NULL UNIQUE,
      laptop_asset_tag TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      registration_date TEXT NOT NULL,
      last_updated TEXT NOT NULL,
      notes TEXT
    )
  `;

  db.exec(createTableQuery);

  // Migration: Add email columns if they don't exist (for existing databases)
  try {
    db.exec('ALTER TABLE assets ADD COLUMN employee_email TEXT');
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE assets ADD COLUMN manager_email TEXT');
  } catch (e) {
    // Column already exists
  }

  // Migration: Add laptop_make and laptop_model columns if they don't exist
  try {
    db.exec('ALTER TABLE assets ADD COLUMN laptop_make TEXT');
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE assets ADD COLUMN laptop_model TEXT');
  } catch (e) {
    // Column already exists
  }

  // Create companies table
  const createCompaniesTableQuery = `
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_date TEXT NOT NULL
    )
  `;

  db.exec(createCompaniesTableQuery);

  // Create audit logs table
  const createAuditLogsTableQuery = `
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

  db.exec(createAuditLogsTableQuery);

  // Create users table
  const createUsersTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      created_at TEXT NOT NULL,
      last_login TEXT,
      first_name TEXT,
      last_name TEXT
    )
  `;

  db.exec(createUsersTableQuery);

  // Create OIDC settings table (single row configuration)
  const createOIDCSettingsTableQuery = `
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

  db.exec(createOIDCSettingsTableQuery);

  // Insert default OIDC settings if not exists
  try {
    const checkSettings = db.prepare('SELECT id FROM oidc_settings WHERE id = 1').get();
    if (!checkSettings) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO oidc_settings (id, enabled, updated_at)
        VALUES (1, 0, ?)
      `).run(now);
      console.log('Default OIDC settings created');
    }
  } catch (e) {
    console.error('Error creating default OIDC settings:', e);
  }

  // Migration: Add first_name and last_name columns if they don't exist
  try {
    db.exec('ALTER TABLE users ADD COLUMN first_name TEXT');
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE users ADD COLUMN last_name TEXT');
  } catch (e) {
    // Column already exists
  }

  // Migration: Add oidc_sub column for OIDC authentication
  try {
    db.exec('ALTER TABLE users ADD COLUMN oidc_sub TEXT UNIQUE');
  } catch (e) {
    // Column already exists
  }

  // Create indexes for faster searching
  db.exec('CREATE INDEX IF NOT EXISTS idx_employee_name ON assets(employee_name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_manager_name ON assets(manager_name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_client_name ON assets(client_name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_status ON assets(status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_company_name ON companies(name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_user_email ON users(email)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_user_oidc_sub ON users(oidc_sub)');

  console.log('Database initialized successfully');
};

// Asset CRUD operations
export const assetDb = {
  // Initialize database
  init: initDb,

  // Create new asset
  create: (asset) => {
    const stmt = db.prepare(`
      INSERT INTO assets (
        employee_name, employee_email, manager_name, manager_email,
        client_name, laptop_make, laptop_model, laptop_serial_number, laptop_asset_tag,
        status, registration_date, last_updated, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    return stmt.run(
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
    );
  },

  // Get all assets
  getAll: () => {
    const stmt = db.prepare('SELECT * FROM assets ORDER BY registration_date DESC');
    return stmt.all();
  },

  // Get asset by ID
  getById: (id) => {
    const stmt = db.prepare('SELECT * FROM assets WHERE id = ?');
    return stmt.get(id);
  },

  // Search assets
  search: (filters) => {
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

    const stmt = db.prepare(query);
    return stmt.all(...params);
  },

  // Update asset status
  updateStatus: (id, status, notes) => {
    const stmt = db.prepare(`
      UPDATE assets
      SET status = ?, last_updated = ?, notes = ?
      WHERE id = ?
    `);

    const now = new Date().toISOString();
    return stmt.run(status, now, notes || '', id);
  },

  // Update entire asset
  update: (id, asset) => {
    const stmt = db.prepare(`
      UPDATE assets
      SET employee_name = ?, employee_email = ?, manager_name = ?, manager_email = ?,
          client_name = ?, laptop_serial_number = ?, laptop_asset_tag = ?,
          status = ?, last_updated = ?, notes = ?
      WHERE id = ?
    `);

    const now = new Date().toISOString();
    return stmt.run(
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
    );
  },

  // Delete asset
  delete: (id) => {
    const stmt = db.prepare('DELETE FROM assets WHERE id = ?');
    return stmt.run(id);
  }
};

// Company CRUD operations
export const companyDb = {
  // Create new company
  create: (company) => {
    const stmt = db.prepare(`
      INSERT INTO companies (name, description, created_date)
      VALUES (?, ?, ?)
    `);

    const now = new Date().toISOString();
    return stmt.run(
      company.name,
      company.description || '',
      now
    );
  },

  // Get all companies
  getAll: () => {
    const stmt = db.prepare('SELECT * FROM companies ORDER BY name ASC');
    return stmt.all();
  },

  // Get company by ID
  getById: (id) => {
    const stmt = db.prepare('SELECT * FROM companies WHERE id = ?');
    return stmt.get(id);
  },

  // Get company by name
  getByName: (name) => {
    const stmt = db.prepare('SELECT * FROM companies WHERE name = ?');
    return stmt.get(name);
  },

  // Update company
  update: (id, company) => {
    const stmt = db.prepare(`
      UPDATE companies
      SET name = ?, description = ?
      WHERE id = ?
    `);

    return stmt.run(
      company.name,
      company.description || '',
      id
    );
  },

  // Delete company
  delete: (id) => {
    const stmt = db.prepare('DELETE FROM companies WHERE id = ?');
    return stmt.run(id);
  },

  // Check if company has assets
  hasAssets: (companyName) => {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM assets WHERE client_name = ?');
    const result = stmt.get(companyName);
    return result.count > 0;
  }
};

// Audit Log operations
export const auditDb = {
  // Log an action
  log: (action, entityType, entityId, entityName, details, userEmail = null) => {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, entity_name, details, timestamp, user_email)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    const detailsJson = typeof details === 'string' ? details : JSON.stringify(details);

    return stmt.run(action, entityType, entityId, entityName, detailsJson, now, userEmail);
  },

  // Get all audit logs
  getAll: (options = {}) => {
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

    const stmt = db.prepare(query);
    return stmt.all(...params);
  },

  // Get logs for specific entity
  getByEntity: (entityType, entityId) => {
    const stmt = db.prepare(`
      SELECT * FROM audit_logs
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY timestamp DESC
    `);
    return stmt.all(entityType, entityId);
  },

  // Get recent logs
  getRecent: (limit = 100) => {
    const stmt = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?');
    return stmt.all(limit);
  },

  // Get statistics
  getStats: (startDate = null, endDate = null) => {
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

    const stmt = db.prepare(query);
    return stmt.all(...params);
  }
};

// User authentication operations
export const userDb = {
  // Create new user
  create: (user) => {
    const stmt = db.prepare(`
      INSERT INTO users (email, password_hash, name, role, created_at, first_name, last_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    const fullName = user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.name;

    return stmt.run(
      user.email,
      user.password_hash,
      fullName,
      user.role || 'employee',
      now,
      user.first_name || null,
      user.last_name || null
    );
  },

  // Get user by email
  getByEmail: (email) => {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  },

  // Get user by ID
  getById: (id) => {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  },

  // Update last login
  updateLastLogin: (id) => {
    const stmt = db.prepare('UPDATE users SET last_login = ? WHERE id = ?');
    const now = new Date().toISOString();
    return stmt.run(now, id);
  },

  // Get all users (admin only)
  getAll: () => {
    const stmt = db.prepare('SELECT id, email, name, role, created_at, last_login FROM users ORDER BY created_at DESC');
    return stmt.all();
  },

  // Update user role
  updateRole: (id, role) => {
    const stmt = db.prepare('UPDATE users SET role = ? WHERE id = ?');
    return stmt.run(role, id);
  },

  // Update user profile
  updateProfile: (id, profile) => {
    const fullName = profile.first_name && profile.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : profile.name;

    const stmt = db.prepare(`
      UPDATE users
      SET name = ?, first_name = ?, last_name = ?
      WHERE id = ?
    `);
    return stmt.run(fullName, profile.first_name, profile.last_name, id);
  },

  // Update user password
  updatePassword: (id, passwordHash) => {
    const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    return stmt.run(passwordHash, id);
  },

  // Delete user
  delete: (id) => {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    return stmt.run(id);
  },

  // Get user by OIDC subject
  getByOIDCSub: (oidcSub) => {
    const stmt = db.prepare('SELECT * FROM users WHERE oidc_sub = ?');
    return stmt.get(oidcSub);
  },

  // Create user with OIDC (JIT provisioning)
  createFromOIDC: (userData) => {
    const stmt = db.prepare(`
      INSERT INTO users (email, password_hash, name, role, created_at, first_name, last_name, oidc_sub)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    const fullName = userData.first_name && userData.last_name
      ? `${userData.first_name} ${userData.last_name}`
      : userData.name;

    // Use a placeholder password hash for OIDC users (they won't use password login)
    const placeholderHash = 'OIDC_USER_NO_PASSWORD';

    return stmt.run(
      userData.email,
      placeholderHash,
      fullName,
      userData.role || 'employee',
      now,
      userData.first_name || null,
      userData.last_name || null,
      userData.oidcSub
    );
  },

  // Link existing user to OIDC subject
  linkOIDC: (userId, oidcSub) => {
    const stmt = db.prepare('UPDATE users SET oidc_sub = ? WHERE id = ?');
    return stmt.run(oidcSub, userId);
  }
};

// OIDC Settings operations
export const oidcSettingsDb = {
  // Get OIDC settings
  get: () => {
    const stmt = db.prepare('SELECT * FROM oidc_settings WHERE id = 1');
    return stmt.get();
  },

  // Update OIDC settings
  update: (settings, userEmail) => {
    const stmt = db.prepare(`
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
    `);

    const now = new Date().toISOString();
    return stmt.run(
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
    );
  }
};

export default db;
