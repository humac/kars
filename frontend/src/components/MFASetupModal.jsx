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
  Stepper,
  Step,
  StepLabel,
  Alert,
  Paper,
  CircularProgress,
  Chip,
  IconButton,
  Divider,
} from '@mui/material';
import { Close, ContentCopy, CheckCircle } from '@mui/icons-material';

const MFASetupModal = ({ open, onClose, onComplete, getAuthHeaders }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);

  const steps = ['Scan QR Code', 'Verify Setup', 'Save Backup Codes'];

  const handleStart = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/mfa/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start MFA enrollment');
      }

      setQrCode(data.qrCode);
      setSecret(data.secret);
      setActiveStep(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/mfa/verify-enrollment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ token: verificationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      setBackupCodes(data.backupCodes);
      setActiveStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    onComplete();
    handleReset();
  };

  const handleReset = () => {
    setActiveStep(0);
    setQrCode('');
    setSecret('');
    setVerificationCode('');
    setBackupCodes([]);
    setError('');
    setCopiedSecret(false);
    setCopiedBackupCodes(false);
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleCopyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopiedBackupCodes(true);
    setTimeout(() => setCopiedBackupCodes(false), 2000);
  };

  const handleDialogClose = () => {
    if (activeStep === 2) {
      // Force user to acknowledge backup codes
      return;
    }
    handleReset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={activeStep === 2}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={600}>
            Set Up Two-Factor Authentication
          </Typography>
          {activeStep !== 2 && (
            <IconButton onClick={handleDialogClose} size="small">
              <Close />
            </IconButton>
          )}
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Step 0: Initial state */}
        {activeStep === 0 && (
          <Box>
            <Typography variant="body1" gutterBottom>
              Two-factor authentication adds an extra layer of security to your account.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              You'll need an authenticator app on your phone such as:
            </Typography>
            <Box sx={{ mt: 1, ml: 2 }}>
              <Typography variant="body2">• Google Authenticator</Typography>
              <Typography variant="body2">• Microsoft Authenticator</Typography>
              <Typography variant="body2">• Authy</Typography>
            </Box>
          </Box>
        )}

        {/* Step 1: QR Code Display */}
        {activeStep === 1 && (
          <Box>
            <Typography variant="body1" gutterBottom>
              Scan this QR code with your authenticator app:
            </Typography>

            {qrCode && (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                <img src={qrCode} alt="MFA QR Code" style={{ maxWidth: '200px' }} />
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            <Typography variant="body2" color="text.secondary" gutterBottom>
              Or enter this code manually:
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', position: 'relative' }}>
              <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                {secret}
              </Typography>
              <IconButton
                size="small"
                onClick={handleCopySecret}
                sx={{ position: 'absolute', top: 8, right: 8 }}
              >
                {copiedSecret ? <CheckCircle color="success" /> : <ContentCopy />}
              </IconButton>
            </Paper>

            <TextField
              fullWidth
              label="Enter 6-digit code from app"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              inputProps={{ maxLength: 6, pattern: '[0-9]*', inputMode: 'numeric' }}
              sx={{ mt: 3 }}
              autoFocus
            />
          </Box>
        )}

        {/* Step 2: Backup Codes */}
        {activeStep === 2 && (
          <Box>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight={600}>
                Save these backup codes in a secure place!
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                You can use these codes to access your account if you lose access to your authenticator app.
              </Typography>
            </Alert>

            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', position: 'relative' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                {backupCodes.map((code, index) => (
                  <Chip
                    key={index}
                    label={code}
                    sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                  />
                ))}
              </Box>
              <Button
                size="small"
                startIcon={copiedBackupCodes ? <CheckCircle /> : <ContentCopy />}
                onClick={handleCopyBackupCodes}
                sx={{ mt: 2 }}
              >
                {copiedBackupCodes ? 'Copied!' : 'Copy All Codes'}
              </Button>
            </Paper>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {activeStep === 0 && (
          <>
            <Button onClick={handleDialogClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleStart}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Get Started'}
            </Button>
          </>
        )}

        {activeStep === 1 && (
          <>
            <Button onClick={handleDialogClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleVerify}
              disabled={loading || verificationCode.length !== 6}
            >
              {loading ? <CircularProgress size={24} /> : 'Verify & Enable'}
            </Button>
          </>
        )}

        {activeStep === 2 && (
          <Button variant="contained" onClick={handleComplete} fullWidth>
            I've Saved My Backup Codes
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default MFASetupModal;
