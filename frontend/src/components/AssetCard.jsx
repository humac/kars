import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatEmployeeName } from '@/utils/user';

const statusVariants = {
  active: 'success',
  returned: 'default',
  lost: 'destructive',
  damaged: 'warning',
  retired: 'secondary'
};

/**
 * Memoized card component for assets (mobile view)
 * Only re-renders when props change
 */
const AssetCard = memo(function AssetCard({
  asset,
  isSelected,
  canEdit,
  canDelete,
  onToggleSelect,
  onEdit,
  onDelete,
}) {
  const status = (asset.status || '').toLowerCase();
  const employeeName = formatEmployeeName(asset, 'N/A');

  return (
    <div
      className={cn(
        'border rounded-lg p-4 flex gap-3',
        isSelected && 'bg-primary/5 border-primary/50 shadow-[0_0_0_1px_hsl(var(--primary))]'
      )}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggleSelect}
        className="mt-1"
        aria-label={`Select ${employeeName}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-medium truncate">{employeeName}</h4>
            <p className="text-sm text-muted-foreground line-clamp-2">{asset.employee_email}</p>
          </div>
          <Badge variant={statusVariants[status] || 'outline'} className="capitalize">
            {asset.status || 'unknown'}
          </Badge>
        </div>
        {(asset._managerDisplayName || asset._managerEmail) && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground">Manager:</p>
            {asset._managerDisplayName && (
              <p className="text-sm font-medium">{asset._managerDisplayName}</p>
            )}
            {asset._managerEmail && (
              <p className="text-sm text-muted-foreground">{asset._managerEmail}</p>
            )}
          </div>
        )}
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="capitalize">{asset.asset_type === 'mobile_phone' ? 'Mobile Phone' : asset.asset_type || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Make/Model</p>
            <p>{asset.make && asset.model ? `${asset.make} ${asset.model}` : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Asset Tag</p>
            <p>{asset.asset_tag || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Serial Number</p>
            <p className="font-mono">{asset.serial_number || '-'}</p>
          </div>
        </div>
      </div>
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
  );
});

export default AssetCard;
