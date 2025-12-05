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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Users,
  Search,
  UserPlus,
  MoreVertical,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'employee', label: 'Employee' },
];

const statusBadge = (status) => {
  const variant = { pending: 'secondary', disabled: 'destructive', active: 'success' }[status] || 'secondary';
  const label = status?.toUpperCase() || 'PENDING';
  return <Badge variant={variant}>{label}</Badge>;
};

const TeamManagement = () => {
  const { getAuthHeaders, user } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'employee', message: '' });
  const [savingInvite, setSavingInvite] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', manager_name: '', manager_email: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/users', { headers: { ...getAuthHeaders() } });
      if (!response.ok) throw new Error('Failed to load team');
      const data = await response.json();
      setMembers(data);
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const getStatus = (member) => (member.status || member.is_disabled ? 'disabled' : 'active');

  const filteredMembers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return members.filter((m) => {
      const matchesSearch =
        m.name?.toLowerCase().includes(term) ||
        m.email?.toLowerCase().includes(term) ||
        m.manager_name?.toLowerCase().includes(term) ||
        m.manager_email?.toLowerCase().includes(term);

      const matchesRole = roleFilter === 'all' || m.role === roleFilter;
      const status = getStatus(m);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [members, searchTerm, roleFilter, statusFilter]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allIds = filteredMembers.map((m) => m.id);
      const hasAll = allIds.every((id) => prev.has(id));
      allIds.forEach((id) => { hasAll ? next.delete(id) : next.add(id); });
      return next;
    });
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      const response = await fetch(`/api/auth/users/${memberId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ role: newRole })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update role');
      toast({ title: 'Role updated', description: `Member now ${newRole}` });
      fetchMembers();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleBulkRole = async (newRole) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setSavingEdit(true);
    try {
      for (const id of ids) {
        const response = await fetch(`/api/auth/users/${id}/role`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ role: newRole })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update role');
      }
      toast({ title: 'Bulk updated', description: `Applied ${newRole} to ${ids.length} members.` });
      setSelectedIds(new Set());
      fetchMembers();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSavingEdit(false); }
  };

  const handleDelete = async (member) => {
    try {
      const response = await fetch(`/api/auth/users/${member.id}`, { method: 'DELETE', headers: { ...getAuthHeaders() } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to remove user');
      toast({ title: 'Removed', description: `${member.email} was removed.` });
      fetchMembers();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const openEditDialog = (member) => {
    setEditUser(member);
    setEditForm({
      first_name: member.first_name || '',
      last_name: member.last_name || '',
      manager_name: member.manager_name || '',
      manager_email: member.manager_email || ''
    });
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    setSavingEdit(true);
    try {
      const response = await fetch(`/api/auth/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(editForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update user');
      toast({ title: 'Updated', description: `Saved changes for ${editUser.email}` });
      setEditUser(null);
      fetchMembers();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSavingEdit(false); }
  };

  const handleInvite = async () => {
    setSavingInvite(true);
    try {
      const response = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(inviteForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send invite');
      toast({ title: 'Invite sent', description: `Invitation sent to ${inviteForm.email}` });
      setInviteOpen(false);
      setInviteForm({ email: '', role: 'employee', message: '' });
      fetchMembers();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSavingInvite(false); }
  };

  const roleChip = <Badge variant="secondary" className="uppercase">{user?.role}</Badge>;

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      {selectedIds.size > 0 && (
        <Select onValueChange={(v) => handleBulkRole(v)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Bulk role" /></SelectTrigger>
          <SelectContent>
            {roleOptions.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
          </SelectContent>
        </Select>
      )}
      <Button variant="outline" className="gap-2" onClick={() => setInviteOpen(true)}>
        <UserPlus className="h-4 w-4" /> Invite members
      </Button>
      <Button variant="ghost" className="gap-2" onClick={fetchMembers}>
        <Sparkles className="h-4 w-4" /> Refresh
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Team</CardTitle>
              {roleChip}
            </div>
            <CardDescription>Manage members, roles, and invites from a dedicated workspace.</CardDescription>
          </div>
          {headerActions}
        </CardHeader>
        <Separator />
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4 md:items-center">
            <div className="md:col-span-2 relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name, email, or manager"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roleOptions.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <>
              <div className="hidden md:block rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={filteredMembers.length > 0 && filteredMembers.every((m) => selectedIds.has(m.id))}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">No team members found.</TableCell>
                      </TableRow>
                    )}
                    {filteredMembers.map((member) => (
                      <TableRow key={member.id} data-state={selectedIds.has(member.id) ? 'selected' : undefined}>
                        <TableCell>
                          <Checkbox checked={selectedIds.has(member.id)} onCheckedChange={() => toggleSelect(member.id)} />
                        </TableCell>
                        <TableCell className="font-medium">{member.name || `${member.first_name || ''} ${member.last_name || ''}`.trim()}</TableCell>
                        <TableCell className="text-muted-foreground">{member.email}</TableCell>
                        <TableCell>
                          <Select value={member.role} onValueChange={(v) => handleRoleChange(member.id, v)} disabled={member.id === user?.id}>
                            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {roleOptions.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{statusBadge(getStatus(member))}</TableCell>
                        <TableCell className="text-muted-foreground">{member.last_login ? new Date(member.last_login).toLocaleDateString() : 'Never'}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(member)}>Edit details</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(member)} className="text-destructive">Remove</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden space-y-3">
                {filteredMembers.length === 0 && (
                  <div className="text-center text-muted-foreground border rounded-md py-6">No team members match these filters.</div>
                )}
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    className={cn(
                      'border rounded-lg p-4 flex gap-3',
                      selectedIds.has(member.id) && 'bg-primary/5 border-primary/40'
                    )}
                  >
                    <Checkbox
                      checked={selectedIds.has(member.id)}
                      onCheckedChange={() => toggleSelect(member.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>{member.name?.[0] || member.email?.[0]}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{member.name || member.email}</p>
                            <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                          </div>
                        </div>
                        {statusBadge(getStatus(member))}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="uppercase">{member.role}</Badge>
                        <span>Last active {member.last_login ? new Date(member.last_login).toLocaleDateString() : 'Never'}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Select value={member.role} onValueChange={(v) => handleRoleChange(member.id, v)}>
                        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(member)}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/40 border-dashed">
        <CardContent className="pt-4 flex items-start gap-3 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Inline role changes save automatically. Use the kebab menu for edits or removals. Invites send email with your message.
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite teammates</DialogTitle>
            <DialogDescription>Send an email invite with a predefined role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="teammate@company.com"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
            />
            <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({ ...inviteForm, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roleOptions.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <Textarea
              rows={3}
              placeholder="Optional message"
              value={inviteForm.message}
              onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={savingInvite} className="gap-2">
              {savingInvite && <Loader2 className="h-4 w-4 animate-spin" />}
              Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit member</DialogTitle>
            <DialogDescription>Update profile and reporting details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="First name"
              value={editForm.first_name}
              onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
            />
            <Input
              placeholder="Last name"
              value={editForm.last_name}
              onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
            />
            <Input
              placeholder="Manager name"
              value={editForm.manager_name}
              onChange={(e) => setEditForm({ ...editForm, manager_name: e.target.value })}
            />
            <Input
              placeholder="Manager email"
              value={editForm.manager_email}
              onChange={(e) => setEditForm({ ...editForm, manager_email: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={savingEdit} className="gap-2">
              {savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamManagement;
