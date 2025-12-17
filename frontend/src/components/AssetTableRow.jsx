import React, { memo } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
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
 * Memoized table row component for assets (desktop view)
 * Only re-renders when props change
 */
const AssetTableRow = memo(function AssetTableRow({
  asset,
  isSelected,
  canEdit,
  canDelete,
  onToggleSelect,
  onEdit,
  onDelete,
}) {
  const status = (asset.status || '').toLowerCase();

  return (
    <TableRow
      data-state={isSelected ? 'selected' : undefined}
      className={cn(isSelected && 'bg-primary/5 border-primary/40')}
    >
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          aria-label={`Select ${formatEmployeeName(asset, 'asset')}`}
        />
      </TableCell>
      <TableCell>
        <div className="font-medium">
          {formatEmployeeName(asset, 'N/A')}
        </div>
        <div className="text-sm text-muted-foreground">
          {asset.employee_email || 'N/A'}
        </div>
      </TableCell>
      <TableCell className="hidden xl:table-cell">
        <div className="font-medium">
          {asset._managerDisplayName || '-'}
        </div>
        {asset._managerEmail && (
          <div className="text-sm text-muted-foreground">
            {asset._managerEmail}
          </div>
        )}
      </TableCell>
      <TableCell className="hidden lg:table-cell">{asset.company_name || '-'}</TableCell>
      <TableCell className="hidden xl:table-cell capitalize">
        {asset.asset_type === 'mobile_phone' ? 'Mobile Phone' : asset.asset_type || '-'}
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        {asset.make && asset.model ? `${asset.make} ${asset.model}` : '-'}
      </TableCell>
      <TableCell className="hidden 2xl:table-cell">{asset.asset_tag || '-'}</TableCell>
      <TableCell className="font-mono text-sm">{asset.serial_number || '-'}</TableCell>
      <TableCell>
        <Badge variant={statusVariants[status] || 'outline'} className="capitalize">
          {asset.status || 'unknown'}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
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
  );
});

export default AssetTableRow;
