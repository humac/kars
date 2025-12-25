import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const AssetViewModal = ({ asset, open = true, onClose }) => {
  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4">
            <span>Asset Details</span>
            <Badge variant="secondary">{(asset.status || '').toUpperCase()}</Badge>
          </DialogTitle>
          <DialogDescription className="mt-1">
            Read-only details for <span className="font-medium">{asset.employee_first_name && asset.employee_last_name ? `${asset.employee_first_name} ${asset.employee_last_name}` : 'N/A'}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-sm">
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs">Employee</div>
            <div className="font-medium">{asset.employee_first_name && asset.employee_last_name ? `${asset.employee_first_name} ${asset.employee_last_name}` : 'N/A'}</div>

            <div className="text-muted-foreground text-xs mt-2">Email</div>
            <div className="text-sm">{asset.employee_email || '-'}</div>

            <div className="text-muted-foreground text-xs mt-2">Company</div>
            <div className="text-sm">{asset.company_name || '-'}</div>
          </div>

          <div className="space-y-1">
            <div className="text-muted-foreground text-xs">Asset Tag</div>
            <div className="font-mono">{asset.asset_tag || asset.laptop_asset_tag || '-'}</div>

            <div className="text-muted-foreground text-xs mt-2">Serial</div>
            <div className="font-mono">{asset.serial_number || asset.laptop_serial_number || '-'}</div>

            <div className="text-muted-foreground text-xs mt-2">Manager</div>
            <div className="text-sm">{asset.manager_first_name && asset.manager_last_name ? `${asset.manager_first_name} ${asset.manager_last_name}` : '-'}</div>

            <div className="text-muted-foreground text-xs mt-2">Issued Date</div>
            <div className="text-sm">{asset.issued_date ? new Date(asset.issued_date).toLocaleDateString() : '-'}</div>

            {asset.returned_date && (
              <>
                <div className="text-muted-foreground text-xs mt-2">Returned Date</div>
                <div className="text-sm">{new Date(asset.returned_date).toLocaleDateString()}</div>
              </>
            )}
          </div>

          <div className="sm:col-span-2 mt-1">
            <div className="text-muted-foreground text-xs">Notes</div>
            <div className="text-sm max-h-36 overflow-auto">{asset.notes || '-'}</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssetViewModal;
