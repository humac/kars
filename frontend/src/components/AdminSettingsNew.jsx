import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Settings, Users, LayoutDashboard, Database, Trash2, Loader2, AlertTriangle, Shield, Image, Edit } from 'lucide-react';
import OIDCSettings from './OIDCSettings';
import SecuritySettingsNew from './SecuritySettingsNew';

const AdminSettingsNew = () => {
  const { getAuthHeaders, user } = useAuth();
  const { toast } = useToast();
  const [activeView, setActiveView] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', manager_name: '', manager_email: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null });
  const [dbSettings, setDbSettings] = useState({ engine: 'sqlite', postgresUrl: '', managedByEnv: false, effectiveEngine: 'sqlite' });
  const [dbLoading, setDbLoading] = useState(false);
  const [brandingSettings, setBrandingSettings] = useState({ logo_data: null, logo_filename: null });
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);

  useEffect(() => {
    if (activeView === 'users') fetchUsers();
    if (activeView === 'settings') fetchDatabaseSettings();
    if (activeView === 'branding') fetchBrandingSettings();
  }, [activeView]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/users', { headers: { ...getAuthHeaders() } });
      if (!response.ok) throw new Error('Failed to fetch users');
      setUsers(await response.json());
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

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

  const handleRoleChange = async (userId, newRole) => {
    try {
      const response = await fetch(`/api/auth/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ role: newRole })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update role');
      toast({ title: "Success", description: `Role updated to ${newRole}`, variant: "success" });
      fetchUsers();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const openEditDialog = (user) => {
    setEditingUser(user);
    setEditForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      manager_name: user.manager_name || '',
      manager_email: user.manager_email || ''
    });
  };

  const handleUserUpdate = async () => {
    if (!editingUser) return;

    if (!editForm.first_name || !editForm.last_name) {
      toast({ title: "Missing info", description: "First and last name are required", variant: "destructive" });
      return;
    }

    if (!editForm.manager_name || !editForm.manager_email) {
      toast({ title: "Missing info", description: "Manager name and email are required", variant: "destructive" });
      return;
    }

    setSavingEdit(true);

    try {
      const response = await fetch(`/api/auth/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(editForm)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update user');

      toast({ title: "Success", description: `Updated ${editingUser.email}`, variant: "success" });
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteConfirm = async () => {
    const userToDelete = deleteDialog.user;
    setDeleteDialog({ open: false, user: null });
    try {
      const response = await fetch(`/api/auth/users/${userToDelete.id}`, {
        method: 'DELETE', headers: { ...getAuthHeaders() }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete user');
      toast({ title: "Success", description: "User deleted", variant: "success" });
      fetchUsers();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
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
      toast({ title: "Success", description: "Logo removed successfully", variant: "success" });
      fetchBrandingSettings();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setBrandingLoading(false); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Never';
  const getRoleColor = (role) => ({ admin: 'destructive', manager: 'success', employee: 'default' }[role] || 'secondary');

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      u.name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.manager_name?.toLowerCase().includes(term) ||
      u.manager_email?.toLowerCase().includes(term)
    );
  });

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <CardTitle>Admin Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeView} onValueChange={setActiveView}>
            <TabsList className="mb-6">
              <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" />Users</TabsTrigger>
              <TabsTrigger value="overview" className="gap-2"><LayoutDashboard className="h-4 w-4" />Overview</TabsTrigger>
              <TabsTrigger value="settings" className="gap-2"><Database className="h-4 w-4" />Database</TabsTrigger>
              <TabsTrigger value="branding" className="gap-2"><Image className="h-4 w-4" />Branding</TabsTrigger>
              <TabsTrigger value="security" className="gap-2"><Shield className="h-4 w-4" />Security</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">User Management</h3>
                <span className="text-sm text-muted-foreground">Total: {users.length}</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Input
                  placeholder="Search by name, email, or manager"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-md"
                />
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden md:table-cell">Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="hidden lg:table-cell">Manager</TableHead>
                        <TableHead className="hidden lg:table-cell">Last Login</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            No users match your search.
                          </TableCell>
                        </TableRow>
                      )}
                      {filteredUsers.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.name}</TableCell>
                          <TableCell className="hidden md:table-cell">{u.email}</TableCell>
                          <TableCell>
                            <Select value={u.role} onValueChange={(v) => handleRoleChange(u.id, v)} disabled={u.id === user.id}>
                              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="employee">Employee</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex flex-col">
                              <span className="font-medium">{u.manager_name || '—'}</span>
                              <span className="text-xs text-muted-foreground">{u.manager_email || '—'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">{formatDate(u.last_login)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(u)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ open: true, user: u })} disabled={u.id === user.id}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <Card className="bg-muted/50">
                <CardHeader><CardTitle className="text-base">Role Descriptions</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div><Badge variant="destructive">Admin</Badge><p className="text-sm text-muted-foreground mt-1">Full system access, can manage all users and settings.</p></div>
                  <div><Badge variant="success">Manager</Badge><p className="text-sm text-muted-foreground mt-1">View own + team assets, access team audit reports.</p></div>
                  <div><Badge variant="secondary">Employee</Badge><p className="text-sm text-muted-foreground mt-1">Can only view and manage own asset registrations.</p></div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="overview">
              <div className="grid gap-4 md:grid-cols-4 mb-6">
                <Card className="bg-primary text-primary-foreground"><CardContent className="pt-6"><div className="text-3xl font-bold">{users.length}</div><p className="text-sm opacity-80">Total Users</p></CardContent></Card>
                <Card className="bg-red-500 text-white"><CardContent className="pt-6"><div className="text-3xl font-bold">{users.filter(u => u.role === 'admin').length}</div><p className="text-sm opacity-80">Administrators</p></CardContent></Card>
                <Card className="bg-green-500 text-white"><CardContent className="pt-6"><div className="text-3xl font-bold">{users.filter(u => u.role === 'manager').length}</div><p className="text-sm opacity-80">Managers</p></CardContent></Card>
                <Card className="bg-blue-500 text-white"><CardContent className="pt-6"><div className="text-3xl font-bold">{users.filter(u => u.role === 'employee').length}</div><p className="text-sm opacity-80">Employees</p></CardContent></Card>
              </div>
              <Card>
                <CardHeader><CardTitle className="text-base">System Information</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p><strong>Application:</strong> KARS - KeyData Asset Registration System</p>
                  <p><strong>Purpose:</strong> SOC2 Compliance - Track and manage client assets</p>
                  <p><strong>Features:</strong> Role-based access, Asset tracking, Company management, Audit logging, CSV exports</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Database Configuration</CardTitle>
                  <CardDescription>Choose SQLite (default) or PostgreSQL for production.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                  <Button onClick={handleDatabaseSave} disabled={dbSettings.managedByEnv || dbLoading}>
                    {dbLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Database Settings
                  </Button>
                  <p className="text-xs text-muted-foreground">Restart the backend after changing database settings.</p>
                </CardContent>
              </Card>
              <Card className="border-yellow-400 bg-yellow-50">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-yellow-600" /><CardTitle className="text-base text-yellow-800">Security Best Practices</CardTitle></div>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>Regularly review user roles and permissions</li>
                    <li>Remove inactive user accounts</li>
                    <li>Monitor audit logs for suspicious activity</li>
                    <li>Keep the application updated</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="branding" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Company Logo</CardTitle>
                  <CardDescription>Upload a custom logo to replace the default KARS branding on the login page.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {brandingLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <>
                      {logoPreview && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-center p-6 border rounded-lg bg-muted/50">
                            <img
                              src={logoPreview}
                              alt="Company Logo"
                              className="max-h-32 object-contain"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="destructive"
                              onClick={handleLogoRemove}
                              disabled={brandingLoading}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove Logo
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={brandingLoading}
                        />
                        <p className="text-xs text-muted-foreground">
                          Supported formats: PNG, JPG, SVG. Max size: 2MB.
                          The logo will be automatically scaled to fit the login page width.
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <SecuritySettingsNew />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Attributes</DialogTitle>
            <DialogDescription>Update name and manager information for this user.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">First Name</label>
                <Input
                  value={editForm.first_name}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Last Name</label>
                <Input
                  value={editForm.last_name}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                  placeholder="Last name"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Manager Name</label>
                <Input
                  value={editForm.manager_name}
                  onChange={(e) => setEditForm({ ...editForm, manager_name: e.target.value })}
                  placeholder="Manager name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Manager Email</label>
                <Input
                  value={editForm.manager_email}
                  onChange={(e) => setEditForm({ ...editForm, manager_email: e.target.value })}
                  placeholder="manager@example.com"
                  type="email"
                />
              </div>
            </div>
            {editingUser && (
              <p className="text-xs text-muted-foreground">Editing: {editingUser.email}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={handleUserUpdate} disabled={savingEdit}>
              {savingEdit && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, user: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete User</DialogTitle>
            <DialogDescription>Are you sure you want to delete "{deleteDialog.user?.name}"? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, user: null })}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSettingsNew;
