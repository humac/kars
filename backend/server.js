import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { assetDb, companyDb, auditDb, userDb } from './database.js';
import { authenticate, authorize, hashPassword, comparePassword, generateToken } from './auth.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
assetDb.init();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Asset Registration API is running' });
});

// ===== Authentication Endpoints =====

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, first_name, last_name } = req.body;

    // Validation - accept either 'name' or 'first_name + last_name'
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    if (!name && (!first_name || !last_name)) {
      return res.status(400).json({
        error: 'Either name or both first_name and last_name are required'
      });
    }

    // Check if user already exists
    const existingUser = userDb.getByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user
    const result = userDb.create({
      email,
      password_hash,
      name: name || `${first_name} ${last_name}`,
      first_name: first_name || null,
      last_name: last_name || null,
      role: 'user'
    });

    const newUser = userDb.getById(result.lastInsertRowid);

    // Generate token
    const token = generateToken(newUser);

    // Return user info (without password hash)
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        first_name: newUser.first_name,
        last_name: newUser.last_name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Find user
    const user = userDb.getByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    userDb.updateLastLogin(user.id);

    // Generate token
    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Get current user (verify token)
app.get('/api/auth/me', authenticate, (req, res) => {
  try {
    const user = userDb.getById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Update user profile
app.put('/api/auth/profile', authenticate, (req, res) => {
  try {
    const { first_name, last_name } = req.body;

    // Validation
    if (!first_name || !last_name) {
      return res.status(400).json({
        error: 'First name and last name are required'
      });
    }

    // Update profile
    userDb.updateProfile(req.user.id, {
      first_name,
      last_name
    });

    // Get updated user
    const user = userDb.getById(req.user.id);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get all users (admin only)
app.get('/api/auth/users', authenticate, authorize('admin'), (req, res) => {
  try {
    const users = userDb.getAll();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Update user role (admin only)
app.put('/api/auth/users/:id/role', authenticate, authorize('admin'), (req, res) => {
  try {
    const { role } = req.body;
    const userId = parseInt(req.params.id);

    // Validation
    if (!role || !['admin', 'manager', 'employee'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role. Must be one of: admin, manager, employee'
      });
    }

    const user = userDb.getById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admin from demoting themselves
    if (userId === req.user.id && role !== 'admin') {
      return res.status(403).json({
        error: 'Cannot change your own admin role'
      });
    }

    userDb.updateRole(userId, role);
    const updatedUser = userDb.getById(userId);

    res.json({
      message: 'User role updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name
      }
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Delete user (admin only)
app.delete('/api/auth/users/:id', authenticate, authorize('admin'), (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(403).json({
        error: 'Cannot delete your own account'
      });
    }

    const user = userDb.getById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    userDb.delete(userId);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get all assets (with role-based filtering)
app.get('/api/assets', authenticate, (req, res) => {
  try {
    const allAssets = assetDb.getAll();
    const user = userDb.getById(req.user.id);

    // Role-based filtering
    let filteredAssets;
    if (user.role === 'admin') {
      // Admin sees all assets
      filteredAssets = allAssets;
    } else if (user.role === 'manager') {
      // Manager sees their own assets + their employees' assets
      filteredAssets = allAssets.filter(asset =>
        asset.employee_email === user.email ||
        asset.manager_email === user.email
      );
    } else {
      // Employee sees only their own assets
      filteredAssets = allAssets.filter(asset =>
        asset.employee_email === user.email
      );
    }

    res.json(filteredAssets);
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// Get single asset by ID
app.get('/api/assets/:id', (req, res) => {
  try {
    const asset = assetDb.getById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(asset);
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// Search assets
app.get('/api/assets/search', (req, res) => {
  try {
    const filters = {
      employee_name: req.query.employee,
      manager_name: req.query.manager,
      client_name: req.query.client,
      status: req.query.status
    };

    const assets = assetDb.search(filters);
    res.json(assets);
  } catch (error) {
    console.error('Error searching assets:', error);
    res.status(500).json({ error: 'Failed to search assets' });
  }
});

// Create new asset
app.post('/api/assets', authenticate, (req, res) => {
  try {
    const { employee_name, employee_email, manager_name, manager_email, client_name, laptop_serial_number, laptop_asset_tag, notes } = req.body;

    // Validation
    if (!employee_name || !employee_email || !manager_name || !manager_email || !client_name || !laptop_serial_number || !laptop_asset_tag) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['employee_name', 'employee_email', 'manager_name', 'manager_email', 'client_name', 'laptop_serial_number', 'laptop_asset_tag']
      });
    }

    const result = assetDb.create(req.body);
    const newAsset = assetDb.getById(result.lastInsertRowid);

    // Log audit
    auditDb.log(
      'CREATE',
      'asset',
      newAsset.id,
      `${laptop_serial_number} - ${employee_name}`,
      {
        employee_name,
        employee_email,
        client_name,
        laptop_serial_number,
        laptop_asset_tag
      },
      employee_email
    );

    res.status(201).json({
      message: 'Asset registered successfully',
      asset: newAsset
    });
  } catch (error) {
    console.error('Error creating asset:', error);

    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        error: 'Asset with this serial number or asset tag already exists'
      });
    }

    res.status(500).json({ error: 'Failed to register asset' });
  }
});

// Update asset status
app.patch('/api/assets/:id/status', (req, res) => {
  try {
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['active', 'returned', 'lost', 'damaged', 'retired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        validStatuses
      });
    }

    const asset = assetDb.getById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const oldStatus = asset.status;
    assetDb.updateStatus(req.params.id, status, notes);
    const updatedAsset = assetDb.getById(req.params.id);

    // Log audit
    auditDb.log(
      'STATUS_CHANGE',
      'asset',
      asset.id,
      `${asset.laptop_serial_number} - ${asset.employee_name}`,
      {
        old_status: oldStatus,
        new_status: status,
        notes: notes || ''
      },
      asset.employee_email
    );

    res.json({
      message: 'Asset status updated successfully',
      asset: updatedAsset
    });
  } catch (error) {
    console.error('Error updating asset status:', error);
    res.status(500).json({ error: 'Failed to update asset status' });
  }
});

// Update entire asset
app.put('/api/assets/:id', (req, res) => {
  try {
    const asset = assetDb.getById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const { employee_name, employee_email, manager_name, manager_email, client_name, laptop_serial_number, laptop_asset_tag, status, notes } = req.body;

    if (!employee_name || !employee_email || !manager_name || !manager_email || !client_name || !laptop_serial_number || !laptop_asset_tag) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['employee_name', 'employee_email', 'manager_name', 'manager_email', 'client_name', 'laptop_serial_number', 'laptop_asset_tag']
      });
    }

    assetDb.update(req.params.id, req.body);
    const updatedAsset = assetDb.getById(req.params.id);

    res.json({
      message: 'Asset updated successfully',
      asset: updatedAsset
    });
  } catch (error) {
    console.error('Error updating asset:', error);

    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        error: 'Asset with this serial number or asset tag already exists'
      });
    }

    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// Delete asset
app.delete('/api/assets/:id', (req, res) => {
  try {
    const asset = assetDb.getById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    assetDb.delete(req.params.id);
    res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// ===== Company Management Endpoints =====

// Get all companies
app.get('/api/companies', authenticate, (req, res) => {
  try {
    const companies = companyDb.getAll();
    res.json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get single company by ID
app.get('/api/companies/:id', (req, res) => {
  try {
    const company = companyDb.getById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(company);
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// Create new company
app.post('/api/companies', authenticate, (req, res) => {
  try {
    const { name, description } = req.body;

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({
        error: 'Company name is required'
      });
    }

    // Check if company already exists
    const existing = companyDb.getByName(name);
    if (existing) {
      return res.status(409).json({
        error: 'A company with this name already exists'
      });
    }

    const result = companyDb.create(req.body);
    const newCompany = companyDb.getById(result.lastInsertRowid);

    res.status(201).json({
      message: 'Company registered successfully',
      company: newCompany
    });
  } catch (error) {
    console.error('Error creating company:', error);

    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        error: 'A company with this name already exists'
      });
    }

    res.status(500).json({ error: 'Failed to register company' });
  }
});

// Update company
app.put('/api/companies/:id', (req, res) => {
  try {
    const company = companyDb.getById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const { name, description } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        error: 'Company name is required'
      });
    }

    // Check if another company has this name
    const existing = companyDb.getByName(name);
    if (existing && existing.id !== parseInt(req.params.id)) {
      return res.status(409).json({
        error: 'A company with this name already exists'
      });
    }

    companyDb.update(req.params.id, req.body);
    const updatedCompany = companyDb.getById(req.params.id);

    res.json({
      message: 'Company updated successfully',
      company: updatedCompany
    });
  } catch (error) {
    console.error('Error updating company:', error);

    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        error: 'A company with this name already exists'
      });
    }

    res.status(500).json({ error: 'Failed to update company' });
  }
});

// Delete company
app.delete('/api/companies/:id', (req, res) => {
  try {
    const company = companyDb.getById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check if company has assets
    if (companyDb.hasAssets(company.name)) {
      return res.status(409).json({
        error: 'Cannot delete company with existing assets. Please reassign or delete assets first.'
      });
    }

    companyDb.delete(req.params.id);
    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

// ===== Audit & Reporting Endpoints =====

// Get all audit logs (with role-based filtering)
app.get('/api/audit/logs', authenticate, (req, res) => {
  try {
    const user = userDb.getById(req.user.id);

    const options = {
      entityType: req.query.entityType,
      entityId: req.query.entityId,
      action: req.query.action,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      userEmail: req.query.userEmail,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };

    let logs = auditDb.getAll(options);

    // Role-based filtering
    if (user.role === 'employee') {
      // Employees only see their own audit logs
      logs = logs.filter(log => log.user_email === user.email);
    } else if (user.role === 'manager') {
      // Managers see their own logs + their employees' logs
      // Get all assets where user is manager to find their employees
      const allAssets = assetDb.getAll();
      const employeeEmails = new Set();
      employeeEmails.add(user.email); // Add manager's own email

      allAssets.forEach(asset => {
        if (asset.manager_email === user.email) {
          employeeEmails.add(asset.employee_email);
        }
      });

      logs = logs.filter(log =>
        !log.user_email || employeeEmails.has(log.user_email)
      );
    }
    // Admin sees all logs (no filtering)

    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get audit logs for specific entity
app.get('/api/audit/entity/:type/:id', (req, res) => {
  try {
    const logs = auditDb.getByEntity(req.params.type, req.params.id);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching entity audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch entity audit logs' });
  }
});

// Get recent audit logs
app.get('/api/audit/recent', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    const logs = auditDb.getRecent(limit);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching recent audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch recent audit logs' });
  }
});

// Get audit statistics
app.get('/api/audit/stats', (req, res) => {
  try {
    const stats = auditDb.getStats(req.query.startDate, req.query.endDate);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({ error: 'Failed to fetch audit stats' });
  }
});

// Generate report (CSV export)
app.get('/api/audit/export', (req, res) => {
  try {
    const options = {
      entityType: req.query.entityType,
      action: req.query.action,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      userEmail: req.query.userEmail
    };

    const logs = auditDb.getAll(options);

    // Generate CSV
    const headers = ['ID', 'Timestamp', 'Action', 'Entity Type', 'Entity Name', 'Details', 'User Email'];
    const csvRows = [headers.join(',')];

    logs.forEach(log => {
      const row = [
        log.id,
        log.timestamp,
        log.action,
        log.entity_type,
        `"${log.entity_name || ''}"`,
        `"${log.details || ''}"`,
        log.user_email || ''
      ];
      csvRows.push(row.join(','));
    });

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

// Asset summary report (with role-based filtering)
app.get('/api/reports/summary', authenticate, (req, res) => {
  try {
    const user = userDb.getById(req.user.id);
    const allAssets = assetDb.getAll();

    // Filter assets based on role
    let assets;
    if (user.role === 'admin') {
      assets = allAssets;
    } else if (user.role === 'manager') {
      assets = allAssets.filter(asset =>
        asset.employee_email === user.email ||
        asset.manager_email === user.email
      );
    } else {
      assets = allAssets.filter(asset =>
        asset.employee_email === user.email
      );
    }

    const summary = {
      total: assets.length,
      by_status: {},
      by_company: {},
      by_manager: {}
    };

    assets.forEach(asset => {
      // Status breakdown
      summary.by_status[asset.status] = (summary.by_status[asset.status] || 0) + 1;

      // Company breakdown
      summary.by_company[asset.client_name] = (summary.by_company[asset.client_name] || 0) + 1;

      // Manager breakdown
      summary.by_manager[asset.manager_name] = (summary.by_manager[asset.manager_name] || 0) + 1;
    });

    res.json(summary);
  } catch (error) {
    console.error('Error generating summary report:', error);
    res.status(500).json({ error: 'Failed to generate summary report' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Asset Registration API running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
