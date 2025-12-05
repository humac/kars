import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LogIn, Key, Loader2, AlertCircle, Laptop, Moon, Sun } from 'lucide-react';
import { prepareRequestOptions, uint8ArrayToBase64Url } from '@/utils/webauthn';

const LoginNew = ({ onSwitchToRegister }) => {
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
  const [brandingLogo, setBrandingLogo] = useState(null);

  // Dark mode state - default to light mode
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  // MFA state
  const [showMFAVerify, setShowMFAVerify] = useState(false);
  const [mfaSessionId, setMfaSessionId] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);

  useEffect(() => {
    // Apply theme
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    // Check if OIDC is enabled
    fetch('/api/auth/oidc/config')
      .then(res => res.json())
      .then(data => setOidcEnabled(data.enabled))
      .catch(err => console.error('Failed to check OIDC config:', err));

    // Fetch branding settings
    fetch('/api/branding')
      .then(res => res.json())
      .then(data => {
        if (data.logo_data) {
          setBrandingLogo(data.logo_data);
        }
      })
      .catch(err => console.error('Failed to fetch branding:', err));
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.mfaRequired) {
        setMfaSessionId(data.mfaSessionId);
        setShowMFAVerify(true);
        setLoading(false);
        return;
      }

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

  const handleMFAVerify = async (e) => {
    e.preventDefault();
    setMfaLoading(true);
    setMfaError('');

    try {
      const response = await fetch('/api/auth/mfa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mfaSessionId,
          token: mfaCode,
          useBackupCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
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

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const isLoading = loading || oidcLoading || passkeyLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="w-full max-w-md">
        {/* Dark Mode Toggle */}
        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </div>
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          {brandingLogo ? (
            <div className="mb-4">
              <img
                src={brandingLogo}
                alt="Company Logo"
                className="max-w-full h-auto max-h-32 object-contain mx-auto"
              />
            </div>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary mb-4">
                <Laptop className="h-8 w-8 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">KARS</h1>
              <p className="text-muted-foreground">KeyData Asset Registration System</p>
            </>
          )}
        </div>

        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Welcome back</CardTitle>
            <CardDescription className="text-center">
              Sign in to manage company assets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            <Button
              variant="outline"
              className="w-full"
              onClick={handlePasskeyLogin}
              disabled={isLoading}
            >
              {passkeyLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Waiting for passkey...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Use Passkey
                </>
              )}
            </Button>

            {oidcEnabled && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleOIDCLogin}
                  disabled={isLoading}
                >
                  {oidcLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    <>
                      <Key className="h-4 w-4 mr-2" />
                      Sign In with SSO
                    </>
                  )}
                </Button>
              </>
            )}

            <Separator />

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="font-semibold text-primary hover:underline"
              >
                Register here
              </button>
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          SOC2 Compliance - Track and manage company assets
        </p>
      </div>

      {/* MFA Verification Modal */}
      <Dialog open={showMFAVerify} onOpenChange={(open) => {
        setShowMFAVerify(open);
        if (!open) {
          setMfaError('');
          setMfaCode('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter the verification code from your authenticator app.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMFAVerify} className="space-y-4">
            {mfaError && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{mfaError}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="mfa_code">
                {useBackupCode ? 'Backup Code' : 'Verification Code'}
              </Label>
              <Input
                id="mfa_code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder={useBackupCode ? 'Enter backup code' : 'Enter 6-digit code'}
                autoFocus
                required
              />
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={useBackupCode}
                  onChange={(e) => setUseBackupCode(e.target.checked)}
                  className="rounded border-input"
                />
                Use backup code instead
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowMFAVerify(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mfaLoading}>
                {mfaLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Verify
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginNew;
