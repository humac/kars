import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock clipboard
Object.assign(navigator, {
  clipboard: { writeText: vi.fn(() => Promise.resolve()) },
});

// Mock fetch
global.fetch = vi.fn();

import MFASetupModal from './MFASetupModal';

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onComplete: vi.fn(),
  getAuthHeaders: () => ({ Authorization: 'Bearer token' }),
};

const renderModal = (props = {}) => {
  return render(<MFASetupModal {...defaultProps} {...props} />);
};

describe('MFASetupModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  describe('Initial State', () => {
    it('renders when open is true', () => {
      renderModal();
      expect(screen.getByText('Set Up Two-Factor Authentication')).toBeInTheDocument();
    });

    it('does not render when open is false', () => {
      renderModal({ open: false });
      expect(screen.queryByText('Set Up Two-Factor Authentication')).not.toBeInTheDocument();
    });

    it('shows step 1 of 3', () => {
      renderModal();
      expect(screen.getByText(/Step 1 of 3/)).toBeInTheDocument();
    });

    it('shows MFA benefits text', () => {
      renderModal();
      expect(screen.getByText(/adds an extra layer of security/)).toBeInTheDocument();
    });

    it('lists Google Authenticator', () => {
      renderModal();
      expect(screen.getByText('• Google Authenticator')).toBeInTheDocument();
    });

    it('lists Microsoft Authenticator', () => {
      renderModal();
      expect(screen.getByText('• Microsoft Authenticator')).toBeInTheDocument();
    });

    it('lists Authy', () => {
      renderModal();
      expect(screen.getByText('• Authy')).toBeInTheDocument();
    });

    it('shows Get Started button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument();
    });

    it('shows Cancel button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  describe('Cancel Action', () => {
    it('calls onClose when Cancel clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Enrollment Flow', () => {
    it('calls API on Get Started click', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ qrCode: 'data:image', secret: 'SECRET' }),
      });

      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/mfa/enroll', expect.any(Object));
      });
    });

    it('shows loading state during enrollment', async () => {
      global.fetch.mockImplementation(() => new Promise(() => {}));

      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

      expect(screen.getByText('Starting...')).toBeInTheDocument();
    });

    it('shows error on enrollment failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to enroll' }),
      });

      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

      await waitFor(() => {
        expect(screen.getByText('Failed to enroll')).toBeInTheDocument();
      });
    });

    it('advances to step 2 on success', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ qrCode: 'data:image', secret: 'ABCD1234' }),
      });

      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

      await waitFor(() => {
        expect(screen.getByText(/Step 2 of 3/)).toBeInTheDocument();
      });
    });

    it('displays QR code after enrollment', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ qrCode: 'data:image/png;base64,test', secret: 'SECRET123' }),
      });

      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

      await waitFor(() => {
        expect(screen.getByAltText('MFA QR Code')).toBeInTheDocument();
      });
    });

    it('displays secret code after enrollment', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ qrCode: 'data:image', secret: 'MYSECRET' }),
      });

      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

      await waitFor(() => {
        expect(screen.getByText('MYSECRET')).toBeInTheDocument();
      });
    });

    it('shows verification input after enrollment', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ qrCode: 'data:image', secret: 'SECRET' }),
      });

      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

      await waitFor(() => {
        expect(screen.getByLabelText(/Enter 6-digit code/)).toBeInTheDocument();
      });
    });
  });

  describe('Verification Flow', () => {
    beforeEach(async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ qrCode: 'data:image', secret: 'SECRET' }),
      });
    });

    it('shows Verify button after enrollment', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Verify & Enable' })).toBeInTheDocument();
      });
    });

    it('disables Verify button with empty code', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Verify & Enable' })).toBeDisabled();
      });
    });

    it('enables Verify button with 6-digit code', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

      await waitFor(() => {
        const input = screen.getByLabelText(/Enter 6-digit code/);
        fireEvent.change(input, { target: { value: '123456' } });
      });

      expect(screen.getByRole('button', { name: 'Verify & Enable' })).not.toBeDisabled();
    });

    it('filters non-numeric input', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

      await waitFor(() => {
        const input = screen.getByLabelText(/Enter 6-digit code/);
        fireEvent.change(input, { target: { value: 'abc123xyz' } });
        expect(input).toHaveValue('123');
      });
    });

    it('limits input to 6 characters', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

      await waitFor(() => {
        const input = screen.getByLabelText(/Enter 6-digit code/);
        fireEvent.change(input, { target: { value: '12345678' } });
        expect(input).toHaveValue('123456');
      });
    });
  });

  describe('Backup Codes Flow', () => {
    beforeEach(async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ qrCode: 'data:image', secret: 'SECRET' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ backupCodes: ['CODE1', 'CODE2', 'CODE3'] }),
        });
    });

    it('shows backup codes after verification', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

      await waitFor(() => {
        const input = screen.getByLabelText(/Enter 6-digit code/);
        fireEvent.change(input, { target: { value: '123456' } });
      });

      fireEvent.click(screen.getByRole('button', { name: 'Verify & Enable' }));

      await waitFor(() => {
        expect(screen.getByText('CODE1')).toBeInTheDocument();
        expect(screen.getByText('CODE2')).toBeInTheDocument();
        expect(screen.getByText('CODE3')).toBeInTheDocument();
      });
    });

    it('shows step 3 after verification', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

      await waitFor(() => {
        const input = screen.getByLabelText(/Enter 6-digit code/);
        fireEvent.change(input, { target: { value: '123456' } });
      });

      fireEvent.click(screen.getByRole('button', { name: 'Verify & Enable' }));

      await waitFor(() => {
        expect(screen.getByText(/Step 3 of 3/)).toBeInTheDocument();
      });
    });

    it('shows warning about saving backup codes', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

      await waitFor(() => {
        const input = screen.getByLabelText(/Enter 6-digit code/);
        fireEvent.change(input, { target: { value: '123456' } });
      });

      fireEvent.click(screen.getByRole('button', { name: 'Verify & Enable' }));

      await waitFor(() => {
        expect(screen.getByText(/Save these backup codes/)).toBeInTheDocument();
      });
    });

    it('shows Copy All Codes button', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

      await waitFor(() => {
        const input = screen.getByLabelText(/Enter 6-digit code/);
        fireEvent.change(input, { target: { value: '123456' } });
      });

      fireEvent.click(screen.getByRole('button', { name: 'Verify & Enable' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Copy All Codes/ })).toBeInTheDocument();
      });
    });

    it('shows confirmation button', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

      await waitFor(() => {
        const input = screen.getByLabelText(/Enter 6-digit code/);
        fireEvent.change(input, { target: { value: '123456' } });
      });

      fireEvent.click(screen.getByRole('button', { name: 'Verify & Enable' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Saved My Backup Codes/ })).toBeInTheDocument();
      });
    });

    it('calls onComplete when confirmed', async () => {
      const onComplete = vi.fn();
      renderModal({ onComplete });
      fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

      await waitFor(() => {
        const input = screen.getByLabelText(/Enter 6-digit code/);
        fireEvent.change(input, { target: { value: '123456' } });
      });

      fireEvent.click(screen.getByRole('button', { name: 'Verify & Enable' }));

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Saved My Backup Codes/ }));
      });

      expect(onComplete).toHaveBeenCalled();
    });
  });
});
