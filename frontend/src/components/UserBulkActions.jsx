import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles, Loader2 } from 'lucide-react';

/**
 * Bulk actions toolbar for selected users.
 * Provides role update and delete functionality for multiple users at once.
 */
export default function UserBulkActions({
  selectedIds,
  currentUserId,
  onClearSelection,
  onUsersUpdated,
}) {
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const [bulkRole, setBulkRole] = useState('');
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedCount = selectedIds.size;

  // Filter out current user from operations
  const getOperableIds = () => Array.from(selectedIds).filter((id) => id !== currentUserId);

  const handleBulkRoleUpdate = async () => {
    const ids = getOperableIds();
    if (!ids.length || !bulkRole) return;

    setUpdating(true);
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
      onClearSelection();
      if (onUsersUpdated) onUsersUpdated();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = getOperableIds();
    if (!ids.length) return;

    setDeleting(true);
    try {
      for (const id of ids) {
        const response = await fetch(`/api/auth/users/${id}`, {
          method: 'DELETE',
          headers: { ...getAuthHeaders() }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to delete user');
      }
      toast({ title: "Success", description: `Deleted ${ids.length} user${ids.length === 1 ? '' : 's'}`, variant: "success" });
      onClearSelection();
      if (onUsersUpdated) onUsersUpdated();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 rounded-lg border px-2 py-1.5 bg-muted/50">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{selectedCount} selected</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={bulkRole} onValueChange={setBulkRole}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Bulk role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="employee">Employee</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="attestation_coordinator">Attestation Coordinator</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={handleBulkRoleUpdate} disabled={!bulkRole || updating}>
          {updating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Apply role
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={handleBulkDelete}
          disabled={deleting}
        >
          {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Delete
        </Button>
        <Button size="sm" variant="ghost" onClick={onClearSelection}>Clear</Button>
      </div>
    </div>
  );
}
