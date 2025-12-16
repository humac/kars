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
import { LogIn, Key, KeyRound, Loader2, AlertCircle, Laptop, Moon, Sun, UserCircle } from 'lucide-react';
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
  const [passkeysEnabled, setPasskeysEnabled] = useState(true);
  const [ssoButtonConfig, setSsoButtonConfig] = useState({
    text: 'Sign In with SSO',
    helpText: '',
    variant: 'outline'
  });
  const [brandingLogo, setBrandingLogo] = useState(null);
  const [siteName, setSiteName] = useState('KARS');
  const [subTitle, setSubTitle] = useState('KeyData Asset Registration System');

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
      .then(data => {
        setOidcEnabled(data.enabled);
        setSsoButtonConfig({
          text: data.button_text || 'Sign In with SSO',
          helpText: data.button_help_text || '',
          variant: ['default', 'secondary', 'outline', 'ghost'].includes(data.button_variant)
            ? data.button_variant
            : 'outline'
        });
      })
      .catch(err => console.error('Failed to check OIDC config:', err));

    fetch('/api/auth/passkeys/config')
      .then(res => res.json())
      .then(data => setPasskeysEnabled(data.enabled !== false))
      .catch(err => console.error('Failed to check passkey config:', err));

    // Fetch branding settings
    fetch('/api/branding')
      .then(res => res.json())
      .then(data => {
        if (data.logo_data) {
          setBrandingLogo(data.logo_data);
        }
        if (data.site_name) {
          setSiteName(data.site_name);
          document.title = data.site_name;
        }
        if (data.sub_title) {
          setSubTitle(data.sub_title);
        }
        if (data.primary_color) {
          // Apply primary color
          const hex = data.primary_color.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16) / 255;
          const g = parseInt(hex.substring(2, 4), 16) / 255;
          const b = parseInt(hex.substring(4, 6), 16) / 255;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          let h = 0, s = 0, l = (max + min) / 2;
          
          if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
              case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
              case g: h = ((b - r) / d + 2) / 6; break;
              case b: h = ((r - g) / d + 4) / 6; break;
            }
          }
          
          document.documentElement.style.setProperty('--primary', `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`);
        }
        if (data.favicon_data) {
          let link = document.querySelector("link[rel~='icon']");
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = data.favicon_data;
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

    setPasskeyLoading(true);
    setError(null);

    try {
      const optionsPayload = formData.email ? { email: formData.email } : {};
      const optionsResponse = await fetch('/api/auth/passkeys/auth-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(optionsPayload)
      });

      const optionsData = await optionsResponse.json();
      if (!optionsResponse.ok) {
        throw new Error(optionsData.error || 'Unable to start passkey sign in');
      }

      const publicKeyOptions = prepareRequestOptions(optionsData.options);
      const credentialRequestOptions = { publicKey: publicKeyOptions };

      if (window.PublicKeyCredential.isConditionalMediationAvailable) {
        const conditionalAvailable = await window.PublicKeyCredential.isConditionalMediationAvailable();
        if (conditionalAvailable) {
          credentialRequestOptions.mediation = 'conditional';
        }
      }

      const assertion = await navigator.credentials.get(credentialRequestOptions);

      if (!assertion) {
        throw new Error('No credential was provided by the authenticator');
      }

      const verificationPayload = {
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

      if (formData.email) {
        verificationPayload.email = formData.email;
      }

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
      if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
        setError(err.message);
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const isLoading = loading || oidcLoading || passkeyLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4 relative overflow-hidden bg-dot-pattern">
      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Dark Mode Toggle */}
        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full shadow-sm hover:shadow-md"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </div>
        
        {/* Logo/Brand */}
        <div className="text-center mb-8 animate-slide-up">
          {brandingLogo ? (
            <div className="mb-4">
              <img
                src={brandingLogo}
                alt="Company Logo"
                className="max-w-full h-auto max-h-32 object-contain mx-auto drop-shadow-lg"
              />
            </div>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-primary mb-4 shadow-lg hover:scale-105 transition-transform">
                <Laptop className="h-10 w-10 text-primary-foreground" />
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-2">{siteName}</h1>
              <p className="text-muted-foreground">{subTitle}</p>
            </>
          )}
        </div>

        <Card className="shadow-xl backdrop-blur-sm bg-card/95 border-border/50 animate-scale-in">
          <CardHeader className="space-y-2 pb-4">
            <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
              <UserCircle className="h-6 w-6" />
              {siteName}
            </CardTitle>
            <CardDescription className="text-center text-base">
              {subTitle}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20 animate-slide-up">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                  className="transition-all"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <a
                    href="/forgot-password"
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="transition-all"
                />
              </div>

              <Button type="submit" className="w-full mt-2" disabled={isLoading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            {passkeysEnabled ? (
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
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-md border text-sm text-muted-foreground bg-muted/50">
                <Key className="h-4 w-4" />
                <span>Passkey sign-in is disabled by your administrator.</span>
              </div>
            )}

            {oidcEnabled && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs font-medium uppercase">
                    <span className="bg-card px-3 text-muted-foreground">or continue with</span>
                  </div>
                </div>

                <Button
                  variant={ssoButtonConfig.variant}
                  className="w-full"
                  onClick={handleOIDCLogin}
                  disabled={isLoading}
                >
                  {oidcLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Redirecting...
                    </>
                    ) : (
                      <>
                        <KeyRound className="h-4 w-4" />
                        {ssoButtonConfig.text}
                      </>
                    )}
                </Button>
                {ssoButtonConfig.helpText && (
                  <p className="text-xs text-muted-foreground text-center mt-2">{ssoButtonConfig.helpText}</p>
                )}
              </>
            )}

            <div className="pt-4 border-t">
              <p className="text-center text-sm text-muted-foreground">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={onSwitchToRegister}
                  className="font-semibold text-gradient hover:opacity-80 transition-opacity"
                >
                  Register here
                </button>
              </p>
            </div>
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
