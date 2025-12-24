import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

// Mock fetch globally
global.fetch = vi.fn();

// Test component that exposes auth context
function TestConsumer({ onMount }) {
  const auth = useAuth();
  if (onMount) {
    onMount(auth);
  }
  return (
    <div>
      <span data-testid="loading">{auth.loading.toString()}</span>
      <span data-testid="authenticated">{auth.isAuthenticated.toString()}</span>
      <span data-testid="user-email">{auth.user?.email || 'none'}</span>
      <span data-testid="user-role">{auth.user?.role || 'none'}</span>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('useAuth hook', () => {
    it('throws error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useAuth must be used within AuthProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('initial state', () => {
    it('starts in loading state without token', async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      // Should quickly become not loading when no token
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('user-email')).toHaveTextContent('none');
    });

    it('verifies token on mount when token exists', async () => {
      localStorage.setItem('token', 'valid-token');

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'user@test.com', role: 'admin' }),
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/auth/me', {
        headers: { 'Authorization': 'Bearer valid-token' }
      });
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('user-email')).toHaveTextContent('user@test.com');
    });

    it('clears invalid token on verification failure', async () => {
      localStorage.setItem('token', 'invalid-token');

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('handles network error during token verification', async () => {
      localStorage.setItem('token', 'some-token');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      expect(localStorage.getItem('token')).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('login', () => {
    it('successfully logs in user', async () => {
      let authContext;

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'new-token',
          user: { email: 'user@test.com', role: 'employee' }
        }),
      });

      render(
        <AuthProvider>
          <TestConsumer onMount={(auth) => { authContext = auth; }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      let result;
      await act(async () => {
        result = await authContext.login('user@test.com', 'password123');
      });

      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@test.com', password: 'password123' }),
      });
      expect(localStorage.getItem('token')).toBe('new-token');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('user-email')).toHaveTextContent('user@test.com');
    });

    it('returns error on failed login', async () => {
      let authContext;

      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid credentials' }),
      });

      render(
        <AuthProvider>
          <TestConsumer onMount={(auth) => { authContext = auth; }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      let result;
      await act(async () => {
        result = await authContext.login('user@test.com', 'wrongpassword');
      });

      expect(result).toEqual({ success: false, error: 'Invalid credentials' });
      expect(localStorage.getItem('token')).toBeNull();
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    });

    it('handles network error during login', async () => {
      let authContext;

      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <AuthProvider>
          <TestConsumer onMount={(auth) => { authContext = auth; }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      let result;
      await act(async () => {
        result = await authContext.login('user@test.com', 'password');
      });

      expect(result).toEqual({ success: false, error: 'Network error' });
    });

    it('uses default error message when none provided', async () => {
      let authContext;

      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}), // No error message
      });

      render(
        <AuthProvider>
          <TestConsumer onMount={(auth) => { authContext = auth; }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      let result;
      await act(async () => {
        result = await authContext.login('user@test.com', 'password');
      });

      expect(result).toEqual({ success: false, error: 'Login failed' });
    });
  });

  describe('register', () => {
    it('successfully registers user', async () => {
      let authContext;

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'new-token',
          user: { email: 'new@test.com', role: 'employee' }
        }),
      });

      render(
        <AuthProvider>
          <TestConsumer onMount={(auth) => { authContext = auth; }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      let result;
      await act(async () => {
        result = await authContext.register(
          'new@test.com',
          'password123',
          'John',
          'Doe',
          'Jane',
          'Manager',
          'jane@test.com'
        );
      });

      expect(result).toEqual({ success: true, redirectToAttestations: false });
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'new@test.com',
          password: 'password123',
          first_name: 'John',
          last_name: 'Doe',
          manager_first_name: 'Jane',
          manager_last_name: 'Manager',
          manager_email: 'jane@test.com'
        }),
      });
      expect(localStorage.getItem('token')).toBe('new-token');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });

    it('returns redirectToAttestations when set', async () => {
      let authContext;

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'new-token',
          user: { email: 'new@test.com', role: 'employee' },
          redirectToAttestations: true
        }),
      });

      render(
        <AuthProvider>
          <TestConsumer onMount={(auth) => { authContext = auth; }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      let result;
      await act(async () => {
        result = await authContext.register('new@test.com', 'password123', 'John', 'Doe', '', '', '');
      });

      expect(result).toEqual({ success: true, redirectToAttestations: true });
    });

    it('returns error on failed registration', async () => {
      let authContext;

      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Email already exists' }),
      });

      render(
        <AuthProvider>
          <TestConsumer onMount={(auth) => { authContext = auth; }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      let result;
      await act(async () => {
        result = await authContext.register('existing@test.com', 'password', '', '', '', '', '');
      });

      expect(result).toEqual({ success: false, error: 'Email already exists' });
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('logout', () => {
    it('clears auth state and token', async () => {
      let authContext;
      localStorage.setItem('token', 'existing-token');

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'user@test.com', role: 'admin' }),
      });

      render(
        <AuthProvider>
          <TestConsumer onMount={(auth) => { authContext = auth; }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      });

      act(() => {
        authContext.logout();
      });

      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('user-email')).toHaveTextContent('none');
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('updates user data without affecting token', async () => {
      let authContext;
      localStorage.setItem('token', 'existing-token');

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'user@test.com', role: 'employee' }),
      });

      render(
        <AuthProvider>
          <TestConsumer onMount={(auth) => { authContext = auth; }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-role')).toHaveTextContent('employee');
      });

      act(() => {
        authContext.updateUser({ email: 'user@test.com', role: 'admin' });
      });

      expect(screen.getByTestId('user-role')).toHaveTextContent('admin');
      expect(localStorage.getItem('token')).toBe('existing-token');
    });
  });

  describe('setAuthData', () => {
    it('sets token and user data', async () => {
      let authContext;

      render(
        <AuthProvider>
          <TestConsumer onMount={(auth) => { authContext = auth; }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      act(() => {
        authContext.setAuthData('new-token', { email: 'sso@test.com', role: 'manager' });
      });

      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('user-email')).toHaveTextContent('sso@test.com');
      expect(screen.getByTestId('user-role')).toHaveTextContent('manager');
      expect(localStorage.getItem('token')).toBe('new-token');
    });
  });

  describe('getAuthHeaders', () => {
    it('returns empty object when no token', async () => {
      let authContext;

      render(
        <AuthProvider>
          <TestConsumer onMount={(auth) => { authContext = auth; }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(authContext.getAuthHeaders()).toEqual({});
    });

    it('returns authorization header when token exists', async () => {
      let authContext;
      localStorage.setItem('token', 'test-token');

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'user@test.com', role: 'admin' }),
      });

      render(
        <AuthProvider>
          <TestConsumer onMount={(auth) => { authContext = auth; }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      });

      expect(authContext.getAuthHeaders()).toEqual({
        'Authorization': 'Bearer test-token'
      });
    });

    it('is memoized and stable across renders', async () => {
      let authContext;
      let getAuthHeadersRef;

      localStorage.setItem('token', 'test-token');

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'user@test.com', role: 'admin' }),
      });

      const { rerender } = render(
        <AuthProvider>
          <TestConsumer onMount={(auth) => {
            authContext = auth;
            getAuthHeadersRef = auth.getAuthHeaders;
          }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      });

      const firstRef = getAuthHeadersRef;

      // Trigger a rerender
      rerender(
        <AuthProvider>
          <TestConsumer onMount={(auth) => {
            authContext = auth;
            getAuthHeadersRef = auth.getAuthHeaders;
          }} />
        </AuthProvider>
      );

      // getAuthHeaders should be the same reference (memoized)
      expect(getAuthHeadersRef).toBe(firstRef);
    });
  });

  describe('role-based access', () => {
    it('correctly identifies admin user', async () => {
      let authContext;
      localStorage.setItem('token', 'admin-token');

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'admin@test.com', role: 'admin' }),
      });

      render(
        <AuthProvider>
          <TestConsumer onMount={(auth) => { authContext = auth; }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-role')).toHaveTextContent('admin');
      });

      expect(authContext.user.role).toBe('admin');
    });

    it('correctly identifies manager user', async () => {
      localStorage.setItem('token', 'manager-token');

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'manager@test.com', role: 'manager' }),
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-role')).toHaveTextContent('manager');
      });
    });

    it('correctly identifies attestation_coordinator user', async () => {
      localStorage.setItem('token', 'coordinator-token');

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'coord@test.com', role: 'attestation_coordinator' }),
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-role')).toHaveTextContent('attestation_coordinator');
      });
    });

    it('correctly identifies employee user', async () => {
      localStorage.setItem('token', 'employee-token');

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'employee@test.com', role: 'employee' }),
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-role')).toHaveTextContent('employee');
      });
    });
  });
});
