import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const OIDCCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuthData } = useAuth();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(true);
  const processedRef = useRef(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme && storedTheme !== theme) {
      setTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (processedRef.current) {
      return;
    }
    processedRef.current = true;

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

        const response = await fetch(`/api/auth/oidc/callback?code=${code}&state=${state}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'OIDC authentication failed');
        }

        setAuthData(data.token, data.user);

        // Check for stored invite token and redirect appropriately
        const storedInviteToken = sessionStorage.getItem('attestation_invite_token');
        if (storedInviteToken) {
          sessionStorage.removeItem('attestation_invite_token');
          // Redirect to attestations page since invite was converted during registration
          setTimeout(() => navigate('/my-attestations'), 500);
        } else {
          // Always navigate to home - App.jsx will redirect to CompleteProfile if needed
          setTimeout(() => navigate('/'), 500);
        }
      } catch (err) {
        console.error('OIDC callback error:', err);
        setError(err.message);
        setProcessing(false);
      }
    };

    handleCallback();
  }, [searchParams, navigate, setAuthData]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              {processing ? <Loader2 className="h-6 w-6 animate-spin" /> : <ShieldCheck className="h-6 w-6" />}
            </div>
            <CardTitle>Completing sign in...</CardTitle>
            <CardDescription>Hang tight while we verify your authentication details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            {processing ? (
              <div className="space-y-3 text-muted-foreground">
                <p className="text-sm">This will only take a moment.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">{error}</span>
                </div>
                <Button variant="outline" onClick={() => navigate('/login')}>
                  Return to login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OIDCCallback;
