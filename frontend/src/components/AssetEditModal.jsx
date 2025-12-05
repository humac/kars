import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Grid,
  Divider,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const AssetEditModal = ({ asset, onClose, onUpdate }) => {
  const { getAuthHeaders, user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Parse employee name into first and last name
  const parseEmployeeName = (fullName) => {
    if (!fullName) return { first: '', last: '' };
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return { first: parts[0], last: '' };
    const last = parts.pop();
    const first = parts.join(' ');
    return { first, last };
  };

  const employeeName = parseEmployeeName(asset.employee_name);
  const isEmployee = user?.role === 'employee' && user?.email === asset.employee_email;

  const [formData, setFormData] = useState({
    employee_first_name: employeeName.first,
    employee_last_name: employeeName.last,
    employee_email: asset.employee_email || '',
    manager_name: asset.manager_name || '',
    manager_email: asset.manager_email || '',
    company_name: asset.company_name || '',
    laptop_serial_number: asset.laptop_serial_number || '',
    laptop_asset_tag: asset.laptop_asset_tag || '',
    laptop_make: asset.laptop_make || '',
    laptop_model: asset.laptop_model || '',
    status: asset.status || 'active',
    notes: asset.notes || ''
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/companies/names', {
        headers: {
          ...getAuthHeaders()
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCompanies(data);
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Combine first and last names for API
      const submitData = {
        ...formData,
        employee_name: `${formData.employee_first_name} ${formData.employee_last_name}`.trim()
      };
      // Remove the separate fields since API expects employee_name
      delete submitData.employee_first_name;
      delete submitData.employee_last_name;

      const response = await fetch(`/api/assets/${asset.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update asset');
      }

      onUpdate();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Asset</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
          {/* Employee Information Section */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" color="primary" sx={{ fontWeight: 600, mb: 2 }}>
              Employee Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="First Name"
                  name="employee_first_name"
                  value={formData.employee_first_name}
                  onChange={handleChange}
                  required
                  disabled={isEmployee}
                  placeholder="John"
                  helperText={isEmployee ? 'You cannot edit your own name' : ''}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Last Name"
                  name="employee_last_name"
                  value={formData.employee_last_name}
                  onChange={handleChange}
                  required
                  disabled={isEmployee}
                  placeholder="Doe"
                  helperText={isEmployee ? 'You cannot edit your own name' : ''}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="email"
                  label="Email"
                  name="employee_email"
                  value={formData.employee_email}
                  onChange={handleChange}
                  required
                  disabled={isEmployee}
                  placeholder="john.doe@company.com"
                  helperText={isEmployee ? 'You cannot edit your own email' : ''}
                />
              </Grid>
            </Grid>
          </Box>

          {/* Manager Information Section */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" color="primary" sx={{ fontWeight: 600, mb: 2 }}>
              Manager Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Manager Name"
                  name="manager_name"
                  value={formData.manager_name}
                  onChange={handleChange}
                  placeholder="Jane Smith"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="email"
                  label="Manager Email"
                  name="manager_email"
                  value={formData.manager_email}
                  onChange={handleChange}
                  placeholder="manager@company.com"
                />
              </Grid>
            </Grid>
          </Box>

          {/* Company Information Section */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" color="primary" sx={{ fontWeight: 600, mb: 2 }}>
              Company Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <FormControl fullWidth required>
              <InputLabel id="company-label">Company</InputLabel>
              <Select
                labelId="company-label"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                label="Company"
                required
              >
                <MenuItem value="">
                  <em>Select a company...</em>
                </MenuItem>
                {companies.map((company) => (
                  <MenuItem key={company.id} value={company.name}>
                    {company.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Asset Information Section */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" color="primary" sx={{ fontWeight: 600, mb: 2 }}>
              Asset Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Serial Number"
                  name="laptop_serial_number"
                  value={formData.laptop_serial_number}
                  onChange={handleChange}
                  required
                  placeholder="SN123456789"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Asset Tag"
                  name="laptop_asset_tag"
                  value={formData.laptop_asset_tag}
                  onChange={handleChange}
                  required
                  placeholder="ASSET-001"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Make"
                  name="laptop_make"
                  value={formData.laptop_make}
                  onChange={handleChange}
                  placeholder="Dell"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Model"
                  name="laptop_model"
                  value={formData.laptop_model}
                  onChange={handleChange}
                  placeholder="Latitude 5420"
                />
              </Grid>
            </Grid>
          </Box>

          {/* Status Section */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" color="primary" sx={{ fontWeight: 600, mb: 2 }}>
              Status
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <FormControl fullWidth>
              <InputLabel>Status *</InputLabel>
              <Select
                value={formData.status}
                onChange={handleChange}
                label="Status *"
                name="status"
                required
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="returned">Returned</MenuItem>
                <MenuItem value="lost">Lost</MenuItem>
                <MenuItem value="damaged">Damaged</MenuItem>
                <MenuItem value="retired">Retired</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Notes Section */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notes (Optional)"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional information..."
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Updating...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssetEditModal;
