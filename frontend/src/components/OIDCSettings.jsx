import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Switch,
  FormControlLabel,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Save, VpnKey } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const OIDCSettings = () => {
  const { getAuthHeaders } = useAuth();
  const [settings, setSettings] = useState({
    enabled: false,
    issuer_url: '',
    client_id: '',
    client_secret: '',
    redirect_uri: '',
    scope: 'openid email profile',
    role_claim_path: 'roles',
    default_role: 'employee',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [hasClientSecret, setHasClientSecret] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/oidc-settings', {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setSettings({
          enabled: data.enabled === 1,
          issuer_url: data.issuer_url || '',
          client_id: data.client_id || '',
          client_secret: '',
          redirect_uri: data.redirect_uri || window.location.origin + '/auth/callback',
          scope: data.scope || 'openid email profile',
          role_claim_path: data.role_claim_path || 'roles',
          default_role: data.default_role || 'employee',
        });
        setHasClientSecret(data.has_client_secret);
      }
    } catch (err) {
      setError('Failed to load OIDC settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setSettings({
      ...settings,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/admin/oidc-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      setSuccess(true);
      setHasClientSecret(!!settings.client_secret || hasClientSecret);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={5}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
          <VpnKey color="primary" />
          <Typography variant="h5" fontWeight={600}>
            OIDC/SSO Configuration
          </Typography>
        </Box>

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            OIDC settings saved successfully!
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.enabled}
                onChange={handleChange}
                name="enabled"
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body1" fontWeight={600}>
                  Enable OIDC/SSO Authentication
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Allow users to sign in with an external identity provider
                </Typography>
              </Box>
            }
            sx={{ mb: 3 }}
          />

          <Divider sx={{ mb: 3 }} />

          <Typography variant="h6" gutterBottom>
            Provider Configuration
          </Typography>

          <TextField
            fullWidth
            label="Issuer URL"
            name="issuer_url"
            value={settings.issuer_url}
            onChange={handleChange}
            required={settings.enabled}
            disabled={!settings.enabled}
            placeholder="https://your-domain.auth0.com"
            helperText="The OIDC issuer URL from your identity provider"
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Client ID"
            name="client_id"
            value={settings.client_id}
            onChange={handleChange}
            required={settings.enabled}
            disabled={!settings.enabled}
            placeholder="your-client-id"
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Client Secret"
            name="client_secret"
            type="password"
            value={settings.client_secret}
            onChange={handleChange}
            required={settings.enabled && !hasClientSecret}
            disabled={!settings.enabled}
            placeholder={hasClientSecret ? "••••••••••••" : "your-client-secret"}
            helperText={hasClientSecret ? "Leave blank to keep existing secret" : ""}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Redirect URI"
            name="redirect_uri"
            value={settings.redirect_uri}
            onChange={handleChange}
            required={settings.enabled}
            disabled={!settings.enabled}
            placeholder={window.location.origin + "/auth/callback"}
            helperText="Configure this URL in your OIDC provider's allowed callback URLs"
            sx={{ mb: 2 }}
          />

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            Advanced Settings
          </Typography>

          <TextField
            fullWidth
            label="Scopes"
            name="scope"
            value={settings.scope}
            onChange={handleChange}
            disabled={!settings.enabled}
            placeholder="openid email profile"
            helperText="Space-separated list of OAuth scopes"
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Role Claim Path"
            name="role_claim_path"
            value={settings.role_claim_path}
            onChange={handleChange}
            disabled={!settings.enabled}
            placeholder="roles"
            helperText="Path to the roles claim in the OIDC token (e.g., 'roles', 'groups', 'https://myapp.com/roles')"
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            select
            label="Default Role"
            name="default_role"
            value={settings.default_role}
            onChange={handleChange}
            disabled={!settings.enabled}
            SelectProps={{ native: true }}
            helperText="Default role for new users if no role mapping matches"
            sx={{ mb: 3 }}
          >
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </TextField>

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <Save />}
          >
            {saving ? 'Saving...' : 'Save OIDC Settings'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default OIDCSettings;
