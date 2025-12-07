import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoreHorizontal, Edit, Trash2, Laptop } from 'lucide-react';

export default function AssetTable({ assets = [], onEdit, onDelete, currentUser }) {
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const [deleteDialog, setDeleteDialog] = useState({ open: false, asset: null });

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

  if (assets.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Laptop className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No assets found</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map(asset => (
            <TableRow key={asset.id}>
              <TableCell className="font-medium">{asset.employee_name || 'N/A'}</TableCell>
              <TableCell>{asset.laptop_make && asset.laptop_model ? `${asset.laptop_make} ${asset.laptop_model}` : 'N/A'}</TableCell>
              <TableCell>{asset.employee_email || 'N/A'}</TableCell>
              <TableCell>
                <span className="capitalize">{asset.status || 'unknown'}</span>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => onEdit(asset)}
                      disabled={!canEdit(asset)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteDialog({ open: true, asset })}
                      disabled={!canDelete(asset)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, asset: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialog.asset?.employee_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
