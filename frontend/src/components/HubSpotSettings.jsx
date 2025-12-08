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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle, Info, CheckCircle2, XCircle, RefreshCw, ExternalLink } from 'lucide-react';

const HubSpotSettings = () => {
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    enabled: false,
    access_token: '',
    auto_sync_enabled: false,
    sync_interval: 'daily',
    last_sync: null,
    last_sync_status: null,
    companies_synced: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncHistory, setSyncHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchSyncHistory();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/hubspot-settings', {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setSettings({
          enabled: data.enabled === 1 || data.enabled === true,
          access_token: '',
          auto_sync_enabled: data.auto_sync_enabled === 1 || data.auto_sync_enabled === true,
          sync_interval: data.sync_interval || 'daily',
          last_sync: data.last_sync,
          last_sync_status: data.last_sync_status,
          companies_synced: data.companies_synced || 0
        });
        setHasAccessToken(data.has_access_token);
      }
    } catch (err) {
      toast({ title: "Error", description: 'Failed to load HubSpot settings', variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch('/api/admin/hubspot/sync-history', {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setSyncHistory(data);
      }
    } catch (err) {
      console.error('Failed to load sync history:', err);
    } finally {
      setLoadingHistory(false);
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
      const response = await fetch('/api/admin/hubspot-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          enabled: settings.enabled,
          access_token: settings.access_token || undefined,
          auto_sync_enabled: settings.auto_sync_enabled,
          sync_interval: settings.sync_interval
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      toast({ title: "Success", description: 'HubSpot settings saved successfully!' });
      setHasAccessToken(!!settings.access_token || hasAccessToken);
      // Clear the access token field after saving
      setSettings(prev => ({ ...prev, access_token: '' }));
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const response = await fetch('/api/admin/hubspot/test-connection', {
        method: 'POST',
        headers: getAuthHeaders()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Connection test failed');
      }

      toast({ 
        title: "Success", 
        description: data.message || 'Successfully connected to HubSpot!'
      });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/admin/hubspot/sync-companies', {
        method: 'POST',
        headers: getAuthHeaders()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      toast({ 
        title: "Success", 
        description: `Synced ${data.companiesFound} companies: ${data.companiesCreated} created, ${data.companiesUpdated} updated`
      });

      // Refresh settings and history
      await fetchSettings();
      await fetchSyncHistory();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getSyncStatusBadge = (status) => {
    if (status === 'success') {
      return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" />Success</Badge>;
    } else if (status === 'error') {
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Error</Badge>;
    }
    return <Badge variant="secondary">{status || 'Unknown'}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between space-x-4 rounded-lg border px-3 py-2 bg-muted/50">
          <div className="flex-1">
            <Label htmlFor="hubspot-enabled" className="text-sm font-semibold">
              Enable HubSpot Integration
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automatically sync companies from HubSpot CRM
            </p>
          </div>
          <Switch
            id="hubspot-enabled"
            checked={settings.enabled}
            onCheckedChange={(checked) => handleChange('enabled', checked)}
          />
        </div>

        {/* Configuration Section */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">HubSpot Configuration</CardTitle>
            <CardDescription className="text-sm">
              Configure your HubSpot Private App access token
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="access_token" className="text-sm">
                Access Token {settings.enabled && !hasAccessToken && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="access_token"
                name="access_token"
                type="password"
                value={settings.access_token}
                onChange={(e) => handleChange('access_token', e.target.value)}
                required={settings.enabled && !hasAccessToken}
                disabled={!settings.enabled}
                placeholder={hasAccessToken ? "••••••••••••" : "pat-na1-..."}
                className="h-9 font-mono text-sm"
              />
              {hasAccessToken && (
                <p className="text-xs text-muted-foreground">
                  Leave blank to keep existing token
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Create a Private App in HubSpot with <code className="bg-muted px-1 py-0.5 rounded">crm.objects.companies.read</code> scope
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={!hasAccessToken || testing || !settings.enabled}
              >
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>Test Connection</>
                )}
              </Button>
              <a
                href="https://developers.hubspot.com/docs/api/private-apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Info className="h-3 w-3" />
                HubSpot Private Apps Guide
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Auto-Sync Configuration */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Automatic Sync</CardTitle>
            <CardDescription className="text-sm">
              Schedule automatic company synchronization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <div className="flex items-center justify-between space-x-4 rounded-lg border px-3 py-2 bg-muted/50">
              <div>
                <p className="font-medium text-sm">Enable auto-sync</p>
                <p className="text-xs text-muted-foreground">Automatically sync on schedule</p>
              </div>
              <Switch
                checked={settings.auto_sync_enabled}
                onCheckedChange={(checked) => handleChange('auto_sync_enabled', checked)}
                disabled={!settings.enabled}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sync_interval" className="text-sm">Sync Interval</Label>
              <Select
                value={settings.sync_interval}
                onValueChange={(value) => handleChange('sync_interval', value)}
                disabled={!settings.enabled || !settings.auto_sync_enabled}
              >
                <SelectTrigger id="sync_interval" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How often to automatically sync companies from HubSpot
              </p>
            </div>

            {!settings.auto_sync_enabled && (
              <Alert className="py-2">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Note: Automatic sync is currently disabled. Use the "Sync Now" button to sync manually.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
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
            <>Save Settings</>
          )}
        </Button>
      </form>

      {/* Sync Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sync Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Last Sync</p>
              <p className="text-sm font-medium">{formatDate(settings.last_sync)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Status</p>
              <div>{getSyncStatusBadge(settings.last_sync_status)}</div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Companies Synced</p>
              <p className="text-sm font-medium">{settings.companies_synced}</p>
            </div>
          </div>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleSyncNow}
            disabled={!hasAccessToken || syncing || !settings.enabled}
          >
            {syncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Companies Now
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Sync History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sync History</CardTitle>
          <CardDescription className="text-sm">
            Recent synchronization results
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : syncHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No sync history available
            </p>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Started</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Found</TableHead>
                    <TableHead className="text-xs text-right">Created</TableHead>
                    <TableHead className="text-xs text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncHistory.map((sync) => (
                    <TableRow key={sync.id}>
                      <TableCell className="text-xs">{formatDate(sync.sync_started_at)}</TableCell>
                      <TableCell className="text-xs">{getSyncStatusBadge(sync.status)}</TableCell>
                      <TableCell className="text-xs text-right">{sync.companies_found || 0}</TableCell>
                      <TableCell className="text-xs text-right">{sync.companies_created || 0}</TableCell>
                      <TableCell className="text-xs text-right">{sync.companies_updated || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HubSpotSettings;
