import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Typography,
  TextField,
  Button,
  Alert,
  Grid,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Person, CheckCircle, Cancel } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import MFASetupModal from './MFASetupModal';

const Profile = () => {
  const { user, getAuthHeaders, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    manager_first_name: '',
    manager_last_name: '',
    manager_email: ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [error, setError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [showDisableMFA, setShowDisableMFA] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaSuccess, setMfaSuccess] = useState('');

  useEffect(() => {
    // Initialize form with user data
    if (user) {
      // Split manager_name if it exists
      const managerNameParts = user.manager_name ? user.manager_name.trim().split(' ') : ['', ''];
      const manager_first_name = managerNameParts[0] || '';
      const manager_last_name = managerNameParts.slice(1).join(' ') || '';

      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        manager_first_name,
        manager_last_name,
        manager_email: user.manager_email || ''
      });
    }
  }, [user]);

  // Fetch MFA status
  useEffect(() => {
    const fetchMFAStatus = async () => {
      try {
        const response = await fetch('/api/auth/mfa/status', {
          headers: getAuthHeaders(),
        });
        const data = await response.json();
        if (response.ok) {
          setMfaEnabled(data.enabled);
        }
      } catch (err) {
        console.error('Failed to fetch MFA status:', err);
      }
    };

    fetchMFAStatus();
  }, [getAuthHeaders]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Combine manager first and last names for API
      const submitData = {
        ...formData,
        manager_name: `${formData.manager_first_name} ${formData.manager_last_name}`.trim()
      };
      // Remove the separate fields since API expects manager_name
      delete submitData.manager_first_name;
      delete submitData.manager_last_name;

      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setSuccess(true);

      // Update user in context
      updateUser(data.user);

      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    // Client-side validation
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      setPasswordLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long');
      setPasswordLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(passwordData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      setPasswordSuccess(true);

      // Clear password form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      setTimeout(() => setPasswordSuccess(false), 5000);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: 'error',
      manager: 'success',
      employee: 'primary',
    };
    return colors[role] || 'default';
  };

  const handleMFASetupComplete = () => {
    setMfaEnabled(true);
    setShowMFASetup(false);
    setMfaSuccess('Two-factor authentication enabled successfully!');
    setTimeout(() => setMfaSuccess(''), 5000);
  };

  const handleDisableMFA = async () => {
    if (!disablePassword) {
      setMfaError('Password is required to disable MFA');
      return;
    }

    setMfaLoading(true);
    setMfaError('');

    try {
      const response = await fetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ password: disablePassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disable MFA');
      }

      setMfaEnabled(false);
      setShowDisableMFA(false);
      setDisablePassword('');
      setMfaSuccess('Two-factor authentication disabled successfully');
      setTimeout(() => setMfaSuccess(''), 5000);
    } catch (err) {
      setMfaError(err.message);
    } finally {
      setMfaLoading(false);
    }
  };

  return (
    <>
      <Card sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <Person color="primary" />
          <Typography variant="h5" fontWeight={600}>
            Profile Settings
          </Typography>
        </Box>

        {/* Global Success/Error Messages */}
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Profile updated successfully!
          </Alert>
        )}

        {passwordSuccess && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Password changed successfully!
          </Alert>
        )}

        {mfaSuccess && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {mfaSuccess}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Account Information */}
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 3, bgcolor: 'background.default', height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Account Information
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Email
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {user?.email}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Role
                  </Typography>
                  <Chip
                    label={user?.role?.toUpperCase()}
                    color={getRoleColor(user?.role)}
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Current Name
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {user?.name || 'Not set'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Manager Name
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {user?.manager_name || 'Not set'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Manager Email
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {user?.manager_email || 'Not set'}
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Grid>

          {/* Update Profile */}
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 3, bgcolor: 'background.default', height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Update Profile
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Update your personal information and manager details. Your email address cannot be changed.
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="First Name"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      required
                      placeholder="John"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Last Name"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      required
                      placeholder="Doe"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Manager First Name"
                      name="manager_first_name"
                      value={formData.manager_first_name}
                      onChange={handleChange}
                      required
                      placeholder="Jane"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Manager Last Name"
                      name="manager_last_name"
                      value={formData.manager_last_name}
                      onChange={handleChange}
                      required
                      placeholder="Smith"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Manager Email"
                      name="manager_email"
                      type="email"
                      value={formData.manager_email}
                      onChange={handleChange}
                      required
                      placeholder="manager@company.com"
                    />
                  </Grid>
                </Grid>

                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  sx={{ mt: 2 }}
                >
                  {loading ? <CircularProgress size={24} /> : 'Update Profile'}
                </Button>
              </Box>
            </Card>
          </Grid>

          {/* Change Password */}
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 3, bgcolor: 'background.default', height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Change Password
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Update your password to keep your account secure. Passwords must be at least 6 characters long.
              </Typography>

              {passwordError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {passwordError}
                </Alert>
              )}

              <Box component="form" onSubmit={handlePasswordSubmit}>
                <TextField
                  fullWidth
                  type="password"
                  label="Current Password"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  required
                  placeholder="Enter current password"
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  type="password"
                  label="New Password"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  required
                  placeholder="Enter new password (min 6 characters)"
                  inputProps={{ minLength: 6 }}
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  type="password"
                  label="Confirm New Password"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  required
                  placeholder="Confirm new password"
                  inputProps={{ minLength: 6 }}
                  sx={{ mb: 2 }}
                />

                <Button
                  type="submit"
                  variant="contained"
                  disabled={passwordLoading}
                >
                  {passwordLoading ? <CircularProgress size={24} /> : 'Change Password'}
                </Button>
              </Box>
            </Card>
          </Grid>

          {/* Two-Factor Authentication */}
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 3, bgcolor: 'background.default', height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Two-Factor Authentication
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Add an extra layer of security to your account by requiring a verification code from your phone in addition to your password.
              </Typography>

              {mfaError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {mfaError}
                </Alert>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Status
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {mfaEnabled ? (
                      <>
                        <CheckCircle color="success" fontSize="small" />
                        <Typography variant="body2" color="success.main" fontWeight={600}>
                          Enabled
                        </Typography>
                      </>
                    ) : (
                      <>
                        <Cancel color="error" fontSize="small" />
                        <Typography variant="body2" color="error.main">
                          Disabled
                        </Typography>
                      </>
                    )}
                  </Box>
                </Box>

                {mfaEnabled ? (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={() => setShowDisableMFA(true)}
                  >
                    Disable MFA
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => setShowMFASetup(true)}
                  >
                    Enable MFA
                  </Button>
                )}
              </Box>

              <Alert severity="info">
                <Typography variant="body2">
                  {mfaEnabled
                    ? 'Two-factor authentication is currently protecting your account.'
                    : 'Enable two-factor authentication to better protect your account from unauthorized access.'}
                </Typography>
              </Alert>
            </Card>
          </Grid>
        </Grid>
      </Card>

      {/* MFA Setup Modal */}
      <MFASetupModal
        open={showMFASetup}
        onClose={() => setShowMFASetup(false)}
        onComplete={handleMFASetupComplete}
        getAuthHeaders={getAuthHeaders}
      />

      {/* Disable MFA Confirmation Dialog */}
      <Dialog
        open={showDisableMFA}
        onClose={() => {
          setShowDisableMFA(false);
          setDisablePassword('');
          setMfaError('');
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will make your account less secure. Are you sure?
          </Alert>

          {mfaError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {mfaError}
            </Alert>
          )}

          <TextField
            fullWidth
            type="password"
            label="Enter your password to confirm"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            placeholder="Enter password"
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowDisableMFA(false);
              setDisablePassword('');
              setMfaError('');
            }}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDisableMFA}
            disabled={mfaLoading || !disablePassword}
          >
            {mfaLoading ? <CircularProgress size={24} /> : 'Disable MFA'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Profile;
