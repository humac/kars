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
    notes: ''
  });

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
  }, []);

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
    if (!newAssetForm.asset_type || !newAssetForm.serial_number || !newAssetForm.asset_tag) {
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
        notes: ''
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
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6" />
          My Attestations
        </h1>
        <p className="text-muted-foreground mt-2">
          Review and attest to the status of your registered assets
        </p>
      </div>

      {attestations.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No pending attestations</h3>
              <p className="text-muted-foreground">
                You don't have any pending asset attestations at this time
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {attestations.map((attestation) => (
            <Card key={attestation.id}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{attestation.campaign?.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {attestation.campaign?.description}
                    </p>
                  </div>
                  {getStatusBadge(attestation.status)}
                </div>
              </CardHeader>
              <CardContent className="py-2 px-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="font-medium">Started:</span>{' '}
                      {new Date(attestation.campaign?.start_date).toLocaleDateString()}
                    </p>
                    {attestation.completed_at && (
                      <p>
                        <span className="font-medium">Completed:</span>{' '}
                        {new Date(attestation.completed_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {attestation.status !== 'completed' && (
                    <Button onClick={() => handleStartAttestation(attestation)}>
                      {attestation.status === 'pending' ? 'Start Attestation' : 'Continue Attestation'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
                    onClick={() => setShowAddAssetModal(true)}
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
                  <div className="border rounded-md">
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
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleAttestAsset(asset, asset.status)}
                                    >
                                      Confirm Status
                                    </Button>
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
                  <div className="border rounded-md">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Missing Asset</DialogTitle>
            <DialogDescription>
              Add an asset that you have but isn't currently registered in the system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="asset_type">Asset Type *</Label>
              <Select
                value={newAssetForm.asset_type}
                onValueChange={(value) => setNewAssetForm({ ...newAssetForm, asset_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Laptop">Laptop</SelectItem>
                  <SelectItem value="Desktop">Desktop</SelectItem>
                  <SelectItem value="Monitor">Monitor</SelectItem>
                  <SelectItem value="Phone">Phone</SelectItem>
                  <SelectItem value="Tablet">Tablet</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
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
