import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  ClipboardCheck, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  Package,
  Plus
} from 'lucide-react';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function MyAttestationsPage() {
  const { getAuthHeaders, user } = useAuth();
  const { toast } = useToast();
  const [attestations, setAttestations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAttestationModal, setShowAttestationModal] = useState(false);
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [selectedAttestation, setSelectedAttestation] = useState(null);
  const [attestationDetails, setAttestationDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [attestedAssetIds, setAttestedAssetIds] = useState(new Set());
  const [newAssetForm, setNewAssetForm] = useState({
    asset_type: '',
    make: '',
    model: '',
    serial_number: '',
    asset_tag: '',
    notes: '',
    employee_first_name: '',
    employee_last_name: '',
    employee_email: '',
    manager_first_name: '',
    manager_last_name: '',
    manager_email: '',
    company_id: null
  });
  const [assetTypes, setAssetTypes] = useState([]);
  const [loadingAssetTypes, setLoadingAssetTypes] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  const loadAttestations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attestation/my-attestations', {
        headers: { ...getAuthHeaders() }
      });
      if (!res.ok) throw new Error('Failed to load attestations');
      const data = await res.json();
      setAttestations(data.attestations || []);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to load attestations',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttestations();
    fetchAssetTypes();
  }, []);

  const fetchAssetTypes = async () => {
    setLoadingAssetTypes(true);
    try {
      const response = await fetch('/api/asset-types', {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setAssetTypes(data);
      } else {
        console.error('Failed to fetch asset types');
      }
    } catch (error) {
      console.error('Error fetching asset types:', error);
    } finally {
      setLoadingAssetTypes(false);
    }
  };

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const response = await fetch('/api/companies/names', {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setCompanies(data);
      } else {
        console.error('Failed to fetch companies');
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleOpenAddAssetModal = async () => {
    const campaign = attestationDetails?.campaign;
    const isCompanyScoped = campaign?.target_type === 'companies';
    
    // Get the target company ID for company-scoped campaigns
    let targetCompanyId = null;
    if (isCompanyScoped && campaign?.target_company_ids) {
      try {
        const targetCompanyIds = JSON.parse(campaign.target_company_ids);
        targetCompanyId = targetCompanyIds.length > 0 ? targetCompanyIds[0] : null;
      } catch (e) {
        console.error('Error parsing target_company_ids:', e);
      }
    }
    
    // Initialize form with user info
    setNewAssetForm({
      asset_type: '',
      make: '',
      model: '',
      serial_number: '',
      asset_tag: '',
      notes: '',
      employee_first_name: user?.first_name || '',
      employee_last_name: user?.last_name || '',
      employee_email: user?.email || '',
      manager_first_name: user?.manager_first_name || '',
      manager_last_name: user?.manager_last_name || '',
      manager_email: user?.manager_email || '',
      company_id: targetCompanyId
    });
    
    // Load companies if needed
    if (companies.length === 0) {
      fetchCompanies();
    }
    
    setShowAddAssetModal(true);
  };

  const handleStartAttestation = async (attestation) => {
    setSelectedAttestation(attestation);
    setShowAttestationModal(true);
    setLoadingDetails(true);

    try {
      const res = await fetch(`/api/attestation/records/${attestation.id}`, {
        headers: { ...getAuthHeaders() }
      });

      if (!res.ok) throw new Error('Failed to load attestation details');

      const data = await res.json();
      setAttestationDetails(data);
      
      // Track which assets have been attested
      const attestedIds = new Set(data.attestedAssets?.map(a => a.asset_id) || []);
      setAttestedAssetIds(attestedIds);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to load attestation details',
        variant: 'destructive'
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAttestAsset = async (asset, status) => {
    try {
      const res = await fetch(`/api/attestation/records/${selectedAttestation.id}/assets/${asset.id}`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attested_status: status,
          notes: ''
        })
      });

      if (!res.ok) throw new Error('Failed to attest asset');

      toast({
        title: 'Success',
        description: 'Asset status confirmed'
      });

      // Mark this asset as attested
      setAttestedAssetIds(prev => new Set([...prev, asset.id]));

      // Reload details to get updated info
      handleStartAttestation(selectedAttestation);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to attest asset',
        variant: 'destructive'
      });
    }
  };

  const handleAddNewAsset = async () => {
    // Validate required fields
    if (!newAssetForm.asset_type || !newAssetForm.serial_number || !newAssetForm.asset_tag ||
        !newAssetForm.employee_first_name || !newAssetForm.employee_last_name || !newAssetForm.employee_email ||
        !newAssetForm.company_id) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    try {
      const res = await fetch(`/api/attestation/records/${selectedAttestation.id}/assets/new`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(newAssetForm)
      });

      if (!res.ok) throw new Error('Failed to add new asset');

      toast({
        title: 'Success',
        description: 'New asset added successfully'
      });

      setShowAddAssetModal(false);
      setNewAssetForm({
        asset_type: '',
        make: '',
        model: '',
        serial_number: '',
        asset_tag: '',
        notes: '',
        employee_first_name: '',
        employee_last_name: '',
        employee_email: '',
        manager_first_name: '',
        manager_last_name: '',
        manager_email: '',
        company_id: null
      });

      // Reload details to show the new asset
      handleStartAttestation(selectedAttestation);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to add new asset',
        variant: 'destructive'
      });
    }
  };

  const handleCompleteAttestation = async () => {
    // Check if all assets have been attested
    const allAssetsAttested = attestationDetails?.assets?.every(a => attestedAssetIds.has(a.id));

    if (!allAssetsAttested) {
      if (!confirm('Not all assets have been attested. Are you sure you want to complete?')) {
        return;
      }
    }

    try {
      const res = await fetch(`/api/attestation/records/${selectedAttestation.id}/complete`, {
        method: 'POST',
        headers: { ...getAuthHeaders() }
      });

      if (!res.ok) throw new Error('Failed to complete attestation');

      toast({
        title: 'Success',
        description: 'Attestation completed successfully'
      });

      setShowAttestationModal(false);
      loadAttestations();
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to complete attestation',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { variant: 'secondary', label: 'Pending' },
      in_progress: { variant: 'default', label: 'In Progress' },
      completed: { variant: 'outline', label: 'Completed' }
    };

    const { variant, label } = config[status] || config.pending;

    return <Badge variant={variant}>{label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <CardTitle>My Attestations ({attestations.length})</CardTitle>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Review and attest to the status of your registered assets
          </p>
        </CardHeader>
        <CardContent>
          {attestations.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No pending attestations</h3>
              <p className="text-muted-foreground">
                You don't have any pending asset attestations at this time
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="hidden md:table-cell">Completed</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attestations.map((attestation) => (
                  <TableRow key={attestation.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{attestation.campaign?.name}</div>
                        <div className="text-sm text-muted-foreground hidden md:block">
                          {attestation.campaign?.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(attestation.status)}
                    </TableCell>
                    <TableCell>
                      {new Date(attestation.campaign?.start_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {attestation.completed_at 
                        ? new Date(attestation.completed_at).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {attestation.status !== 'completed' && (
                        <Button onClick={() => handleStartAttestation(attestation)}>
                          {attestation.status === 'pending' ? 'Start Attestation' : 'Continue Attestation'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Attestation Modal */}
      <Dialog open={showAttestationModal} onOpenChange={setShowAttestationModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asset Attestation: {attestationDetails?.campaign?.name}</DialogTitle>
            <DialogDescription>
              Review each asset and confirm its status. You can also add any missing assets.
            </DialogDescription>
          </DialogHeader>
          {loadingDetails ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : attestationDetails ? (
            <div className="space-y-6">
              {/* Assets Table */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Your Assets</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpenAddAssetModal}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Missing Asset
                  </Button>
                </div>

                {attestationDetails.assets?.length === 0 ? (
                  <div className="text-center py-8 border rounded-md">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      No assets registered yet. Click "Add Missing Asset" to add one.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Make/Model</TableHead>
                          <TableHead>Serial Number</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attestationDetails.assets?.map((asset) => {
                          const isAttested = attestedAssetIds.has(asset.id);
                          return (
                            <TableRow key={asset.id} className={isAttested ? 'bg-green-50 dark:bg-green-950' : ''}>
                              <TableCell className="font-medium">{asset.asset_type}</TableCell>
                              <TableCell>
                                {asset.make} {asset.model}
                              </TableCell>
                              <TableCell>{asset.serial_number}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{asset.status}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {isAttested ? (
                                  <div className="flex items-center justify-end gap-2 text-green-600">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span className="text-sm">Confirmed</span>
                                  </div>
                                ) : (
                                  <div className="flex justify-end gap-2">
                                    <Select
                                      value={asset.status}
                                      onValueChange={(value) => handleAttestAsset(asset, value)}
                                    >
                                      <SelectTrigger className="w-[180px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="active">Active (Confirmed)</SelectItem>
                                        <SelectItem value="lost">Lost</SelectItem>
                                        <SelectItem value="stolen">Stolen</SelectItem>
                                        <SelectItem value="decommissioned">Decommissioned</SelectItem>
                                        <SelectItem value="transferred">Transferred</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* New Assets Added */}
              {attestationDetails.newAssets?.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Newly Added Assets</h3>
                  <div className="rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Make/Model</TableHead>
                          <TableHead>Serial Number</TableHead>
                          <TableHead>Asset Tag</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attestationDetails.newAssets?.map((asset, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{asset.asset_type}</TableCell>
                            <TableCell>
                              {asset.make} {asset.model}
                            </TableCell>
                            <TableCell>{asset.serial_number}</TableCell>
                            <TableCell>{asset.asset_tag}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Complete Button */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowAttestationModal(false)}>
                  Close
                </Button>
                <Button onClick={handleCompleteAttestation}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Complete Attestation
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Add New Asset Modal */}
      <Dialog open={showAddAssetModal} onOpenChange={setShowAddAssetModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Missing Asset</DialogTitle>
            <DialogDescription>
              Add an asset that you have but isn't currently registered in the system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="asset_type">Asset Type *</Label>
              {loadingAssetTypes ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading asset types...
                </div>
              ) : assetTypes.length > 0 ? (
                <Select
                  value={newAssetForm.asset_type}
                  onValueChange={(value) => setNewAssetForm({ ...newAssetForm, asset_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetTypes.map((type) => (
                      <SelectItem key={type.id} value={type.name}>
                        {type.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No asset types available
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="make">Make</Label>
                <Input
                  id="make"
                  value={newAssetForm.make}
                  onChange={(e) => setNewAssetForm({ ...newAssetForm, make: e.target.value })}
                  placeholder="e.g., Dell"
                />
              </div>
              <div>
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={newAssetForm.model}
                  onChange={(e) => setNewAssetForm({ ...newAssetForm, model: e.target.value })}
                  placeholder="e.g., XPS 13"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="serial_number">Serial Number *</Label>
              <Input
                id="serial_number"
                value={newAssetForm.serial_number}
                onChange={(e) => setNewAssetForm({ ...newAssetForm, serial_number: e.target.value })}
                placeholder="Enter serial number"
              />
            </div>
            <div>
              <Label htmlFor="asset_tag">Asset Tag *</Label>
              <Input
                id="asset_tag"
                value={newAssetForm.asset_tag}
                onChange={(e) => setNewAssetForm({ ...newAssetForm, asset_tag: e.target.value })}
                placeholder="Enter asset tag"
              />
            </div>

            {/* Employee Information */}
            <div className="space-y-2 pt-2 border-t">
              <h4 className="font-medium text-sm">Employee Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employee_first_name">First Name *</Label>
                  <Input
                    id="employee_first_name"
                    value={newAssetForm.employee_first_name}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, employee_first_name: e.target.value })}
                    placeholder="First name"
                    readOnly={attestationDetails?.campaign?.target_type === 'companies'}
                    className={attestationDetails?.campaign?.target_type === 'companies' ? 'bg-muted' : ''}
                  />
                </div>
                <div>
                  <Label htmlFor="employee_last_name">Last Name *</Label>
                  <Input
                    id="employee_last_name"
                    value={newAssetForm.employee_last_name}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, employee_last_name: e.target.value })}
                    placeholder="Last name"
                    readOnly={attestationDetails?.campaign?.target_type === 'companies'}
                    className={attestationDetails?.campaign?.target_type === 'companies' ? 'bg-muted' : ''}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="employee_email">Email *</Label>
                <Input
                  id="employee_email"
                  type="email"
                  value={newAssetForm.employee_email}
                  onChange={(e) => setNewAssetForm({ ...newAssetForm, employee_email: e.target.value })}
                  placeholder="employee@example.com"
                  readOnly={attestationDetails?.campaign?.target_type === 'companies'}
                  className={attestationDetails?.campaign?.target_type === 'companies' ? 'bg-muted' : ''}
                />
              </div>
            </div>

            {/* Manager Information */}
            <div className="space-y-2 pt-2 border-t">
              <h4 className="font-medium text-sm">Manager Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="manager_first_name">First Name</Label>
                  <Input
                    id="manager_first_name"
                    value={newAssetForm.manager_first_name}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, manager_first_name: e.target.value })}
                    placeholder="First name"
                    readOnly={attestationDetails?.campaign?.target_type === 'companies'}
                    className={attestationDetails?.campaign?.target_type === 'companies' ? 'bg-muted' : ''}
                  />
                </div>
                <div>
                  <Label htmlFor="manager_last_name">Last Name</Label>
                  <Input
                    id="manager_last_name"
                    value={newAssetForm.manager_last_name}
                    onChange={(e) => setNewAssetForm({ ...newAssetForm, manager_last_name: e.target.value })}
                    placeholder="Last name"
                    readOnly={attestationDetails?.campaign?.target_type === 'companies'}
                    className={attestationDetails?.campaign?.target_type === 'companies' ? 'bg-muted' : ''}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="manager_email">Email</Label>
                <Input
                  id="manager_email"
                  type="email"
                  value={newAssetForm.manager_email}
                  onChange={(e) => setNewAssetForm({ ...newAssetForm, manager_email: e.target.value })}
                  placeholder="manager@example.com"
                  readOnly={attestationDetails?.campaign?.target_type === 'companies'}
                  className={attestationDetails?.campaign?.target_type === 'companies' ? 'bg-muted' : ''}
                />
              </div>
            </div>

            {/* Company Selection */}
            <div className="space-y-2 pt-2 border-t">
              <h4 className="font-medium text-sm">Company</h4>
              {attestationDetails?.campaign?.target_type === 'companies' ? (
                <div>
                  <Label>Company (Auto-selected from campaign)</Label>
                  <Input
                    value={companies.find(c => c.id === newAssetForm.company_id)?.name || (companies.length > 0 ? 'Company not found' : 'Loading...')}
                    readOnly
                    className="bg-muted"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="company_id">Company *</Label>
                  {loadingCompanies ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading companies...
                    </div>
                  ) : companies.length > 0 ? (
                    <Select
                      value={newAssetForm.company_id?.toString() || ''}
                      onValueChange={(value) => setNewAssetForm({ ...newAssetForm, company_id: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select company" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id.toString()}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No companies available
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={newAssetForm.notes}
                onChange={(e) => setNewAssetForm({ ...newAssetForm, notes: e.target.value })}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAssetModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNewAsset}>
              Add Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
