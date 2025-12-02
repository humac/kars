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
} from '@mui/material';
import { Save } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const AssetRegistrationForm = ({ onAssetRegistered }) => {
  const { getAuthHeaders } = useAuth();
  const [formData, setFormData] = useState({
    employee_name: '',
    employee_email: '',
    manager_name: '',
    manager_email: '',
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
    setSuccess(false);

    try {
      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to register asset');
      }

      setSuccess(true);
      setFormData({
        employee_name: '',
        employee_email: '',
        manager_name: '',
        manager_email: '',
        client_name: '',
        laptop_make: '',
        laptop_model: '',
        laptop_serial_number: '',
        laptop_asset_tag: '',
        notes: ''
      });

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
        <Grid container spacing={3}>
          {/* Employee Information */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 600, mb: -1 }}>
              Employee Information
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Employee Name"
              name="employee_name"
              value={formData.employee_name}
              onChange={handleChange}
              required
              placeholder="John Doe"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="email"
              label="Employee Email"
              name="employee_email"
              value={formData.employee_email}
              onChange={handleChange}
              required
              placeholder="john.doe@company.com"
            />
          </Grid>

          {/* Manager Information */}
          <Grid item xs={12} sx={{ mt: 2 }}>
            <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 600, mb: -1 }}>
              Manager Information
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Manager Name"
              name="manager_name"
              value={formData.manager_name}
              onChange={handleChange}
              required
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
              required
              placeholder="jane.smith@company.com"
            />
          </Grid>

          {/* Client Information */}
          <Grid item xs={12} sx={{ mt: 2 }}>
            <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 600, mb: -1 }}>
              Client Information
            </Typography>
          </Grid>
          <Grid item xs={12}>
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
          </Grid>

          {/* Asset Information */}
          <Grid item xs={12} sx={{ mt: 2 }}>
            <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 600, mb: -1 }}>
              Asset Information
            </Typography>
          </Grid>
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

          {/* Notes */}
          <Grid item xs={12} sx={{ mt: 2 }}>
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
          </Grid>
        </Grid>

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
