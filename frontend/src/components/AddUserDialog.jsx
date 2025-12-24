import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const initialFormState = {
  email: '',
  first_name: '',
  last_name: '',
  password: '',
  role: 'employee',
  manager_first_name: '',
  manager_last_name: '',
  manager_email: ''
};

/**
 * Dialog for creating a new user account.
 * Handles form validation, user creation via API, and optional role assignment.
 */
export default function AddUserDialog({ open, onOpenChange, onUserAdded }) {
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState(initialFormState);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    // Validation
    if (!form.email || !form.password || !form.first_name || !form.last_name) {
      toast({ title: "Missing info", description: "Email, password, first name, and last name are required", variant: "destructive" });
      return;
    }

    if (form.password.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    // Manager fields are optional, but if any is provided, all must be provided
    const hasAnyManagerField = form.manager_first_name || form.manager_last_name || form.manager_email;
    if (hasAnyManagerField) {
      if (!form.manager_first_name || !form.manager_last_name || !form.manager_email) {
        toast({ title: "Incomplete manager info", description: "If providing manager info, all fields (first name, last name, email) are required", variant: "destructive" });
        return;
      }
    }

    setLoading(true);

    try {
      // Build payload
      const payload = {
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
      };

      // Only include manager fields if they're all provided
      if (hasAnyManagerField) {
        payload.manager_first_name = form.manager_first_name;
        payload.manager_last_name = form.manager_last_name;
        payload.manager_email = form.manager_email;
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
      if (form.role !== 'employee' && data.user?.id) {
        const roleResponse = await fetch(`/api/auth/users/${data.user.id}/role`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ role: form.role })
        });
        if (!roleResponse.ok) {
          const roleData = await roleResponse.json();
          throw new Error(roleData.error || 'User created but failed to set role');
        }
      }

      toast({ title: "Success", description: `User ${form.email} created successfully`, variant: "success" });
      onOpenChange(false);
      setForm(initialFormState);
      if (onUserAdded) onUserAdded();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen) => {
    if (!newOpen) {
      setForm(initialFormState);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="user@company.com"
                className="text-base"
              />
            </div>
            <div>
              <Label htmlFor="add-password">Password *</Label>
              <Input
                id="add-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
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
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                placeholder="John"
                className="text-base"
              />
            </div>
            <div>
              <Label htmlFor="add-last-name">Last Name *</Label>
              <Input
                id="add-last-name"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                placeholder="Doe"
                className="text-base"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="add-role">Role *</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
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
                  value={form.manager_first_name}
                  onChange={(e) => setForm({ ...form, manager_first_name: e.target.value })}
                  placeholder="Jane"
                  className="text-base"
                />
              </div>
              <div>
                <Label htmlFor="add-manager-last">Manager Last Name</Label>
                <Input
                  id="add-manager-last"
                  value={form.manager_last_name}
                  onChange={(e) => setForm({ ...form, manager_last_name: e.target.value })}
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
                value={form.manager_email}
                onChange={(e) => setForm({ ...form, manager_email: e.target.value })}
                placeholder="manager@company.com"
                className="text-base"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} className="w-full sm:w-auto">Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="w-full sm:w-auto">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
