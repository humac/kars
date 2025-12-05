import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  LayoutTemplate,
  ShieldCheck,
  Bell,
  Plug,
  CreditCard,
  Database,
  AlertTriangle,
  Image,
  Loader2,
  Clock3,
  CheckCircle2,
} from 'lucide-react';
import OIDCSettingsNew from './OIDCSettingsNew';
import SecuritySettingsNew from './SecuritySettingsNew';

const sectionIcons = {
  general: LayoutTemplate,
  security: ShieldCheck,
  notifications: Bell,
  integrations: Plug,
  billing: CreditCard,
};

const AdminSettingsNew = () => {
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();

  const [activeSection, setActiveSection] = useState('general');
  const [brandingSettings, setBrandingSettings] = useState({ logo_data: null, logo_filename: null });
  const [logoPreview, setLogoPreview] = useState(null);
  const [brandingLoading, setBrandingLoading] = useState(false);

  const [dbSettings, setDbSettings] = useState({ engine: 'sqlite', postgresUrl: '', managedByEnv: false, effectiveEngine: 'sqlite' });
  const [dbLoading, setDbLoading] = useState(false);

  const [generalForm, setGeneralForm] = useState({ organization: '', language: 'en', timezone: 'UTC' });
  const [notificationPrefs, setNotificationPrefs] = useState({
    emailActivity: true,
    weeklyDigest: false,
    securityAlerts: true,
    webhookFailures: true,
  });

  const sections = useMemo(() => (
    [
      { id: 'general', label: 'General', description: 'Branding, localization, and platform metadata.' },
      { id: 'security', label: 'Security & Access', description: 'Authentication, MFA, and session hardening.' },
      { id: 'notifications', label: 'Notifications', description: 'Email and webhook delivery preferences.' },
      { id: 'integrations', label: 'Integrations', description: 'OIDC and platform connectivity.' },
      { id: 'billing', label: 'Billing', description: 'Plan, payment methods, and invoices.' },
    ]
  ), []);

  useEffect(() => {
    fetchBrandingSettings();
    fetchDatabaseSettings();
  }, []);

  const fetchBrandingSettings = async () => {
    setBrandingLoading(true);
    try {
      const response = await fetch('/api/branding');
      if (!response.ok) throw new Error('Failed to load branding settings');
      const data = await response.json();
      setBrandingSettings(data);
      setLogoPreview(data.logo_data || null);
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setBrandingLoading(false); }
  };

  const fetchDatabaseSettings = async () => {
    setDbLoading(true);
    try {
      const response = await fetch('/api/admin/database', { headers: { ...getAuthHeaders() } });
      if (!response.ok) throw new Error('Failed to load database settings');
      setDbSettings(await response.json());
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setDbLoading(false); }
  };

  const handleGeneralSave = () => {
    toast({ title: 'Saved', description: 'General settings updated.' });
  };

  const handleNotificationSave = () => {
    toast({ title: 'Saved', description: 'Notification preferences updated.' });
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
      toast({ title: 'Success', description: 'Database settings saved. Restart backend to apply.' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setDbLoading(false); }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please select an image file', variant: 'destructive' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Error', description: 'Image size must be less than 2MB', variant: 'destructive' });
      return;
    }

    setBrandingLoading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const logo_data = reader.result;
        setLogoPreview(logo_data);

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

        toast({ title: 'Success', description: 'Logo uploaded successfully' });
        fetchBrandingSettings();
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
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
      toast({ title: 'Success', description: 'Logo removed successfully' });
      fetchBrandingSettings();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setBrandingLoading(false); }
  };

  const warningCards = useMemo(() => {
    const warnings = [];
    if (dbSettings.engine === 'sqlite') warnings.push('SQLite in-memory is active. Switch to Postgres for production.');
    if (!notificationPrefs.securityAlerts) warnings.push('Security alerts are disabled. Enable to catch suspicious activity.');
    return warnings;
  }, [dbSettings.engine, notificationPrefs.securityAlerts]);

  return (
    <div className="space-y-6">
      <Card className="bg-muted/40 border-dashed">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Admin Settings</CardTitle>
              <CardDescription>Consistent, card-based controls for platform administration.</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            Autosave for inline controls; click Save where available.
          </div>
        </CardHeader>
        {warningCards.length > 0 && (
          <CardContent className="flex flex-col gap-3">
            {warningCards.map((warning, idx) => (
              <div key={idx} className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/80 p-3 text-amber-900">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <span className="text-sm">{warning}</span>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[260px,1fr]">
        <div className="lg:sticky lg:top-24 h-fit">
          <Card className="divide-y">
            {sections.map((section) => {
              const Icon = sectionIcons[section.id] || Settings;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition hover:bg-muted ${isActive ? 'bg-muted' : ''}`}
                  onClick={() => {
                    setActiveSection(section.id);
                    document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  <Icon className={`h-4 w-4 mt-0.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{section.label}</p>
                    <p className="text-xs text-muted-foreground">{section.description}</p>
                  </div>
                  {isActive && <Badge variant="secondary" className="text-[10px]">Active</Badge>}
                </button>
              );
            })}
          </Card>
        </div>

        <div className="space-y-10">
          <section id="general" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">General</h2>
                <p className="text-sm text-muted-foreground">Consistent layout, localization, and branding.</p>
              </div>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Workspace profile</CardTitle>
                <CardDescription>Control how your workspace appears across the platform.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Organization name</Label>
                    <Input
                      value={generalForm.organization}
                      onChange={(e) => setGeneralForm({ ...generalForm, organization: e.target.value })}
                      placeholder="Acme Security"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select value={generalForm.language} onValueChange={(v) => setGeneralForm({ ...generalForm, language: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select value={generalForm.timezone} onValueChange={(v) => setGeneralForm({ ...generalForm, timezone: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific</SelectItem>
                        <SelectItem value="Europe/London">London</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleGeneralSave} className="gap-2 w-fit">
                  <CheckCircle2 className="h-4 w-4" />
                  Save changes
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle>Branding</CardTitle>
                  <CardDescription>Upload a logo for login and navigation surfaces.</CardDescription>
                </div>
                <Badge variant="outline">Optional</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {brandingLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading branding…</div>
                ) : logoPreview ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center p-6 border rounded-lg bg-muted/50">
                      <img src={logoPreview} alt="Company Logo" className="max-h-32 object-contain" />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="destructive" onClick={handleLogoRemove} disabled={brandingLoading} className="gap-2">
                        <Image className="h-4 w-4" />Remove logo
                      </Button>
                      <Button variant="outline" asChild>
                        <label className="cursor-pointer">
                          Replace
                          <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                        </label>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input type="file" accept="image/*" onChange={handleLogoUpload} disabled={brandingLoading} />
                    <p className="text-xs text-muted-foreground">Supported: PNG, JPG, SVG. Max 2MB. Fits login + header automatically.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section id="security" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">Security & Access</h2>
                <p className="text-sm text-muted-foreground">Authentication, MFA, and database posture.</p>
              </div>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Database</CardTitle>
                  <CardDescription>Choose the storage engine and connection string.</CardDescription>
                </div>
                <Badge variant="outline" className="uppercase">{dbSettings.effectiveEngine}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Engine</Label>
                    <Select value={dbSettings.engine} onValueChange={(v) => setDbSettings({ ...dbSettings, engine: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sqlite">SQLite (default)</SelectItem>
                        <SelectItem value="postgres">PostgreSQL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Postgres URL</Label>
                    <Input
                      placeholder="postgresql://user:pass@host:5432/db"
                      value={dbSettings.postgresUrl}
                      onChange={(e) => setDbSettings({ ...dbSettings, postgresUrl: e.target.value })}
                      disabled={dbSettings.engine !== 'postgres'}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">Managed by env: {dbSettings.managedByEnv ? 'Yes' : 'No'}</Badge>
                  <Badge variant="secondary">Effective: {dbSettings.effectiveEngine}</Badge>
                </div>
                <Button onClick={handleDatabaseSave} disabled={dbLoading} className="gap-2 w-fit">
                  {dbLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save database
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Authentication & MFA</CardTitle>
                <CardDescription>Configure MFA enforcement and session controls.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SecuritySettingsNew />
              </CardContent>
            </Card>
          </section>

          <section id="notifications" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">Notifications</h2>
                <p className="text-sm text-muted-foreground">Keep admins informed across email and webhooks.</p>
              </div>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Email & Delivery</CardTitle>
                <CardDescription>Toggle key communication channels for your team.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {[
                    { id: 'emailActivity', label: 'Activity emails', description: 'Asset updates, invites, and approvals.' },
                    { id: 'weeklyDigest', label: 'Weekly digest', description: 'A summarized rollup every Monday.' },
                    { id: 'securityAlerts', label: 'Security alerts', description: 'MFA resets, suspicious logins, policy gaps.' },
                    { id: 'webhookFailures', label: 'Webhook failures', description: 'Notify when an integration delivery fails repeatedly.' },
                  ].map((pref) => (
                    <div key={pref.id} className="flex items-start justify-between gap-4 rounded-lg border p-3">
                      <div>
                        <p className="font-medium text-sm">{pref.label}</p>
                        <p className="text-xs text-muted-foreground">{pref.description}</p>
                      </div>
                      <Switch
                        checked={notificationPrefs[pref.id]}
                        onCheckedChange={(checked) => setNotificationPrefs((prev) => ({ ...prev, [pref.id]: checked }))}
                      />
                    </div>
                  ))}
                </div>
                <Button onClick={handleNotificationSave} className="gap-2 w-fit">
                  <CheckCircle2 className="h-4 w-4" />
                  Save notifications
                </Button>
              </CardContent>
            </Card>
          </section>

          <section id="integrations" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">Integrations</h2>
                <p className="text-sm text-muted-foreground">OIDC connectivity with consistent theming.</p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Single Sign-On (OIDC)</CardTitle>
                <CardDescription>Set issuer details, claim mapping, and sign-in button labels.</CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="space-y-6">
                <OIDCSettingsNew />
              </CardContent>
            </Card>
          </section>

          <section id="billing" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">Billing</h2>
                <p className="text-sm text-muted-foreground">Plan details and invoices stay in one place.</p>
              </div>
            </div>
            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle>Plan overview</CardTitle>
                  <CardDescription>Track current usage and manage the subscription owner.</CardDescription>
                </div>
                <Badge variant="secondary">Pilot</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Seats</p>
                    <p className="text-2xl font-semibold">10 / Unlimited</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Next invoice</p>
                    <p className="text-2xl font-semibold">$0.00</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline">Download invoices</Button>
                  <Button variant="secondary">Manage payment method</Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsNew;
