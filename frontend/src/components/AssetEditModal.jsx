import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const ROLE_ALLOWED_FIELDS = {
  admin: ['employee_name', 'employee_email', 'company_name', 'laptop_make', 'laptop_model', 'laptop_serial_number', 'laptop_asset_tag', 'status', 'notes'],
  editor: ['employee_name', 'company_name', 'laptop_make', 'laptop_model', 'notes', 'status'],
  user: ['notes'],
};

function getAllowedFieldsForUser(user) {
  const roles = user?.roles || [];
  const allowed = new Set();
  roles.forEach(r => {
    (ROLE_ALLOWED_FIELDS[r] || []).forEach(f => allowed.add(f));
  });
  return Array.from(allowed);
}

export default function AssetEditModal({ asset, currentUser, onClose, onSaved }) {
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const allowedFields = getAllowedFieldsForUser(currentUser);
  const [form, setForm] = useState({ 
    ...asset, 
    notes: asset.notes || '',
    laptop_make: asset.laptop_make || '',
    laptop_model: asset.laptop_model || ''
  });
  const [saving, setSaving] = useState(false);

  function onChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Save failed');
      }
      const updated = await res.json();
      toast({
        title: "Success",
        description: "Asset updated successfully",
        variant: "success",
      });
      // The API returns { message, asset }, extract the asset
      onSaved(updated.asset || updated);
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: err.message || 'Unable to save asset.',
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Asset</DialogTitle>
          <DialogDescription>
            Update the asset information. Only fields you have permission to edit are shown.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {allowedFields.includes('employee_name') && (
            <div className="space-y-2">
              <Label htmlFor="employee_name">Employee Name</Label>
              <Input id="employee_name" name="employee_name" value={form.employee_name || ''} onChange={onChange} />
            </div>
          )}
          {allowedFields.includes('employee_email') && (
            <div className="space-y-2">
              <Label htmlFor="employee_email">Employee Email</Label>
              <Input id="employee_email" name="employee_email" type="email" value={form.employee_email || ''} onChange={onChange} />
            </div>
          )}
          {allowedFields.includes('company_name') && (
            <div className="space-y-2">
              <Label htmlFor="company_name">Company</Label>
              <Input id="company_name" name="company_name" value={form.company_name || ''} onChange={onChange} />
            </div>
          )}
          {allowedFields.includes('laptop_make') && (
            <div className="space-y-2">
              <Label htmlFor="laptop_make">Laptop Make</Label>
              <Input id="laptop_make" name="laptop_make" value={form.laptop_make || ''} onChange={onChange} />
            </div>
          )}
          {allowedFields.includes('laptop_model') && (
            <div className="space-y-2">
              <Label htmlFor="laptop_model">Laptop Model</Label>
              <Input id="laptop_model" name="laptop_model" value={form.laptop_model || ''} onChange={onChange} />
            </div>
          )}
          {allowedFields.includes('laptop_serial_number') && (
            <div className="space-y-2">
              <Label htmlFor="laptop_serial_number">Serial Number</Label>
              <Input id="laptop_serial_number" name="laptop_serial_number" value={form.laptop_serial_number || ''} onChange={onChange} />
            </div>
          )}
          {allowedFields.includes('laptop_asset_tag') && (
            <div className="space-y-2">
              <Label htmlFor="laptop_asset_tag">Asset Tag</Label>
              <Input id="laptop_asset_tag" name="laptop_asset_tag" value={form.laptop_asset_tag || ''} onChange={onChange} />
            </div>
          )}
          {allowedFields.includes('status') && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={form.status || ''} onValueChange={(value) => setForm(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {allowedFields.includes('notes') && (
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" value={form.notes || ''} onChange={onChange} rows={4} />
            </div>
          )}

          {allowedFields.length === 0 && (
            <div className="text-sm text-muted-foreground">You do not have permissions to edit any fields for this asset.</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={save}
            disabled={saving || allowedFields.length === 0}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
