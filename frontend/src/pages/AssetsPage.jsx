import React, { useEffect, useState } from 'react';
import AssetTable from '../components/AssetTable';
import AssetEditModal from '../components/AssetEditModal';
import AssetRegisterModal from '../components/AssetRegisterModal';
import AssetBulkImportModal from '../components/AssetBulkImportModal';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Laptop, Loader2, Upload, Plus } from 'lucide-react';

export default function AssetsPage() {
  const { getAuthHeaders, user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
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

  const canRegister = () => {
    if (currentUser?.roles?.includes('admin')) return true;
    if (currentUser?.roles?.includes('editor')) return true;
    if (currentUser?.roles?.includes('user')) return true;
    return false;
  };

  const canBulkImport = () => {
    return currentUser?.roles?.includes('admin') || currentUser?.roles?.includes('editor');
  };

  const handleAssetRegistered = (newAsset) => {
    onAssetAdded(newAsset);
    loadAssets();
  };

  const handleBulkImported = () => {
    loadAssets();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading assets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <Card>
        <CardHeader className="space-y-3 md:space-y-4 px-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Laptop className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg sm:text-xl">Asset Management ({assets.length})</CardTitle>
            </div>
            {canRegister() && (
              <div className="flex gap-2 flex-wrap">
                {canBulkImport() && (
                  <Button variant="outline" onClick={() => setShowBulkImportModal(true)} className="flex-1 sm:flex-none">
                    <Upload className="h-4 w-4 mr-2" />Bulk Import
                  </Button>
                )}
                <Button onClick={() => setShowRegisterModal(true)} className="flex-1 sm:flex-none">
                  <Plus className="h-4 w-4 mr-2" />Register Asset
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <AssetTable
            assets={assets}
            onEdit={onEdit}
            onDelete={onDelete}
            currentUser={currentUser}
            onRefresh={loadAssets}
            onAssetAdded={onAssetAdded}
          />
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

      {showRegisterModal && (
        <AssetRegisterModal
          onClose={() => setShowRegisterModal(false)}
          onRegistered={handleAssetRegistered}
        />
      )}

      {showBulkImportModal && (
        <AssetBulkImportModal
          onClose={() => setShowBulkImportModal(false)}
          onImported={handleBulkImported}
        />
      )}
    </div>
  );
}
