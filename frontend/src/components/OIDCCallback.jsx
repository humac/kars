import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';

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

        const response = await fetch(`/api/auth/oidc/callback?code=${code}&state=${state}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'OIDC authentication failed');
        }

        setAuthData(data.token, data.user);
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-xl rounded-2xl border bg-white p-8 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Sign in</p>
            <h1 className="text-xl font-semibold text-slate-900">Completing authentication</h1>
          </div>
        </div>

        <div className="mt-6 rounded-xl border bg-slate-50 px-4 py-5">
          {processing ? (
            <div className="flex items-center gap-3 text-sm text-slate-700">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Verifying your sign-in with the provider...
            </div>
          ) : (
            <div className="space-y-4 text-sm text-slate-700">
              <p className="font-semibold text-rose-600">{error}</p>
              <p className="text-muted-foreground">Please return to the sign-in page and try again.</p>
              <Button onClick={() => navigate('/')}>Back to sign in</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OIDCCallback;
