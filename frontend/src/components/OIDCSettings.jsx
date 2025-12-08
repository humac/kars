import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';

const OIDCSettings = () => {
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    enabled: false,
    issuer_url: '',
    client_id: '',
    client_secret: '',
    redirect_uri: '',
    scope: 'openid email profile',
    role_claim_path: 'roles',
    default_role: 'employee',
    sso_button_text: 'Sign In with SSO',
    sso_button_help_text: '',
    sso_button_variant: 'outline',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
          sso_button_text: data.sso_button_text || 'Sign In with SSO',
          sso_button_help_text: data.sso_button_help_text || '',
          sso_button_variant: data.sso_button_variant || 'outline',
        });
        setHasClientSecret(data.has_client_secret);
      }
    } catch (err) {
      toast({ title: "Error", description: 'Failed to load OIDC settings', variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (name, value) => {
    setSettings({
      ...settings,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

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

      toast({ title: "Success", description: 'OIDC settings saved successfully!' });
      setHasClientSecret(!!settings.client_secret || hasClientSecret);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Enable Toggle */}
      <div className="flex items-center justify-between space-x-4">
        <div className="flex-1">
          <Label htmlFor="oidc-enabled" className="text-sm font-semibold">
            Enable OIDC/SSO Authentication
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Allow users to sign in with an external identity provider
          </p>
        </div>
        <Switch
          id="oidc-enabled"
          checked={settings.enabled}
          onCheckedChange={(checked) => handleChange('enabled', checked)}
        />
      </div>

      <Separator />

      {/* Provider Configuration */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Provider Configuration</h3>

        <div className="space-y-1.5">
          <Label htmlFor="issuer_url" className="text-sm">Issuer URL {settings.enabled && <span className="text-destructive">*</span>}</Label>
          <Input
            id="issuer_url"
            name="issuer_url"
            value={settings.issuer_url}
            onChange={(e) => handleChange('issuer_url', e.target.value)}
            required={settings.enabled}
            disabled={!settings.enabled}
            placeholder="https://your-domain.auth0.com"
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">
            The OIDC issuer URL from your identity provider
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="client_id" className="text-sm">Client ID {settings.enabled && <span className="text-destructive">*</span>}</Label>
          <Input
            id="client_id"
            name="client_id"
            value={settings.client_id}
            onChange={(e) => handleChange('client_id', e.target.value)}
            required={settings.enabled}
            disabled={!settings.enabled}
            placeholder="your-client-id"
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="client_secret" className="text-sm">
            Client Secret {settings.enabled && !hasClientSecret && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id="client_secret"
            name="client_secret"
            type="password"
            value={settings.client_secret}
            onChange={(e) => handleChange('client_secret', e.target.value)}
            required={settings.enabled && !hasClientSecret}
            disabled={!settings.enabled}
            placeholder={hasClientSecret ? "••••••••••••" : "your-client-secret"}
            className="h-9"
          />
          {hasClientSecret && (
            <p className="text-xs text-muted-foreground">
              Leave blank to keep existing secret
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="redirect_uri" className="text-sm">Redirect URI {settings.enabled && <span className="text-destructive">*</span>}</Label>
          <Input
            id="redirect_uri"
            name="redirect_uri"
            value={settings.redirect_uri}
            onChange={(e) => handleChange('redirect_uri', e.target.value)}
            required={settings.enabled}
            disabled={!settings.enabled}
            placeholder={window.location.origin + "/auth/callback"}
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">
            Configure this URL in your OIDC provider's allowed callback URLs
          </p>
        </div>
      </div>

      <Separator />

      {/* Advanced Settings */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Advanced Settings</h3>

        <div className="space-y-1.5">
          <Label htmlFor="scope" className="text-sm">Scopes</Label>
          <Input
            id="scope"
            name="scope"
            value={settings.scope}
            onChange={(e) => handleChange('scope', e.target.value)}
            disabled={!settings.enabled}
            placeholder="openid email profile"
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">
            Space-separated list of OAuth scopes
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="role_claim_path" className="text-sm">Role Claim Path</Label>
          <Input
            id="role_claim_path"
            name="role_claim_path"
            value={settings.role_claim_path}
            onChange={(e) => handleChange('role_claim_path', e.target.value)}
            disabled={!settings.enabled}
            placeholder="roles"
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">
            Path to the roles claim in the OIDC token (e.g., 'roles', 'groups', 'https://myapp.com/roles')
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="default_role" className="text-sm">Default Role</Label>
          <Select
            value={settings.default_role}
            onValueChange={(value) => handleChange('default_role', value)}
            disabled={!settings.enabled}
          >
            <SelectTrigger id="default_role" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Default role for new users if no role mapping matches
          </p>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Sign in button customization</h3>

        <div className="space-y-1.5">
          <Label htmlFor="sso_button_text" className="text-sm">Button label</Label>
          <Input
            id="sso_button_text"
            name="sso_button_text"
            value={settings.sso_button_text}
            onChange={(e) => handleChange('sso_button_text', e.target.value)}
            disabled={!settings.enabled}
            placeholder="Sign In with SSO"
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">Set the text users see on the sign-in button.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sso_button_help_text" className="text-sm">Helper text (optional)</Label>
          <Textarea
            id="sso_button_help_text"
            name="sso_button_help_text"
            value={settings.sso_button_help_text}
            onChange={(e) => handleChange('sso_button_help_text', e.target.value)}
            disabled={!settings.enabled}
            placeholder="Use your company identity provider."
            className="min-h-[60px]"
          />
          <p className="text-xs text-muted-foreground">Appears below the button on the sign-in page.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sso_button_variant" className="text-sm">Button style</Label>
          <Select
            value={settings.sso_button_variant}
            onValueChange={(value) => handleChange('sso_button_variant', value)}
            disabled={!settings.enabled}
          >
            <SelectTrigger id="sso_button_variant" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Primary</SelectItem>
              <SelectItem value="secondary">Muted</SelectItem>
              <SelectItem value="outline">Outline</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Match your branding by selecting a button variant.</p>
        </div>
      </div>

      <Button
        type="submit"
        disabled={saving}
        size="sm"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Save OIDC Settings
          </>
        )}
      </Button>
    </form>
  );
};

export default OIDCSettings;
