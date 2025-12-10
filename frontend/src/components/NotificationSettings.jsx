import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Info, Send } from 'lucide-react';

const NotificationSettings = () => {
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    enabled: false,
    host: '',
    port: 587,
    use_tls: true,
    username: '',
    password: '',
    auth_method: 'plain',
    from_name: 'KARS Notifications',
    from_email: '',
    default_recipient: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [testing, setTesting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/notification-settings', {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setSettings({
          enabled: data.enabled === 1 || data.enabled === true,
          host: data.host || '',
          port: data.port || 587,
          use_tls: data.use_tls === 1 || data.use_tls === true,
          username: data.username || '',
          password: '', // Never return the actual password
          auth_method: data.auth_method || 'plain',
          from_name: data.from_name || 'KARS Notifications',
          from_email: data.from_email || '',
          default_recipient: data.default_recipient || ''
        });
        setHasPassword(data.has_password);
      }
    } catch (err) {
      toast({ title: "Error", description: 'Failed to load notification settings', variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (name, value) => {
    setSettings({
      ...settings,
      [name]: value
    });
    // Clear error for this field if it exists
    if (errors[name]) {
      setErrors({ ...errors, [name]: null });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (settings.enabled) {
      if (!settings.host) {
        newErrors.host = 'Host is required when notifications are enabled';
      }
      if (!settings.port) {
        newErrors.port = 'Port is required when notifications are enabled';
      }
      if (!settings.from_email) {
        newErrors.from_email = 'From email is required when notifications are enabled';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.from_email)) {
        newErrors.from_email = 'Please enter a valid email address';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({ 
        title: "Validation Error", 
        description: 'Please fix the errors in the form', 
        variant: "destructive" 
      });
      return;
    }

    setSaving(true);

    try {
      const payload = {
        enabled: settings.enabled,
        host: settings.host,
        port: parseInt(settings.port),
        use_tls: settings.use_tls,
        username: settings.username || null,
        auth_method: settings.auth_method,
        from_name: settings.from_name,
        from_email: settings.from_email,
        default_recipient: settings.default_recipient || null
      };

      // Only include password if it was changed
      if (settings.password && settings.password !== '[REDACTED]') {
        payload.password = settings.password;
      }

      const response = await fetch('/api/admin/notification-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      toast({ title: "Success", description: 'Notification settings saved successfully!' });
      setHasPassword(!!settings.password || hasPassword);
      // Clear the password field after saving
      setSettings(prev => ({ ...prev, password: '' }));
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!settings.enabled) {
      toast({ 
        title: "Error", 
        description: 'Please enable and save notification settings before sending a test email', 
        variant: "destructive" 
      });
      return;
    }

    setTestDialogOpen(true);
    setTestRecipient(settings.default_recipient || '');
  };

  const handleSendTest = async () => {
    if (!testRecipient) {
      toast({ title: "Error", description: 'Please enter a recipient email address', variant: "destructive" });
      return;
    }

    setTesting(true);
    try {
      const response = await fetch('/api/admin/notification-settings/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ recipient: testRecipient })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test email');
      }

      toast({ 
        title: "Success", 
        description: data.message || 'Test email sent successfully!'
      });
      setTestDialogOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2 bg-muted/50">
          <div>
            <p className="font-medium text-sm">Enable SMTP Email Notifications</p>
            <p className="text-xs text-muted-foreground">Configure SMTP settings for sending email notifications from KARS.</p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) => handleChange('enabled', checked)}
          />
        </div>

        <div className="space-y-3">
            {/* SMTP Server Settings */}
            <div className="space-y-3 rounded-lg border p-3">
              <h3 className="text-sm font-medium">SMTP Server</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="host" className="text-xs">Host *</Label>
                  <Input
                    id="host"
                    value={settings.host}
                    onChange={(e) => handleChange('host', e.target.value)}
                    placeholder="smtp.example.com"
                    disabled={saving}
                    className={errors.host ? 'border-destructive' : ''}
                  />
                  {errors.host && <p className="text-xs text-destructive">{errors.host}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="port" className="text-xs">Port *</Label>
                  <Input
                    id="port"
                    type="number"
                    value={settings.port}
                    onChange={(e) => handleChange('port', e.target.value)}
                    placeholder="587"
                    disabled={saving}
                    className={errors.port ? 'border-destructive' : ''}
                  />
                  {errors.port && <p className="text-xs text-destructive">{errors.port}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="use_tls"
                  checked={settings.use_tls}
                  onCheckedChange={(checked) => handleChange('use_tls', checked)}
                  disabled={saving}
                />
                <Label htmlFor="use_tls" className="text-xs cursor-pointer">Use TLS/SSL (recommended)</Label>
              </div>
            </div>

            {/* Authentication */}
            <div className="space-y-3 rounded-lg border p-3">
              <h3 className="text-sm font-medium">Authentication</h3>
              <div className="space-y-1">
                <Label htmlFor="auth_method" className="text-xs">Auth Method</Label>
                <Select value={settings.auth_method} onValueChange={(value) => handleChange('auth_method', value)}>
                  <SelectTrigger id="auth_method" disabled={saving}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="plain">Plain</SelectItem>
                    <SelectItem value="login">Login</SelectItem>
                    <SelectItem value="cram-md5">CRAM-MD5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {settings.auth_method !== 'none' && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="username" className="text-xs">Username</Label>
                    <Input
                      id="username"
                      value={settings.username}
                      onChange={(e) => handleChange('username', e.target.value)}
                      placeholder="user@example.com"
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="password" className="text-xs">
                      Password
                      {hasPassword && <span className="ml-1 text-muted-foreground">(leave blank to keep current)</span>}
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={settings.password}
                      onChange={(e) => handleChange('password', e.target.value)}
                      placeholder={hasPassword ? '••••••••' : 'Enter password'}
                      disabled={saving}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Email Settings */}
            <div className="space-y-3 rounded-lg border p-3">
              <h3 className="text-sm font-medium">Email Settings</h3>
              <div className="space-y-1">
                <Label htmlFor="from_name" className="text-xs">From Name</Label>
                <Input
                  id="from_name"
                  value={settings.from_name}
                  onChange={(e) => handleChange('from_name', e.target.value)}
                  placeholder="KARS Notifications"
                  disabled={saving}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="from_email" className="text-xs">From Email *</Label>
                <Input
                  id="from_email"
                  type="email"
                  value={settings.from_email}
                  onChange={(e) => handleChange('from_email', e.target.value)}
                  placeholder="noreply@example.com"
                  disabled={saving}
                  className={errors.from_email ? 'border-destructive' : ''}
                />
                {errors.from_email && <p className="text-xs text-destructive">{errors.from_email}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="default_recipient" className="text-xs">Default Test Recipient</Label>
                <Input
                  id="default_recipient"
                  type="email"
                  value={settings.default_recipient}
                  onChange={(e) => handleChange('default_recipient', e.target.value)}
                  placeholder="admin@example.com"
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">Used as the default recipient for test emails</p>
              </div>
            </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving} size="sm">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Settings
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestEmail}
              disabled={!settings.enabled || saving}
            >
              <Send className="h-4 w-4 mr-2" />
              Send Test Email
            </Button>
          </div>
        </div>
      </form>

      {/* Security Notice */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <strong>Security:</strong> SMTP passwords are encrypted at rest using AES-256-GCM encryption. 
          Ensure the <code>KARS_MASTER_KEY</code> environment variable is set and kept secure.
        </AlertDescription>
      </Alert>

      {/* Test Email Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Enter an email address to receive a test notification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="test_recipient">Recipient Email</Label>
            <Input
              id="test_recipient"
              type="email"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              placeholder="user@example.com"
              disabled={testing}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTestDialogOpen(false)}
              disabled={testing}
            >
              Cancel
            </Button>
            <Button onClick={handleSendTest} disabled={testing}>
              {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotificationSettings;
