import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
} from 'lucide-react';

const Dashboard = () => {
  const { getAuthHeaders, user } = useAuth();
  const { toast } = useToast();
  const [assets, setAssets] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dashboardStats, setDashboardStats] = useState({
    assetsCount: 0,
    employeesCount: 0,
    companiesCount: 0
  });
  
  // Modal states
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [assetDetailsForm, setAssetDetailsForm] = useState(null);
  const [detailsEditMode, setDetailsEditMode] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  
  // Form states
  const [formLoading, setFormLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  
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

  const parseEmployeeName = (fullName = '') => {
    const parts = fullName.trim().split(' ');
    if (parts.length === 0) return { first: '', last: '' };
    if (parts.length === 1) return { first: parts[0], last: '' };
    const last = parts.pop();
    const first = parts.join(' ');
    return { first, last };
  };

  const canEditField = (field) => {
    if (['registration_date', 'last_updated'].includes(field)) return false;
    if (user?.role === 'admin') return true;
    if (user?.role === 'employee') {
      return ['status', 'notes'].includes(field);
    }
    return ['status', 'notes'].includes(field);
  };

  const openAssetDetails = (asset) => {
    const employeeName = parseEmployeeName(asset.employee_name || '');
    setSelectedAsset(asset);
    setAssetDetailsForm({
      employee_first_name: employeeName.first,
      employee_last_name: employeeName.last,
      employee_email: asset.employee_email || '',
      manager_name: asset.manager_name || '',
      manager_email: asset.manager_email || '',
      company_name: asset.company_name || '',
      laptop_make: asset.laptop_make || '',
      laptop_model: asset.laptop_model || '',
      laptop_serial_number: asset.laptop_serial_number || '',
      laptop_asset_tag: asset.laptop_asset_tag || '',
      status: asset.status || 'active',
      notes: asset.notes || '',
      registration_date: asset.registration_date || '',
      last_updated: asset.last_updated || ''
    });
    setDetailsEditMode(false);
    setShowInfoModal(true);
  };

  const handleDetailsChange = (field, value) => {
    if (!detailsEditMode || !canEditField(field)) return;
    setAssetDetailsForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDetailsClose = () => {
    setShowInfoModal(false);
    setSelectedAsset(null);
    setAssetDetailsForm(null);
    setDetailsEditMode(false);
    setDetailsLoading(false);
  };

  const handleDetailsEdit = async () => {
    if (!detailsEditMode) {
      setDetailsEditMode(true);
      return;
    }

    if (!assetDetailsForm || !selectedAsset) return;

    setDetailsLoading(true);
    try {
      const submitData = {
        employee_first_name: assetDetailsForm.employee_first_name?.trim() || '',
        employee_last_name: assetDetailsForm.employee_last_name?.trim() || '',
        employee_email: assetDetailsForm.employee_email?.trim() || '',
        manager_name: assetDetailsForm.manager_name?.trim() || '',
        manager_email: assetDetailsForm.manager_email?.trim() || '',
        company_name: assetDetailsForm.company_name?.trim() || '',
        laptop_make: assetDetailsForm.laptop_make?.trim() || '',
        laptop_model: assetDetailsForm.laptop_model?.trim() || '',
        laptop_serial_number: assetDetailsForm.laptop_serial_number?.trim() || '',
        laptop_asset_tag: assetDetailsForm.laptop_asset_tag?.trim() || '',
        status: assetDetailsForm.status,
        notes: assetDetailsForm.notes
      };

      const payload = {
        ...submitData,
        employee_name: `${submitData.employee_first_name} ${submitData.employee_last_name}`.trim(),
      };

      delete payload.employee_first_name;
      delete payload.employee_last_name;

      const response = await fetch(`/api/assets/${selectedAsset.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update asset');

      toast({
        title: "Success",
        description: "Asset updated successfully",
        variant: "success",
      });

      handleDetailsClose();
      fetchAssets();
    } catch (err) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDetailsLoading(false);
      setDetailsEditMode(false);
    }
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
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-4 md:flex-row md:items-center flex-1">
              <div className="relative flex-1 max-w-sm">
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
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="pt-6">
          {filteredAssets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Laptop className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No assets found matching your criteria.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Employee Email</TableHead>
                    <TableHead>Manager Email</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Asset Tag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map((asset) => (
                    <TableRow key={asset.id}>
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Asset Details Modal */}
      <Dialog open={showInfoModal} onOpenChange={handleDetailsClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asset Details</DialogTitle>
            <DialogDescription>
              View complete asset information. Click Edit to update allowed fields.
            </DialogDescription>
          </DialogHeader>

          {assetDetailsForm && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Employee First Name</Label>
                  <Input
                    value={assetDetailsForm.employee_first_name}
                    onChange={(e) => handleDetailsChange('employee_first_name', e.target.value)}
                    disabled={!detailsEditMode || !canEditField('employee_first_name')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Employee Last Name</Label>
                  <Input
                    value={assetDetailsForm.employee_last_name}
                    onChange={(e) => handleDetailsChange('employee_last_name', e.target.value)}
                    disabled={!detailsEditMode || !canEditField('employee_last_name')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Employee Email</Label>
                  <Input
                    type="email"
                    value={assetDetailsForm.employee_email}
                    onChange={(e) => handleDetailsChange('employee_email', e.target.value)}
                    disabled={!detailsEditMode || !canEditField('employee_email')}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Manager Name</Label>
                  <Input
                    value={assetDetailsForm.manager_name}
                    onChange={(e) => handleDetailsChange('manager_name', e.target.value)}
                    disabled={!detailsEditMode || !canEditField('manager_name')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Manager Email</Label>
                  <Input
                    type="email"
                    value={assetDetailsForm.manager_email}
                    onChange={(e) => handleDetailsChange('manager_email', e.target.value)}
                    disabled={!detailsEditMode || !canEditField('manager_email')}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Input
                    value={assetDetailsForm.company_name}
                    onChange={(e) => handleDetailsChange('company_name', e.target.value)}
                    disabled={!detailsEditMode || !canEditField('company_name')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={assetDetailsForm.status}
                    onValueChange={(value) => handleDetailsChange('status', value)}
                    disabled={!detailsEditMode || !canEditField('status')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
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
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Laptop Make</Label>
                  <Input
                    value={assetDetailsForm.laptop_make}
                    onChange={(e) => handleDetailsChange('laptop_make', e.target.value)}
                    disabled={!detailsEditMode || !canEditField('laptop_make')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Laptop Model</Label>
                  <Input
                    value={assetDetailsForm.laptop_model}
                    onChange={(e) => handleDetailsChange('laptop_model', e.target.value)}
                    disabled={!detailsEditMode || !canEditField('laptop_model')}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Serial Number</Label>
                  <Input
                    value={assetDetailsForm.laptop_serial_number}
                    onChange={(e) => handleDetailsChange('laptop_serial_number', e.target.value)}
                    disabled={!detailsEditMode || !canEditField('laptop_serial_number')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Asset Tag</Label>
                  <Input
                    value={assetDetailsForm.laptop_asset_tag}
                    onChange={(e) => handleDetailsChange('laptop_asset_tag', e.target.value)}
                    disabled={!detailsEditMode || !canEditField('laptop_asset_tag')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={assetDetailsForm.notes}
                  onChange={(e) => handleDetailsChange('notes', e.target.value)}
                  disabled={!detailsEditMode || !canEditField('notes')}
                  className="min-h-[120px]"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Registered</Label>
                  <Input value={assetDetailsForm.registration_date ? new Date(assetDetailsForm.registration_date).toLocaleString() : '—'} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Last Updated</Label>
                  <Input value={assetDetailsForm.last_updated ? new Date(assetDetailsForm.last_updated).toLocaleString() : '—'} disabled />
                </div>
              </div>

              <DialogFooter>
                <Button onClick={handleDetailsEdit} disabled={detailsLoading}>
                  {detailsLoading ? 'Saving...' : 'Edit'}
                </Button>
                <Button variant="outline" onClick={handleDetailsClose}>
                  Ok
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
