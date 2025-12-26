import React, { memo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Edit, Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatEmployeeName } from '@/utils/user';
import { ASSET_STATUS_OPTIONS } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const statusVariants = {
  active: 'success',
  returned: 'default',
  lost: 'destructive',
  damaged: 'warning',
  retired: 'secondary'
};

/**
 * Format date for display
 */
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
};

/**
 * Memoized card component for assets (mobile view)
 * Features expandable details and inline status editing
 */
const AssetCard = memo(function AssetCard({
  asset,
  isSelected,
  canEdit,
  canDelete,
  onToggleSelect,
  onEdit,
  onDelete,
  onStatusUpdated,
}) {
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(asset.status || 'active');
  const [returnedDate, setReturnedDate] = useState(asset.returned_date || '');
  const [saving, setSaving] = useState(false);

  const status = (asset.status || '').toLowerCase();
  const employeeName = formatEmployeeName(asset, 'N/A');

  const handleStatusChange = async () => {
    if (pendingStatus === 'returned' && !returnedDate) {
      toast({
        title: "Validation Error",
        description: "Returned date is required when status is 'Returned'",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...asset,
        status: pendingStatus,
        returned_date: pendingStatus === 'returned' ? returnedDate : null,
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

      setStatusPopoverOpen(false);
      if (onStatusUpdated) {
        onStatusUpdated(updated.asset || updated);
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: err.message || 'Unable to update status.',
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePopoverOpenChange = (open) => {
    setStatusPopoverOpen(open);
    if (open) {
      setPendingStatus(asset.status || 'active');
      setReturnedDate(asset.returned_date || '');
    }
  };

  return (
    <div
      className={cn(
        'border rounded-lg p-4',
        isSelected && 'bg-primary/5 border-primary/50 shadow-[0_0_0_1px_hsl(var(--primary))]'
      )}
    >
      {/* Header row with checkbox, name, status, and actions */}
      <div className="flex gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          className="mt-1"
          aria-label={`Select ${employeeName}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium truncate">{employeeName}</h4>
              <p className="text-sm text-muted-foreground truncate">{asset.employee_email}</p>
            </div>
            {/* Status badge - clickable for inline edit */}
            {canEdit ? (
              <Popover open={statusPopoverOpen} onOpenChange={handlePopoverOpenChange}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 hover:bg-transparent"
                    aria-label="Change status"
                  >
                    <Badge
                      variant={statusVariants[status] || 'outline'}
                      className="capitalize cursor-pointer hover:opacity-80"
                    >
                      {asset.status || 'unknown'}
                    </Badge>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={pendingStatus}
                        onValueChange={(value) => {
                          setPendingStatus(value);
                          if (value !== 'returned') {
                            setReturnedDate('');
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSET_STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {pendingStatus === 'returned' && (
                      <div className="space-y-2">
                        <Label htmlFor={`returned-date-card-${asset.id}`}>
                          Returned Date *
                        </Label>
                        <Input
                          id={`returned-date-card-${asset.id}`}
                          type="date"
                          value={returnedDate}
                          onChange={(e) => setReturnedDate(e.target.value)}
                          required
                        />
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatusPopoverOpen(false)}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleStatusChange}
                        disabled={saving}
                      >
                        {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Badge variant={statusVariants[status] || 'outline'} className="capitalize">
                {asset.status || 'unknown'}
              </Badge>
            )}
          </div>

          {/* Key details row */}
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Company</p>
              <p className="font-medium truncate">{asset.company_name || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="capitalize">{asset.asset_type === 'mobile_phone' ? 'Mobile Phone' : asset.asset_type || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Asset Tag</p>
              <p>{asset.asset_tag || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Serial Number</p>
              <p>{asset.serial_number || '-'}</p>
            </div>
          </div>

          {/* Expandable details section */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Manager</p>
                <p className="font-medium">{asset._managerDisplayName || '-'}</p>
                {asset._managerEmail && (
                  <p className="text-xs text-muted-foreground">{asset._managerEmail}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Make/Model</p>
                <p>{asset.make && asset.model ? `${asset.make} ${asset.model}` : asset.make || asset.model || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Issued Date</p>
                <p>{formatDate(asset.issued_date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Returned Date</p>
                <p>{formatDate(asset.returned_date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p>{formatDate(asset.registration_date || asset.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Modified</p>
                <p>{formatDate(asset.last_updated || asset.updated_at)}</p>
              </div>
              {asset.notes && (
                <div className="col-span-2 mt-2">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm">{asset.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Expand/Collapse toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full text-muted-foreground hover:text-foreground"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show more
              </>
            )}
          </Button>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            disabled={!canEdit}
            aria-label="Edit asset"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={!canDelete}
            aria-label="Delete asset"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
});

export default AssetCard;
