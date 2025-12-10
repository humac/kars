import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import TablePaginationControls from '@/components/TablePaginationControls';
import { cn } from '@/lib/utils';
import { Settings, Database, Trash2, Loader2, AlertTriangle, Shield, Image, Plug, Bell } from 'lucide-react';
import OIDCSettings from './OIDCSettings';
import SecuritySettings from './SecuritySettings';
import HubSpotSettings from './HubSpotSettings';
import NotificationSettings from './NotificationSettings';

const AdminSettingsNew = () => {
  const { getAuthHeaders, user } = useAuth();
  const { toast } = useToast();
  const [activeView, setActiveView] = useState('branding');
  const [dbSettings, setDbSettings] = useState({ engine: 'sqlite', postgresUrl: '', managedByEnv: false, effectiveEngine: 'sqlite' });
  const [dbLoading, setDbLoading] = useState(false);
  const [brandingSettings, setBrandingSettings] = useState({ logo_data: null, logo_filename: null });
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFilename, setLogoFilename] = useState('');

  useEffect(() => {
    if (activeView === 'settings') fetchDatabaseSettings();
    if (activeView === 'branding') fetchBrandingSettings();
  }, [activeView]);

  const fetchDatabaseSettings = async () => {
    setDbLoading(true);
    try {
      const response = await fetch('/api/admin/database', { headers: { ...getAuthHeaders() } });
      if (!response.ok) throw new Error('Failed to load database settings');
      setDbSettings(await response.json());
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setDbLoading(false); }
  };

  const handleDatabaseSave = async () => {
    setDbLoading(true);
    try {
      const response = await fetch('/api/admin/database', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ engine: dbSettings.engine, postgresUrl: dbSettings.postgresUrl })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save');
      setDbSettings(data);
      toast({ title: "Success", description: "Database settings saved. Restart backend to apply.", variant: "success" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setDbLoading(false); }
  };

  const fetchBrandingSettings = async () => {
    setBrandingLoading(true);
    try {
      const response = await fetch('/api/branding');
      if (!response.ok) throw new Error('Failed to load branding settings');
      const data = await response.json();
      setBrandingSettings(data);
      setLogoPreview(data.logo_data || null);
      setLogoFilename(data.logo_filename || '');
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setBrandingLoading(false); }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: "Error", description: "Please select an image file", variant: "destructive" });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Error", description: "Image size must be less than 2MB", variant: "destructive" });
      return;
    }

    setBrandingLoading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const logo_data = reader.result;
        setLogoPreview(logo_data);
        setLogoFilename(file.name);

        const response = await fetch('/api/admin/branding', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            logo_data,
            logo_filename: file.name,
            logo_content_type: file.type
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to upload logo');

        toast({ title: "Success", description: "Logo uploaded successfully", variant: "success" });
        fetchBrandingSettings();
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setBrandingLoading(false);
    }
  };

  const handleLogoRemove = async () => {
    setBrandingLoading(true);
    try {
      const response = await fetch('/api/admin/branding', {
        method: 'DELETE',
        headers: { ...getAuthHeaders() }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to remove logo');

      setLogoPreview(null);
      setLogoFilename('');
      toast({ title: "Success", description: "Logo removed successfully", variant: "success" });
      fetchBrandingSettings();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setBrandingLoading(false); }
  };


  if (user?.role !== 'admin') {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">Access Denied - Admin access required</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <CardTitle>Admin Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <Tabs value={activeView} onValueChange={setActiveView}>
            <TabsList className="mb-3">
              <TabsTrigger value="branding" className="gap-2"><Image className="h-4 w-4" />Branding</TabsTrigger>
              <TabsTrigger value="security" className="gap-2"><Shield className="h-4 w-4" />Security</TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" />Notifications</TabsTrigger>
              <TabsTrigger value="integrations" className="gap-2"><Plug className="h-4 w-4" />Integrations</TabsTrigger>
              <TabsTrigger value="settings" className="gap-2"><Database className="h-4 w-4" />Database</TabsTrigger>
            </TabsList>


            <TabsContent value="settings" className="space-y-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Database Configuration</CardTitle>
                  <CardDescription className="text-sm">Choose SQLite (default) or PostgreSQL for production.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={dbSettings.effectiveEngine === 'postgres' ? 'success' : 'secondary'}>{dbSettings.effectiveEngine.toUpperCase()}</Badge>
                    {dbSettings.managedByEnv && <Badge variant="warning">Managed by ENV</Badge>}
                  </div>
                  <Select value={dbSettings.engine} onValueChange={(v) => setDbSettings({ ...dbSettings, engine: v })} disabled={dbSettings.managedByEnv || dbLoading}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sqlite">SQLite (default)</SelectItem>
                      <SelectItem value="postgres">PostgreSQL</SelectItem>
                    </SelectContent>
                  </Select>
                  {dbSettings.engine === 'postgres' && (
                    <Input placeholder="postgresql://user:pass@host:5432/database" value={dbSettings.postgresUrl} onChange={(e) => setDbSettings({ ...dbSettings, postgresUrl: e.target.value })} disabled={dbSettings.managedByEnv || dbLoading} />
                  )}
                  <Button onClick={handleDatabaseSave} disabled={dbSettings.managedByEnv || dbLoading} size="sm">
                    {dbLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Database Settings
                  </Button>
                  <p className="text-xs text-muted-foreground">Restart the backend after changing database settings.</p>
                </CardContent>
              </Card>
              <Card className="border-yellow-400 bg-yellow-50">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-yellow-600" /><CardTitle className="text-sm text-yellow-800">Security Best Practices</CardTitle></div>
                </CardHeader>
                <CardContent className="pt-2">
                  <ul className="text-xs text-yellow-800 space-y-0.5 list-disc list-inside">
                    <li>Regularly review user roles and permissions</li>
                    <li>Remove inactive user accounts</li>
                    <li>Monitor audit logs for suspicious activity</li>
                    <li>Keep the application updated</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="branding" className="space-y-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Company Logo</CardTitle>
                  <CardDescription className="text-sm">Upload a custom logo to replace the default KARS branding on the login page.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-2">
                  {brandingLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 pb-2">
                      <div className="h-20 w-20 flex items-center justify-center rounded-lg border bg-muted/50 overflow-hidden shrink-0">
                        {logoPreview ? (
                          <img
                            src={logoPreview}
                            alt="Company Logo"
                            className="max-h-16 max-w-16 object-contain"
                          />
                        ) : (
                          <Image className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label htmlFor="company-logo" className="text-sm">Company Logo</Label>
                        <Input id="company-logo" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => document.getElementById('company-logo')?.click()}
                            disabled={brandingLoading}
                          >
                            Choose Image
                          </Button>
                          {logoPreview && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleLogoRemove}
                              disabled={brandingLoading}
                            >
                              Remove
                            </Button>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {logoFilename || 'No file selected'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">PNG, JPG, or SVG up to 2MB.</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <SecuritySettings />
            </TabsContent>

            <TabsContent value="notifications">
              <NotificationSettings />
            </TabsContent>

            <TabsContent value="integrations">
              <HubSpotSettings />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettingsNew;
