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
        <Grid container spacing={2}>
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
          <Grid item xs={12}>
            <FormControl fullWidth required error={companies.length === 0}>
              <InputLabel>Client Company</InputLabel>
              <Select
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
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Laptop Serial Number"
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
              label="Laptop Asset Tag"
              name="laptop_asset_tag"
              value={formData.laptop_asset_tag}
              onChange={handleChange}
              required
              placeholder="ASSET-001"
            />
          </Grid>
          <Grid item xs={12}>
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
