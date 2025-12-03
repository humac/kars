import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert, Card, CardContent } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const OIDCCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuthData } = useAuth();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const oidcError = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (oidcError) {
          throw new Error(errorDescription || oidcError);
        }

        if (!code || !state) {
          throw new Error('Missing authorization code or state');
        }

        // Call backend to complete OIDC flow
        const response = await fetch(`/api/auth/oidc/callback?code=${code}&state=${state}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'OIDC authentication failed');
        }

        // Store auth data
        setAuthData(data.token, data.user);

        // Redirect to home
        setTimeout(() => navigate('/'), 500);
      } catch (err) {
        console.error('OIDC callback error:', err);
        setError(err.message);
        setProcessing(false);
      }
    };

    handleCallback();
  }, [searchParams, navigate, setAuthData]);

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
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          {processing ? (
            <>
              <CircularProgress size={60} sx={{ mb: 3 }} />
              <Typography variant="h6" gutterBottom>
                Completing sign in...
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Please wait while we verify your authentication
              </Typography>
            </>
          ) : (
            <>
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
              <Typography variant="body2" color="text.secondary">
                <a href="/login">Return to login</a>
              </Typography>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default OIDCCallback;
