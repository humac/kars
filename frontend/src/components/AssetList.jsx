import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Grid,
  Dialog,
  DialogContent,
  DialogActions,
  IconButton,
  useTheme,
  useMediaQuery,
  DialogTitle,
  Stack,
  Link,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  FormControlLabel,
  FormGroup,
} from '@mui/material';
import {
  Add,
  FilterList,
  Clear,
  Edit,
  UploadFile,
  Delete,
  ViewColumn,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import AssetEditModal from './AssetEditModal';
import AssetRegistrationForm from './AssetRegistrationForm';

const AssetList = ({ refresh, onAssetRegistered }) => {
  const { getAuthHeaders, user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [filters, setFilters] = useState({
    employee: '',
    manager: '',
    company: '',
    status: ''
  });

  // Column visibility state - optional columns that can be shown/hidden
  const [optionalColumns, setOptionalColumns] = useState(() => {
    const saved = localStorage.getItem('assetTableColumns');
    return saved ? JSON.parse(saved) : {
      make: true,
      model: true,
      registered: true,
      manager: true,
      notes: false
    };
  });
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  useEffect(() => {
    fetchAssets();
  }, [refresh]);

  useEffect(() => {
    applyFilters();
  }, [assets, filters]);

  const fetchAssets = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/assets', {
        headers: {
          ...getAuthHeaders()
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch assets');
      }
      const data = await response.json();
      setAssets(data);
      setFilteredAssets(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...assets];

    if (filters.employee) {
      filtered = filtered.filter(asset =>
        asset.employee_name.toLowerCase().includes(filters.employee.toLowerCase()) ||
        (asset.employee_email && asset.employee_email.toLowerCase().includes(filters.employee.toLowerCase()))
      );
    }

    if (filters.manager) {
      filtered = filtered.filter(asset =>
        asset.manager_name.toLowerCase().includes(filters.manager.toLowerCase()) ||
        (asset.manager_email && asset.manager_email.toLowerCase().includes(filters.manager.toLowerCase()))
      );
    }

    if (filters.company) {
      filtered = filtered.filter(asset =>
        asset.company_name.toLowerCase().includes(filters.company.toLowerCase())
      );
    }

    if (filters.status) {
      filtered = filtered.filter(asset =>
        asset.status === filters.status
      );
    }

    setFilteredAssets(filtered);
  };

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const clearFilters = () => {
    setFilters({
      employee: '',
      manager: '',
      company: '',
      status: ''
    });
  };

  const toggleColumn = (columnName) => {
    const newColumns = {
      ...optionalColumns,
      [columnName]: !optionalColumns[columnName]
    };
    setOptionalColumns(newColumns);
    localStorage.setItem('assetTableColumns', JSON.stringify(newColumns));
  };

  const handleEditAsset = (asset) => {
    setSelectedAsset(asset);
    setShowEditModal(true);
  };

  const handleEditModalClose = () => {
    setShowEditModal(false);
    setSelectedAsset(null);
  };

  const handleAssetUpdated = () => {
    fetchAssets();
    handleEditModalClose();
  };

  const handleNewAssetClick = () => {
    setShowRegistrationModal(true);
  };

  const handleRegistrationModalClose = () => {
    setShowRegistrationModal(false);
  };

  const handleAssetRegistered = (asset) => {
    setShowRegistrationModal(false);
    fetchAssets();
    if (onAssetRegistered) {
      onAssetRegistered(asset);
    }
  };

  const handleImportAssets = async (e) => {
    e.preventDefault();
    setImportError(null);
    setImportResult(null);

    if (!importFile) {
      setImportError('Please select a CSV file to import.');
      return;
    }

    setImporting(true);

    try {
      const formData = new FormData();
      formData.append('file', importFile);

      const response = await fetch('/api/assets/import', {
        method: 'POST',
        headers: {
          ...getAuthHeaders()
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import assets');
      }

      setImportResult(data);
      setImportFile(null);
      fetchAssets();
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleImportModalClose = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportError(null);
    setImportResult(null);
  };

  const handleDeleteClick = (asset) => {
    setAssetToDelete(asset);
    setShowDeleteConfirm(true);
    setDeleteError(null);
  };

  const handleDeleteConfirmClose = () => {
    setShowDeleteConfirm(false);
    setAssetToDelete(null);
    setDeleteError(null);
  };

  const handleDeleteAsset = async () => {
    if (!assetToDelete) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/assets/${assetToDelete.id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders()
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete asset');
      }

      // Close the dialog and refresh the asset list
      handleDeleteConfirmClose();
      fetchAssets();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'success',
      returned: 'info',
      lost: 'error',
      damaged: 'warning',
      retired: 'default',
    };
    return colors[status] || 'default';
  };

  const hasActiveFilters = filters.employee || filters.manager || filters.company || filters.status;

  if (loading) {
    return (
      <Card sx={{ p: 3 }}>
        <Box display="flex" justifyContent="center" alignItems="center" py={5}>
          <CircularProgress />
          <Typography variant="body1" sx={{ ml: 2 }}>
            Loading assets...
          </Typography>
        </Box>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Asset Inventory
        </Typography>
        <Alert severity="error">{error}</Alert>
      </Card>
    );
  }

  return (
    <>
      <Card sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h5" fontWeight={600}>
            Asset Inventory ({filteredAssets.length} assets)
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<ViewColumn />}
              onClick={() => setShowColumnSelector(true)}
            >
              Columns
            </Button>
            <Button
              variant="outlined"
              startIcon={<UploadFile />}
              onClick={() => setShowImportModal(true)}
            >
              Bulk Import
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleNewAssetClick}
            >
              New Asset
            </Button>
          </Stack>
        </Box>

        {/* Filters */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <FilterList sx={{ mr: 1 }} color="action" />
            <Typography variant="subtitle1" fontWeight={600}>
              Filters
            </Typography>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                name="employee"
                label="Employee"
                placeholder="Search by employee..."
                value={filters.employee}
                onChange={handleFilterChange}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                name="manager"
                label="Manager"
                placeholder="Search by manager..."
                value={filters.manager}
                onChange={handleFilterChange}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                name="company"
                label="Company"
                placeholder="Search by company..."
                value={filters.company}
                onChange={handleFilterChange}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  label="Status"
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="returned">Returned</MenuItem>
                  <MenuItem value="lost">Lost</MenuItem>
                  <MenuItem value="damaged">Damaged</MenuItem>
                  <MenuItem value="retired">Retired</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {hasActiveFilters && (
            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Clear />}
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            </Box>
          )}
        </Box>

        {/* Assets Table */}
        {filteredAssets.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 5 }}>
            <Typography variant="body1" color="text.secondary">
              No assets found matching your search criteria.
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: '100%' }}>
            <Table size={isMobile ? 'small' : 'medium'} sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  {/* Fixed columns */}
                  <TableCell><strong>Employee</strong></TableCell>
                  <TableCell><strong>Employee Email</strong></TableCell>
                  <TableCell><strong>Manager Email</strong></TableCell>
                  <TableCell><strong>Company</strong></TableCell>
                  <TableCell><strong>Serial Number</strong></TableCell>
                  <TableCell><strong>Asset Tag</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  {/* Optional columns */}
                  {optionalColumns.manager && <TableCell><strong>Manager</strong></TableCell>}
                  {optionalColumns.make && <TableCell><strong>Make</strong></TableCell>}
                  {optionalColumns.model && <TableCell><strong>Model</strong></TableCell>}
                  {optionalColumns.registered && <TableCell><strong>Registered</strong></TableCell>}
                  {optionalColumns.notes && <TableCell><strong>Notes</strong></TableCell>}
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAssets.map((asset) => (
                  <TableRow key={asset.id} hover>
                    {/* Fixed columns */}
                    <TableCell>{asset.employee_name}</TableCell>
                    <TableCell>{asset.employee_email || '-'}</TableCell>
                    <TableCell>{asset.manager_email || '-'}</TableCell>
                    <TableCell>{asset.company_name}</TableCell>
                    <TableCell>{asset.laptop_serial_number}</TableCell>
                    <TableCell>{asset.laptop_asset_tag}</TableCell>
                    <TableCell>
                      <Chip
                        label={asset.status.toUpperCase()}
                        color={getStatusColor(asset.status)}
                        size="small"
                      />
                    </TableCell>
                    {/* Optional columns */}
                    {optionalColumns.manager && <TableCell>{asset.manager_name || '-'}</TableCell>}
                    {optionalColumns.make && <TableCell>{asset.laptop_make || '-'}</TableCell>}
                    {optionalColumns.model && <TableCell>{asset.laptop_model || '-'}</TableCell>}
                    {optionalColumns.registered && <TableCell>{formatDate(asset.registration_date)}</TableCell>}
                    {optionalColumns.notes && <TableCell>{asset.notes || '-'}</TableCell>}
                    <TableCell>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleEditAsset(asset)}
                        title="Edit Asset"
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      {(user?.role === 'admin' || asset.employee_email === user?.email) && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteClick(asset)}
                          title="Delete Asset"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {/* Column Selector Modal */}
      <Dialog
        open={showColumnSelector}
        onClose={() => setShowColumnSelector(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Customize Table Columns</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select which optional columns to display in the asset table. Fixed columns (Employee, Employee Email, Manager Email, Company, Serial Number, Asset Tag, Status) are always visible.
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={optionalColumns.manager}
                  onChange={() => toggleColumn('manager')}
                />
              }
              label="Manager Name"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={optionalColumns.make}
                  onChange={() => toggleColumn('make')}
                />
              }
              label="Make"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={optionalColumns.model}
                  onChange={() => toggleColumn('model')}
                />
              }
              label="Model"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={optionalColumns.registered}
                  onChange={() => toggleColumn('registered')}
                />
              }
              label="Registered Date"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={optionalColumns.notes}
                  onChange={() => toggleColumn('notes')}
                />
              }
              label="Notes"
            />
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowColumnSelector(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Asset Edit Modal */}
      {showEditModal && selectedAsset && (
        <AssetEditModal
          asset={selectedAsset}
          onClose={handleEditModalClose}
          onUpdate={handleAssetUpdated}
        />
      )}

      {/* Bulk Import Modal */}
      <Dialog
        open={showImportModal}
        onClose={handleImportModalClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Import Assets from CSV</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload a CSV file with your asset details. Download the example file to see the required columns and formatting.
          </Typography>

          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button
              component="label"
              variant="outlined"
              startIcon={<UploadFile />}
            >
              {importFile ? 'Change File' : 'Choose CSV File'}
              <input
                type="file"
                accept=".csv"
                hidden
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
            </Button>
            <Button
              component={Link}
              href="/import_assets.csv"
              download
              variant="text"
            >
              Download example CSV
            </Button>
          </Stack>

          {importFile && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              Selected file: {importFile.name}
            </Typography>
          )}

          {importError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {importError}
            </Alert>
          )}

          {importResult && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {importResult.message}
            </Alert>
          )}

          {importResult?.errors?.length > 0 && (
            <Paper variant="outlined" sx={{ p: 1, maxHeight: 200, overflow: 'auto' }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Issues
              </Typography>
              <List dense>
                {importResult.errors.map((err, idx) => (
                  <ListItem key={idx} disablePadding>
                    <ListItemText primary={err} />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleImportModalClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleImportAssets}
            disabled={importing}
          >
            {importing ? 'Importing...' : 'Import Assets'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Asset Registration Modal */}
      <Dialog
        open={showRegistrationModal}
        onClose={handleRegistrationModalClose}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogContent>
          <AssetRegistrationForm onAssetRegistered={handleAssetRegistered} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRegistrationModalClose}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={showDeleteConfirm}
        onClose={handleDeleteConfirmClose}
        maxWidth="sm"
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to delete this asset?
          </Typography>
          {assetToDelete && (
            <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2"><strong>Employee:</strong> {assetToDelete.employee_name}</Typography>
              <Typography variant="body2"><strong>Serial Number:</strong> {assetToDelete.laptop_serial_number}</Typography>
              <Typography variant="body2"><strong>Asset Tag:</strong> {assetToDelete.laptop_asset_tag}</Typography>
            </Box>
          )}
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteConfirmClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteAsset}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AssetList;
