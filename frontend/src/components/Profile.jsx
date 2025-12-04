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
  Tabs,
  Tab,
  Stack,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Person,
  CheckCircle,
  Cancel,
  AccountCircle,
  Edit,
  Security as SecurityIcon,
  VpnKey,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import MFASetupModal from './MFASetupModal';
import { prepareCreationOptions, uint8ArrayToBase64Url } from '../utils/webauthn';

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
  const [activeTab, setActiveTab] = useState('account');
  const [passkeys, setPasskeys] = useState([]);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyError, setPasskeyError] = useState('');
  const [passkeySuccess, setPasskeySuccess] = useState('');
  const [newPasskeyName, setNewPasskeyName] = useState('');

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

  useEffect(() => {
    if (activeTab === 'security') {
      fetchPasskeys();
    }
  }, [activeTab]);

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

  const fetchPasskeys = async () => {
    setPasskeyLoading(true);
    setPasskeyError('');

    try {
      const response = await fetch('/api/auth/passkeys', {
        headers: {
          ...getAuthHeaders(),
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load passkeys');
      }

      setPasskeys(data.passkeys || []);
    } catch (err) {
      setPasskeyError(err.message);
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handlePasskeyRegistration = async () => {
    if (!window.PublicKeyCredential) {
      setPasskeyError('Passkeys are not supported in this browser.');
      return;
    }

    setPasskeyLoading(true);
    setPasskeyError('');
    setPasskeySuccess('');

    try {
      const optionsResponse = await fetch('/api/auth/passkeys/registration-options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });

      const optionsData = await optionsResponse.json();
      if (!optionsResponse.ok) {
        throw new Error(optionsData.error || 'Unable to start passkey setup');
      }

      const creationOptions = prepareCreationOptions(optionsData.options);
      const credential = await navigator.credentials.create({ publicKey: creationOptions });

      if (!credential) {
        throw new Error('No credential was returned by the authenticator');
      }

      const verificationPayload = {
        name: newPasskeyName.trim() || 'Passkey',
        credential: {
          id: credential.id,
          rawId: uint8ArrayToBase64Url(credential.rawId),
          type: credential.type,
          response: {
            clientDataJSON: uint8ArrayToBase64Url(credential.response.clientDataJSON),
            attestationObject: uint8ArrayToBase64Url(credential.response.attestationObject),
            transports:
              typeof credential.response.getTransports === 'function'
                ? credential.response.getTransports()
                : credential.response.transports || [],
          },
        },
      };

      const verifyResponse = await fetch('/api/auth/passkeys/verify-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(verificationPayload),
      });

      const verifyData = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(verifyData.error || 'Unable to save passkey');
      }

      setPasskeys((prev) => [verifyData.passkey, ...prev.filter((pk) => pk.id !== verifyData.passkey.id)]);
      setPasskeySuccess('Passkey added successfully.');
      setNewPasskeyName('');
    } catch (err) {
      setPasskeyError(err.message);
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleDeletePasskey = async (passkeyId) => {
    setPasskeyLoading(true);
    setPasskeyError('');
    setPasskeySuccess('');

    try {
      const response = await fetch(`/api/auth/passkeys/${passkeyId}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete passkey');
      }

      setPasskeys((prev) => prev.filter((pk) => pk.id !== passkeyId));
      setPasskeySuccess('Passkey removed successfully.');
    } catch (err) {
      setPasskeyError(err.message);
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const formatPasskeyDate = (value) => (value ? new Date(value).toLocaleString() : 'Never');

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

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab
              icon={<AccountCircle />}
              iconPosition="start"
              label="Account Information"
              value="account"
            />
            <Tab
              icon={<Edit />}
              iconPosition="start"
              label="Update Information"
              value="update"
            />
            <Tab
              icon={<SecurityIcon />}
              iconPosition="start"
              label="Security"
              value="security"
            />
          </Tabs>
        </Box>

        {activeTab === 'account' && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Account Information
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Your core account details are managed by the administrator and cannot be edited here.
            </Typography>

            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6} md={4}>
                <Card variant="outlined" sx={{ p: 2, bgcolor: 'background.paper', height: '100%' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Email
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {user?.email || 'Not available'}
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card variant="outlined" sx={{ p: 2, bgcolor: 'background.paper', height: '100%' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Role
                  </Typography>
                  <Chip
                    label={user?.role?.toUpperCase() || 'N/A'}
                    color={getRoleColor(user?.role)}
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card variant="outlined" sx={{ p: 2, bgcolor: 'background.paper', height: '100%' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Current Name
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {user?.name || 'Not set'}
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card variant="outlined" sx={{ p: 2, bgcolor: 'background.paper', height: '100%' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Manager Name
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {user?.manager_name || 'Not set'}
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card variant="outlined" sx={{ p: 2, bgcolor: 'background.paper', height: '100%' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Manager Email
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {user?.manager_email || 'Not set'}
                  </Typography>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {activeTab === 'update' && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Update Information
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
                    placeholder="Smith"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    type="email"
                    label="Manager Email"
                    name="manager_email"
                    value={formData.manager_email}
                    onChange={handleChange}
                    placeholder="manager@example.com"
                  />
                </Grid>
              </Grid>

              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{ mt: 3 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Update Profile'}
              </Button>
            </Box>
          </Box>
        )}

        {activeTab === 'security' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Security
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Manage your password, passkeys, and multi-factor authentication preferences.
              </Typography>
              <Stack spacing={3}>
                <Card variant="outlined" sx={{ p: 3, bgcolor: 'background.paper' }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Update Password
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Update your password regularly to help keep your account secure.
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

                <Card variant="outlined" sx={{ p: 3, bgcolor: 'background.paper' }}>
                  <Typography variant="subtitle1" gutterBottom>
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

                <Card variant="outlined" sx={{ p: 3, bgcolor: 'background.paper' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <VpnKey color="primary" />
                    <Typography variant="subtitle1" gutterBottom sx={{ mb: 0 }}>
                      Passkeys
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Use passkeys for passwordless sign-in and manage the authenticators tied to your account.
                  </Typography>

                  {passkeyError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {passkeyError}
                    </Alert>
                  )}

                  {passkeySuccess && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      {passkeySuccess}
                    </Alert>
                  )}

                  <Stack spacing={2} sx={{ mb: 2 }}>
                    <TextField
                      fullWidth
                      label="Passkey name"
                      value={newPasskeyName}
                      onChange={(e) => setNewPasskeyName(e.target.value)}
                      placeholder="e.g. MacBook Touch ID"
                    />
                    <Button
                      variant="contained"
                      onClick={handlePasskeyRegistration}
                      disabled={passkeyLoading}
                      startIcon={passkeyLoading ? <CircularProgress size={24} /> : <VpnKey />}
                    >
                      {passkeyLoading ? 'Waiting for passkey...' : 'Create new passkey'}
                    </Button>
                  </Stack>

                  <Alert severity="info" sx={{ mb: 2 }}>
                    Passkeys require a supported browser and device. Keep at least one passkey available in case you forget your password.
                  </Alert>

                  {passkeyLoading && !passkeys.length ? (
                    <Typography variant="body2" color="text.secondary">
                      Loading passkeys...
                    </Typography>
                  ) : (
                    <List dense>
                      {passkeys.map((pk) => (
                        <ListItem
                          key={pk.id}
                          secondaryAction={
                            <Tooltip title="Remove passkey">
                              <span>
                                <IconButton
                                  edge="end"
                                  onClick={() => handleDeletePasskey(pk.id)}
                                  disabled={passkeyLoading}
                                  aria-label="Delete passkey"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          }
                        >
                          <ListItemText
                            primary={pk.name}
                            secondary={`Created ${formatPasskeyDate(pk.created_at)} • Last used ${formatPasskeyDate(pk.last_used_at)}`}
                          />
                        </ListItem>
                      ))}
                      {!passkeys.length && (
                        <ListItem>
                          <ListItemText
                            primary="No passkeys yet"
                            secondary="Create a passkey to enable passwordless sign-in."
                          />
                        </ListItem>
                      )}
                    </List>
                  )}
                </Card>
              </Stack>
            </Box>
          </Box>
        )}
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
