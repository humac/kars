import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertTriangle, Server } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const SystemSettings = () => {
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/system-settings', {
        headers: { ...getAuthHeaders() }
      });
      if (!response.ok) throw new Error('Failed to load system settings');
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        proxy: {
          enabled: settings.proxy.enabled.value,
          type: settings.proxy.type.value,
          trustLevel: settings.proxy.trustLevel.value
        },
        rateLimiting: {
          enabled: settings.rateLimiting.enabled.value,
          windowMs: settings.rateLimiting.windowMs.value,
          maxRequests: settings.rateLimiting.maxRequests.value
        }
      };

      const response = await fetch('/api/admin/system-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to save system settings');
      const data = await response.json();
      setSettings(data);

      toast({
        title: "Success",
        description: "System settings saved successfully"
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (category, field, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: {
          ...prev[category][field],
          value,
          source: 'database' // Mark as database override when changed
        }
      }
    }));
  };

  const getSourceBadge = (source) => {
    if (source === 'database') {
      return <Badge variant="warning" className="ml-2">Database Override</Badge>;
    }
    return <Badge variant="secondary" className="ml-2">Environment</Badge>;
  };

  const getEnvLabel = (envVar, envValue) => {
    if (envValue !== undefined && envValue !== null && envValue !== '') {
      return <span className="text-xs text-muted-foreground ml-2">({envVar}={envValue})</span>;
    }
    return <span className="text-xs text-muted-foreground ml-2">({envVar})</span>;
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Warning Banner */}
      <Card className="border-yellow-400 bg-yellow-50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <CardTitle className="text-sm text-yellow-800">Important</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-yellow-800">
            Changes to proxy settings require a backend restart to take effect. Rate limiting changes are applied immediately.
          </p>
        </CardContent>
      </Card>

      {/* Proxy Configuration */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Proxy Configuration</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Configure reverse proxy settings for Cloudflare, nginx, or other proxies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          {/* Trust Proxy Toggle */}
          <div className="flex items-center justify-between space-x-2">
            <div className="flex-1">
              <Label className="text-sm font-semibold flex items-center">
                Trust Proxy
                {getSourceBadge(settings.proxy.enabled.source)}
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Enable when behind a reverse proxy (Cloudflare, nginx, etc.)
                {getEnvLabel(settings.proxy.enabled.envVar, settings.proxy.enabled.envValue)}
              </p>
            </div>
            <Switch
              checked={settings.proxy.enabled.value}
              onCheckedChange={(checked) => updateSetting('proxy', 'enabled', checked)}
            />
          </div>

          {/* Proxy Type */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center">
              Proxy Type
              {getSourceBadge(settings.proxy.type.source)}
            </Label>
            <Select
              value={settings.proxy.type.value}
              onValueChange={(value) => updateSetting('proxy', 'type', value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cloudflare">Cloudflare (CF-Connecting-IP)</SelectItem>
                <SelectItem value="standard">Standard (X-Forwarded-For)</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Determines how client IP addresses are extracted
              {getEnvLabel(settings.proxy.type.envVar, settings.proxy.type.envValue)}
            </p>
          </div>

          {/* Trust Level */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center">
              Trust Level
              {getSourceBadge(settings.proxy.trustLevel.source)}
            </Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={settings.proxy.trustLevel.value}
              onChange={(e) => updateSetting('proxy', 'trustLevel', parseInt(e.target.value, 10))}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Number of proxy hops to trust (1 for most setups)
              {getEnvLabel(settings.proxy.trustLevel.envVar, settings.proxy.trustLevel.envValue)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limiting Configuration */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rate Limiting</CardTitle>
          <CardDescription className="text-sm">
            Protect against abuse and DDoS attacks with request rate limiting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          {/* Rate Limiting Enabled Toggle */}
          <div className="flex items-center justify-between space-x-2">
            <div className="flex-1">
              <Label className="text-sm font-semibold flex items-center">
                Enable Rate Limiting
                {getSourceBadge(settings.rateLimiting.enabled.source)}
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Enable global rate limiting for API requests
                {getEnvLabel(settings.rateLimiting.enabled.envVar, settings.rateLimiting.enabled.envValue)}
              </p>
            </div>
            <Switch
              checked={settings.rateLimiting.enabled.value}
              onCheckedChange={(checked) => updateSetting('rateLimiting', 'enabled', checked)}
            />
          </div>

          {/* Window Duration */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center">
              Time Window (minutes)
              {getSourceBadge(settings.rateLimiting.windowMs.source)}
            </Label>
            <Input
              type="number"
              min="1"
              max="1440"
              value={Math.round(settings.rateLimiting.windowMs.value / 60000)}
              onChange={(e) => updateSetting('rateLimiting', 'windowMs', parseInt(e.target.value, 10) * 60000)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Time window for rate limiting (default: 15 minutes)
              {getEnvLabel(settings.rateLimiting.windowMs.envVar, settings.rateLimiting.windowMs.envValue)}
            </p>
          </div>

          {/* Max Requests */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center">
              Maximum Requests
              {getSourceBadge(settings.rateLimiting.maxRequests.source)}
            </Label>
            <Input
              type="number"
              min="1"
              max="10000"
              value={settings.rateLimiting.maxRequests.value}
              onChange={(e) => updateSetting('rateLimiting', 'maxRequests', parseInt(e.target.value, 10))}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Maximum requests allowed per time window (default: 100)
              {getEnvLabel(settings.rateLimiting.maxRequests.envVar, settings.rateLimiting.maxRequests.envValue)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save System Settings
        </Button>
      </div>
    </div>
  );
};

export default SystemSettings;
