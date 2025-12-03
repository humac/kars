import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Grid,
  Chip,
  TextField,
  Tabs,
  Tab,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Settings,
  People,
  Dashboard,
  SettingsApplications,
  Delete,
  Warning,
  VpnKey,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import OIDCSettings from './OIDCSettings';

const AdminSettings = () => {
  const { getAuthHeaders, user } = useAuth();
  const [activeView, setActiveView] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null });
  const [dbSettings, setDbSettings] = useState({
    engine: 'sqlite',
    postgresUrl: '',
    managedByEnv: false,
    effectiveEngine: 'sqlite',
    restartRequired: true
  });
  const [dbLoading, setDbLoading] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    if (activeView === 'users') {
      fetchUsers();
    }
    if (activeView === 'settings') {
      fetchDatabaseSettings();
    }
  }, [activeView]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/users', {
        headers: {
          ...getAuthHeaders()
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDatabaseSettings = async () => {
    setDbLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/database', {
        headers: {
          ...getAuthHeaders()
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load database settings');
      }

      const data = await response.json();
      setDbSettings(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setDbLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/auth/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ role: newRole })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user role');
      }

      setSuccess(`User role updated to ${newRole}`);
      fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDatabaseSave = async () => {
    setError(null);
    setSuccess(null);
    setDbLoading(true);

    try {
      const response = await fetch('/api/admin/database', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          engine: dbSettings.engine,
          postgresUrl: dbSettings.postgresUrl
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save database settings');
      }

      setDbSettings(data);
      setSuccess('Database settings saved. Restart the backend to apply changes.');
      setTimeout(() => setSuccess(null), 3500);
    } catch (err) {
      setError(err.message);
    } finally {
      setDbLoading(false);
    }
  };

  const handleDeleteClick = (userToDelete) => {
    setDeleteDialog({ open: true, user: userToDelete });
  };

  const handleDeleteConfirm = async () => {
    const userToDelete = deleteDialog.user;
    setDeleteDialog({ open: false, user: null });
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/auth/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders()
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      setSuccess('User deleted successfully');
      fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ open: false, user: null });
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: 'error',
      manager: 'success',
      employee: 'primary'
    };
    return colors[role] || 'default';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleTabChange = (event, newValue) => {
    setActiveView(newValue);
  };

  if (user?.role !== 'admin') {
    return (
      <Card sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Warning color="error" />
          <Typography variant="h5" fontWeight={600}>
            Access Denied
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          You do not have permission to access this page. Admin access required.
        </Typography>
      </Card>
    );
  }

  return (
    <>
      <Card sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <Settings color="primary" />
          <Typography variant="h5" fontWeight={600}>
            Admin Settings
          </Typography>
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={activeView} onChange={handleTabChange}>
            <Tab
              icon={<People />}
              iconPosition="start"
              label="User Management"
              value="users"
            />
            <Tab
              icon={<Dashboard />}
              iconPosition="start"
              label="System Overview"
              value="overview"
            />
            <Tab
              icon={<SettingsApplications />}
              iconPosition="start"
              label="Application Settings"
              value="settings"
            />
            <Tab
              icon={<VpnKey />}
              iconPosition="start"
              label="OIDC/SSO"
              value="oidc"
            />
          </Tabs>
        </Box>

        {/* Error Message */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Success Message */}
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        {/* User Management View */}
        {activeView === 'users' && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="h6">
                Manage Users & Roles
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Users: {users.length}
              </Typography>
            </Box>

            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" py={5}>
                <CircularProgress />
                <Typography variant="body1" sx={{ ml: 2 }}>
                  Loading users...
                </Typography>
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: '100%', mb: 4 }}>
                <Table size={isMobile ? 'small' : 'medium'}>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Name</strong></TableCell>
                      {!isMobile && <TableCell><strong>Email</strong></TableCell>}
                      <TableCell><strong>Role</strong></TableCell>
                      {!isMobile && <TableCell><strong>Created</strong></TableCell>}
                      {!isMobile && <TableCell><strong>Last Login</strong></TableCell>}
                      <TableCell><strong>Actions</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {u.name}
                          </Typography>
                          {isMobile && (
                            <Typography variant="caption" color="text.secondary">
                              {u.email}
                            </Typography>
                          )}
                        </TableCell>
                        {!isMobile && <TableCell>{u.email}</TableCell>}
                        <TableCell>
                          <FormControl size="small" disabled={u.id === user.id}>
                            <Select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              sx={{ minWidth: 120 }}
                            >
                              <MenuItem value="employee">Employee</MenuItem>
                              <MenuItem value="manager">Manager</MenuItem>
                              <MenuItem value="admin">Admin</MenuItem>
                            </Select>
                          </FormControl>
                        </TableCell>
                        {!isMobile && <TableCell>{formatDate(u.created_at)}</TableCell>}
                        {!isMobile && <TableCell>{formatDate(u.last_login)}</TableCell>}
                        <TableCell>
                          <Button
                            onClick={() => handleDeleteClick(u)}
                            disabled={u.id === user.id}
                            variant="contained"
                            color="error"
                            size="small"
                            startIcon={<Delete />}
                            sx={{ minWidth: isMobile ? 'auto' : 'auto' }}
                          >
                            {!isMobile && 'Delete'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Role Descriptions */}
            <Card sx={{ p: 3, bgcolor: 'background.default' }}>
              <Typography variant="h6" gutterBottom>
                Role Descriptions
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Box>
                    <Chip
                      label="Admin"
                      color={getRoleColor('admin')}
                      sx={{ mb: 1 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      Full system access. Can manage all users, view all assets and reports, configure system settings.
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box>
                    <Chip
                      label="Manager"
                      color={getRoleColor('manager')}
                      sx={{ mb: 1 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      Can view their own assets plus assets of employees they manage. Access to audit reports for their team.
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box>
                    <Chip
                      label="Employee"
                      color={getRoleColor('employee')}
                      sx={{ mb: 1 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      Can only view and manage their own asset registrations.
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Card>
          </Box>
        )}

        {/* System Overview */}
        {activeView === 'overview' && (
          <Box>
            <Typography variant="h6" gutterBottom>
              System Overview
            </Typography>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ p: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                  <Typography variant="h3" fontWeight={700}>
                    {users.length}
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 1 }}>
                    Total Users
                  </Typography>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ p: 3, bgcolor: 'success.main', color: 'success.contrastText' }}>
                  <Typography variant="h3" fontWeight={700}>
                    {users.filter(u => u.role === 'admin').length}
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 1 }}>
                    Administrators
                  </Typography>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ p: 3, bgcolor: 'info.main', color: 'info.contrastText' }}>
                  <Typography variant="h3" fontWeight={700}>
                    {users.filter(u => u.role === 'manager').length}
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 1 }}>
                    Managers
                  </Typography>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ p: 3, bgcolor: 'warning.main', color: 'warning.contrastText' }}>
                  <Typography variant="h3" fontWeight={700}>
                    {users.filter(u => u.role === 'employee').length}
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 1 }}>
                    Employees
                  </Typography>
                </Card>
              </Grid>
            </Grid>

            <Card sx={{ p: 3, bgcolor: 'background.default', mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                System Information
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Application:</strong> ARS - Asset Registration System
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Purpose:</strong> SOC2 Compliance - Track and manage client assets
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Features:</strong>
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 3 }}>
                    <Typography component="li" variant="body2" color="text.secondary">
                      Role-based access control (Admin, Manager, Employee)
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary">
                      Asset registration and tracking
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary">
                      Company management
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary">
                      Comprehensive audit logging
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary">
                      Customizable reporting and exports
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Card>
          </Box>
        )}

        {/* Application Settings */}
        {activeView === 'settings' && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Application Settings
            </Typography>

            <Grid container spacing={3} sx={{ mt: 1 }}>
              {/* Company Management */}
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 3, bgcolor: 'background.default', height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    Company Management
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Manage registered companies through the Company Management tab. Companies can be created, edited, and deleted as needed.
                  </Typography>
                  <Button
                    onClick={() => window.location.hash = '#companies'}
                    variant="contained"
                    size="small"
                  >
                    Go to Company Management
                  </Button>
                </Card>
              </Grid>

              {/* Audit & Compliance */}
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 3, bgcolor: 'background.default', height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    Audit & Compliance
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    All asset operations are automatically logged for SOC2 compliance. View detailed audit trails and generate reports through the Audit & Reporting tab.
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                    <strong>Audit Features:</strong>
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 3 }}>
                    <Typography component="li" variant="body2" color="text.secondary">
                      Comprehensive activity logging
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary">
                      User attribution for all actions
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary">
                      Timestamp tracking
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary">
                      CSV export capabilities
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary">
                      Role-based audit visibility
                    </Typography>
                  </Box>
                </Card>
              </Grid>

              {/* Data Management */}
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 3, bgcolor: 'background.default', height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    Data Management
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Choose the database engine that best fits your deployment. SQLite is the built-in default; PostgreSQL
                    is recommended for production resilience and external backups.
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Chip
                      label={`Active: ${dbSettings.effectiveEngine.toUpperCase()}`}
                      color={dbSettings.effectiveEngine === 'postgres' ? 'success' : 'default'}
                      size="small"
                    />
                    {dbSettings.managedByEnv && (
                      <Chip label="Managed by environment variables" color="warning" size="small" />
                    )}
                  </Box>
                  <FormControl fullWidth sx={{ mb: 2 }} disabled={dbSettings.managedByEnv || dbLoading}>
                    <Typography variant="subtitle2" gutterBottom>
                      Preferred engine
                    </Typography>
                    <Select
                      value={dbSettings.engine}
                      onChange={(e) => setDbSettings({ ...dbSettings, engine: e.target.value })}
                    >
                      <MenuItem value="sqlite">SQLite (default)</MenuItem>
                      <MenuItem value="postgres">PostgreSQL</MenuItem>
                    </Select>
                  </FormControl>
                  {dbSettings.engine === 'postgres' && (
                    <TextField
                      fullWidth
                      label="PostgreSQL connection string"
                      placeholder="postgresql://user:pass@host:5432/database"
                      value={dbSettings.postgresUrl}
                      onChange={(e) => setDbSettings({ ...dbSettings, postgresUrl: e.target.value })}
                      disabled={dbSettings.managedByEnv || dbLoading}
                      helperText="Requires restart after saving. Validate credentials before applying."
                      sx={{ mb: 2 }}
                    />
                  )}
                  <Button
                    variant="contained"
                    onClick={handleDatabaseSave}
                    disabled={dbSettings.managedByEnv || dbLoading}
                  >
                    {dbLoading ? 'Saving…' : 'Save Database Settings'}
                  </Button>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    A service restart is required after changing the database engine or connection string.
                  </Typography>
                </Card>
              </Grid>

              {/* PostgreSQL Setup */}
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 3, bgcolor: 'background.default', height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    PostgreSQL Setup
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Configure a PostgreSQL database to replace the default SQLite file. Point the backend to your
                    PostgreSQL connection string and restart the service to take effect.
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                    <strong>Connection details to collect:</strong>
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 3, mb: 2 }}>
                    <Typography component="li" variant="body2" color="text.secondary">
                      Host, port, and database name
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary">
                      Database user and password (least-privilege)
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary">
                      TLS requirements and allowed IPs/security groups
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Migration tip:</strong> After configuring PostgreSQL, migrate existing SQLite data using the
                    documented export/import workflow to preserve assets, users, companies, and audit logs.
                  </Typography>
                  <Button
                    href="https://github.com/humac/claude_app_poc#postgresql-configuration-and-migration"
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="contained"
                    size="small"
                    sx={{ mt: 2 }}
                  >
                    View PostgreSQL Setup & Migration Guide
                  </Button>
                </Card>
              </Grid>

              {/* Security Best Practices */}
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 3, bgcolor: 'warning.light', border: 2, borderColor: 'warning.main', height: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Warning color="warning" />
                    <Typography variant="h6">
                      Security Best Practices
                    </Typography>
                  </Box>
                  <Box component="ul" sx={{ m: 0, pl: 3 }}>
                    <Typography component="li" variant="body2">
                      Regularly review user roles and permissions
                    </Typography>
                    <Typography component="li" variant="body2">
                      Remove inactive user accounts
                    </Typography>
                    <Typography component="li" variant="body2">
                      Enforce strong password policies
                    </Typography>
                    <Typography component="li" variant="body2">
                      Monitor audit logs for suspicious activity
                    </Typography>
                    <Typography component="li" variant="body2">
                      Keep the application updated
                    </Typography>
                  </Box>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* OIDC/SSO Settings */}
        {activeView === 'oidc' && (
          <Box>
            <OIDCSettings />
          </Box>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Delete User</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete user "{deleteDialog.user?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AdminSettings;
