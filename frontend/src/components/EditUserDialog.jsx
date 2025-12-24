import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

/**
 * Dialog for editing user attributes (name and manager information).
 * Opens when a user object is provided, closes when set to null.
 */
export default function EditUserDialog({ user, onClose, onUserUpdated }) {
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    manager_first_name: '',
    manager_last_name: '',
    manager_email: ''
  });
  const [saving, setSaving] = useState(false);

  // Initialize form when user changes
  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        manager_first_name: user.manager_first_name || '',
        manager_last_name: user.manager_last_name || '',
        manager_email: user.manager_email || ''
      });
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;

    if (!form.first_name || !form.last_name) {
      toast({ title: "Missing info", description: "First and last name are required", variant: "destructive" });
      return;
    }

    if (!form.manager_first_name || !form.manager_last_name || !form.manager_email) {
      toast({ title: "Missing info", description: "Manager first name, last name, and email are required", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/auth/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(form)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update user');

      toast({ title: "Success", description: `Updated ${user.email}`, variant: "success" });
      onClose();
      if (onUserUpdated) onUserUpdated();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
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
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                placeholder="First name"
                className="text-base"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Last Name</label>
              <Input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                placeholder="Last name"
                className="text-base"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Manager First Name</label>
              <Input
                value={form.manager_first_name}
                onChange={(e) => setForm({ ...form, manager_first_name: e.target.value })}
                placeholder="First name"
                className="text-base"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Manager Last Name</label>
              <Input
                value={form.manager_last_name}
                onChange={(e) => setForm({ ...form, manager_last_name: e.target.value })}
                placeholder="Last name"
                className="text-base"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Manager Email</label>
            <Input
              value={form.manager_email}
              onChange={(e) => setForm({ ...form, manager_email: e.target.value })}
              placeholder="manager@example.com"
              type="email"
              className="text-base"
            />
          </div>
          {user && (
            <p className="text-xs text-muted-foreground">Editing: {user.email}</p>
          )}
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} className="w-full sm:w-auto">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
