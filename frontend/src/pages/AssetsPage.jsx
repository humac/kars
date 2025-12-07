import React, { useEffect, useState } from 'react';
import AssetTable from '../components/AssetTable';
import AssetEditModal from '../components/AssetEditModal';
import Dashboard from '../components/Dashboard';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Laptop, Loader2 } from 'lucide-react';

export default function AssetsPage() {
  const { getAuthHeaders, user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUser, setCurrentUser] = useState({ roles: ['user'] });

  useEffect(() => {
    if (user) {
      // Map the user role to roles array for compatibility with the modal
      const roles = [];
      if (user.role === 'admin') {
        roles.push('admin');
      } else if (user.role === 'editor') {
        roles.push('editor');
      } else if (user.role === 'manager') {
        roles.push('editor'); // managers can edit similar to editors
      } else {
        roles.push('user'); // default to user role for employees and others
      }
      
      setCurrentUser({ ...user, roles });
    }
  }, [user]);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/assets', {
        headers: { ...getAuthHeaders() }
      });
      if (!res.ok) throw new Error('Failed to load assets');
      const data = await res.json();
      setAssets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [getAuthHeaders]);

  function onEdit(asset) {
    setSelectedAsset(asset);
    setShowEditModal(true);
  }

  function onDelete(id) {
    setAssets(prev => prev.filter(a => a.id !== id));
  }

  async function onSave(updated) {
    setAssets(prev => prev.map(a => (a.id === updated.id ? updated : a)));
    setShowEditModal(false);
    setSelectedAsset(null);
  }

  function onAssetAdded(newAsset) {
    setAssets(prev => [...prev, newAsset]);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading assets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Laptop className="h-5 w-5 text-primary" />
            <CardTitle>Asset Management</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="assets" className="w-full">
            <TabsList>
              <TabsTrigger value="assets">Assets</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            </TabsList>
            <TabsContent value="assets" className="mt-6">
              <AssetTable
                assets={assets}
                onEdit={onEdit}
                onDelete={onDelete}
                currentUser={currentUser}
                onRefresh={loadAssets}
                onAssetAdded={onAssetAdded}
              />
            </TabsContent>
            <TabsContent value="dashboard" className="mt-6">
              <Dashboard />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {showEditModal && selectedAsset && (
        <AssetEditModal
          asset={selectedAsset}
          currentUser={currentUser}
          onClose={() => { setShowEditModal(false); setSelectedAsset(null); }}
          onSaved={onSave}
        />
      )}
    </div>
  );
}
