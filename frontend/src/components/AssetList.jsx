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
} from '@mui/material';
import {
  Add,
  FilterList,
  Clear,
  Edit,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import StatusUpdateModal from './StatusUpdateModal';
import AssetRegistrationForm from './AssetRegistrationForm';

const AssetList = ({ refresh, onAssetRegistered }) => {
  const { getAuthHeaders } = useAuth();
  const [assets, setAssets] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [filters, setFilters] = useState({
    employee: '',
    manager: '',
    client: '',
    status: ''
  });

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

    if (filters.client) {
      filtered = filtered.filter(asset =>
        asset.client_name.toLowerCase().includes(filters.client.toLowerCase())
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
      client: '',
      status: ''
    });
  };

  const handleStatusUpdate = (asset) => {
    setSelectedAsset(asset);
    setShowStatusModal(true);
  };

  const handleStatusModalClose = () => {
    setShowStatusModal(false);
    setSelectedAsset(null);
  };

  const handleStatusUpdated = () => {
    fetchAssets();
    handleStatusModalClose();
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

  const hasActiveFilters = filters.employee || filters.manager || filters.client || filters.status;

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
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleNewAssetClick}
          >
            New Asset
          </Button>
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
                name="client"
                label="Client"
                placeholder="Search by client..."
                value={filters.client}
                onChange={handleFilterChange}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
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
            <Table size={isMobile ? 'small' : 'medium'} sx={{ minWidth: isMobile ? 300 : 800 }}>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Employee</strong></TableCell>
                  {!isMobile && <TableCell><strong>Employee Email</strong></TableCell>}
                  <TableCell><strong>Manager</strong></TableCell>
                  {!isMobile && <TableCell><strong>Manager Email</strong></TableCell>}
                  <TableCell><strong>Client</strong></TableCell>
                  {!isMobile && <TableCell><strong>Serial Number</strong></TableCell>}
                  {!isMobile && <TableCell><strong>Asset Tag</strong></TableCell>}
                  <TableCell><strong>Status</strong></TableCell>
                  {!isMobile && <TableCell><strong>Registered</strong></TableCell>}
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAssets.map((asset) => (
                  <TableRow key={asset.id} hover>
                    <TableCell>{asset.employee_name}</TableCell>
                    {!isMobile && <TableCell>{asset.employee_email || '-'}</TableCell>}
                    <TableCell>{asset.manager_name}</TableCell>
                    {!isMobile && <TableCell>{asset.manager_email || '-'}</TableCell>}
                    <TableCell>{asset.client_name}</TableCell>
                    {!isMobile && <TableCell>{asset.laptop_serial_number}</TableCell>}
                    {!isMobile && <TableCell>{asset.laptop_asset_tag}</TableCell>}
                    <TableCell>
                      <Chip
                        label={asset.status.toUpperCase()}
                        color={getStatusColor(asset.status)}
                        size="small"
                      />
                    </TableCell>
                    {!isMobile && <TableCell>{formatDate(asset.registration_date)}</TableCell>}
                    <TableCell>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleStatusUpdate(asset)}
                        title="Update Status"
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {/* Status Update Modal */}
      {showStatusModal && selectedAsset && (
        <StatusUpdateModal
          asset={selectedAsset}
          onClose={handleStatusModalClose}
          onUpdate={handleStatusUpdated}
        />
      )}

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
    </>
  );
};

export default AssetList;
