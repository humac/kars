import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Alert,
  CircularProgress,
  Link,
  IconButton,
} from '@mui/material';
import { Close, Security } from '@mui/icons-material';

const MFAVerifyModal = ({ open, onClose, onVerify, loading, error }) => {
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.trim()) {
      onVerify(code, useBackup);
    }
  };

  const handleClose = () => {
    setCode('');
    setUseBackup(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Security color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Two-Factor Authentication
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {useBackup
            ? 'Enter one of your backup codes to sign in.'
            : 'Enter the 6-digit verification code from your authenticator app.'}
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label={useBackup ? 'Backup Code' : 'Verification Code'}
            value={code}
            onChange={(e) => {
              if (useBackup) {
                // Allow alphanumeric and dashes for backup codes
                setCode(e.target.value.toUpperCase());
              } else {
                // Only digits for TOTP
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
              }
            }}
            placeholder={useBackup ? 'XXXX-XXXX' : '123456'}
            inputProps={{
              maxLength: useBackup ? 9 : 6,
              inputMode: useBackup ? 'text' : 'numeric',
            }}
            autoFocus
            sx={{ mb: 2 }}
          />

          <Box sx={{ textAlign: 'center' }}>
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={() => {
                setUseBackup(!useBackup);
                setCode('');
              }}
              sx={{ cursor: 'pointer' }}
            >
              {useBackup ? 'Use authenticator app instead' : 'Use backup code instead'}
            </Link>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !code.trim()}
        >
          {loading ? <CircularProgress size={24} /> : 'Verify'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MFAVerifyModal;
