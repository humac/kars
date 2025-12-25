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
import { Download, Sparkles, Loader2 } from 'lucide-react';

/**
 * Bulk actions toolbar and dialog for selected assets.
 * Displays selection count and provides bulk edit, export, and delete functionality.
 * Role-aware: delete only shown to admins, bulk edit shown to admins and asset owners.
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
      {/* Results Count and Bulk Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">
            Showing {filteredAssets.length} assets
          </div>
          {allAssets && allAssets.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAll}
              className="h-7"
            >
              <Download className="h-3 w-3 mr-1" />
              Export All ({allAssets.length})
            </Button>
          )}
          {filteredAssets.length > 0 && hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportFiltered}
              className="h-7"
            >
              <Download className="h-3 w-3 mr-1" />
              Export Filtered ({filteredAssets.length})
            </Button>
          )}
        </div>
        {selectedCount > 0 && (
          <div className="flex items-center gap-2 sm:gap-3 rounded-lg border px-3 py-1.5 bg-muted/50">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium whitespace-nowrap">{selectedCount} selected</span>
            </div>
            <div className="flex items-center gap-1">
              {canBulkEdit && (
                <Button variant="ghost" size="sm" onClick={() => setBulkDialogOpen(true)}>Bulk edit</Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleExportSelected}>
                <Download className="h-4 w-4 mr-1" />Export
              </Button>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleBulkDelete}
                  disabled={formLoading}
                >
                  Delete
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={onClearSelection}>Clear</Button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk edit selected assets</DialogTitle>
            <DialogDescription>Update status for {selectedCount} asset{selectedCount === 1 ? '' : 's'}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-status">Status</Label>
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
              />
              <p className="text-xs text-muted-foreground">This will update status for {selectedCount} asset{selectedCount === 1 ? '' : 's'}.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleBulkStatusUpdate} disabled={formLoading || !bulkStatus.trim()}>
                {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Apply changes
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
