import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Fingerprint, Key, Loader2, AlertTriangle, Info, ExternalLink } from 'lucide-react';
import OIDCSettings from './OIDCSettings';

const SecuritySettings = () => {
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const [passkeySettings, setPasskeySettings] = useState({
    rp_id: 'localhost',
    rp_name: 'KARS - KeyData Asset Registration System',
    origin: 'http://localhost:5173',
    enabled: true,
    managed_by_env: false
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPasskeySettings();
  }, []);

  const fetchPasskeySettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/passkey-settings', {
        headers: { ...getAuthHeaders() }
      });
      if (!response.ok) throw new Error('Failed to load passkey settings');
      setPasskeySettings(await response.json());
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeySave = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/passkey-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          rp_id: passkeySettings.rp_id,
          rp_name: passkeySettings.rp_name,
          origin: passkeySettings.origin,
          enabled: passkeySettings.enabled
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save passkey settings');
      toast({ title: "Success", description: data.message || 'Passkey settings saved successfully' });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Passkey/WebAuthn Configuration */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Passkey/WebAuthn Configuration</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Configure biometric authentication (Touch ID, Face ID, Windows Hello) and hardware security keys (YubiKey)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2 bg-muted/50">
            <div>
              <p className="font-medium text-sm">Passkey sign-in</p>
              <p className="text-xs text-muted-foreground">Toggle to allow users to register and sign in with passkeys.</p>
            </div>
            <Switch
              checked={passkeySettings.enabled}
              onCheckedChange={(checked) => setPasskeySettings({ ...passkeySettings, enabled: checked })}
              disabled={passkeySettings.managed_by_env || loading}
            />
          </div>

          {!passkeySettings.enabled && (
            <Alert variant="warning" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Passkey registration and sign-in are currently disabled. Users will not see passkey options on the login page while this is off.
              </AlertDescription>
            </Alert>
          )}

          {passkeySettings.managed_by_env && (
            <Alert variant="warning" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Passkey settings are currently managed by environment variables. To use database configuration, remove PASSKEY_RP_ID, PASSKEY_RP_NAME, PASSKEY_ORIGIN, and PASSKEY_ENABLED from your environment variables and restart the backend.
              </AlertDescription>
            </Alert>
          )}

          <Alert className="py-2">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Restart required:</strong> Changes to passkey settings require a backend restart to take effect.
            </AlertDescription>
          </Alert>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rp_id" className="text-sm">Relying Party ID (RP ID) *</Label>
              <Input
                id="rp_id"
                value={passkeySettings.rp_id}
                onChange={(e) => setPasskeySettings({ ...passkeySettings, rp_id: e.target.value })}
                disabled={passkeySettings.managed_by_env || loading}
                placeholder="localhost"
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">
                Domain name without protocol (e.g., 'localhost' or 'example.com'). MUST match the domain users access the app from.
              </p>
              <Alert className="mt-1 py-2">
                <AlertDescription className="text-xs space-y-0.5">
                  <p><strong>Local Development:</strong></p>
                  <p>• Set to: <code className="bg-muted px-1 py-0.5 rounded text-xs">localhost</code></p>
                  <p>• Access via: <code className="bg-muted px-1 py-0.5 rounded text-xs">http://localhost:5173</code></p>
                  <p>⚠️ DO NOT access via <code className="bg-muted px-1 py-0.5 rounded text-xs">127.0.0.1</code></p>
                </AlertDescription>
              </Alert>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rp_name" className="text-sm">Relying Party Name (RP Name) *</Label>
              <Input
                id="rp_name"
                value={passkeySettings.rp_name}
                onChange={(e) => setPasskeySettings({ ...passkeySettings, rp_name: e.target.value })}
                disabled={passkeySettings.managed_by_env || loading}
                placeholder="KARS - KeyData Asset Registration System"
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">
                Friendly name shown to users during passkey registration
              </p>
              <Alert className="mt-1 py-2">
                <AlertDescription className="text-xs space-y-0.5">
                  <p><strong>Production:</strong></p>
                  <p>• Set to: <code className="bg-muted px-1 py-0.5 rounded text-xs">yourdomain.com</code></p>
                  <p>• Access via: <code className="bg-muted px-1 py-0.5 rounded text-xs">https://yourdomain.com</code></p>
                  <p>• Can also use subdomain: <code className="bg-muted px-1 py-0.5 rounded text-xs">app.example.com</code></p>
                </AlertDescription>
              </Alert>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="origin" className="text-sm">Expected Origin *</Label>
            <Input
              id="origin"
              value={passkeySettings.origin}
              onChange={(e) => setPasskeySettings({ ...passkeySettings, origin: e.target.value })}
              disabled={passkeySettings.managed_by_env || loading}
              placeholder="http://localhost:5173 or https://example.com"
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">
              Full URL with protocol where your frontend is hosted
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePasskeySave}
              disabled={passkeySettings.managed_by_env || loading}
              size="sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Fingerprint className="h-4 w-4 mr-2" />
                  Save Passkey Settings
                </>
              )}
            </Button>

            <a
              href="https://github.com/humac/kars/blob/main/PASSKEY-TROUBLESHOOTING.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Info className="h-3 w-3" />
              Troubleshooting Guide
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {!passkeySettings.managed_by_env && (
            <Alert variant="warning" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                After saving, you must restart the backend for changes to take effect.
              </AlertDescription>
            </Alert>
          )}

          {passkeySettings.updated_at && (
            <div className="pt-2 border-t text-xs text-muted-foreground">
              Last updated: {new Date(passkeySettings.updated_at).toLocaleString()}
              {passkeySettings.updated_by && ` by ${passkeySettings.updated_by}`}
            </div>
          )}
        </CardContent>
      </Card>

      {/* OIDC/SSO Configuration */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">OIDC/SSO Configuration</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Configure Single Sign-On authentication providers
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <OIDCSettings />
        </CardContent>
      </Card>
    </div>
  );
};

export default SecuritySettings;
