import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Grid,
  Chip,
  Paper,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { Save, Lock, Person, Security, CheckCircle, Cancel } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import MFASetupModal from './MFASetupModal';

const Profile = () => {
  const { user, getAuthHeaders, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: ''
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
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || ''
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
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(formData),
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
      manager: 'warning',
      employee: 'info',
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
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Grid container spacing={3}>
        {/* Profile Information Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Person sx={{ mr: 1 }} color="primary" />
                <Typography variant="h5" fontWeight={600}>
                  Profile Information
                </Typography>
              </Box>

              <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Email
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {user?.email}
                  </Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
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
              </Paper>

              {success && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Profile updated successfully!
                </Alert>
              )}

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit} sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <TextField
                  fullWidth
                  label="First Name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  placeholder="John"
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="Last Name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  placeholder="Doe"
                  sx={{ mb: 2 }}
                />

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                  sx={{ mt: 'auto' }}
                >
                  {loading ? 'Updating...' : 'Update Profile'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Change Password Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Lock sx={{ mr: 1 }} color="primary" />
                <Typography variant="h5" fontWeight={600}>
                  Change Password
                </Typography>
              </Box>

              {passwordSuccess && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Password changed successfully!
                </Alert>
              )}

              {passwordError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {passwordError}
                </Alert>
              )}

              <Box component="form" onSubmit={handlePasswordSubmit} sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
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
                  fullWidth
                  disabled={passwordLoading}
                  startIcon={passwordLoading ? <CircularProgress size={20} /> : <Lock />}
                  sx={{ mt: 'auto' }}
                >
                  {passwordLoading ? 'Changing Password...' : 'Change Password'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Two-Factor Authentication Card */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Security sx={{ mr: 1 }} color="primary" />
                <Typography variant="h5" fontWeight={600}>
                  Two-Factor Authentication
                </Typography>
              </Box>

              {mfaSuccess && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {mfaSuccess}
                </Alert>
              )}

              {mfaError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {mfaError}
                </Alert>
              )}

              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body1" fontWeight={600} gutterBottom>
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
                      onClick={() => setShowDisableMFA(true)}
                    >
                      Disable MFA
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={() => setShowMFASetup(true)}
                    >
                      Enable MFA
                    </Button>
                  )}
                </Box>
              </Paper>

              <Alert severity="info">
                <Typography variant="body2">
                  Two-factor authentication adds an extra layer of security to your account by requiring
                  a verification code from your phone in addition to your password.
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
    </Box>
  );
};

export default Profile;
