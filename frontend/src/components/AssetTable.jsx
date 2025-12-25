import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUsers } from '../contexts/UsersContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import TablePaginationControls from '@/components/TablePaginationControls';
import AssetTableRow from '@/components/AssetTableRow';
import AssetCard from '@/components/AssetCard';
import AssetTableFilters from '@/components/AssetTableFilters';
import BulkAssetActions from '@/components/BulkAssetActions';
import { Laptop } from 'lucide-react';

export default function AssetTable({ assets = [], onEdit, onDelete, currentUser, onRefresh, onAssetAdded }) {
  const { getAuthHeaders } = useAuth();
  const { getFullName, getEmail } = useUsers();
  const { toast } = useToast();
  const [deleteDialog, setDeleteDialog] = useState({ open: false, asset: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [assetTypeFilter, setAssetTypeFilter] = useState('all');
  const [companies, setCompanies] = useState([]);
  const [assetTypes, setAssetTypes] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch companies and asset types for filter dropdowns
  useEffect(() => {
    async function fetchCompanies() {
      try {
        const res = await fetch('/api/companies/names', {
          headers: { ...getAuthHeaders() }
        });
        if (res.ok) {
          const data = await res.json();
          setCompanies(data);
        }
      } catch (err) {
        console.error('Failed to fetch companies:', err);
      }
    }
    
    async function fetchAssetTypes() {
      try {
        const res = await fetch('/api/asset-types', {
          headers: { ...getAuthHeaders() }
        });
        if (res.ok) {
          const data = await res.json();
          setAssetTypes(data);
        }
      } catch (err) {
        console.error('Failed to fetch asset types:', err);
      }
    }
    
    fetchCompanies();
    fetchAssetTypes();
  }, [getAuthHeaders]);

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
    // Admin can edit any asset
    if (currentUser?.role === 'admin') return true;

    // Users can edit their own assets (match by email)
    if (currentUser?.email && asset.employee_email) {
      return currentUser.email.toLowerCase() === asset.employee_email.toLowerCase();
    }

    return false;
  };

  const canDelete = (asset) => {
    // Only admin can delete assets
    if (currentUser?.role === 'admin') return true;
    return false;
  };

  // Helper to get manager display name - handles three cases:
  // 1. manager_first_name/manager_last_name (preferred)
  // 2. manager_id resolved via UsersContext
  // 3. fallback to null
  const getManagerDisplayName = useCallback((asset) => {
    // Case 1: Prefer denormalized fields if present
    if (asset.manager_first_name && asset.manager_last_name) {
      return `${asset.manager_first_name.trim()} ${asset.manager_last_name.trim()}`.trim();
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
  }, [getFullName]);

  // Helper to get manager email - handles three cases:
  // 1. manager_email (preferred)
  // 2. manager_id resolved via UsersContext
  // 3. fallback to null
  const getManagerEmail = useCallback((asset) => {
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
  }, [getEmail]);

  // Enhance assets with computed manager data for efficient rendering
  const assetsWithManagerData = useMemo(() => {
    return assets.map(asset => ({
      ...asset,
      _managerDisplayName: getManagerDisplayName(asset),
      _managerEmail: getManagerEmail(asset)
    }));
  }, [assets, getManagerDisplayName, getManagerEmail]);

  // Extract unique employees and managers for filter dropdowns
  const uniqueEmployees = useMemo(() => {
    const employeeMap = new Map();
    assetsWithManagerData.forEach(asset => {
      const name = `${asset.employee_first_name || ''} ${asset.employee_last_name || ''}`.trim();
      if (name && !employeeMap.has(name)) {
        employeeMap.set(name, { name, email: asset.employee_email });
      }
    });
    return Array.from(employeeMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [assetsWithManagerData]);

  const uniqueManagers = useMemo(() => {
    const managerMap = new Map();
    assetsWithManagerData.forEach(asset => {
      const name = asset._managerDisplayName;
      if (name && !managerMap.has(name)) {
        managerMap.set(name, { name, email: asset._managerEmail });
      }
    });
    return Array.from(managerMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [assetsWithManagerData]);

  // Filter assets based on search term, status, company, employee, and manager
  const filteredAssets = useMemo(() => {
    let filtered = [...assetsWithManagerData];
    
    // Search filter - across multiple fields
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
          asset.serial_number?.toLowerCase().includes(term) ||
          asset.asset_tag?.toLowerCase().includes(term) ||
          asset.company_name?.toLowerCase().includes(term) ||
          asset.make?.toLowerCase().includes(term) ||
          asset.model?.toLowerCase().includes(term) ||
          asset.asset_type?.toLowerCase().includes(term);
      });
    }

    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(asset => asset.status === statusFilter);
    }

    // Company filter
    if (companyFilter && companyFilter !== 'all') {
      filtered = filtered.filter(asset => asset.company_name === companyFilter);
    }

    // Employee filter
    if (employeeFilter && employeeFilter !== 'all') {
      filtered = filtered.filter(asset => {
        const name = `${asset.employee_first_name || ''} ${asset.employee_last_name || ''}`.trim();
        return name === employeeFilter;
      });
    }

    // Manager filter
    if (managerFilter && managerFilter !== 'all') {
      filtered = filtered.filter(asset => asset._managerDisplayName === managerFilter);
    }

    // Asset type filter
    if (assetTypeFilter && assetTypeFilter !== 'all') {
      filtered = filtered.filter(asset => asset.asset_type === assetTypeFilter);
    }

    return filtered;
  }, [assetsWithManagerData, searchTerm, statusFilter, companyFilter, employeeFilter, managerFilter, assetTypeFilter]);

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

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCompanyFilter('all');
    setEmployeeFilter('all');
    setManagerFilter('all');
    setAssetTypeFilter('all');
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
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
    }
  };

  const hasActiveFilters = () => {
    return searchTerm !== '' ||
           statusFilter !== 'all' ||
           companyFilter !== 'all' ||
           employeeFilter !== 'all' ||
           managerFilter !== 'all' ||
           assetTypeFilter !== 'all';
  };

  const isAllSelected = paginatedAssets.length > 0 && paginatedAssets.every((a) => selectedIds.has(a.id));
  const isSomeSelected = paginatedAssets.some((a) => selectedIds.has(a.id)) && !isAllSelected;

  return (
    <>
      <div className="space-y-6">
        {/* Advanced Filters Section */}
        <div className="space-y-4">
          <AssetTableFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            assetTypeFilter={assetTypeFilter}
            setAssetTypeFilter={setAssetTypeFilter}
            companyFilter={companyFilter}
            setCompanyFilter={setCompanyFilter}
            employeeFilter={employeeFilter}
            setEmployeeFilter={setEmployeeFilter}
            managerFilter={managerFilter}
            setManagerFilter={setManagerFilter}
            companies={companies}
            assetTypes={assetTypes}
            uniqueEmployees={uniqueEmployees}
            uniqueManagers={uniqueManagers}
            onClearFilters={clearFilters}
          />

          <BulkAssetActions
            selectedIds={selectedIds}
            filteredAssets={filteredAssets}
            allAssets={assetsWithManagerData}
            hasActiveFilters={hasActiveFilters()}
            onClearSelection={clearSelection}
            onBulkDelete={handleBulkDelete}
            onRefresh={onRefresh}
            currentUser={currentUser}
          />
        </div>

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
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedIds.has(asset.id)}
                  canEdit={canEdit(asset)}
                  canDelete={canDelete(asset)}
                  onToggleSelect={() => toggleSelect(asset.id)}
                  onEdit={() => onEdit(asset)}
                  onDelete={() => setDeleteDialog({ open: true, asset })}
                />
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
                  <TableHead>Employee</TableHead>
                  <TableHead className="hidden xl:table-cell">Manager</TableHead>
                  <TableHead className="hidden lg:table-cell">Company</TableHead>
                  <TableHead className="hidden xl:table-cell">Type</TableHead>
                  <TableHead className="hidden lg:table-cell">Make/Model</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Asset Tag</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAssets.map((asset) => (
                  <AssetTableRow
                    key={asset.id}
                    asset={asset}
                    isSelected={selectedIds.has(asset.id)}
                    canEdit={canEdit(asset)}
                    canDelete={canDelete(asset)}
                    onToggleSelect={() => toggleSelect(asset.id)}
                    onEdit={() => onEdit(asset)}
                    onDelete={() => setDeleteDialog({ open: true, asset })}
                  />
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
    </>
  );
}
