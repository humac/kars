import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ForgotPassword from './ForgotPassword';

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

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <ForgotPassword />
    </BrowserRouter>
  );
};

describe('ForgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders forgot password form', () => {
      renderComponent();

      expect(screen.getByText('Forgot Password')).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
    });

    it('renders description text', () => {
      renderComponent();

      expect(screen.getByText(/enter your email address and we'll send you a link to reset your password/i)).toBeInTheDocument();
    });

    it('renders back to login button', () => {
      renderComponent();

      expect(screen.getByRole('button', { name: /back to login/i })).toBeInTheDocument();
    });
  });

  describe('form interaction', () => {
    it('updates email input on user input', async () => {
      const user = userEvent.setup();
      renderComponent();

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'test@example.com');

      expect(emailInput).toHaveValue('test@example.com');
    });

    it('submits form with email', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Reset email sent' }),
      });

      renderComponent();

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com' }),
        });
      });
    });

    it('shows success message after successful submission', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Reset email sent' }),
      });

      renderComponent();

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText(/if an account with that email exists, a password reset link has been sent/i)).toBeInTheDocument();
      });

      // Form should be hidden after success
      expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    });

    it('shows error message on API failure', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Rate limit exceeded' }),
      });

      renderComponent();

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
      });
    });

    it('shows default error message when none provided', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      renderComponent();

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText('Failed to send reset email')).toBeInTheDocument();
      });
    });

    it('handles network error', async () => {
      const user = userEvent.setup();
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      renderComponent();

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('shows loading state while submitting', async () => {
      const user = userEvent.setup();
      // Create a promise that we control
      let resolvePromise;
      global.fetch.mockReturnValue(new Promise((resolve) => {
        resolvePromise = resolve;
      }));

      renderComponent();

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      expect(screen.getByText('Sending...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();

      // Resolve the promise
      resolvePromise({
        ok: true,
        json: async () => ({ message: 'ok' }),
      });
    });
  });

  describe('navigation', () => {
    it('navigates to login when back button clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByRole('button', { name: /back to login/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('shows back to login button after success', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Reset email sent' }),
      });

      renderComponent();

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText(/if an account with that email exists/i)).toBeInTheDocument();
      });

      // There should be a "Back to Login" button in success state
      expect(screen.getByRole('button', { name: /back to login/i })).toBeInTheDocument();
    });
  });
});
