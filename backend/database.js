import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'assets.db'));

// Initialize database schema
const initDb = () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_name TEXT NOT NULL,
      manager_name TEXT NOT NULL,
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

  // Create indexes for faster searching
  db.exec('CREATE INDEX IF NOT EXISTS idx_employee_name ON assets(employee_name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_manager_name ON assets(manager_name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_client_name ON assets(client_name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_status ON assets(status)');

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
        employee_name, manager_name, client_name,
        laptop_serial_number, laptop_asset_tag,
        status, registration_date, last_updated, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    return stmt.run(
      asset.employee_name,
      asset.manager_name,
      asset.client_name,
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
      SET employee_name = ?, manager_name = ?, client_name = ?,
          laptop_serial_number = ?, laptop_asset_tag = ?,
          status = ?, last_updated = ?, notes = ?
      WHERE id = ?
    `);

    const now = new Date().toISOString();
    return stmt.run(
      asset.employee_name,
      asset.manager_name,
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

export default db;
