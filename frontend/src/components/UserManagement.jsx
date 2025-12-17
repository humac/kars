import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import TablePaginationControls from '@/components/TablePaginationControls';
import { cn } from '@/lib/utils';
import { Users, Trash2, Loader2, AlertTriangle, Edit, Search, Sparkles, Info, UserPlus } from 'lucide-react';

const UserManagement = () => {
  const { getAuthHeaders, user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', manager_first_name: '', manager_last_name: '', manager_email: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null });
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(10);
  const [bulkRole, setBulkRole] = useState('');
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [addUserForm, setAddUserForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    role: 'employee',
    manager_first_name: '',
    manager_last_name: '',
    manager_email: ''
  });
  const [addingUser, setAddingUser] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isAttestationCoordinator = user?.role === 'attestation_coordinator';
  const isReadOnly = isManager || isAttestationCoordinator;

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const handleRoleChange = async (userId, newRole) => {
    if (!isAdmin) return;
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
    if (!isAdmin) return;
    setEditingUser(user);
    setEditForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      manager_first_name: user.manager_first_name || '',
      manager_last_name: user.manager_last_name || '',
      manager_email: user.manager_email || ''
    });
  };

  const handleUserUpdate = async () => {
    if (!editingUser || !isAdmin) return;

    if (!editForm.first_name || !editForm.last_name) {
      toast({ title: "Missing info", description: "First and last name are required", variant: "destructive" });
      return;
    }

    if (!editForm.manager_first_name || !editForm.manager_last_name || !editForm.manager_email) {
      toast({ title: "Missing info", description: "Manager first name, last name, and email are required", variant: "destructive" });
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
    if (!isAdmin) return;
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

  const toggleUserSelect = (id) => {
    if (!isAdmin) return;
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAllUsers = () => {
    if (!isAdmin) return;
    setSelectedUserIds((prev) => {
      const pageIds = paginatedUsers.map((u) => u.id);
      const hasAll = pageIds.every((id) => prev.has(id));
      const next = new Set(prev);
      pageIds.forEach((id) => {
        if (hasAll) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const clearUserSelection = () => setSelectedUserIds(new Set());

  const handleBulkRoleUpdate = async () => {
    if (!isAdmin) return;
    const ids = Array.from(selectedUserIds).filter((id) => id !== user?.id);
    if (!ids.length || !bulkRole) return;
    setSavingEdit(true);
    try {
      for (const id of ids) {
        const response = await fetch(`/api/auth/users/${id}/role`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ role: bulkRole })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update role');
      }
      toast({ title: "Success", description: `Updated ${ids.length} user roles`, variant: "success" });
      setBulkRole('');
      clearUserSelection();
      fetchUsers();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleBulkDeleteUsers = async () => {
    if (!isAdmin) return;
    const ids = Array.from(selectedUserIds).filter((id) => id !== user?.id);
    if (!ids.length) return;
    setBulkDeleting(true);
    try {
      for (const id of ids) {
        const response = await fetch(`/api/auth/users/${id}`, { method: 'DELETE', headers: { ...getAuthHeaders() } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to delete user');
      }
      toast({ title: "Success", description: `Deleted ${ids.length} user${ids.length === 1 ? '' : 's'}`, variant: "success" });
      clearUserSelection();
      fetchUsers();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleAddUser = async () => {
    if (!isAdmin) return;

    // Validation
    if (!addUserForm.email || !addUserForm.password || !addUserForm.first_name || !addUserForm.last_name) {
      toast({ title: "Missing info", description: "Email, password, first name, and last name are required", variant: "destructive" });
      return;
    }

    if (addUserForm.password.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    // Manager fields are optional, but if any is provided, all must be provided
    const hasAnyManagerField = addUserForm.manager_first_name || addUserForm.manager_last_name || addUserForm.manager_email;
    if (hasAnyManagerField) {
      if (!addUserForm.manager_first_name || !addUserForm.manager_last_name || !addUserForm.manager_email) {
        toast({ title: "Incomplete manager info", description: "If providing manager info, all fields (first name, last name, email) are required", variant: "destructive" });
        return;
      }
    }

    setAddingUser(true);

    try {
      // Use the registration endpoint
      const payload = {
        email: addUserForm.email,
        password: addUserForm.password,
        first_name: addUserForm.first_name,
        last_name: addUserForm.last_name,
      };

      // Only include manager fields if they're all provided
      if (hasAnyManagerField) {
        payload.manager_first_name = addUserForm.manager_first_name;
        payload.manager_last_name = addUserForm.manager_last_name;
        payload.manager_email = addUserForm.manager_email;
      } else {
        // Provide default manager fields if none provided
        payload.manager_first_name = 'Unknown';
        payload.manager_last_name = 'Manager';
        payload.manager_email = 'nomanager@example.com';
      }

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create user');

      // If a specific role was selected, update it
      if (addUserForm.role !== 'employee' && data.user?.id) {
        await handleRoleChange(data.user.id, addUserForm.role);
      }

      toast({ title: "Success", description: `User ${addUserForm.email} created successfully`, variant: "success" });
      setAddUserDialogOpen(false);
      setAddUserForm({
        email: '',
        first_name: '',
        last_name: '',
        password: '',
        role: 'employee',
        manager_first_name: '',
        manager_last_name: '',
        manager_email: ''
      });
      fetchUsers();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingUser(false);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Never';
  const getRoleColor = (role) => ({ admin: 'destructive', manager: 'success', employee: 'default', attestation_coordinator: 'outline' }[role] || 'secondary');

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return users.filter((u) => {
      const managerFullName = `${u.manager_first_name || ''} ${u.manager_last_name || ''}`.trim().toLowerCase();
      return (
        u.name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        managerFullName.includes(term) ||
        u.manager_email?.toLowerCase().includes(term)
      );
    });
  }, [users, searchTerm]);

  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / usersPageSize) || 1);

  useEffect(() => {
    setUsersPage(1);
  }, [usersPageSize, filteredUsers.length]);

  useEffect(() => {
    if (usersPage > totalUserPages) {
      setUsersPage(totalUserPages);
    }
  }, [usersPage, totalUserPages]);

  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * usersPageSize;
    return filteredUsers.slice(start, start + usersPageSize);
  }, [filteredUsers, usersPage, usersPageSize]);

  const isAllUsersSelected = paginatedUsers.length > 0 && paginatedUsers.every((u) => selectedUserIds.has(u.id));
  const isSomeUsersSelected = paginatedUsers.some((u) => selectedUserIds.has(u.id)) && !isAllUsersSelected;

  if (!isAdmin && !isReadOnly) {
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

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg sm:text-xl">User Management</CardTitle>
            </div>
            <span className="text-xs sm:text-sm text-muted-foreground">Total: {users.length}</span>
          </div>
          <CardDescription className="text-sm">
            {isReadOnly ? 'View user information (read-only access)' : 'Manage user accounts, roles, and permissions'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 px-4 sm:px-6">
          {isReadOnly && (
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                You have read-only access to user information. Contact an administrator to make changes.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or manager"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                {isAdmin && (
                  <Button onClick={() => setAddUserDialogOpen(true)} className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Add User
                  </Button>
                )}
              </div>
            </div>

            {isAdmin && selectedUserIds.size > 0 && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 rounded-lg border px-2 py-1.5 bg-muted/50">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{selectedUserIds.size} selected</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={bulkRole} onValueChange={setBulkRole}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Bulk role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="attestation_coordinator">Attestation Coordinator</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleBulkRoleUpdate} disabled={!bulkRole || savingEdit}>
                    {savingEdit && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Apply role
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={handleBulkDeleteUsers}
                    disabled={bulkDeleting}
                  >
                    {bulkDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearUserSelection}>Clear</Button>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-2 mt-4">
              <div className="md:hidden space-y-2">
                {filteredUsers.length === 0 && (
                  <div className="text-center text-muted-foreground border rounded-md py-6">No users match your search.</div>
                )}
                {paginatedUsers.map((u) => (
                  <div
                    key={u.id}
                    className={cn(
                      "border rounded-lg p-3 flex gap-2",
                      isAdmin && selectedUserIds.has(u.id) && "bg-primary/5 border-primary/30"
                    )}
                  >
                    {isAdmin && (
                      <Checkbox
                        checked={selectedUserIds.has(u.id)}
                        onCheckedChange={() => toggleUserSelect(u.id)}
                        className="mt-1"
                        disabled={u.id === user.id}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium truncate">{u.name}</h4>
                          <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <Badge variant={getRoleColor(u.role)} className="uppercase">{u.role}</Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium text-foreground">Manager</span>
                          <div className="text-xs">
                            {u.manager_first_name && u.manager_last_name 
                              ? `${u.manager_first_name} ${u.manager_last_name}` 
                              : '—'}
                          </div>
                          <div className="text-xs">{u.manager_email || '—'}</div>
                        </div>
                        <div className="text-right text-xs">Last login<br />{formatDate(u.last_login)}</div>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex flex-col gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(u)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ open: true, user: u })} disabled={u.id === user.id}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {isAdmin && (
                        <TableHead className="w-12">
                          <Checkbox
                            checked={isAllUsersSelected ? true : isSomeUsersSelected ? "indeterminate" : false}
                            onCheckedChange={toggleSelectAllUsers}
                          />
                        </TableHead>
                      )}
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden md:table-cell">Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden lg:table-cell">Manager</TableHead>
                      <TableHead className="hidden lg:table-cell">Last Login</TableHead>
                      {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 7 : 5} className="text-center text-muted-foreground">No users match your search.</TableCell>
                      </TableRow>
                    )}
                    {paginatedUsers.map((u) => (
                      <TableRow
                        key={u.id}
                        data-state={isAdmin && selectedUserIds.has(u.id) ? "selected" : undefined}
                        className={cn(isAdmin && selectedUserIds.has(u.id) && "bg-primary/5")}
                      >
                        {isAdmin && (
                          <TableCell>
                            <Checkbox
                              checked={selectedUserIds.has(u.id)}
                              onCheckedChange={() => toggleUserSelect(u.id)}
                              disabled={u.id === user.id}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="hidden md:table-cell">{u.email}</TableCell>
                        <TableCell>
                          {isAdmin ? (
                            <Select value={u.role} onValueChange={(v) => handleRoleChange(u.id, v)} disabled={u.id === user.id}>
                              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="employee">Employee</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="attestation_coordinator">Attestation Coord.</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant={getRoleColor(u.role)} className="uppercase">{u.role}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {u.manager_first_name && u.manager_last_name 
                                ? `${u.manager_first_name} ${u.manager_last_name}` 
                                : '—'}
                            </span>
                            <span className="text-xs text-muted-foreground">{u.manager_email || '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">{formatDate(u.last_login)}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(u)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteDialog({ open: true, user: u })}
                                disabled={u.id === user.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filteredUsers.length > 0 ? (
                <TablePaginationControls
                  className="mt-4"
                  page={usersPage}
                  pageSize={usersPageSize}
                  totalItems={filteredUsers.length}
                  onPageChange={setUsersPage}
                  onPageSizeChange={setUsersPageSize}
                />
              ) : null}
            </div>
          )}

          <Card className="bg-muted/50 mt-4">
            <CardHeader className="pb-2 px-4 sm:px-6"><CardTitle className="text-sm sm:text-base">Role Descriptions</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 pt-2 px-4 sm:px-6">
              <div><Badge variant="destructive" className="uppercase text-xs">Admin</Badge><p className="text-sm text-muted-foreground mt-1">Full system access, can manage all users and settings.</p></div>
              <div><Badge variant="default" className="uppercase text-xs bg-green-600">Manager</Badge><p className="text-sm text-muted-foreground mt-1">View own + team assets, access team audit reports.</p></div>
              <div><Badge variant="outline" className="uppercase text-xs bg-purple-600 text-white border-purple-600">Attestation Coordinator</Badge><p className="text-sm text-muted-foreground mt-1">Manage attestation campaigns and compliance reporting.</p></div>
              <div><Badge variant="secondary" className="uppercase text-xs">Employee</Badge><p className="text-sm text-muted-foreground mt-1">Can only view and manage own asset registrations.</p></div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      {isAdmin && (
        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Edit User Attributes</DialogTitle>
              <DialogDescription className="text-sm">Update name and manager information for this user.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">First Name</label>
                  <Input
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    placeholder="First name"
                    className="text-base"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name</label>
                  <Input
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    placeholder="Last name"
                    className="text-base"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Manager First Name</label>
                  <Input
                    value={editForm.manager_first_name}
                    onChange={(e) => setEditForm({ ...editForm, manager_first_name: e.target.value })}
                    placeholder="First name"
                    className="text-base"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Manager Last Name</label>
                  <Input
                    value={editForm.manager_last_name}
                    onChange={(e) => setEditForm({ ...editForm, manager_last_name: e.target.value })}
                    placeholder="Last name"
                    className="text-base"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Manager Email</label>
                <Input
                  value={editForm.manager_email}
                  onChange={(e) => setEditForm({ ...editForm, manager_email: e.target.value })}
                  placeholder="manager@example.com"
                  type="email"
                  className="text-base"
                />
              </div>
              {editingUser && (
                <p className="text-xs text-muted-foreground">Editing: {editingUser.email}</p>
              )}
            </div>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setEditingUser(null)} className="w-full sm:w-auto">Cancel</Button>
              <Button onClick={handleUserUpdate} disabled={savingEdit} className="w-full sm:w-auto">
                {savingEdit && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete User Dialog */}
      {isAdmin && (
        <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, user: null })}>
          <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Confirm Delete User</DialogTitle>
              <DialogDescription className="text-sm">Are you sure you want to delete "{deleteDialog.user?.name}"? This cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setDeleteDialog({ open: false, user: null })} className="w-full sm:w-auto">Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} className="w-full sm:w-auto">Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add User Dialog */}
      {isAdmin && (
        <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Add New User</DialogTitle>
              <DialogDescription className="text-sm">Create a new user account with specified role and details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="add-email">Email *</Label>
                  <Input
                    id="add-email"
                    type="email"
                    value={addUserForm.email}
                    onChange={(e) => setAddUserForm({ ...addUserForm, email: e.target.value })}
                    placeholder="user@company.com"
                    className="text-base"
                  />
                </div>
                <div>
                  <Label htmlFor="add-password">Password *</Label>
                  <Input
                    id="add-password"
                    type="password"
                    value={addUserForm.password}
                    onChange={(e) => setAddUserForm({ ...addUserForm, password: e.target.value })}
                    placeholder="At least 6 characters"
                    className="text-base"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="add-first-name">First Name *</Label>
                  <Input
                    id="add-first-name"
                    value={addUserForm.first_name}
                    onChange={(e) => setAddUserForm({ ...addUserForm, first_name: e.target.value })}
                    placeholder="John"
                    className="text-base"
                  />
                </div>
                <div>
                  <Label htmlFor="add-last-name">Last Name *</Label>
                  <Input
                    id="add-last-name"
                    value={addUserForm.last_name}
                    onChange={(e) => setAddUserForm({ ...addUserForm, last_name: e.target.value })}
                    placeholder="Doe"
                    className="text-base"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="add-role">Role *</Label>
                <Select value={addUserForm.role} onValueChange={(v) => setAddUserForm({ ...addUserForm, role: v })}>
                  <SelectTrigger id="add-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="attestation_coordinator">Attestation Coordinator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Manager Information (Optional)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="add-manager-first">Manager First Name</Label>
                    <Input
                      id="add-manager-first"
                      value={addUserForm.manager_first_name}
                      onChange={(e) => setAddUserForm({ ...addUserForm, manager_first_name: e.target.value })}
                      placeholder="Jane"
                      className="text-base"
                    />
                  </div>
                  <div>
                    <Label htmlFor="add-manager-last">Manager Last Name</Label>
                    <Input
                      id="add-manager-last"
                      value={addUserForm.manager_last_name}
                      onChange={(e) => setAddUserForm({ ...addUserForm, manager_last_name: e.target.value })}
                      placeholder="Smith"
                      className="text-base"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <Label htmlFor="add-manager-email">Manager Email</Label>
                  <Input
                    id="add-manager-email"
                    type="email"
                    value={addUserForm.manager_email}
                    onChange={(e) => setAddUserForm({ ...addUserForm, manager_email: e.target.value })}
                    placeholder="manager@company.com"
                    className="text-base"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setAddUserDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
              <Button onClick={handleAddUser} disabled={addingUser} className="w-full sm:w-auto">
                {addingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default UserManagement;
