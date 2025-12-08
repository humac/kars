import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUsers } from '../contexts/UsersContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import TablePaginationControls from '@/components/TablePaginationControls';
import AssetRegisterModal from '@/components/AssetRegisterModal';
import AssetBulkImportModal from '@/components/AssetBulkImportModal';
import { Laptop, Search, Edit, Trash2, Sparkles, Loader2, Plus, Upload, Download } from 'lucide-react';

export default function AssetTable({ assets = [], onEdit, onDelete, currentUser, onRefresh, onAssetAdded }) {
  const { getAuthHeaders } = useAuth();
  const { getFullName, getEmail } = useUsers();
  const { toast } = useToast();
  const [deleteDialog, setDeleteDialog] = useState({ open: false, asset: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkNote, setBulkNote] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);

  async function handleDeleteConfirm() {
    const asset = deleteDialog.asset;
    setDeleteDialog({ open: false, asset: null });
    
    try {
      const res = await fetch(`/api/assets/${asset.id}`, { 
        method: 'DELETE',
        headers: { ...getAuthHeaders() }
      });
      if (!res.ok) throw new Error('Delete failed');
      
      toast({
        title: "Success",
        description: "Asset deleted successfully",
        variant: "success",
      });
      onDelete(asset.id);
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: 'Unable to delete asset.',
        variant: "destructive",
      });
    }
  }

  const canEdit = (asset) => {
    if (currentUser?.roles?.includes('admin')) return true;
    if (currentUser?.roles?.includes('editor')) return true;
    return false;
  };

  const canDelete = (asset) => {
    // Admin can delete any asset
    if (currentUser?.roles?.includes('admin')) return true;
    // Users can only delete their own assets
    if (currentUser?.email === asset.employee_email) return true;
    return false;
  };

  // Helper to get manager display name - handles three cases:
  // 1. manager_first_name/manager_last_name (preferred)
  // 2. manager_id resolved via UsersContext
  // 3. fallback to null
  const getManagerDisplayName = (asset) => {
    // Case 1: Prefer denormalized fields if present
    if (asset.manager_first_name && asset.manager_last_name) {
      return `${asset.manager_first_name} ${asset.manager_last_name}`;
    }
    if (asset.manager_first_name || asset.manager_last_name) {
      return (asset.manager_first_name || asset.manager_last_name).trim();
    }
    
    // Case 2: Fallback to resolving via manager_id
    if (asset.manager_id) {
      const name = getFullName(asset.manager_id);
      if (name) return name;
    }
    
    // Case 3: No name available
    return null;
  };

  // Helper to get manager email - handles three cases:
  // 1. manager_email (preferred)
  // 2. manager_id resolved via UsersContext
  // 3. fallback to null
  const getManagerEmail = (asset) => {
    // Case 1: Prefer denormalized field if present
    if (asset.manager_email) {
      return asset.manager_email;
    }
    
    // Case 2: Fallback to resolving via manager_id
    if (asset.manager_id) {
      const email = getEmail(asset.manager_id);
      if (email) return email;
    }
    
    // Case 3: No email available
    return null;
  };

  // Enhance assets with computed manager data for efficient rendering
  const assetsWithManagerData = useMemo(() => {
    return assets.map(asset => ({
      ...asset,
      _managerDisplayName: getManagerDisplayName(asset),
      _managerEmail: getManagerEmail(asset)
    }));
  }, [assets, getFullName, getEmail]);

  // Filter assets based on search term and status
  const filteredAssets = useMemo(() => {
    let filtered = [...assetsWithManagerData];
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((asset) => {
        const fullName = `${asset.employee_first_name || ''} ${asset.employee_last_name || ''}`.toLowerCase();
        const managerName = (asset._managerDisplayName || '').toLowerCase();
        const managerEmail = (asset._managerEmail || '').toLowerCase();
        return fullName.includes(term) ||
          asset.employee_email?.toLowerCase().includes(term) ||
          managerName.includes(term) ||
          managerEmail.includes(term) ||
          asset.laptop_serial_number?.toLowerCase().includes(term) ||
          asset.laptop_asset_tag?.toLowerCase().includes(term) ||
          asset.company_name?.toLowerCase().includes(term) ||
          asset.laptop_make?.toLowerCase().includes(term) ||
          asset.laptop_model?.toLowerCase().includes(term);
      });
    }

    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(asset => asset.status === statusFilter);
    }

    return filtered;
  }, [assetsWithManagerData, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize) || 1);
  
  useEffect(() => {
    setPage(1);
  }, [pageSize, filteredAssets.length]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedAssets = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAssets.slice(start, start + pageSize);
  }, [filteredAssets, page, pageSize]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const pageIds = paginatedAssets.map((a) => a.id);
      const hasAll = pageIds.every((id) => prev.has(id));
      const next = new Set(prev);
      pageIds.forEach((id) => {
        if (hasAll) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

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
      clearSelection();
      if (onRefresh) onRefresh();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setFormLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setFormLoading(true);
    try {
      for (const id of ids) {
        const response = await fetch(`/api/assets/${id}`, { method: 'DELETE', headers: { ...getAuthHeaders() } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to delete asset');
      }
      toast({ title: "Success", description: `Deleted ${ids.length} asset${ids.length === 1 ? '' : 's'}`, variant: "success" });
      clearSelection();
      ids.forEach(id => onDelete(id));
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setFormLoading(false);
    }
  };

  const handleExportSelected = () => {
    const selectedAssets = assets.filter(a => selectedIds.has(a.id));
    const headers = [
      'employee_first_name',
      'employee_last_name',
      'employee_email',
      'manager_first_name',
      'manager_last_name',
      'manager_email',
      'company_name',
      'laptop_make',
      'laptop_model',
      'laptop_serial_number',
      'laptop_asset_tag',
      'status',
      'registration_date',
      'notes',
    ];

    const csvContent = [
      headers.join(','),
      ...selectedAssets.map(asset =>
        headers.map(h => `"${(asset[h] || '').toString().replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `assets_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const isAllSelected = paginatedAssets.length > 0 && paginatedAssets.every((a) => selectedIds.has(a.id));
  const isSomeSelected = paginatedAssets.some((a) => selectedIds.has(a.id)) && !isAllSelected;

  const getStatusBadge = (status) => {
    const normalized = (status || '').toLowerCase();
    const variants = {
      active: 'success',
      returned: 'default',
      lost: 'destructive',
      damaged: 'warning',
      retired: 'secondary'
    };

    return (
      <Badge variant={variants[normalized] || 'outline'} className="capitalize">
        {status || 'unknown'}
      </Badge>
    );
  };

  const canRegister = () => {
    if (currentUser?.roles?.includes('admin')) return true;
    if (currentUser?.roles?.includes('editor')) return true;
    if (currentUser?.roles?.includes('user')) return true; // Employees can register assets for themselves
    return false;
  };

  const handleAssetRegistered = (newAsset) => {
    if (onAssetAdded) {
      onAssetAdded(newAsset);
    }
    if (onRefresh) {
      onRefresh();
    }
  };

  const handleBulkImported = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Action Buttons and Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md w-full">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search assets by name, email, manager, serial, tag..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {canRegister() && (
              <>
                {/* Only admins and editors can bulk import */}
                {(currentUser?.roles?.includes('admin') || currentUser?.roles?.includes('editor')) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBulkImportModal(true)}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Bulk Import
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => setShowRegisterModal(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Register Asset
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            All
          </Button>
          <Button
            variant={statusFilter === 'active' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('active')}
          >
            Active
          </Button>
          <Button
            variant={statusFilter === 'returned' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('returned')}
          >
            Returned
          </Button>
          <Button
            variant={statusFilter === 'lost' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('lost')}
          >
            Lost
          </Button>
          <Button
            variant={statusFilter === 'damaged' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('damaged')}
          >
            Damaged
          </Button>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 rounded-lg border px-3 py-2 bg-muted/50">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setBulkDialogOpen(true)}>Bulk edit</Button>
              <Button variant="ghost" size="sm" onClick={handleExportSelected}>
                <Download className="h-4 w-4 mr-2" />Export
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleBulkDelete}
              >
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
            </div>
          </div>
        )}

        {/* Table */}
        {filteredAssets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Laptop className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{assets.length === 0 ? 'No assets found. Get started by registering your first asset!' : 'No assets match your search or filters'}</p>
          </div>
        ) : (
          <>
            <div className="md:hidden space-y-3">
              {paginatedAssets.map((asset) => (
                <div
                  key={asset.id}
                  className={cn(
                    "border rounded-lg p-4 flex gap-3",
                    selectedIds.has(asset.id) && "bg-primary/5 border-primary/50 shadow-[0_0_0_1px_hsl(var(--primary))]"
                  )}
                >
                  <Checkbox
                    checked={selectedIds.has(asset.id)}
                    onCheckedChange={() => toggleSelect(asset.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium truncate">{asset.employee_first_name && asset.employee_last_name ? `${asset.employee_first_name} ${asset.employee_last_name}` : 'N/A'}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2">{asset.employee_email}</p>
                      </div>
                      {getStatusBadge(asset.status)}
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
                    <p className="text-sm text-muted-foreground mt-2">{asset.laptop_serial_number}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(asset)} disabled={!canEdit(asset)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteDialog({ open: true, asset })}
                      disabled={!canDelete(asset)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Table wrapperClassName="hidden md:block">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={isAllSelected ? true : isSomeSelected ? "indeterminate" : false}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden xl:table-cell">Manager Name</TableHead>
                  <TableHead className="hidden xl:table-cell">Manager Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Company</TableHead>
                  <TableHead className="hidden lg:table-cell">Laptop</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Serial Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAssets.map((asset) => (
                  <TableRow
                    key={asset.id}
                    data-state={selectedIds.has(asset.id) ? "selected" : undefined}
                    className={cn(selectedIds.has(asset.id) && "bg-primary/5 border-primary/40")}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(asset.id)}
                        onCheckedChange={() => toggleSelect(asset.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{asset.employee_first_name && asset.employee_last_name ? `${asset.employee_first_name} ${asset.employee_last_name}` : 'N/A'}</TableCell>
                    <TableCell className="text-muted-foreground">{asset.employee_email || 'N/A'}</TableCell>
                    <TableCell className="hidden xl:table-cell">{asset._managerDisplayName || '-'}</TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground">{asset._managerEmail || '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell">{asset.company_name || '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {asset.laptop_make && asset.laptop_model ? `${asset.laptop_make} ${asset.laptop_model}` : '-'}
                    </TableCell>
                    <TableCell className="hidden 2xl:table-cell font-mono text-sm">{asset.laptop_serial_number || '-'}</TableCell>
                    <TableCell>{getStatusBadge(asset.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(asset)}
                          disabled={!canEdit(asset)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteDialog({ open: true, asset })}
                          disabled={!canDelete(asset)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <TablePaginationControls
              className="mt-4"
              page={page}
              pageSize={pageSize}
              totalItems={filteredAssets.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk edit selected assets</DialogTitle>
            <DialogDescription>Update status for {selectedIds.size} asset{selectedIds.size === 1 ? '' : 's'}.</DialogDescription>
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
              <p className="text-xs text-muted-foreground">This will update status for {selectedIds.size} asset{selectedIds.size === 1 ? '' : 's'}.</p>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, asset: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog.asset?.employee_first_name} {deleteDialog.asset?.employee_last_name}"'s asset? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, asset: null })}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register Asset Modal */}
      {showRegisterModal && (
        <AssetRegisterModal
          onClose={() => setShowRegisterModal(false)}
          onRegistered={handleAssetRegistered}
        />
      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <AssetBulkImportModal
          onClose={() => setShowBulkImportModal(false)}
          onImported={handleBulkImported}
        />
      )}
    </>
  );
}
