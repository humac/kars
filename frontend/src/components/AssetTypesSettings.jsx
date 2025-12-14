import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Edit, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

const AssetTypesSettings = () => {
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const [assetTypes, setAssetTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    fetchAssetTypes();
  }, []);

  const fetchAssetTypes = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/asset-types', {
        headers: { ...getAuthHeaders() }
      });
      if (!response.ok) throw new Error('Failed to load asset types');
      const data = await response.json();
      setAssetTypes(data);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormData({
      name: '',
      display_name: '',
      description: '',
      is_active: true
    });
    setShowAddModal(true);
  };

  const handleEdit = (type) => {
    setSelectedType(type);
    setFormData({
      name: type.name,
      display_name: type.display_name,
      description: type.description || '',
      is_active: type.is_active === 1
    });
    setShowEditModal(true);
  };

  const handleDelete = (type) => {
    setSelectedType(type);
    setShowDeleteDialog(true);
  };

  const handleSaveAdd = async () => {
    if (!formData.name || !formData.display_name) {
      toast({ 
        title: "Validation Error", 
        description: "Name and display name are required", 
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/asset-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          ...formData,
          is_active: formData.is_active ? 1 : 0
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create asset type');
      }
      
      toast({ title: "Success", description: "Asset type created successfully", variant: "success" });
      setShowAddModal(false);
      await fetchAssetTypes();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!formData.name || !formData.display_name) {
      toast({ 
        title: "Validation Error", 
        description: "Name and display name are required", 
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/asset-types/${selectedType.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          ...formData,
          is_active: formData.is_active ? 1 : 0
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update asset type');
      }
      
      toast({ title: "Success", description: "Asset type updated successfully", variant: "success" });
      setShowEditModal(false);
      await fetchAssetTypes();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/asset-types/${selectedType.id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete asset type');
      }
      
      toast({ title: "Success", description: "Asset type deleted successfully", variant: "success" });
      setShowDeleteDialog(false);
      await fetchAssetTypes();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (type) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/asset-types/${type.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          is_active: type.is_active === 1 ? 0 : 1
        })
      });
      
      if (!response.ok) throw new Error('Failed to toggle asset type status');
      
      await fetchAssetTypes();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleMoveUp = async (type, index) => {
    if (index === 0) return;
    
    const newOrder = [...assetTypes];
    [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
    
    setLoading(true);
    try {
      const response = await fetch('/api/admin/asset-types/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          orderedIds: newOrder.map(t => t.id)
        })
      });
      
      if (!response.ok) throw new Error('Failed to reorder asset types');
      
      await fetchAssetTypes();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleMoveDown = async (type, index) => {
    if (index === assetTypes.length - 1) return;
    
    const newOrder = [...assetTypes];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    
    setLoading(true);
    try {
      const response = await fetch('/api/admin/asset-types/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          orderedIds: newOrder.map(t => t.id)
        })
      });
      
      if (!response.ok) throw new Error('Failed to reorder asset types');
      
      await fetchAssetTypes();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Asset Types</h3>
          <p className="text-sm text-muted-foreground">
            Configure which asset types are available for registration
          </p>
        </div>
        <Button onClick={handleAdd} disabled={loading}>
          <Plus className="h-4 w-4 mr-2" />
          Add Asset Type
        </Button>
      </div>

      {loading && assetTypes.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assetTypes.map((type, index) => (
                <TableRow key={type.id}>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveUp(type, index)}
                        disabled={index === 0 || loading}
                        className="h-6 w-6 p-0"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveDown(type, index)}
                        disabled={index === assetTypes.length - 1 || loading}
                        className="h-6 w-6 p-0"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{type.name}</TableCell>
                  <TableCell className="font-medium">{type.display_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {type.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={type.is_active === 1}
                      onCheckedChange={() => handleToggleActive(type)}
                      disabled={loading}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{type.usage_count || 0}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(type)}
                        disabled={loading}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(type)}
                        disabled={loading || (type.usage_count && type.usage_count > 0)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Asset Type</DialogTitle>
            <DialogDescription>
              Create a new asset type that will be available for registration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name (ID) *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., laptop, mobile_phone"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Lowercase, no spaces, used as identifier in database
              </p>
            </div>
            <div>
              <Label htmlFor="display_name">Display Name *</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="e.g., Laptop, Mobile Phone"
              />
              <p className="text-xs text-muted-foreground mt-1">
                User-friendly name shown in forms and reports
              </p>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active (available for selection)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSaveAdd} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Asset Type</DialogTitle>
            <DialogDescription>
              Update the asset type configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_name">Name (ID) *</Label>
              <Input
                id="edit_name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., laptop, mobile_phone"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Lowercase, no spaces, used as identifier in database
              </p>
            </div>
            <div>
              <Label htmlFor="edit_display_name">Display Name *</Label>
              <Input
                id="edit_display_name"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="e.g., Laptop, Mobile Phone"
              />
              <p className="text-xs text-muted-foreground mt-1">
                User-friendly name shown in forms and reports
              </p>
            </div>
            <div>
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="edit_is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="edit_is_active">Active (available for selection)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset Type</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedType?.display_name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssetTypesSettings;
