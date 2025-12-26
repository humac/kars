import React, { memo, useState } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
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
import { Edit, Trash2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
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
 * Memoized table row component for assets (desktop view)
 * Features expandable details and inline status editing
 */
const AssetTableRow = memo(function AssetTableRow({
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

  const handleStatusChange = async () => {
    // Validate returned_date is required when status is 'returned'
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
      // Reset to current values when opening
      setPendingStatus(asset.status || 'active');
      setReturnedDate(asset.returned_date || '');
    }
  };

  return (
    <>
      <TableRow
        data-state={isSelected ? 'selected' : undefined}
        className={cn(
          isSelected && 'bg-primary/5 border-primary/40',
          isExpanded && 'border-b-0'
        )}
      >
        {/* Checkbox */}
        <TableCell className="w-12">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            aria-label={`Select ${formatEmployeeName(asset, 'asset')}`}
          />
        </TableCell>

        {/* Expand toggle */}
        <TableCell className="w-10 px-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>

        {/* Employee (Owner) */}
        <TableCell>
          <div className="font-medium">
            {formatEmployeeName(asset, 'N/A')}
          </div>
          <div className="text-sm text-muted-foreground">
            {asset.employee_email || 'N/A'}
          </div>
        </TableCell>

        {/* Company */}
        <TableCell className="hidden lg:table-cell">
          {asset.company_name || '-'}
        </TableCell>

        {/* Type */}
        <TableCell className="hidden md:table-cell capitalize">
          {asset.asset_type === 'mobile_phone' ? 'Mobile Phone' : asset.asset_type || '-'}
        </TableCell>

        {/* Asset Tag */}
        <TableCell className="hidden xl:table-cell">
          {asset.asset_tag || '-'}
        </TableCell>

        {/* Serial Number */}
        <TableCell>
          {asset.serial_number || '-'}
        </TableCell>

        {/* Status - with inline edit capability */}
        <TableCell>
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
              <PopoverContent className="w-64" align="start">
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
                      <Label htmlFor={`returned-date-${asset.id}`}>
                        Returned Date *
                      </Label>
                      <Input
                        id={`returned-date-${asset.id}`}
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
        </TableCell>

        {/* Actions */}
        <TableCell className="text-right pr-4">
          <div className="flex justify-end gap-1">
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
        </TableCell>
      </TableRow>

      {/* Expanded Details Row */}
      {isExpanded && (
        <TableRow className={cn(
          'bg-muted/30 hover:bg-muted/30',
          isSelected && 'bg-primary/5'
        )}>
          <TableCell colSpan={9} className="py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm px-2">
              {/* Manager */}
              <div>
                <span className="text-muted-foreground text-xs block">Manager</span>
                <div className="font-medium">
                  {asset._managerDisplayName || '-'}
                </div>
                {asset._managerEmail && (
                  <div className="text-xs text-muted-foreground">
                    {asset._managerEmail}
                  </div>
                )}
              </div>

              {/* Make/Model */}
              <div>
                <span className="text-muted-foreground text-xs block">Make/Model</span>
                <div className="font-medium">
                  {asset.make && asset.model ? `${asset.make} ${asset.model}` :
                   asset.make || asset.model || '-'}
                </div>
              </div>

              {/* Issued Date */}
              <div>
                <span className="text-muted-foreground text-xs block">Issued Date</span>
                <div className="font-medium">{formatDate(asset.issued_date)}</div>
              </div>

              {/* Returned Date */}
              <div>
                <span className="text-muted-foreground text-xs block">Returned Date</span>
                <div className="font-medium">{formatDate(asset.returned_date)}</div>
              </div>

              {/* Created Date */}
              <div>
                <span className="text-muted-foreground text-xs block">Created</span>
                <div className="font-medium">{formatDate(asset.registration_date || asset.created_at)}</div>
              </div>

              {/* Last Modified */}
              <div>
                <span className="text-muted-foreground text-xs block">Last Modified</span>
                <div className="font-medium">{formatDate(asset.last_updated || asset.updated_at)}</div>
              </div>

              {/* Notes - spans full width if present */}
              {asset.notes && (
                <div className="col-span-2 md:col-span-4 lg:col-span-6 mt-2">
                  <span className="text-muted-foreground text-xs block">Notes</span>
                  <div className="text-sm mt-1">{asset.notes}</div>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
});

export default AssetTableRow;
