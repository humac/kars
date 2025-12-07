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
import { Loader2, AlertCircle } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'returned', label: 'Returned' },
  { value: 'lost', label: 'Lost' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'retired', label: 'Retired' },
];

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AssetEditModal({ asset, currentUser, onClose, onSaved }) {
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  
  // Initialize form with only editable fields
  const [form, setForm] = useState({ 
    status: asset.status || 'active',
    manager_name: asset.manager_name || '',
    manager_email: asset.manager_email || '',
    notes: asset.notes || '',
  });
  
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState('');

  function onChange(e) {
    const { name, value } = e.target;
    
    // Apply max length constraints
    let finalValue = value;
    if (name === 'manager_name' && value.length > 100) {
      finalValue = value.slice(0, 100);
    } else if (name === 'notes' && value.length > 1000) {
      finalValue = value.slice(0, 1000);
    }
    
    setForm(prev => ({ ...prev, [name]: finalValue }));
    
    // Validate email on change
    if (name === 'manager_email') {
      if (finalValue && !EMAIL_REGEX.test(finalValue)) {
        setEmailError('Please enter a valid email address');
      } else {
        setEmailError('');
      }
    }
  }

  async function save() {
    // Validate email before saving
    if (form.manager_email && !EMAIL_REGEX.test(form.manager_email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setSaving(true);
    try {
      // Merge editable fields with existing asset data to satisfy backend validation
      // The backend requires all fields, but we only want to update these 4
      const payload = {
        ...asset, // Include all existing fields
        status: form.status,
        manager_name: form.manager_name,
        manager_email: form.manager_email,
        notes: form.notes,
      };

      const res = await fetch(`/api/assets/${asset.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload),
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

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Edit Asset</DialogTitle>
          <DialogDescription>
            Update manager information, status, and notes for this asset.
          </DialogDescription>
        </DialogHeader>

        {/* Read-only Summary Section */}
        <div className="rounded-md bg-muted/50 p-3 space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-medium text-muted-foreground">Asset Tag:</span>
              <div className="font-semibold">{asset.laptop_asset_tag || 'N/A'}</div>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Serial Number:</span>
              <div className="font-semibold">{asset.laptop_serial_number || 'N/A'}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-medium text-muted-foreground">Type:</span>
              <div>{asset.laptop_make || 'N/A'} {asset.laptop_model || ''}</div>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Location:</span>
              <div>{asset.company_name || 'N/A'}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-medium text-muted-foreground">Employee:</span>
              <div>{asset.employee_name || 'N/A'}</div>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Registered:</span>
              <div>{formatDate(asset.registration_date)}</div>
            </div>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select 
              value={form.status} 
              onValueChange={(value) => setForm(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manager_name">Manager Name</Label>
            <Input 
              id="manager_name" 
              name="manager_name" 
              value={form.manager_name} 
              onChange={onChange}
              maxLength={100}
              placeholder="Enter manager name"
            />
            <div className="text-xs text-muted-foreground text-right">
              {form.manager_name.length}/100
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manager_email">Manager Email</Label>
            <Input 
              id="manager_email" 
              name="manager_email" 
              type="email"
              value={form.manager_email} 
              onChange={onChange}
              placeholder="manager@example.com"
              className={emailError ? 'border-destructive' : ''}
            />
            {emailError && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{emailError}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea 
              id="notes" 
              name="notes" 
              value={form.notes} 
              onChange={onChange}
              rows={4}
              maxLength={1000}
              placeholder="Add any additional notes..."
            />
            <div className="text-xs text-muted-foreground text-right">
              {form.notes.length}/1000
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving || !!emailError}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
