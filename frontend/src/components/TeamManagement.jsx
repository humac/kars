import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Users,
  Shield,
  Edit,
  Search,
  Trash2,
  Loader2,
  AlertTriangle,
  Building2,
  Laptop,
  Activity,
} from 'lucide-react';

const TeamManagement = () => {
  const { getAuthHeaders, user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedManager, setSelectedManager] = useState('all');
  const [view, setView] = useState('employees');
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', manager_name: '', manager_email: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null });

  const isAdmin = user?.role === 'admin';
  const managedEmail = user?.email?.toLowerCase();

  useEffect(() => {
    fetchUsers();
    fetchAssets();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/users', { headers: { ...getAuthHeaders() } });
      if (!response.ok) throw new Error('Failed to fetch users');
      setUsers(await response.json());
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchAssets = async () => {
    setAssetsLoading(true);
    try {
      const response = await fetch('/api/assets', { headers: { ...getAuthHeaders() } });
      if (!response.ok) throw new Error('Failed to load assets');
      setAssets(await response.json());
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setAssetsLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const response = await fetch(`/api/auth/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update role');
      toast({ title: 'Success', description: `Role updated to ${newRole}`, variant: 'success' });
      fetchUsers();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const openEditDialog = (selectedUser) => {
    setEditingUser(selectedUser);
    setEditForm({
      first_name: selectedUser.first_name || '',
      last_name: selectedUser.last_name || '',
      manager_name: selectedUser.manager_name || '',
      manager_email: selectedUser.manager_email || '',
    });
  };

  const handleUserUpdate = async () => {
    if (!editingUser) return;

    if (!editForm.first_name || !editForm.last_name) {
      toast({ title: 'Missing info', description: 'First and last name are required', variant: 'destructive' });
      return;
    }

    if (!editForm.manager_name || !editForm.manager_email) {
      toast({ title: 'Missing info', description: 'Manager name and email are required', variant: 'destructive' });
      return;
    }

    setSavingEdit(true);

    try {
      const response = await fetch(`/api/auth/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(editForm),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update user');

      toast({ title: 'Success', description: `Updated ${editingUser.email}`, variant: 'success' });
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteConfirm = async () => {
    const userToDelete = deleteDialog.user;
    setDeleteDialog({ open: false, user: null });
    try {
      const response = await fetch(`/api/auth/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete user');
      toast({ title: 'Success', description: 'User deleted', variant: 'success' });
      fetchUsers();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const formatDisplayName = (u) => u?.name || [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.email || 'Unknown user';

  const matchesSearch = (emp, term) => {
    if (!term) return true;
    const normalized = term.toLowerCase();
    return (
      formatDisplayName(emp).toLowerCase().includes(normalized) ||
      emp.email?.toLowerCase().includes(normalized) ||
      emp.manager_name?.toLowerCase().includes(normalized) ||
      emp.manager_email?.toLowerCase().includes(normalized) ||
      emp.companies.some((company) => company?.toLowerCase().includes(normalized)) ||
      emp.assets.some(
        (asset) =>
          asset.laptop_asset_tag?.toLowerCase().includes(normalized) ||
          asset.laptop_serial_number?.toLowerCase().includes(normalized) ||
          asset.company_name?.toLowerCase().includes(normalized)
      )
    );
  };

  const visibleUsers = useMemo(() => {
    if (isAdmin) return users;
    return users.filter((u) => u.manager_email?.toLowerCase() === managedEmail);
  }, [isAdmin, managedEmail, users]);

  const managedEmails = useMemo(
    () => new Set(visibleUsers.map((u) => u.email?.toLowerCase()).filter(Boolean)),
    [visibleUsers]
  );

  const visibleAssets = useMemo(() => {
    const scopedAssets = isAdmin
      ? assets
      : assets.filter((asset) => managedEmails.has(asset.employee_email?.toLowerCase()));

    return [...scopedAssets].sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''));
  }, [assets, isAdmin, managedEmails]);

  const enrichedEmployees = useMemo(
    () =>
      visibleUsers
        .map((u) => {
          const relatedAssets = visibleAssets.filter(
            (asset) => asset.employee_email && asset.employee_email.toLowerCase() === u.email?.toLowerCase()
          );
          const companies = Array.from(new Set(relatedAssets.map((a) => a.company_name).filter(Boolean)));
          return { ...u, assets: relatedAssets, companies };
        })
        .sort((a, b) => formatDisplayName(a).localeCompare(formatDisplayName(b))),
    [visibleUsers, visibleAssets]
  );

  const employeeLookup = useMemo(
    () => new Map(enrichedEmployees.map((emp) => [emp.email?.toLowerCase(), emp])),
    [enrichedEmployees]
  );

  const managerGroups = useMemo(() => {
    const groups = new Map();

    enrichedEmployees.forEach((emp) => {
      const key = emp.manager_email || emp.manager_name || 'Unassigned';
      if (!groups.has(key)) {
        groups.set(key, {
          managerEmail: emp.manager_email || 'Not provided',
          managerName: emp.manager_name || 'Unassigned manager',
          team: [],
        });
      }
      groups.get(key).team.push(emp);
    });

    return Array.from(groups.values()).sort((a, b) => a.managerName.localeCompare(b.managerName));
  }, [enrichedEmployees]);

  const companyGroups = useMemo(() => {
    const map = new Map();

    enrichedEmployees.forEach((emp) => {
      const companies = emp.companies.length ? emp.companies : ['Unassigned company'];
      companies.forEach((companyName) => {
        if (!map.has(companyName)) {
          map.set(companyName, { name: companyName, employees: [], assets: [], managers: new Set() });
        }
        const entry = map.get(companyName);
        if (!entry.employees.some((e) => e.id === emp.id)) {
          entry.employees.push(emp);
        }
        entry.assets.push(...emp.assets);
        if (emp.manager_name) {
          entry.managers.add(emp.manager_name);
        }
      });
    });

    return Array.from(map.values())
      .map((entry) => ({ ...entry, managers: Array.from(entry.managers) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [enrichedEmployees]);

  const managerOptions = useMemo(
    () => managerGroups.map((group) => ({ value: group.managerEmail, label: group.managerName })),
    [managerGroups]
  );

  const assetEntries = useMemo(() => {
    return visibleAssets
      .map((asset) => ({
        ...asset,
        owner: employeeLookup.get(asset.employee_email?.toLowerCase()),
        company: asset.company_name || 'Unassigned company',
        status: asset.status || 'Active',
      }))
      .sort((a, b) => a.company.localeCompare(b.company));
  }, [employeeLookup, visibleAssets]);

  const filteredAssets = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return assetEntries;
    return assetEntries.filter((asset) => {
      const ownerName = asset.owner ? formatDisplayName(asset.owner).toLowerCase() : '';
      return (
        asset.laptop_asset_tag?.toLowerCase().includes(term) ||
        asset.laptop_serial_number?.toLowerCase().includes(term) ||
        asset.company.toLowerCase().includes(term) ||
        ownerName.includes(term) ||
        asset.employee_email?.toLowerCase().includes(term)
      );
    });
  }, [assetEntries, searchTerm]);

  const assetsByCompany = useMemo(() => {
    const map = new Map();

    assetEntries.forEach((entry) => {
      if (!map.has(entry.company)) {
        map.set(entry.company, { name: entry.company, assets: [], owners: new Set() });
      }
      const companyRow = map.get(entry.company);
      companyRow.assets.push(entry);
      if (entry.owner) {
        companyRow.owners.add(entry.owner.first_name || entry.owner.last_name ? formatDisplayName(entry.owner) : entry.owner.email);
      }
    });

    return Array.from(map.values()).map((company) => ({
      ...company,
      owners: Array.from(company.owners),
    }));
  }, [assetEntries]);

  const filteredAssetsByCompany = useMemo(() => {
    if (!searchTerm) return assetsByCompany;

    const map = new Map();
    filteredAssets.forEach((entry) => {
      if (!map.has(entry.company)) {
        map.set(entry.company, { name: entry.company, assets: [], owners: new Set() });
      }
      const companyRow = map.get(entry.company);
      companyRow.assets.push(entry);
      if (entry.owner) {
        companyRow.owners.add(entry.owner.first_name || entry.owner.last_name ? formatDisplayName(entry.owner) : entry.owner.email);
      }
    });

    return Array.from(map.values()).map((company) => ({
      ...company,
      owners: Array.from(company.owners),
    }));
  }, [assetsByCompany, filteredAssets, searchTerm]);

  const filteredManagerGroups = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return managerGroups
      .map((group) => ({
        ...group,
        team: group.team.filter((member) => matchesSearch(member, term)),
      }))
      .filter((group) => group.team.length > 0)
      .filter((group) => (selectedManager === 'all' ? true : group.managerEmail === selectedManager));
  }, [managerGroups, searchTerm, selectedManager]);

  const filteredCompanies = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return companyGroups.filter(
      (company) =>
        !term ||
        company.name.toLowerCase().includes(term) ||
        company.employees.some((emp) => matchesSearch(emp, term))
    );
  }, [companyGroups, searchTerm]);

  const stats = useMemo(
    () => ({
      employees: visibleUsers.length,
      managers: managerGroups.filter((group) => group.managerEmail !== 'Not provided').length,
      companies: companyGroups.length,
      assets: visibleAssets.length,
    }),
    [visibleUsers.length, managerGroups, companyGroups, visibleAssets.length]
  );

  if (!['admin', 'manager'].includes(user?.role)) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">Access Denied - Manager or Admin access required</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeLoading = loading || assetsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Team intelligence</h1>
            <p className="text-sm text-muted-foreground">Stay on top of managers, employees, and their device footprints.</p>
          </div>
        </div>
        {!isAdmin && (
          <p className="text-xs text-muted-foreground">
            Showing direct reports mapped to <span className="font-semibold text-foreground">{user?.email}</span>. Ensure each employee record has your manager email assigned.
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Employees</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-bold">{stats.employees}</div>
            <div className="rounded-full bg-primary/10 p-2 text-primary"><Users className="h-5 w-5" /></div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-background border-emerald-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Managers</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-bold">{stats.managers}</div>
            <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-600"><Shield className="h-5 w-5" /></div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-background border-blue-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Companies</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-bold">{stats.companies}</div>
            <div className="rounded-full bg-blue-500/10 p-2 text-blue-600"><Building2 className="h-5 w-5" /></div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-background border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tracked assets</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-bold">{stats.assets}</div>
            <div className="rounded-full bg-amber-500/10 p-2 text-amber-600"><Laptop className="h-5 w-5" /></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-1">
          <CardTitle className="text-lg">Team relationship hub</CardTitle>
          <p className="text-sm text-muted-foreground">Explore your organization by managers, employees, companies, and devices.</p>
        </CardHeader>
        <CardContent>
          <Tabs value={view} onValueChange={setView} className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 items-center gap-3">
                <div className="relative w-full md:max-w-md">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    placeholder="Search by employee, company, or asset"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {view === 'employees' && (
                  <Select value={selectedManager} onValueChange={setSelectedManager}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Filter by manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All managers</SelectItem>
                      {managerOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <TabsList className="self-start md:self-auto">
                <TabsTrigger value="employees" className="gap-2"><Users className="h-4 w-4" />Employee view</TabsTrigger>
                <TabsTrigger value="companies" className="gap-2"><Building2 className="h-4 w-4" />Company view</TabsTrigger>
                <TabsTrigger value="assets" className="gap-2"><Laptop className="h-4 w-4" />Asset view</TabsTrigger>
                <TabsTrigger value="guidance" className="gap-2"><Shield className="h-4 w-4" />Guidance</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="employees" className="space-y-4">
              {activeLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 mr-2 animate-spin" /> Loading team data
                </div>
              ) : filteredManagerGroups.length === 0 ? (
                <div className="text-center text-muted-foreground border rounded-md py-10">No employees match the current filters.</div>
              ) : (
                <div className="space-y-4">
                  {filteredManagerGroups.map((group) => (
                    <div
                      key={group.managerEmail}
                      className="rounded-xl border bg-gradient-to-br from-muted/60 via-background to-background p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Manager</p>
                          <div className="text-lg font-semibold leading-tight">{group.managerName}</div>
                          <p className="text-sm text-muted-foreground">{group.managerEmail}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="gap-1"><Users className="h-4 w-4" />{group.team.length} teammates</Badge>
                          <Badge variant="outline" className="gap-1"><Laptop className="h-4 w-4" />{group.team.reduce((acc, member) => acc + member.assets.length, 0)} assets</Badge>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {group.team.map((member) => (
                          <Card key={member.id} className="border-muted bg-muted/20">
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="font-semibold leading-tight">{formatDisplayName(member)}</div>
                                  <p className="text-sm text-muted-foreground break-all">{member.email}</p>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    <Badge variant="secondary" className="uppercase text-xs">{member.role}</Badge>
                                    {member.companies.length === 0 && <Badge variant="outline">No company</Badge>}
                                    {member.companies.map((company) => (
                                      <Badge key={company} variant="outline" className="bg-background">{company}</Badge>
                                    ))}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">Assets</p>
                                  <div className="text-2xl font-bold">{member.assets.length}</div>
                                </div>
                              </div>

                              {member.assets.length > 0 && (
                                <div className="space-y-2">
                                  {member.assets.slice(0, 2).map((asset) => (
                                    <div key={asset.id || `${asset.laptop_asset_tag}-${asset.employee_email}`}
                                      className="rounded-lg border bg-background px-3 py-2 flex items-center justify-between">
                                      <div className="space-y-0.5">
                                        <div className="flex items-center gap-2 font-medium">
                                          <Laptop className="h-4 w-4 text-muted-foreground" />
                                          <span>{asset.laptop_asset_tag || asset.laptop_serial_number || 'Laptop asset'}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{asset.company_name || 'Unassigned company'}</p>
                                      </div>
                                      <Badge variant="outline" className="uppercase text-xs">{asset.status || 'Active'}</Badge>
                                    </div>
                                  ))}
                                  {member.assets.length > 2 && (
                                    <p className="text-xs text-muted-foreground">+{member.assets.length - 2} more devices</p>
                                  )}
                                </div>
                              )}

                              <div className="flex flex-wrap gap-2 pt-1">
                                <Select value={member.role} onValueChange={(value) => handleRoleChange(member.id, value)}>
                                  <SelectTrigger className="w-32 uppercase"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="employee">Employee</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button variant="outline" size="sm" onClick={() => openEditDialog(member)}>
                                  <Edit className="h-4 w-4 mr-2" />Update details
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setDeleteDialog({ open: true, user: member })}
                                  disabled={member.id === user.id}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />Remove
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="companies" className="space-y-4">
              {activeLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 mr-2 animate-spin" /> Loading company view
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div className="text-center text-muted-foreground border rounded-md py-10">No companies match the current filters.</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredCompanies.map((company) => (
                    <Card key={company.name} className="border-muted bg-muted/10">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-base">{company.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">{company.employees.length} employees • {company.assets.length} assets</p>
                          </div>
                          <Badge variant="outline" className="gap-1"><Activity className="h-4 w-4" />Active</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {company.managers.length ? (
                            company.managers.map((manager) => <Badge key={manager} variant="secondary">{manager}</Badge>)
                          ) : (
                            <Badge variant="outline">No manager noted</Badge>
                          )}
                        </div>
                        <div className="space-y-2">
                          {company.employees.slice(0, 4).map((emp) => (
                            <div key={emp.id} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
                              <div>
                                <div className="font-medium leading-tight">{formatDisplayName(emp)}</div>
                                <p className="text-xs text-muted-foreground">{emp.email}</p>
                              </div>
                              <Badge variant="outline" className="uppercase text-xs">{emp.role}</Badge>
                            </div>
                          ))}
                          {company.employees.length > 4 && (
                            <p className="text-xs text-muted-foreground">+{company.employees.length - 4} more teammates</p>
                          )}
                        </div>
                        {company.assets.length > 0 && (
                          <div className="rounded-lg border bg-background px-3 py-2">
                            <p className="text-xs uppercase text-muted-foreground mb-2">Assets mapped</p>
                            <div className="flex flex-wrap gap-2">
                              {company.assets.slice(0, 5).map((asset) => (
                                <Badge key={asset.id || `${asset.laptop_asset_tag}-${asset.employee_email}`}
                                  variant="secondary" className="gap-1">
                                  <Laptop className="h-3 w-3" />{asset.laptop_asset_tag || asset.laptop_serial_number || 'Asset'}
                                </Badge>
                              ))}
                              {company.assets.length > 5 && (
                                <Badge variant="outline">+{company.assets.length - 5} more</Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="assets" className="space-y-4">
              {activeLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 mr-2 animate-spin" /> Loading asset relationships
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="text-center text-muted-foreground border rounded-md py-10">No assets match the current filters.</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    {filteredAssetsByCompany.map((company) => (
                      <Card key={company.name} className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-base">{company.name}</CardTitle>
                              <p className="text-sm text-muted-foreground">{company.assets.length} assets • {company.owners.length} owners</p>
                            </div>
                            <Badge variant="secondary" className="gap-1"><Laptop className="h-4 w-4" />Mapped</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {company.owners.length ? (
                              company.owners.map((owner) => <Badge key={owner} variant="outline">{owner}</Badge>)
                            ) : (
                              <Badge variant="outline">No owners listed</Badge>
                            )}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {company.assets.slice(0, 4).map((asset) => (
                              <div key={asset.id || `${asset.laptop_asset_tag}-${asset.employee_email}`} className="rounded-lg border bg-background px-3 py-2">
                                <div className="font-medium leading-tight">{asset.laptop_asset_tag || asset.laptop_serial_number || 'Tracked asset'}</div>
                                <p className="text-xs text-muted-foreground break-all">{asset.employee_email || 'Unassigned owner'}</p>
                                <Badge variant="outline" className="mt-1 uppercase text-xs">{asset.status}</Badge>
                              </div>
                            ))}
                          </div>
                          {company.assets.length > 4 && (
                            <p className="text-xs text-muted-foreground">+{company.assets.length - 4} more devices connected to this company</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredAssets.map((asset) => (
                      <Card key={asset.id || `${asset.laptop_asset_tag}-${asset.employee_email}`} className="border-muted bg-muted/20">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-xs uppercase text-muted-foreground">Device</p>
                              <div className="font-semibold leading-tight">{asset.laptop_asset_tag || asset.laptop_serial_number || 'Tracked asset'}</div>
                              <p className="text-sm text-muted-foreground">{asset.company}</p>
                            </div>
                            <Badge variant="outline" className="uppercase text-xs">{asset.status}</Badge>
                          </div>
                          <div className="rounded-lg border bg-background px-3 py-2 space-y-1">
                            <p className="text-xs text-muted-foreground">Owner</p>
                            <div className="font-medium leading-tight">{asset.owner ? formatDisplayName(asset.owner) : 'Unassigned owner'}</div>
                            <p className="text-xs text-muted-foreground break-all">{asset.employee_email || 'No email recorded'}</p>
                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                              <span>Manager</span>
                              <span className="text-foreground font-medium">{asset.owner?.manager_name || 'Not provided'}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="guidance" className="space-y-3">
              <Card className="border-yellow-400 bg-yellow-50">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <Shield className="h-5 w-5" />
                    <CardTitle className="text-base">Team management guidance</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>Review access levels regularly to keep least-privilege in place.</li>
                    <li>Keep manager contacts current so escalations reach the right people.</li>
                    <li>Map devices to owners so support teams have a single source of truth.</li>
                    <li>Spot check teams with many assets to ensure nothing is orphaned or stale.</li>
                  </ul>
                </CardContent>
              </Card>
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
                  placeholder="manager@email.com"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={handleUserUpdate} disabled={savingEdit}>
              {savingEdit && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, user: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete User</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the user account and remove access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, user: null })}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamManagement;
