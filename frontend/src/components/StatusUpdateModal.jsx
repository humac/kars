import { useState } from 'react';
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
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const StatusUpdateModal = ({ asset, onClose, onUpdate }) => {
  const { getAuthHeaders } = useAuth();
  const [status, setStatus] = useState(asset.status);
  const [notes, setNotes] = useState(asset.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/assets/${asset.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ status, notes }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update status');
      }

      onUpdate();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Update Asset Status</DialogTitle>
      <DialogContent>
        <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
          <Typography variant="body2" gutterBottom>
            <strong>Employee:</strong> {asset.employee_name}
          </Typography>
          {asset.employee_email && (
            <Typography variant="body2" gutterBottom>
              <strong>Employee Email:</strong> {asset.employee_email}
            </Typography>
          )}
          <Typography variant="body2" gutterBottom>
            <strong>Serial Number:</strong> {asset.laptop_serial_number}
          </Typography>
          <Typography variant="body2">
            <strong>Asset Tag:</strong> {asset.laptop_asset_tag}
          </Typography>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>New Status *</InputLabel>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              label="New Status *"
              required
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="returned">Returned</MenuItem>
              <MenuItem value="lost">Lost</MenuItem>
              <MenuItem value="damaged">Damaged</MenuItem>
              <MenuItem value="retired">Retired</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            multiline
            rows={4}
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this status change..."
          />
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
          {loading ? 'Updating...' : 'Update Status'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StatusUpdateModal;
