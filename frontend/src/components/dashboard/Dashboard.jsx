import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Laptop,
  LogOut,
  MonitorSmartphone,
  Plus,
  Search,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../ui/use-toast';

const statusTone = (status) => {
  if (!status) return 'secondary';
  const normalized = status.toLowerCase();
  if (normalized.includes('available')) return 'success';
  if (normalized.includes('assigned')) return 'warning';
  if (normalized.includes('repair') || normalized.includes('lost')) return 'danger';
  return 'secondary';
};

const Dashboard = () => {
  const { user, logout, getAuthHeaders } = useAuth();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    employeeName: '',
    employeeEmail: '',
    clientName: '',
    laptopMake: '',
    laptopModel: '',
    laptopSerialNumber: '',
    laptopAssetTag: '',
    notes: '',
    status: 'available',
  });

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/assets', {
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) {
        throw new Error('Unable to load inventory');
      }
      const data = await response.json();
      setAssets(data || []);
    } catch (error) {
      toast({ title: 'Load failed', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const filteredAssets = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return assets
      .filter((asset) =>
        statusFilter ? (asset.status || '').toLowerCase() === statusFilter.toLowerCase() : true,
      )
      .filter((asset) => {
        if (!term) return true;
        return [
          asset.employee_name,
          asset.client_name,
          asset.laptop_make,
          asset.laptop_model,
          asset.laptop_serial_number,
          asset.laptop_asset_tag,
        ]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(term));
      });
  }, [assets, searchTerm, statusFilter]);

  const uniqueStatuses = useMemo(() => {
    const set = new Set(assets.map((a) => a.status).filter(Boolean));
    return Array.from(set);
  }, [assets]);

  const stats = useMemo(() => {
    const total = assets.length;
    const available = assets.filter((a) => (a.status || '').toLowerCase().includes('available')).length;
    const assigned = assets.filter((a) => (a.status || '').toLowerCase().includes('assigned')).length;
    return { total, available, assigned };
  }, [assets]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        employee_name: formData.employeeName,
        employee_email: formData.employeeEmail,
        client_name: formData.clientName,
        laptop_make: formData.laptopMake,
        laptop_model: formData.laptopModel,
        laptop_serial_number: formData.laptopSerialNumber,
        laptop_asset_tag: formData.laptopAssetTag,
        notes: formData.notes,
        status: formData.status,
      };

      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to add laptop');
      }

      toast({ title: 'Laptop added successfully', description: `${formData.laptopMake} ${formData.laptopModel}` });
      setDialogOpen(false);
      setFormData({
        employeeName: '',
        employeeEmail: '',
        clientName: '',
        laptopMake: '',
        laptopModel: '',
        laptopSerialNumber: '',
        laptopAssetTag: '',
        notes: '',
        status: 'available',
      });
      fetchAssets();
    } catch (error) {
      toast({ title: 'Action failed', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Asset Control</p>
            <h1 className="text-2xl font-semibold text-slate-900">Laptop Inventory Dashboard</h1>
            <p className="text-sm text-muted-foreground">A crisp overview of every device in circulation.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-900">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <Avatar className="bg-primary/10 text-primary">
              <AvatarFallback>{initials || 'AA'}</AvatarFallback>
            </Avatar>
            <Button variant="ghost" className="hidden sm:inline-flex" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>Total laptops</CardDescription>
              <MonitorSmartphone className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-slate-900">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">Tracked devices in the system</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>Laptops available</CardDescription>
              <BadgeCheck className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-slate-900">{stats.available}</div>
              <p className="text-xs text-muted-foreground mt-1">Ready for assignment</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>Laptops assigned</CardDescription>
              <Laptop className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-slate-900">{stats.assigned}</div>
              <p className="text-xs text-muted-foreground mt-1">Currently allocated to teammates</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="gap-4 md:flex md:items-center md:justify-between">
            <div>
              <CardTitle className="text-xl">Inventory</CardTitle>
              <CardDescription>Search, filter, and manage every laptop in one place.</CardDescription>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 shadow-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, client, or serial"
                  className="border-0 bg-transparent focus-visible:ring-0"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  {uniqueStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    Add laptop
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add a laptop</DialogTitle>
                    <p className="text-sm text-muted-foreground">Register a device and make it available to assign.</p>
                  </DialogHeader>
                  <form className="grid gap-4" onSubmit={handleCreate}>
                    <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="employeeName">Employee name</Label>
                        <Input
                          id="employeeName"
                          value={formData.employeeName}
                          onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                          placeholder="Jordan Smith"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="employeeEmail">Employee email</Label>
                        <Input
                          id="employeeEmail"
                          type="email"
                          value={formData.employeeEmail}
                          onChange={(e) => setFormData({ ...formData, employeeEmail: e.target.value })}
                          placeholder="jordan@company.com"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="clientName">Client / Team</Label>
                        <Input
                          id="clientName"
                          value={formData.clientName}
                          onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                          placeholder="Platform Engineering"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="assigned">Assigned</SelectItem>
                            <SelectItem value="in repair">In repair</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="laptopMake">Make</Label>
                        <Input
                          id="laptopMake"
                          value={formData.laptopMake}
                          onChange={(e) => setFormData({ ...formData, laptopMake: e.target.value })}
                          placeholder="Apple"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="laptopModel">Model</Label>
                        <Input
                          id="laptopModel"
                          value={formData.laptopModel}
                          onChange={(e) => setFormData({ ...formData, laptopModel: e.target.value })}
                          placeholder="MacBook Pro"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="laptopSerial">Serial number</Label>
                        <Input
                          id="laptopSerial"
                          value={formData.laptopSerialNumber}
                          onChange={(e) => setFormData({ ...formData, laptopSerialNumber: e.target.value })}
                          placeholder="SN-123456"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="assetTag">Asset tag</Label>
                        <Input
                          id="assetTag"
                          value={formData.laptopAssetTag}
                          onChange={(e) => setFormData({ ...formData, laptopAssetTag: e.target.value })}
                          placeholder="AT-4582"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Input
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Accessories, condition, or special handling"
                      />
                    </div>
                    <DialogFooter className="pt-2">
                      <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={saving}>
                        {saving ? 'Saving...' : 'Save laptop'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned to</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead className="hidden md:table-cell">Asset tag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Loading inventory...
                      </TableCell>
                    </TableRow>
                  ) : filteredAssets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No laptops match your search.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAssets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-900">
                              {asset.laptop_make} {asset.laptop_model}
                            </p>
                            <p className="text-xs text-muted-foreground">{asset.notes || 'No notes provided'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusTone(asset.status)}>{asset.status || 'Unknown'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-sm text-slate-900">{asset.employee_name || 'Unassigned'}</p>
                            <p className="text-xs text-muted-foreground">{asset.employee_email || '—'}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-900">{asset.client_name || '—'}</TableCell>
                        <TableCell className="text-sm text-slate-900">{asset.laptop_serial_number || '—'}</TableCell>
                        <TableCell className="hidden text-sm text-slate-900 md:table-cell">{asset.laptop_asset_tag || '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
