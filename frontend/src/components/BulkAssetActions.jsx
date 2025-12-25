import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, Loader2, Edit, Trash2, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Consolidated bulk actions toolbar for assets.
 * Features: results count, unified export menu, and selection actions.
 */
export default function BulkAssetActions({
  selectedIds,
  filteredAssets,
  allAssets,
  hasActiveFilters,
  onClearSelection,
  onBulkDelete,
  onRefresh,
  currentUser,
}) {
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkNote, setBulkNote] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const selectedCount = selectedIds.size;
  const isAdmin = currentUser?.role === 'admin';
  const totalCount = allAssets?.length || 0;
  const filteredCount = filteredAssets?.length || 0;

  // Check if user can edit any of the selected assets (admin or owns them)
  const canBulkEdit = isAdmin || (currentUser?.email &&
    filteredAssets.some(a => selectedIds.has(a.id) &&
      a.employee_email?.toLowerCase() === currentUser.email.toLowerCase()));

  const handleBulkStatusUpdate = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length || !bulkStatus.trim()) return;
    setFormLoading(true);
    try {
      const response = await fetch('/api/assets/bulk/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ ids, status: bulkStatus, notes: bulkNote || undefined })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update assets');
      toast({ title: "Success", description: data.message, variant: "success" });
      setBulkDialogOpen(false);
      setBulkStatus('');
      setBulkNote('');
      onClearSelection();
      if (onRefresh) onRefresh();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setFormLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    setFormLoading(true);
    try {
      await onBulkDelete();
    } finally {
      setFormLoading(false);
    }
  };

  const exportAssetsToCSV = (assetsToExport, exportType = 'export') => {
    const headers = [
      'employee_first_name',
      'employee_last_name',
      'employee_email',
      'manager_first_name',
      'manager_last_name',
      'manager_email',
      'company_name',
      'asset_type',
      'make',
      'model',
      'serial_number',
      'asset_tag',
      'status',
      'registration_date',
      'notes',
    ];

    const csvContent = [
      headers.join(','),
      ...assetsToExport.map(asset =>
        headers.map(h => `"${(asset[h] || '').toString().replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `assets_${exportType}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast({
      title: "Export Complete",
      description: `Exported ${assetsToExport.length} asset${assetsToExport.length === 1 ? '' : 's'} to CSV`,
      variant: "success"
    });
  };

  const handleExportSelected = () => {
    const selectedAssets = filteredAssets.filter(a => selectedIds.has(a.id));
    exportAssetsToCSV(selectedAssets, 'selected');
  };

  const handleExportFiltered = () => {
    exportAssetsToCSV(filteredAssets, 'filtered');
  };

  const handleExportAll = () => {
    exportAssetsToCSV(allAssets || filteredAssets, 'all');
  };

  return (
    <>
      {/* Results Count and Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-2">
        {/* Left side: Results count */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {hasActiveFilters ? (
              <>
                <span className="font-medium text-foreground">{filteredCount}</span>
                {' '}of {totalCount} assets
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">{totalCount}</span>
                {' '}asset{totalCount === 1 ? '' : 's'}
              </>
            )}
          </span>

          {/* Export Dropdown */}
          {totalCount > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Export
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={handleExportAll}>
                  <Download className="h-4 w-4 mr-2" />
                  Export All ({totalCount})
                </DropdownMenuItem>
                {hasActiveFilters && filteredCount !== totalCount && (
                  <DropdownMenuItem onClick={handleExportFiltered}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Filtered ({filteredCount})
                  </DropdownMenuItem>
                )}
                {selectedCount > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleExportSelected}>
                      <Download className="h-4 w-4 mr-2" />
                      Export Selected ({selectedCount})
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Right side: Selection actions */}
        {selectedCount > 0 && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5",
              "bg-primary/5 border-primary/30"
            )}
          >
            <span className="text-sm font-medium">
              {selectedCount} selected
            </span>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1">
              {canBulkEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 gap-1.5"
                  onClick={() => setBulkDialogOpen(true)}
                >
                  <Edit className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleBulkDelete}
                  disabled={formLoading}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={onClearSelection}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Bulk Edit Assets</DialogTitle>
            <DialogDescription>
              Update status for {selectedCount} selected asset{selectedCount === 1 ? '' : 's'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-status">New Status</Label>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status..." />
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
            <div className="space-y-2">
              <Label htmlFor="bulk-note">Note (optional)</Label>
              <Textarea
                id="bulk-note"
                placeholder="Add a note for this bulk update..."
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkStatusUpdate}
              disabled={formLoading || !bulkStatus.trim()}
            >
              {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apply Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
