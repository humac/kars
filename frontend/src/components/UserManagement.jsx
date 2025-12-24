import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTableFilters } from '@/hooks/useTableFilters';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import AddUserDialog from '@/components/AddUserDialog';
import EditUserDialog from '@/components/EditUserDialog';
import UserBulkActions from '@/components/UserBulkActions';
import { cn } from '@/lib/utils';
import { Users, Trash2, Loader2, AlertTriangle, Edit, Search, Info, UserPlus } from 'lucide-react';

const UserManagement = () => {
  const { getAuthHeaders, user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null });
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);

  // Custom filter function for users
  const filterUsers = useCallback((items, term) => {
    if (!term) return items;
    const lowerTerm = term.toLowerCase();
    return items.filter((u) => {
      const managerFullName = `${u.manager_first_name || ''} ${u.manager_last_name || ''}`.trim().toLowerCase();
      return (
        u.name?.toLowerCase().includes(lowerTerm) ||
        u.email?.toLowerCase().includes(lowerTerm) ||
        managerFullName.includes(lowerTerm) ||
        u.manager_email?.toLowerCase().includes(lowerTerm)
      );
    });
  }, []);

  const {
    searchTerm,
    setSearchTerm,
    page: usersPage,
    setPage: setUsersPage,
    pageSize: usersPageSize,
    setPageSize: setUsersPageSize,
    totalPages: totalUserPages,
    filteredItems: filteredUsers,
    paginatedItems: paginatedUsers,
  } = useTableFilters(users, {
    filterFn: filterUsers,
    defaultPageSize: 10
  });

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

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Never';

  // Role styling that matches the Role Descriptions section
  const getRoleBadgeProps = (role) => {
    const styles = {
      admin: { variant: 'destructive', className: '' },
      manager: { variant: 'default', className: 'bg-green-600 hover:bg-green-600' },
      employee: { variant: 'secondary', className: '' },
      attestation_coordinator: { variant: 'outline', className: 'bg-purple-600 text-white border-purple-600 hover:bg-purple-600' }
    };
    return styles[role] || { variant: 'secondary', className: '' };
  };

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

            {isAdmin && (
              <UserBulkActions
                selectedIds={selectedUserIds}
                currentUserId={user?.id}
                onClearSelection={clearUserSelection}
                onUsersUpdated={fetchUsers}
              />
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
                        <Badge variant={getRoleBadgeProps(u.role).variant} className={cn("uppercase", getRoleBadgeProps(u.role).className)}>{u.role}</Badge>
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
                        <Button variant="ghost" size="icon" onClick={() => setEditingUser(u)}><Edit className="h-4 w-4" /></Button>
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
                            <Badge variant={getRoleBadgeProps(u.role).variant} className={cn("uppercase", getRoleBadgeProps(u.role).className)}>{u.role}</Badge>
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
                              <Button variant="ghost" size="icon" onClick={() => setEditingUser(u)}>
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
        <EditUserDialog
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUserUpdated={fetchUsers}
        />
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
        <AddUserDialog
          open={addUserDialogOpen}
          onOpenChange={setAddUserDialogOpen}
          onUserAdded={fetchUsers}
        />
      )}
    </div>
  );
};

export default UserManagement;
