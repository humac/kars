import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { UsersProvider, useUsers } from './UsersContext';
import { AuthProvider } from './AuthContext';

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(() => 'mock-token'),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

// Test consumer component
function TestConsumer({ onMount }) {
  const ctx = useUsers();
  if (onMount) onMount(ctx);
  return (
    <div>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="error">{ctx.error || 'none'}</span>
      <span data-testid="count">{ctx.users.length}</span>
      {ctx.users.map((u, i) => (
        <span key={u.id || i} data-testid={`user-${u.id}`}>{u.email}</span>
      ))}
      <button data-testid="refresh" onClick={ctx.refresh}>Refresh</button>
    </div>
  );
}

// Setup auth mock
const setupFetch = (isAuth = true, users = []) => {
  global.fetch.mockImplementation((url) => {
    if (url === '/api/auth/me') {
      return Promise.resolve({
        ok: isAuth,
        json: () => Promise.resolve(isAuth ? { user: { email: 'admin@test.com', role: 'admin' } } : {}),
      });
    }
    if (url === '/api/auth/users') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(users),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
};

describe('UsersContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  describe('useUsers hook', () => {
    it('throws error outside provider', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<TestConsumer />)).toThrow('useUsers must be used within UsersProvider');
      spy.mockRestore();
    });
  });

  describe('Initial State', () => {
    it('starts with empty users', () => {
      global.fetch.mockImplementation(() => new Promise(() => {}));
      render(
        <AuthProvider>
          <UsersProvider>
            <TestConsumer />
          </UsersProvider>
        </AuthProvider>
      );
      expect(screen.getByTestId('count').textContent).toBe('0');
    });

    it('starts with no error', () => {
      global.fetch.mockImplementation(() => new Promise(() => {}));
      render(
        <AuthProvider>
          <UsersProvider>
            <TestConsumer />
          </UsersProvider>
        </AuthProvider>
      );
      expect(screen.getByTestId('error').textContent).toBe('none');
    });
  });

  describe('User Fetching', () => {
    it('fetches users when authenticated', async () => {
      setupFetch(true, [{ id: 1, email: 'user1@test.com' }]);

      render(
        <AuthProvider>
          <UsersProvider>
            <TestConsumer />
          </UsersProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/users', expect.any(Object));
      });
    });

    it('populates users after fetch', async () => {
      setupFetch(true, [
        { id: 1, email: 'a@test.com' },
        { id: 2, email: 'b@test.com' },
      ]);

      render(
        <AuthProvider>
          <UsersProvider>
            <TestConsumer />
          </UsersProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('2');
      });
    });

    it('renders user emails', async () => {
      setupFetch(true, [{ id: 1, email: 'test@example.com' }]);

      render(
        <AuthProvider>
          <UsersProvider>
            <TestConsumer />
          </UsersProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-1').textContent).toBe('test@example.com');
      });
    });

    it('sets loading false after fetch', async () => {
      setupFetch(true, []);

      render(
        <AuthProvider>
          <UsersProvider>
            <TestConsumer />
          </UsersProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
    });
  });

  describe('Error Handling', () => {
    it('sets error on fetch failure', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      global.fetch.mockImplementation((url) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ user: { email: 'a@b.com', role: 'admin' } }),
          });
        }
        if (url === '/api/auth/users') {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(
        <AuthProvider>
          <UsersProvider>
            <TestConsumer />
          </UsersProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error').textContent).toBe('Network error');
      });

      spy.mockRestore();
    });

    it('handles non-ok response', async () => {
      global.fetch.mockImplementation((url) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ user: { email: 'a@b.com', role: 'admin' } }),
          });
        }
        if (url === '/api/auth/users') {
          return Promise.resolve({ ok: false });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(
        <AuthProvider>
          <UsersProvider>
            <TestConsumer />
          </UsersProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('0');
      });
    });
  });

  describe('Helper Functions', () => {
    it('getFullName returns full name', async () => {
      let ref;
      setupFetch(true, [{ id: 1, first_name: 'John', last_name: 'Doe', email: 'j@d.com' }]);

      render(
        <AuthProvider>
          <UsersProvider>
            <TestConsumer onMount={(ctx) => { ref = ctx; }} />
          </UsersProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('1');
      });

      expect(ref.getFullName(1)).toBe('John Doe');
    });

    it('getFullName returns null for unknown id', async () => {
      let ref;
      setupFetch(true, [{ id: 1, first_name: 'John', last_name: 'Doe', email: 'j@d.com' }]);

      render(
        <AuthProvider>
          <UsersProvider>
            <TestConsumer onMount={(ctx) => { ref = ctx; }} />
          </UsersProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('1');
      });

      expect(ref.getFullName(999)).toBeNull();
    });

    it('getFullName returns null for null id', async () => {
      let ref;
      setupFetch(true, []);

      render(
        <AuthProvider>
          <UsersProvider>
            <TestConsumer onMount={(ctx) => { ref = ctx; }} />
          </UsersProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(ref.getFullName(null)).toBeNull();
    });

    it('getFullName trims whitespace', async () => {
      let ref;
      setupFetch(true, [{ id: 1, first_name: '  Jane  ', last_name: '  Smith  ', email: 'j@s.com' }]);

      render(
        <AuthProvider>
          <UsersProvider>
            <TestConsumer onMount={(ctx) => { ref = ctx; }} />
          </UsersProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('1');
      });

      expect(ref.getFullName(1)).toBe('Jane Smith');
    });

    it('getEmail returns email', async () => {
      let ref;
      setupFetch(true, [{ id: 1, email: 'user@example.com' }]);

      render(
        <AuthProvider>
          <UsersProvider>
            <TestConsumer onMount={(ctx) => { ref = ctx; }} />
          </UsersProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('1');
      });

      expect(ref.getEmail(1)).toBe('user@example.com');
    });

    it('getEmail returns null for unknown id', async () => {
      let ref;
      setupFetch(true, [{ id: 1, email: 'a@b.com' }]);

      render(
        <AuthProvider>
          <UsersProvider>
            <TestConsumer onMount={(ctx) => { ref = ctx; }} />
          </UsersProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('1');
      });

      expect(ref.getEmail(999)).toBeNull();
    });

    it('usersById maps users by id', async () => {
      let ref;
      setupFetch(true, [
        { id: 1, email: 'a@a.com' },
        { id: 2, email: 'b@b.com' },
      ]);

      render(
        <AuthProvider>
          <UsersProvider>
            <TestConsumer onMount={(ctx) => { ref = ctx; }} />
          </UsersProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('2');
      });

      expect(ref.usersById[1].email).toBe('a@a.com');
      expect(ref.usersById[2].email).toBe('b@b.com');
    });
  });

  describe('Refresh', () => {
    it('re-fetches users on refresh', async () => {
      setupFetch(true, [{ id: 1, email: 'a@a.com' }]);

      render(
        <AuthProvider>
          <UsersProvider>
            <TestConsumer />
          </UsersProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('1');
      });

      const calls1 = global.fetch.mock.calls.filter(c => c[0] === '/api/auth/users').length;

      await act(async () => {
        screen.getByTestId('refresh').click();
      });

      await waitFor(() => {
        const calls2 = global.fetch.mock.calls.filter(c => c[0] === '/api/auth/users').length;
        expect(calls2).toBeGreaterThan(calls1);
      });
    });
  });
});
