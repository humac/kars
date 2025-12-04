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
import MFAVerifyModal from './MFAVerifyModal';
import { prepareRequestOptions, uint8ArrayToBase64Url } from '../utils/webauthn';

const Login = ({ onSwitchToRegister }) => {
  const { login, setAuthData } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [error, setError] = useState(null);
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  // MFA state
  const [showMFAVerify, setShowMFAVerify] = useState(false);
  const [mfaSessionId, setMfaSessionId] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState('');

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

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Check if MFA is required
      if (data.mfaRequired) {
        setMfaSessionId(data.mfaSessionId);
        setShowMFAVerify(true);
        setLoading(false);
        return;
      }

      // Regular login success
      const result = await login(formData.email, formData.password);
      if (!result.success) {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMFAVerify = async (code, useBackupCode) => {
    setMfaLoading(true);
    setMfaError('');

    try {
      const response = await fetch('/api/auth/mfa/verify-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mfaSessionId,
          token: code,
          useBackupCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      // Store token and user data
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Reload to trigger auth context update
      window.location.reload();
    } catch (err) {
      setMfaError(err.message);
    } finally {
      setMfaLoading(false);
    }
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

  const handlePasskeyLogin = async () => {
    if (!window.PublicKeyCredential) {
      setError('Passkeys are not supported in this browser.');
      return;
    }

    if (!formData.email) {
      setError('Enter your email to continue with a passkey.');
      return;
    }

    setPasskeyLoading(true);
    setError(null);

    try {
      const optionsResponse = await fetch('/api/auth/passkeys/auth-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });

      const optionsData = await optionsResponse.json();
      if (!optionsResponse.ok) {
        throw new Error(optionsData.error || 'Unable to start passkey sign in');
      }

      const publicKeyOptions = prepareRequestOptions(optionsData.options);
      const assertion = await navigator.credentials.get({ publicKey: publicKeyOptions });

      if (!assertion) {
        throw new Error('No credential was provided by the authenticator');
      }

      const verificationPayload = {
        email: formData.email,
        credential: {
          id: assertion.id,
          type: assertion.type,
          rawId: uint8ArrayToBase64Url(assertion.rawId),
          response: {
            clientDataJSON: uint8ArrayToBase64Url(assertion.response.clientDataJSON),
            authenticatorData: uint8ArrayToBase64Url(assertion.response.authenticatorData),
            signature: uint8ArrayToBase64Url(assertion.response.signature),
            userHandle: assertion.response.userHandle
              ? uint8ArrayToBase64Url(assertion.response.userHandle)
              : null
          }
        }
      };

      const verifyResponse = await fetch('/api/auth/passkeys/verify-authentication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verificationPayload)
      });

      const verifyData = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(verifyData.error || 'Passkey verification failed');
      }

      setAuthData(verifyData.token, verifyData.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setPasskeyLoading(false);
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
              disabled={loading || oidcLoading || passkeyLoading}
              startIcon={loading ? <CircularProgress size={20} /> : <LoginIcon />}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <Button
              fullWidth
              variant="outlined"
              size="large"
              onClick={handlePasskeyLogin}
              disabled={loading || oidcLoading || passkeyLoading}
              startIcon={passkeyLoading ? <CircularProgress size={20} /> : <VpnKey />}
              sx={{ mt: 2 }}
            >
              {passkeyLoading ? 'Waiting for passkey...' : 'Use Passkey'}
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
                  disabled={loading || oidcLoading || passkeyLoading}
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

      {/* MFA Verification Modal */}
      <MFAVerifyModal
        open={showMFAVerify}
        onClose={() => {
          setShowMFAVerify(false);
          setMfaError('');
        }}
        onVerify={handleMFAVerify}
        loading={mfaLoading}
        error={mfaError}
      />
    </Box>
  );
};

export default Login;
