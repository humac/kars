import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Download, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AssetBulkImportModal({ onClose, onImported }) {
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  async function handleImport(e) {
    e.preventDefault();
    
    if (!importFile) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV file to import",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      
      const res = await fetch('/api/assets/import', {
        method: 'POST',
        headers: {
          ...getAuthHeaders()
        },
        body: formData,
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }
      
      setResult(data);
      
      if (data.imported > 0) {
        toast({
          title: "Import Complete",
          description: data.message,
          variant: "success",
        });
        
        // Call onImported to refresh the asset list
        if (onImported) {
          onImported();
        }
      } else {
        toast({
          title: "Import Issues",
          description: "No assets were imported. Please check the errors below.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Import Error",
        description: err.message || 'Unable to import assets.',
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type - check both extension and MIME type
      const isCSV = file.name.endsWith('.csv') || file.type === 'text/csv' || file.type === 'application/csv';
      if (!isCSV) {
        toast({
          title: "Invalid File Type",
          description: "Please select a CSV file",
          variant: "destructive",
        });
        return;
      }
      setImportFile(file);
      setResult(null); // Clear previous results
    }
  }

  function handleClose() {
    if (!importing) {
      onClose();
    }
  }

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Assets</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple assets at once. Download the example file to see the required format.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleImport} className="space-y-4 py-2">
          {/* CSV Format Information */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2 text-sm">
                <p className="font-medium">Required fields:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>employee_first_name</li>
                  <li>employee_last_name</li>
                  <li>employee_email</li>
                  <li>company_name</li>
                  <li>asset_type (laptop or mobile_phone)</li>
                  <li>serial_number (must be unique)</li>
                  <li>asset_tag (must be unique)</li>
                </ul>
                <p className="font-medium mt-3">Optional fields:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>manager_first_name</li>
                  <li>manager_last_name</li>
                  <li>manager_email</li>
                  <li>make</li>
                  <li>model</li>
                  <li>status (active, returned, lost, damaged, retired)</li>
                  <li>issued_date (YYYY-MM-DD format)</li>
                  <li>returned_date (YYYY-MM-DD format, required if status is returned)</li>
                  <li>notes</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          {/* File Selection */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                asChild
              >
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  {importFile ? 'Change File' : 'Choose CSV File'}
                  <input 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    onChange={handleFileChange}
                    disabled={importing}
                  />
                </label>
              </Button>
              
              <Button 
                type="button" 
                variant="ghost"
                asChild
              >
                <a href="/import_assets.csv" download>
                  <Download className="h-4 w-4 mr-2" />
                  Example CSV
                </a>
              </Button>
            </div>

            {importFile && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <span className="font-medium">Selected file: </span>
                <span className="text-muted-foreground">{importFile.name}</span>
                <span className="text-muted-foreground ml-2">
                  ({(importFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}
          </div>

          {/* Import Results */}
          {result && (
            <div className="space-y-3">
              {result.imported > 0 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-900">
                    Successfully imported {result.imported} asset{result.imported !== 1 ? 's' : ''}
                  </AlertDescription>
                </Alert>
              )}

              {result.failed > 0 && result.errors && result.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">
                      {result.failed} error{result.failed !== 1 ? 's' : ''} occurred:
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1 text-sm">
                      {result.errors.map((error, index) => (
                        <div key={index} className="font-mono text-xs">
                          {error}
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={importing}
            >
              {result ? 'Close' : 'Cancel'}
            </Button>
            {!result && (
              <Button
                type="submit"
                disabled={importing || !importFile}
              >
                {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {importing ? 'Importing...' : 'Import Assets'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
