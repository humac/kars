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
import OIDCSettingsNew from './OIDCSettingsNew';

const SecuritySettingsNew = () => {
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
    <div className="space-y-6">
      {/* Passkey/WebAuthn Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Passkey/WebAuthn Configuration</CardTitle>
          </div>
          <CardDescription>
            Configure biometric authentication (Touch ID, Face ID, Windows Hello) and hardware security keys (YubiKey)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3 bg-muted/50">
            <div>
              <p className="font-medium">Passkey sign-in</p>
              <p className="text-sm text-muted-foreground">Toggle to allow users to register and sign in with passkeys.</p>
            </div>
            <Switch
              checked={passkeySettings.enabled}
              onCheckedChange={(checked) => setPasskeySettings({ ...passkeySettings, enabled: checked })}
              disabled={passkeySettings.managed_by_env || loading}
            />
          </div>

          {!passkeySettings.enabled && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Passkey registration and sign-in are currently disabled. Users will not see passkey options on the login page while this is off.
              </AlertDescription>
            </Alert>
          )}

          {passkeySettings.managed_by_env && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Passkey settings are currently managed by environment variables. To use database configuration, remove PASSKEY_RP_ID, PASSKEY_RP_NAME, PASSKEY_ORIGIN, and PASSKEY_ENABLED from your environment variables and restart the backend.
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Restart required:</strong> Changes to passkey settings require a backend restart to take effect.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rp_id">Relying Party ID (RP ID) *</Label>
              <Input
                id="rp_id"
                value={passkeySettings.rp_id}
                onChange={(e) => setPasskeySettings({ ...passkeySettings, rp_id: e.target.value })}
                disabled={passkeySettings.managed_by_env || loading}
                placeholder="localhost"
              />
              <p className="text-xs text-muted-foreground">
                Domain name without protocol (e.g., 'localhost' or 'example.com'). MUST match the domain users access the app from.
              </p>
              <Alert className="mt-2">
                <AlertDescription className="text-xs space-y-1">
                  <p><strong>Local Development:</strong></p>
                  <p>• Set to: <code className="bg-muted px-1 py-0.5 rounded">localhost</code></p>
                  <p>• Access via: <code className="bg-muted px-1 py-0.5 rounded">http://localhost:5173</code></p>
                  <p>⚠️ DO NOT access via <code className="bg-muted px-1 py-0.5 rounded">127.0.0.1</code></p>
                </AlertDescription>
              </Alert>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rp_name">Relying Party Name (RP Name) *</Label>
              <Input
                id="rp_name"
                value={passkeySettings.rp_name}
                onChange={(e) => setPasskeySettings({ ...passkeySettings, rp_name: e.target.value })}
                disabled={passkeySettings.managed_by_env || loading}
                placeholder="KARS - KeyData Asset Registration System"
              />
              <p className="text-xs text-muted-foreground">
                Friendly name shown to users during passkey registration
              </p>
              <Alert className="mt-2">
                <AlertDescription className="text-xs space-y-1">
                  <p><strong>Production:</strong></p>
                  <p>• Set to: <code className="bg-muted px-1 py-0.5 rounded">yourdomain.com</code></p>
                  <p>• Access via: <code className="bg-muted px-1 py-0.5 rounded">https://yourdomain.com</code></p>
                  <p>• Can also use subdomain: <code className="bg-muted px-1 py-0.5 rounded">app.example.com</code></p>
                </AlertDescription>
              </Alert>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="origin">Expected Origin *</Label>
            <Input
              id="origin"
              value={passkeySettings.origin}
              onChange={(e) => setPasskeySettings({ ...passkeySettings, origin: e.target.value })}
              disabled={passkeySettings.managed_by_env || loading}
              placeholder="http://localhost:5173 or https://example.com"
            />
            <p className="text-xs text-muted-foreground">
              Full URL with protocol where your frontend is hosted
            </p>
          </div>

          <div className="flex items-center gap-3">
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
              href="https://github.com/humac/claude_app_poc/blob/main/PASSKEY-TROUBLESHOOTING.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <Info className="h-3 w-3" />
              Troubleshooting Guide
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {!passkeySettings.managed_by_env && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                After saving, you must restart the backend for changes to take effect.
              </AlertDescription>
            </Alert>
          )}

          {passkeySettings.updated_at && (
            <div className="pt-4 border-t text-xs text-muted-foreground">
              Last updated: {new Date(passkeySettings.updated_at).toLocaleString()}
              {passkeySettings.updated_by && ` by ${passkeySettings.updated_by}`}
            </div>
          )}
        </CardContent>
      </Card>

      {/* OIDC/SSO Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">OIDC/SSO Configuration</CardTitle>
          </div>
          <CardDescription>
            Configure Single Sign-On authentication providers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OIDCSettingsNew />
        </CardContent>
      </Card>
    </div>
  );
};

export default SecuritySettingsNew;
