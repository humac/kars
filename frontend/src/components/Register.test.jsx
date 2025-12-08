import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Register from './Register';
import { AuthProvider } from '../contexts/AuthContext';

// Mock fetch
global.fetch = vi.fn();

describe('Register Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders register form with default KARS logo when no branding logo exists', async () => {
    // Mock branding fetch with no logo
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ logo_data: null }),
    });

    const mockSwitchToLogin = vi.fn();

    render(
      <AuthProvider>
        <Register onSwitchToLogin={mockSwitchToLogin} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('KARS')).toBeInTheDocument();
    });

    expect(screen.getByText('KeyData Asset Registration System')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('John')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Doe')).toBeInTheDocument();
  });

  it('renders custom branding logo when available', async () => {
    const mockLogoData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
    
    // Mock branding fetch with logo
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ logo_data: mockLogoData }),
    });

    const mockSwitchToLogin = vi.fn();

    render(
      <AuthProvider>
        <Register onSwitchToLogin={mockSwitchToLogin} />
      </AuthProvider>
    );

    await waitFor(() => {
      const logo = screen.getByAltText('Company Logo');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', mockLogoData);
    });

    // Should NOT show default KARS text when custom logo exists
    expect(screen.queryByText('KARS')).not.toBeInTheDocument();
  });

  it('handles branding fetch error gracefully', async () => {
    // Mock branding fetch failure
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const mockSwitchToLogin = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AuthProvider>
        <Register onSwitchToLogin={mockSwitchToLogin} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('KARS')).toBeInTheDocument();
    });

    // Should still show default logo on error
    expect(screen.getByText('KeyData Asset Registration System')).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch branding:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('updates form fields on user input', async () => {
    // Mock branding fetch
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ logo_data: null }),
    });

    const mockSwitchToLogin = vi.fn();
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <Register onSwitchToLogin={mockSwitchToLogin} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Create an account')).toBeInTheDocument();
    });

    const firstNameInput = screen.getByPlaceholderText('John');
    const emailInput = screen.getByPlaceholderText('you@company.com');

    await user.type(firstNameInput, 'John');
    await user.type(emailInput, 'john@example.com');

    expect(firstNameInput).toHaveValue('John');
    expect(emailInput).toHaveValue('john@example.com');
  });

  it('calls onSwitchToLogin when sign in link is clicked', async () => {
    // Mock branding fetch
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ logo_data: null }),
    });

    const mockSwitchToLogin = vi.fn();
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <Register onSwitchToLogin={mockSwitchToLogin} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/sign in here/i)).toBeInTheDocument();
    });

    const signInLink = screen.getByText(/sign in here/i);
    await user.click(signInLink);

    expect(mockSwitchToLogin).toHaveBeenCalledTimes(1);
  });
});
