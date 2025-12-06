import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import TablePaginationControls from '@/components/TablePaginationControls';
import {
  Laptop,
  Search,
  Plus,
  Upload,
  Edit,
  Info,
  Trash2,
  Loader2,
  AlertTriangle,
  Download,
  Users,
  Building2,
  Package,
  MoreHorizontal,
  RefreshCw,
  X,
} from 'lucide-react';

const Dashboard = () => {
  const { getAuthHeaders, user } = useAuth();
  const { toast } = useToast();
  const [assets, setAssets] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [assetPage, setAssetPage] = useState(1);
  const [assetPageSize, setAssetPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dashboardStats, setDashboardStats] = useState({
    assetsCount: 0,
    employeesCount: 0,
    companiesCount: 0
  });

  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Modal states
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkManagerModal, setShowBulkManagerModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  // Form states
  const [formLoading, setFormLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);

  // Bulk operation states
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkNote, setBulkNote] = useState('');
  const [bulkOperating, setBulkOperating] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [bulkManagerName, setBulkManagerName] = useState('');
  const [bulkManagerEmail, setBulkManagerEmail] = useState('');

  // Registration form data
  const [regFormData, setRegFormData] = useState({
    employee_first_name: '',
    employee_last_name: '',
    employee_email: '',
    company_name: '',
    laptop_make: '',
    laptop_model: '',
    laptop_serial_number: '',
    laptop_asset_tag: '',
    notes: ''
  });

  // Status update form data
  const [statusFormData, setStatusFormData] = useState({
    status: '',
    notes: ''
  });

  useEffect(() => {
    fetchAssets();
    fetchCompanies();
    fetchDashboardStats();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [assets, searchQuery, statusFilter]);

  useEffect(() => {
    if (user && user.role === 'employee') {
      setRegFormData(prev => ({
        ...prev,
        employee_first_name: user.first_name || '',
        employee_last_name: user.last_name || '',
        employee_email: user.email || ''
      }));
    }
  }, [user]);

  const fetchAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/assets', {
        headers: { ...getAuthHeaders() }
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
  };

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/companies/names', {
        headers: { ...getAuthHeaders() }
      });
      if (response.ok) {
        const data = await response.json();
        setCompanies(data);
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/stats', {
        headers: { ...getAuthHeaders() }
      });
      if (response.ok) {
        const data = await response.json();
        setDashboardStats(data);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  };

  const applyFilters = () => {
    let filtered = [...assets];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(asset =>
        asset.employee_name?.toLowerCase().includes(query) ||
        asset.employee_email?.toLowerCase().includes(query) ||
        asset.manager_name?.toLowerCase().includes(query) ||
        asset.company_name?.toLowerCase().includes(query) ||
        asset.laptop_serial_number?.toLowerCase().includes(query) ||
        asset.laptop_asset_tag?.toLowerCase().includes(query)
      );
    }

    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(asset => asset.status === statusFilter);
    }

    setFilteredAssets(filtered);
  };

  useEffect(() => {
    setAssetPage(1);
  }, [assetPageSize, filteredAssets.length]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredAssets.length / assetPageSize) || 1);
    if (assetPage > totalPages) {
      setAssetPage(totalPages);
    }
  }, [assetPage, assetPageSize, filteredAssets.length]);

  const paginatedAssets = useMemo(() => {
    const start = (assetPage - 1) * assetPageSize;
    return filteredAssets.slice(start, start + assetPageSize);
  }, [filteredAssets, assetPage, assetPageSize]);

  // Selection handlers
  const isAllSelected = paginatedAssets.length > 0 &&
    paginatedAssets.every(asset => selectedIds.has(asset.id));

  const isSomeSelected = paginatedAssets.some(asset => selectedIds.has(asset.id)) &&
    !isAllSelected;

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const pageIds = paginatedAssets.map((asset) => asset.id);
      const hasAll = pageIds.every((id) => prev.has(id));
      const next = new Set(prev);
      pageIds.forEach((id) => {
        if (hasAll) next.delete(id);
        else next.add(id);
      });
      return next;
    });
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

  const getStatusBadge = (status) => {
    const variants = {
      active: 'success',
      returned: 'info',
      lost: 'destructive',
      damaged: 'warning',
      retired: 'secondary'
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const formatDateTime = (value) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString();
    } catch (err) {
      return '—';
    }
  };

  const DetailItem = ({ label, value, helper, mono = false }) => (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('text-sm font-semibold', mono && 'font-mono')}>{value || '—'}</p>
      {helper && <p className="text-sm text-muted-foreground">{helper}</p>}
    </div>
  );

  const openAssetDetails = (asset) => {
    setSelectedAsset(asset);
    setShowInfoModal(true);
  };

  const handleDetailsClose = () => {
    setShowInfoModal(false);
    setSelectedAsset(null);
  };

  // Registration handlers
  const handleRegFormChange = (e) => {
    setRegFormData({ ...regFormData, [e.target.name]: e.target.value });
  };

  const handleRegSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const submitData = {
        ...regFormData,
        employee_name: `${regFormData.employee_first_name} ${regFormData.employee_last_name}`.trim()
      };
      delete submitData.employee_first_name;
      delete submitData.employee_last_name;

      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to register asset');

      toast({
        title: "Success",
        description: "Laptop added successfully",
        variant: "success",
      });

      setShowRegistrationModal(false);
      resetRegForm();
      fetchAssets();
    } catch (err) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const resetRegForm = () => {
    if (user && user.role === 'employee') {
      setRegFormData({
        employee_first_name: user.first_name || '',
        employee_last_name: user.last_name || '',
        employee_email: user.email || '',
        company_name: '',
        laptop_make: '',
        laptop_model: '',
        laptop_serial_number: '',
        laptop_asset_tag: '',
        notes: ''
      });
    } else {
      setRegFormData({
        employee_first_name: '',
        employee_last_name: '',
        employee_email: '',
        company_name: '',
        laptop_make: '',
        laptop_model: '',
        laptop_serial_number: '',
        laptop_asset_tag: '',
        notes: ''
      });
    }
  };

  // Status update handlers
  const handleStatusUpdate = (asset) => {
    setSelectedAsset(asset);
    setStatusFormData({ status: asset.status, notes: asset.notes || '' });
    setShowStatusModal(true);
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const response = await fetch(`/api/assets/${selectedAsset.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(statusFormData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update status');

      toast({
        title: "Success",
        description: "Status updated successfully",
        variant: "success",
      });

      setShowStatusModal(false);
      setSelectedAsset(null);
      fetchAssets();
    } catch (err) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  // Delete handlers
  const handleDelete = (asset) => {
    setSelectedAsset(asset);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setFormLoading(true);
    try {
      const response = await fetch(`/api/assets/${selectedAsset.id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete asset');

      toast({
        title: "Success",
        description: "Asset deleted successfully",
        variant: "success",
      });

      setShowDeleteModal(false);
      setSelectedAsset(null);
      fetchAssets();
    } catch (err) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  // Import handlers
  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) {
      toast({
        title: "Error",
        description: "Please select a CSV file to import",
        variant: "destructive",
      });
      return;
    }

    setFormLoading(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);

      const response = await fetch('/api/assets/import', {
        method: 'POST',
        headers: { ...getAuthHeaders() },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to import assets');

      setImportResult(data);
      toast({
        title: "Success",
        description: data.message,
        variant: "success",
      });

      setImportFile(null);
      fetchAssets();
    } catch (err) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
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

      toast({
        title: "Success",
        description: data.message,
        variant: "success",
      });

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

      toast({
        title: "Success",
        description: data.message,
        variant: "success",
      });

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

      toast({
        title: "Success",
        description: data.message,
        variant: "success",
      });

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading assets...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assets</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.assetsCount}</div>
            <p className="text-xs text-muted-foreground">
              Total registered assets
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.employeesCount}</div>
            <p className="text-xs text-muted-foreground">
              Total registered users
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.companiesCount}</div>
            <p className="text-xs text-muted-foreground">
              Partner organizations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="rounded-xl bg-card/60 p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4 md:flex-row md:items-center flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by employee, serial, tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="damaged">Damaged</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImportModal(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button onClick={() => setShowRegistrationModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Asset
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-16 z-40 flex flex-wrap items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg backdrop-blur-sm">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>

          <div className="flex-1" />

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
          </Button>
        </div>
      )}

      {/* Data Table */}
      <div className="rounded-xl bg-card/60 p-4 shadow-sm">
        {filteredAssets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Laptop className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No assets found matching your criteria.</p>
          </div>
        ) : isMobile ? (
          /* Mobile Card View */
          <div className="space-y-3">
            {paginatedAssets.map((asset) => (
              <div
                key={asset.id}
                className={cn(
                  "border rounded-lg p-4 transition-colors",
                  selectedIds.has(asset.id) && "bg-primary/5 border-primary/50 shadow-[0_0_0_1px_hsl(var(--primary))]"
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
                        {getStatusBadge(asset.status)}
                      </div>

                      <p className="text-sm text-muted-foreground truncate">
                        {asset.employee_email}
                      </p>

                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <div>
                          <span className="text-muted-foreground">Tag:</span>{' '}
                          <span className="font-mono">{asset.laptop_asset_tag}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Serial:</span>{' '}
                          <span className="font-mono text-xs">{asset.laptop_serial_number}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Company:</span>{' '}
                          {asset.company_name}
                        </div>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openAssetDetails(asset)}>
                          <Info className="h-4 w-4 mr-2" />
                          Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusUpdate(asset)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Update Status
                        </DropdownMenuItem>
                        {user?.role === 'admin' && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(asset)}
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
                  <TableHead>Employee Email</TableHead>
                  <TableHead>Manager Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Asset Tag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAssets.map((asset) => (
                  <TableRow
                    key={asset.id}
                    data-state={selectedIds.has(asset.id) ? "selected" : undefined}
                    className={cn(
                      selectedIds.has(asset.id) && "bg-primary/5 border-primary/40"
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(asset.id)}
                        onCheckedChange={() => toggleSelect(asset.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{asset.employee_name}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{asset.employee_email}</TableCell>
                    <TableCell className="font-mono text-sm">{asset.manager_email || '—'}</TableCell>
                    <TableCell>{asset.company_name}</TableCell>
                    <TableCell className="font-mono text-sm">{asset.laptop_serial_number}</TableCell>
                    <TableCell className="font-mono text-sm">{asset.laptop_asset_tag}</TableCell>
                    <TableCell>{getStatusBadge(asset.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openAssetDetails(asset)}
                          title="More Info"
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStatusUpdate(asset)}
                          title="Update Status"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {user?.role === 'admin' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(asset)}
                            title="Delete Asset"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {filteredAssets.length > 0 && (
            <TablePaginationControls
              className="mt-4"
              page={assetPage}
              pageSize={assetPageSize}
              totalItems={filteredAssets.length}
              onPageChange={setAssetPage}
              onPageSizeChange={setAssetPageSize}
            />
          )}
        </div>
      </div>

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
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
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
              <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">
                {bulkError}
              </div>
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
              <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">
                {bulkError}
              </div>
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
              <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">
                {bulkError}
              </div>
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

      {/* Asset Details Modal */}
      <Dialog open={showInfoModal} onOpenChange={handleDetailsClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asset Details</DialogTitle>
            <DialogDescription>
              View complete asset information.
            </DialogDescription>
          </DialogHeader>

          {selectedAsset && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Employee</p>
                  <p className="text-lg font-semibold leading-tight">{selectedAsset.employee_name || '—'}</p>
                  {selectedAsset.employee_email && (
                    <p className="text-sm text-muted-foreground">{selectedAsset.employee_email}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {getStatusBadge(selectedAsset.status)}
                  <span>Updated {formatDateTime(selectedAsset.last_updated)}</span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <DetailItem
                  label="Manager"
                  value={selectedAsset.manager_name || '—'}
                  helper={selectedAsset.manager_email}
                />
                <DetailItem label="Company" value={selectedAsset.company_name || '—'} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <DetailItem label="Serial Number" value={selectedAsset.laptop_serial_number} mono />
                <DetailItem label="Asset Tag" value={selectedAsset.laptop_asset_tag} mono />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <DetailItem label="Laptop Make" value={selectedAsset.laptop_make} />
                <DetailItem label="Laptop Model" value={selectedAsset.laptop_model} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <DetailItem label="Registered" value={formatDateTime(selectedAsset.registration_date)} />
                <DetailItem label="Last Updated" value={formatDateTime(selectedAsset.last_updated)} />
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                <div className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed text-muted-foreground min-h-[60px]">
                  {selectedAsset.notes || '—'}
                </div>
              </div>

              <DialogFooter className="justify-end pt-2">
                <Button variant="outline" onClick={handleDetailsClose}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Registration Modal */}
      <Dialog open={showRegistrationModal} onOpenChange={setShowRegistrationModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register New Asset</DialogTitle>
            <DialogDescription>
              Enter the details for the new laptop asset.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegSubmit} className="space-y-6">
            {/* Employee Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-primary">Employee Information</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="employee_first_name">First Name</Label>
                  <Input
                    id="employee_first_name"
                    name="employee_first_name"
                    value={regFormData.employee_first_name}
                    onChange={handleRegFormChange}
                    required
                    disabled={user?.role === 'employee'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee_last_name">Last Name</Label>
                  <Input
                    id="employee_last_name"
                    name="employee_last_name"
                    value={regFormData.employee_last_name}
                    onChange={handleRegFormChange}
                    required
                    disabled={user?.role === 'employee'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee_email">Email</Label>
                  <Input
                    id="employee_email"
                    name="employee_email"
                    type="email"
                    value={regFormData.employee_email}
                    onChange={handleRegFormChange}
                    required
                    disabled={user?.role === 'employee'}
                  />
                </div>
              </div>
            </div>

            {/* Company Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-primary">Company Information</h4>
              <div className="space-y-2">
                <Label htmlFor="company_name">Company</Label>
                <Select
                  value={regFormData.company_name}
                  onValueChange={(value) => setRegFormData({ ...regFormData, company_name: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a company..." />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.name}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Asset Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-primary">Asset Information</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="laptop_make">Make</Label>
                  <Input
                    id="laptop_make"
                    name="laptop_make"
                    value={regFormData.laptop_make}
                    onChange={handleRegFormChange}
                    placeholder="e.g., Dell"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="laptop_model">Model</Label>
                  <Input
                    id="laptop_model"
                    name="laptop_model"
                    value={regFormData.laptop_model}
                    onChange={handleRegFormChange}
                    placeholder="e.g., Latitude 5420"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="laptop_serial_number">Serial Number</Label>
                  <Input
                    id="laptop_serial_number"
                    name="laptop_serial_number"
                    value={regFormData.laptop_serial_number}
                    onChange={handleRegFormChange}
                    placeholder="e.g., SN123456789"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="laptop_asset_tag">Asset Tag</Label>
                  <Input
                    id="laptop_asset_tag"
                    name="laptop_asset_tag"
                    value={regFormData.laptop_asset_tag}
                    onChange={handleRegFormChange}
                    placeholder="e.g., ASSET-001"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                name="notes"
                value={regFormData.notes}
                onChange={handleRegFormChange}
                placeholder="Additional information..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowRegistrationModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={formLoading}>
                {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Register Asset
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Status Update Modal */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Asset Status</DialogTitle>
            <DialogDescription>
              Change the status for this asset.
            </DialogDescription>
          </DialogHeader>
          {selectedAsset && (
            <form onSubmit={handleStatusSubmit} className="space-y-4">
              <div className="rounded-md bg-muted p-4 space-y-1">
                <p className="text-sm"><strong>Employee:</strong> {selectedAsset.employee_name}</p>
                <p className="text-sm"><strong>Serial Number:</strong> {selectedAsset.laptop_serial_number}</p>
                <p className="text-sm"><strong>Asset Tag:</strong> {selectedAsset.laptop_asset_tag}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">New Status</Label>
                <Select
                  value={statusFormData.status}
                  onValueChange={(value) => setStatusFormData({ ...statusFormData, status: value })}
                >
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
                <Label htmlFor="status_notes">Notes</Label>
                <Textarea
                  id="status_notes"
                  value={statusFormData.notes}
                  onChange={(e) => setStatusFormData({ ...statusFormData, notes: e.target.value })}
                  placeholder="Add notes about this status change..."
                  rows={4}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowStatusModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={formLoading}>
                  {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Update Status
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this asset? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedAsset && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-4 space-y-1">
                <p className="text-sm"><strong>Employee:</strong> {selectedAsset.employee_name}</p>
                <p className="text-sm"><strong>Serial Number:</strong> {selectedAsset.laptop_serial_number}</p>
                <p className="text-sm"><strong>Asset Tag:</strong> {selectedAsset.laptop_asset_tag}</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteConfirm} disabled={formLoading}>
                  {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Delete Asset
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={(open) => {
        setShowImportModal(open);
        if (!open) {
          setImportFile(null);
          setImportResult(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Assets from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file with your asset details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleImportSubmit} className="space-y-4">
            <div className="space-y-4">
              <div className="rounded-md bg-muted/50 p-4 text-sm space-y-1">
                <p className="font-medium text-foreground">Required columns</p>
                <p className="text-muted-foreground">
                  employee_name, employee_email, company_name, laptop_serial_number, laptop_asset_tag
                </p>
                <p className="font-medium text-foreground pt-2">Optional columns</p>
                <p className="text-muted-foreground">
                  manager_name, manager_email, laptop_make, laptop_model, status, notes
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" asChild>
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
                <Button type="button" variant="ghost" asChild>
                  <a href="/import_assets.csv" download>
                    <Download className="h-4 w-4 mr-2" />
                    Download Example
                  </a>
                </Button>
              </div>
              {importFile && (
                <p className="text-sm text-muted-foreground">
                  Selected file: {importFile.name}
                </p>
              )}
              {importResult && (
                <div className="rounded-md bg-green-50 text-green-900 p-4 text-sm">
                  {importResult.message}
                </div>
              )}
              {importResult?.errors?.length > 0 && (
                <div className="rounded-md border p-4 max-h-40 overflow-auto">
                  <p className="font-medium text-sm mb-2">Issues:</p>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowImportModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={formLoading || !importFile}>
                {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Import Assets
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
