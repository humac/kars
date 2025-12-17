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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'returned', label: 'Returned' },
  { value: 'lost', label: 'Lost' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'retired', label: 'Retired' },
];

export default function AssetEditModal({ asset, currentUser, onClose, onSaved }) {
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();

  // Only status can be changed after asset is registered
  const [status, setStatus] = useState(asset.status || 'active');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      // Merge status with existing asset data to satisfy backend validation
      const payload = {
        ...asset, // Include all existing fields
        status: status,
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
        description: "Asset status updated successfully",
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
      <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[90vh] sm:max-h-none">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Edit Asset</DialogTitle>
          <DialogDescription className="text-sm">
            Update the status of this asset.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto sm:overflow-visible space-y-4">
          {/* Read-only Summary Section */}
          <div className="rounded-md bg-muted/50 p-3 sm:p-4 space-y-3 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
              <div>
                <span className="font-medium text-muted-foreground">Asset Tag:</span>
                <div className="font-semibold">{asset.asset_tag || 'N/A'}</div>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Serial Number:</span>
                <div className="font-semibold">{asset.serial_number || 'N/A'}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
              <div>
                <span className="font-medium text-muted-foreground">Asset Type:</span>
                <div className="capitalize">{asset.asset_type === 'mobile_phone' ? 'Mobile Phone' : asset.asset_type || 'N/A'}</div>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Make/Model:</span>
                <div>{asset.make || 'N/A'} {asset.model || ''}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
              <div>
                <span className="font-medium text-muted-foreground">Company:</span>
                <div>{asset.company_name || 'N/A'}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
              <div>
                <span className="font-medium text-muted-foreground">Employee:</span>
                <div className="break-words">{asset.employee_first_name && asset.employee_last_name ? `${asset.employee_first_name} ${asset.employee_last_name}` : 'N/A'}</div>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Employee Email:</span>
                <div className="text-xs break-all">{asset.employee_email || 'N/A'}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
              <div>
                <span className="font-medium text-muted-foreground">Manager:</span>
                <div>{asset.manager_first_name && asset.manager_last_name ? `${asset.manager_first_name} ${asset.manager_last_name}` : 'N/A'}</div>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Manager Email:</span>
                <div className="text-xs break-all">{asset.manager_email || 'N/A'}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
              <div>
                <span className="font-medium text-muted-foreground">Registered:</span>
                <div>{formatDate(asset.registration_date)}</div>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Last Updated:</span>
                <div>{formatDate(asset.last_updated)}</div>
              </div>
            </div>
            {asset.notes && (
              <div>
                <span className="font-medium text-muted-foreground">Notes:</span>
                <div className="text-xs mt-1">{asset.notes}</div>
              </div>
            )}
          </div>

          {/* Editable Field - Status Only */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={status}
              onValueChange={setStatus}
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
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
