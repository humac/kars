import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Grid,
  CircularProgress,
  FormHelperText,
  Divider,
} from '@mui/material';
import { Save } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const AssetRegistrationForm = ({ onAssetRegistered }) => {
  const { getAuthHeaders, user } = useAuth();
  const [formData, setFormData] = useState({
    employee_first_name: '',
    employee_last_name: '',
    employee_email: '',
    client_name: '',
    laptop_make: '',
    laptop_model: '',
    laptop_serial_number: '',
    laptop_asset_tag: '',
    notes: ''
  });

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchCompanies();

    // Pre-populate employee fields for non-admin/manager users
    if (user && user.role === 'employee') {
      setFormData(prev => ({
        ...prev,
        employee_first_name: user.first_name || '',
        employee_last_name: user.last_name || '',
        employee_email: user.email || ''
      }));
    }
  }, [user]);

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
    setSuccess(false);

    try {
      // Combine first and last names for API
      const submitData = {
        ...formData,
        employee_name: `${formData.employee_first_name} ${formData.employee_last_name}`.trim()
      };
      // Remove the separate fields since API expects employee_name
      delete submitData.employee_first_name;
      delete submitData.employee_last_name;

      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to register asset');
      }

      setSuccess(true);

      // Reset form, but keep employee info pre-populated for employees
      if (user && user.role === 'employee') {
        setFormData({
          employee_first_name: user.first_name || '',
          employee_last_name: user.last_name || '',
          employee_email: user.email || '',
          client_name: '',
          laptop_make: '',
          laptop_model: '',
          laptop_serial_number: '',
          laptop_asset_tag: '',
          notes: ''
        });
      } else {
        setFormData({
          employee_first_name: '',
          employee_last_name: '',
          employee_email: '',
          client_name: '',
          laptop_make: '',
          laptop_model: '',
          laptop_serial_number: '',
          laptop_asset_tag: '',
          notes: ''
        });
      }

      if (onAssetRegistered) {
        onAssetRegistered(data.asset);
      }

      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Register New Asset
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Asset registered successfully!
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
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
                disabled={user?.role === 'employee'}
                placeholder="John"
                helperText={user?.role === 'employee' ? 'Pre-filled from your account' : ''}
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
                disabled={user?.role === 'employee'}
                placeholder="Doe"
                helperText={user?.role === 'employee' ? 'Pre-filled from your account' : ''}
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
                disabled={user?.role === 'employee'}
                placeholder="john.doe@company.com"
                helperText={user?.role === 'employee' ? 'Pre-filled from your account' : ''}
              />
            </Grid>
          </Grid>
        </Box>

        {/* Client Information Section */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" color="primary" sx={{ fontWeight: 600, mb: 2 }}>
            Client Information
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <FormControl fullWidth required error={companies.length === 0}>
            <InputLabel id="client-company-label">Client Company</InputLabel>
            <Select
              labelId="client-company-label"
              name="client_name"
              value={formData.client_name}
              onChange={handleChange}
              label="Client Company"
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
            {companies.length === 0 && (
              <FormHelperText>
                No companies available. Please add companies first in the Company Management section.
              </FormHelperText>
            )}
          </FormControl>
        </Box>

        {/* Asset Information Section */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" color="primary" sx={{ fontWeight: 600, mb: 2 }}>
            Asset Information
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Make"
                name="laptop_make"
                value={formData.laptop_make}
                onChange={handleChange}
                required
                placeholder="Dell"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Model"
                name="laptop_model"
                value={formData.laptop_model}
                onChange={handleChange}
                required
                placeholder="Latitude 5420"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
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
            <Grid item xs={12} sm={6} md={3}>
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
          </Grid>
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

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <Save />}
          sx={{ mt: 3 }}
        >
          {loading ? 'Registering...' : 'Register Asset'}
        </Button>
      </Box>
    </Box>
  );
};

export default AssetRegistrationForm;
