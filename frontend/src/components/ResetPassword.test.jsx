import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ResetPassword from './ResetPassword';

// Mock fetch globally
global.fetch = vi.fn();

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderComponent = (path = '/reset-password/valid-token-123') => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ResetPassword />
    </MemoryRouter>
  );
};

describe('ResetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('token verification', () => {
    it('shows verifying state initially', async () => {
      // Don't resolve immediately
      global.fetch.mockReturnValue(new Promise(() => {}));

      renderComponent();

      expect(screen.getByText('Verifying reset link...')).toBeInTheDocument();
    });

    it('shows form when token is valid', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true }),
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
    });

    it('shows error when token is invalid', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: false, error: 'Token expired' }),
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Invalid Reset Link')).toBeInTheDocument();
      });

      expect(screen.getByText('Token expired')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /request new reset link/i })).toBeInTheDocument();
    });

    it('shows error when API returns non-ok response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error' }),
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Invalid Reset Link')).toBeInTheDocument();
      });
    });

    it('shows error when token is missing', async () => {
      renderComponent('/reset-password/');

      await waitFor(() => {
        expect(screen.getByText('Invalid Reset Link')).toBeInTheDocument();
      });

      expect(screen.getByText('Invalid reset link')).toBeInTheDocument();
    });

    it('handles network error during verification', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Invalid Reset Link')).toBeInTheDocument();
      });

      expect(screen.getByText('Failed to verify reset token')).toBeInTheDocument();
    });

    it('calls verify API with correct token', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true }),
      });

      renderComponent('/reset-password/abc123def');

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/verify-reset-token/abc123def');
      });
    });
  });

  describe('password form', () => {
    beforeEach(async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true }),
      });
    });

    it('updates password fields on user input', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/new password/i), 'newpassword123');
      await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123');

      expect(screen.getByLabelText(/new password/i)).toHaveValue('newpassword123');
      expect(screen.getByLabelText(/confirm password/i)).toHaveValue('newpassword123');
    });

    it('shows error when passwords do not match', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/new password/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'differentpassword');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });

    it('shows error when password is too short', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/new password/i), 'short');
      await user.type(screen.getByLabelText(/confirm password/i), 'short');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      // The error message appears in an error alert (red background)
      await waitFor(() => {
        const errorMessages = screen.getAllByText('Password must be at least 8 characters long');
        // Should have 2: one as hint, one as error
        expect(errorMessages.length).toBe(2);
      });
    });

    it('submits form with valid passwords', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      // Mock reset password API
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset successfully' }),
      });

      renderComponent('/reset-password/valid-token');

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/new password/i), 'newpassword123');
      await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: 'valid-token', password: 'newpassword123' }),
        });
      });
    });

    it('shows success message after password reset', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset successfully' }),
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/new password/i), 'newpassword123');
      await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText(/password reset successfully/i)).toBeInTheDocument();
      });
    });

    it('redirects to login after successful reset', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset successfully' }),
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/new password/i), 'newpassword123');
      await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText(/password reset successfully/i)).toBeInTheDocument();
      });

      // Advance timer to trigger redirect
      vi.advanceTimersByTime(3000);

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('shows API error message on failure', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Token has been used already' }),
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/new password/i), 'newpassword123');
      await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText('Token has been used already')).toBeInTheDocument();
      });
    });
  });

  describe('navigation from invalid token state', () => {
    it('navigates to forgot-password when requesting new link', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: false }),
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Invalid Reset Link')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /request new reset link/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/forgot-password');
    });

    it('navigates to login when back button clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: false }),
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Invalid Reset Link')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /back to login/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('loading state', () => {
    it('shows loading state while resetting password', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      // First call for verification
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true }),
      });

      // Second call - don't resolve immediately
      let resolvePromise;
      global.fetch.mockReturnValueOnce(new Promise((resolve) => {
        resolvePromise = resolve;
      }));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/new password/i), 'newpassword123');
      await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      expect(screen.getByText('Resetting Password...')).toBeInTheDocument();

      // Cleanup
      resolvePromise({
        ok: true,
        json: async () => ({ message: 'ok' }),
      });
    });
  });

  describe('password requirements display', () => {
    it('shows password requirements hint', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true }),
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });
  });
});
