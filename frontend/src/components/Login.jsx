import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Link,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Login as LoginIcon, VpnKey } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Login = ({ onSwitchToRegister }) => {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [error, setError] = useState(null);
  const [oidcEnabled, setOidcEnabled] = useState(false);

  useEffect(() => {
    // Check if OIDC is enabled
    fetch('/api/auth/oidc/config')
      .then(res => res.json())
      .then(data => setOidcEnabled(data.enabled))
      .catch(err => console.error('Failed to check OIDC config:', err));
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await login(formData.email, formData.password);

    if (!result.success) {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleOIDCLogin = async () => {
    setOidcLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/oidc/login');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate OIDC login');
      }

      // Redirect to OIDC provider
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err.message);
      setOidcLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 450, width: '100%' }}>
        <Box
          sx={{
            bgcolor: 'secondary.main',
            color: 'white',
            p: 3,
            textAlign: 'center',
          }}
        >
          <Typography variant="h5" fontWeight={600} gutterBottom>
            ARS - Asset Registration System
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            Sign in to manage client assets
          </Typography>
        </Box>

        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
            <LoginIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Login
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
              placeholder="you@company.com"
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              sx={{ mb: 3 }}
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={loading || oidcLoading}
              startIcon={loading ? <CircularProgress size={20} /> : <LoginIcon />}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            {oidcEnabled && (
              <>
                <Divider sx={{ my: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    OR
                  </Typography>
                </Divider>

                <Button
                  fullWidth
                  variant="outlined"
                  size="large"
                  onClick={handleOIDCLogin}
                  disabled={loading || oidcLoading}
                  startIcon={oidcLoading ? <CircularProgress size={20} /> : <VpnKey />}
                >
                  {oidcLoading ? 'Redirecting...' : 'Sign In with SSO'}
                </Button>
              </>
            )}

            <Box
              sx={{
                mt: 3,
                pt: 2,
                borderTop: 1,
                borderColor: 'divider',
                textAlign: 'center',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Don't have an account?{' '}
                <Link
                  component="button"
                  type="button"
                  variant="body2"
                  onClick={onSwitchToRegister}
                  sx={{ cursor: 'pointer', fontWeight: 600 }}
                >
                  Register here
                </Link>
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Login;
