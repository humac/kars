import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '@/lib/utils';

// Shadcn/UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// Lucide Icons
import {
  Plus,
  Upload,
  Filter,
  X,
  Columns3,
  MoreHorizontal,
  Pencil,
  Trash2,
  Download,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  UserCog,
  Users,
  Sparkles,
} from 'lucide-react';

import AssetEditModal from './AssetEditModal';
import AssetRegistrationForm from './AssetRegistrationForm';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'returned', label: 'Returned' },
  { value: 'lost', label: 'Lost' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'retired', label: 'Retired' },
];

const getStatusVariant = (status) => {
  const variants = {
    active: 'success',
    returned: 'info',
    lost: 'destructive',
    damaged: 'warning',
    retired: 'secondary',
  };
  return variants[status] || 'secondary';
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const AssetList = ({ refresh, onAssetRegistered }) => {
  const { getAuthHeaders, user } = useAuth();

  // Data state
  const [assets, setAssets] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Modal state
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkManagerModal, setShowBulkManagerModal] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importResult, setImportResult] = useState(null);

  // Delete state
  const [assetToDelete, setAssetToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Bulk operations state
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkNote, setBulkNote] = useState('');
  const [bulkOperating, setBulkOperating] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [bulkManagerName, setBulkManagerName] = useState('');
  const [bulkManagerEmail, setBulkManagerEmail] = useState('');

  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    company: '',
  });

  // Column visibility state
  const [optionalColumns, setOptionalColumns] = useState(() => {
    const saved = localStorage.getItem('assetTableColumns');
    return saved ? JSON.parse(saved) : {
      make: true,
      model: true,
      registered: true,
      manager: false,
      managerEmail: false,
      notes: false,
    };
  });

  // Detect mobile view
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch assets
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/assets', {
        headers: { ...getAuthHeaders() },
      });
      if (!response.ok) throw new Error('Failed to fetch assets');
      const data = await response.json();
      setAssets(data);
      setFilteredAssets(data);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchAssets();
  }, [refresh, fetchAssets]);

  // Apply filters
  useEffect(() => {
    let filtered = [...assets];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(asset =>
        asset.employee_name?.toLowerCase().includes(searchLower) ||
        asset.employee_email?.toLowerCase().includes(searchLower) ||
        asset.laptop_serial_number?.toLowerCase().includes(searchLower) ||
        asset.laptop_asset_tag?.toLowerCase().includes(searchLower) ||
        asset.company_name?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.status) {
      filtered = filtered.filter(asset => asset.status === filters.status);
    }

    if (filters.company) {
      filtered = filtered.filter(asset =>
        asset.company_name?.toLowerCase().includes(filters.company.toLowerCase())
      );
    }

    setFilteredAssets(filtered);
  }, [assets, filters]);

  // Selection handlers
  const isAllSelected = filteredAssets.length > 0 &&
    filteredAssets.every(asset => selectedIds.has(asset.id));

  const isSomeSelected = filteredAssets.some(asset => selectedIds.has(asset.id)) &&
    !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAssets.map(a => a.id)));
    }
  };

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectedAssets = useMemo(() =>
    filteredAssets.filter(a => selectedIds.has(a.id)),
    [filteredAssets, selectedIds]
  );

  // Column toggle
  const toggleColumn = (columnName) => {
    const newColumns = { ...optionalColumns, [columnName]: !optionalColumns[columnName] };
    setOptionalColumns(newColumns);
    localStorage.setItem('assetTableColumns', JSON.stringify(newColumns));
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({ search: '', status: '', company: '' });
  };

  const hasActiveFilters = filters.search || filters.status || filters.company;

  // Edit handlers
  const handleEditAsset = (asset) => {
    setSelectedAsset(asset);
    setShowEditModal(true);
  };

  const handleEditModalClose = () => {
    setShowEditModal(false);
    setSelectedAsset(null);
  };

  const handleAssetUpdated = () => {
    fetchAssets();
    handleEditModalClose();
  };

  // Registration handlers
  const handleNewAssetClick = () => setShowRegistrationModal(true);
  const handleRegistrationModalClose = () => setShowRegistrationModal(false);

  const handleAssetRegistered = (asset) => {
    setShowRegistrationModal(false);
    fetchAssets();
    if (onAssetRegistered) onAssetRegistered(asset);
  };

  // Import handlers
  const handleImportAssets = async (e) => {
    e.preventDefault();
    setImportError(null);
    setImportResult(null);

    if (!importFile) {
      setImportError('Please select a CSV file to import.');
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);

      const response = await fetch('/api/assets/import', {
        method: 'POST',
        headers: { ...getAuthHeaders() },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to import assets');

      setImportResult(data);
      setImportFile(null);
      fetchAssets();
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleImportModalClose = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportError(null);
    setImportResult(null);
  };

  // Single delete handlers
  const handleDeleteClick = (asset) => {
    setAssetToDelete(asset);
    setShowDeleteConfirm(true);
    setDeleteError(null);
  };

  const handleDeleteConfirmClose = () => {
    setShowDeleteConfirm(false);
    setAssetToDelete(null);
    setDeleteError(null);
  };

  const handleDeleteAsset = async () => {
    if (!assetToDelete) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/assets/${assetToDelete.id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete asset');

      handleDeleteConfirmClose();
      fetchAssets();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Bulk status update
  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;

    setBulkOperating(true);
    setBulkError(null);

    try {
      const response = await fetch('/api/assets/bulk/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          status: bulkStatus,
          notes: bulkNote || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update assets');

      setShowBulkStatusModal(false);
      setBulkStatus('');
      setBulkNote('');
      setSelectedIds(new Set());
      fetchAssets();
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkOperating(false);
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (deleteConfirmText !== 'DELETE' || selectedIds.size === 0) return;

    setBulkOperating(true);
    setBulkError(null);

    try {
      const response = await fetch('/api/assets/bulk/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete assets');

      setShowBulkDeleteModal(false);
      setDeleteConfirmText('');
      setSelectedIds(new Set());
      fetchAssets();
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkOperating(false);
    }
  };

  // Bulk manager assignment
  const handleBulkManagerAssign = async () => {
    if (!bulkManagerName || !bulkManagerEmail || selectedIds.size === 0) return;

    setBulkOperating(true);
    setBulkError(null);

    try {
      const response = await fetch('/api/assets/bulk/manager', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          manager_name: bulkManagerName,
          manager_email: bulkManagerEmail,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to assign manager');

      setShowBulkManagerModal(false);
      setBulkManagerName('');
      setBulkManagerEmail('');
      setSelectedIds(new Set());
      fetchAssets();
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkOperating(false);
    }
  };

  // Export selected
  const handleExportSelected = () => {
    const headers = [
      'employee_name',
      'employee_email',
      'manager_name',
      'manager_email',
      'company_name',
      'laptop_serial_number',
      'laptop_asset_tag',
      'laptop_make',
      'laptop_model',
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

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span className="text-muted-foreground">Loading assets...</span>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Asset Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-xl font-semibold">
              Asset Inventory
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filteredAssets.length} assets)
              </span>
            </CardTitle>

            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Columns3 className="h-4 w-4 mr-2" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={optionalColumns.manager}
                    onCheckedChange={() => toggleColumn('manager')}
                  >
                    Manager Name
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={optionalColumns.managerEmail}
                    onCheckedChange={() => toggleColumn('managerEmail')}
                  >
                    Manager Email
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={optionalColumns.make}
                    onCheckedChange={() => toggleColumn('make')}
                  >
                    Make
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={optionalColumns.model}
                    onCheckedChange={() => toggleColumn('model')}
                  >
                    Model
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={optionalColumns.registered}
                    onCheckedChange={() => toggleColumn('registered')}
                  >
                    Registered Date
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={optionalColumns.notes}
                    onCheckedChange={() => toggleColumn('notes')}
                  >
                    Notes
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>

              <Button size="sm" onClick={handleNewAssetClick}>
                <Plus className="h-4 w-4 mr-2" />
                New Asset
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee, email, serial, asset tag..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-9"
              />
            </div>

            <Select
              value={filters.status}
              onValueChange={(value) => setFilters({ ...filters, status: value })}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Filter by company..."
              value={filters.company}
              onChange={(e) => setFilters({ ...filters, company: e.target.value })}
              className="w-full sm:w-48"
            />

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border px-3 py-2 bg-muted/50">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{selectedIds.size} selected</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBulkStatus('');
                    setBulkNote('');
                    setBulkError(null);
                    setShowBulkStatusModal(true);
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Update Status
                </Button>

                {user?.role === 'admin' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBulkManagerName('');
                      setBulkManagerEmail('');
                      setBulkError(null);
                      setShowBulkManagerModal(true);
                    }}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Assign Manager
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportSelected}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>

                {user?.role === 'admin' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDeleteConfirmText('');
                      setBulkError(null);
                      setShowBulkDeleteModal(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Assets Display */}
          {filteredAssets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No assets found matching your search criteria.
            </div>
          ) : isMobile ? (
            /* Mobile Card View */
            <div className="space-y-3">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  className={cn(
                    "border rounded-lg p-4 transition-colors",
                    selectedIds.has(asset.id) && "bg-primary/5 border-primary/30"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedIds.has(asset.id)}
                      onCheckedChange={() => toggleSelect(asset.id)}
                      className="mt-1"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium truncate">{asset.employee_name}</h4>
                        <Badge variant={getStatusVariant(asset.status)}>
                          {asset.status.toUpperCase()}
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground truncate">
                        {asset.employee_email}
                      </p>

                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <div>
                          <span className="text-muted-foreground">Asset Tag:</span>{' '}
                          <span className="font-mono">{asset.laptop_asset_tag}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Serial:</span>{' '}
                          <span className="font-mono">{asset.laptop_serial_number}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Company:</span>{' '}
                          {asset.company_name}
                        </div>
                        {optionalColumns.make && asset.laptop_make && (
                          <div>
                            <span className="text-muted-foreground">Make:</span>{' '}
                            {asset.laptop_make}
                          </div>
                        )}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditAsset(asset)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {(user?.role === 'admin' || asset.employee_email === user?.email) && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteClick(asset)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Desktop Table View */
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllSelected ? true : isSomeSelected ? "indeterminate" : false}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Asset Tag</TableHead>
                    <TableHead>Status</TableHead>
                    {optionalColumns.manager && <TableHead>Manager</TableHead>}
                    {optionalColumns.managerEmail && <TableHead>Manager Email</TableHead>}
                    {optionalColumns.make && <TableHead>Make</TableHead>}
                    {optionalColumns.model && <TableHead>Model</TableHead>}
                    {optionalColumns.registered && <TableHead>Registered</TableHead>}
                    {optionalColumns.notes && <TableHead>Notes</TableHead>}
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map((asset) => (
                    <TableRow
                      key={asset.id}
                      data-state={selectedIds.has(asset.id) ? "selected" : undefined}
                      className={cn(
                        selectedIds.has(asset.id) && "bg-primary/5"
                      )}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(asset.id)}
                          onCheckedChange={() => toggleSelect(asset.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{asset.employee_name}</TableCell>
                      <TableCell className="text-muted-foreground">{asset.employee_email || '-'}</TableCell>
                      <TableCell>{asset.company_name}</TableCell>
                      <TableCell className="font-mono text-sm">{asset.laptop_serial_number}</TableCell>
                      <TableCell className="font-mono text-sm">{asset.laptop_asset_tag}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(asset.status)}>
                          {asset.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      {optionalColumns.manager && (
                        <TableCell>{asset.manager_name || '-'}</TableCell>
                      )}
                      {optionalColumns.managerEmail && (
                        <TableCell className="text-muted-foreground">{asset.manager_email || '-'}</TableCell>
                      )}
                      {optionalColumns.make && (
                        <TableCell>{asset.laptop_make || '-'}</TableCell>
                      )}
                      {optionalColumns.model && (
                        <TableCell>{asset.laptop_model || '-'}</TableCell>
                      )}
                      {optionalColumns.registered && (
                        <TableCell>{formatDate(asset.registration_date)}</TableCell>
                      )}
                      {optionalColumns.notes && (
                        <TableCell className="max-w-[200px] truncate" title={asset.notes}>
                          {asset.notes || '-'}
                        </TableCell>
                      )}
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditAsset(asset)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {(user?.role === 'admin' || asset.employee_email === user?.email) && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteClick(asset)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Import Modal */}
      <Dialog open={showImportModal} onOpenChange={handleImportModalClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Assets from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file with your asset details. Download the example file to see the required columns.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                asChild
                className="flex-1"
              >
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  {importFile ? 'Change File' : 'Choose CSV File'}
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                </label>
              </Button>
              <Button variant="ghost" asChild>
                <a href="/import_assets.csv" download>
                  <Download className="h-4 w-4 mr-2" />
                  Example
                </a>
              </Button>
            </div>

            {importFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {importFile.name}
              </p>
            )}

            {importError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            )}

            {importResult && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{importResult.message}</AlertDescription>
              </Alert>
            )}

            {importResult?.errors?.length > 0 && (
              <div className="border rounded-lg p-3 max-h-40 overflow-auto">
                <p className="text-sm font-medium mb-2">Issues:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {importResult.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleImportModalClose}>
              Cancel
            </Button>
            <Button onClick={handleImportAssets} disabled={importing || !importFile}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {importing ? 'Importing...' : 'Import Assets'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Asset Registration Modal */}
      <Dialog open={showRegistrationModal} onOpenChange={handleRegistrationModalClose}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <AssetRegistrationForm onAssetRegistered={handleAssetRegistered} />
        </DialogContent>
      </Dialog>

      {/* Single Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={handleDeleteConfirmClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this asset? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {assetToDelete && (
            <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
              <p><span className="font-medium">Employee:</span> {assetToDelete.employee_name}</p>
              <p><span className="font-medium">Serial Number:</span> {assetToDelete.laptop_serial_number}</p>
              <p><span className="font-medium">Asset Tag:</span> {assetToDelete.laptop_asset_tag}</p>
            </div>
          )}

          {deleteError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleDeleteConfirmClose} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAsset} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Status Update Modal */}
      <Dialog open={showBulkStatusModal} onOpenChange={setShowBulkStatusModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Status for {selectedIds.size} Assets</DialogTitle>
            <DialogDescription>
              Select a new status to apply to all selected assets.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea
                placeholder="Add a note for this bulk update..."
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value)}
                rows={3}
              />
            </div>

            {bulkError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{bulkError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkStatusModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkStatusUpdate} disabled={bulkOperating || !bulkStatus}>
              {bulkOperating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {bulkOperating ? 'Updating...' : `Update ${selectedIds.size} Assets`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Modal */}
      <Dialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete {selectedIds.size} Assets?
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. All selected assets will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border rounded-lg p-3 max-h-40 overflow-auto">
              <p className="text-sm font-medium mb-2">Assets to be deleted:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {selectedAssets.slice(0, 10).map(asset => (
                  <li key={asset.id}>
                    {asset.laptop_asset_tag} ({asset.employee_name})
                  </li>
                ))}
                {selectedAssets.length > 10 && (
                  <li className="italic">...and {selectedAssets.length - 10} more</li>
                )}
              </ul>
            </div>

            <div className="space-y-2">
              <Label>Type "DELETE" to confirm:</Label>
              <Input
                placeholder="DELETE"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
              />
            </div>

            {bulkError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{bulkError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkOperating || deleteConfirmText !== 'DELETE'}
            >
              {bulkOperating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {bulkOperating ? 'Deleting...' : `Delete ${selectedIds.size} Assets`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Manager Assignment Modal */}
      <Dialog open={showBulkManagerModal} onOpenChange={setShowBulkManagerModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Manager to {selectedIds.size} Assets</DialogTitle>
            <DialogDescription>
              Enter the manager details to assign to all selected assets.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Manager Name</Label>
              <Input
                placeholder="Enter manager name..."
                value={bulkManagerName}
                onChange={(e) => setBulkManagerName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Manager Email</Label>
              <Input
                type="email"
                placeholder="Enter manager email..."
                value={bulkManagerEmail}
                onChange={(e) => setBulkManagerEmail(e.target.value)}
              />
            </div>

            {bulkError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{bulkError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkManagerModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkManagerAssign}
              disabled={bulkOperating || !bulkManagerName || !bulkManagerEmail}
            >
              {bulkOperating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {bulkOperating ? 'Assigning...' : `Assign to ${selectedIds.size} Assets`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Asset Edit Modal */}
      {showEditModal && selectedAsset && (
        <AssetEditModal
          asset={selectedAsset}
          onClose={handleEditModalClose}
          onUpdate={handleAssetUpdated}
        />
      )}
    </>
  );
};

export default AssetList;
