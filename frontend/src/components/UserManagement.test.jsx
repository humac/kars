import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import UserManagement from './UserManagement';

// Mock fetch
global.fetch = vi.fn();

// Mock useAuth hook
const mockGetAuthHeaders = vi.fn(() => ({ Authorization: 'Bearer test-token' }));
let mockUser = { id: 1, email: 'admin@test.com', role: 'admin' };

vi.mock('../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      getAuthHeaders: mockGetAuthHeaders,
      user: mockUser,
    }),
  };
});

// Mock useToast hook
vi.mock('../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock TablePaginationControls
vi.mock('@/components/TablePaginationControls', () => ({
  default: () => <div data-testid="table-pagination">Pagination</div>,
}));

describe('UserManagement - Attestation Coordinator Access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should allow attestation_coordinator to access the Users page', async () => {
    mockUser = { id: 1, email: 'coordinator@test.com', role: 'attestation_coordinator' };
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, email: 'user1@test.com', role: 'employee', first_name: 'John', last_name: 'Doe' },
        { id: 2, email: 'user2@test.com', role: 'manager', first_name: 'Jane', last_name: 'Smith' },
      ],
    });

    render(<UserManagement />);

    // Should NOT show "Access Denied" message
    await waitFor(() => {
      expect(screen.queryByText(/Access Denied/i)).not.toBeInTheDocument();
    });

    // Should show User Management title
    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument();
    });
  });

  it('should show read-only banner for attestation_coordinator', async () => {
    mockUser = { id: 1, email: 'coordinator@test.com', role: 'attestation_coordinator' };
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, email: 'user1@test.com', role: 'employee', first_name: 'John', last_name: 'Doe' },
      ],
    });

    render(<UserManagement />);

    // Should show read-only message
    await waitFor(() => {
      expect(screen.getByText(/You have read-only access to user information/i)).toBeInTheDocument();
    });
  });

  it('should show read-only description for attestation_coordinator', async () => {
    mockUser = { id: 1, email: 'coordinator@test.com', role: 'attestation_coordinator' };
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, email: 'user1@test.com', role: 'employee', first_name: 'John', last_name: 'Doe' },
      ],
    });

    render(<UserManagement />);

    // Should show read-only description
    await waitFor(() => {
      expect(screen.getByText('View user information (read-only access)')).toBeInTheDocument();
    });
  });

  it('should show read-only banner for manager', async () => {
    mockUser = { id: 1, email: 'manager@test.com', role: 'manager' };
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, email: 'user1@test.com', role: 'employee', first_name: 'John', last_name: 'Doe' },
      ],
    });

    render(<UserManagement />);

    // Should show read-only message for manager too
    await waitFor(() => {
      expect(screen.getByText(/You have read-only access to user information/i)).toBeInTheDocument();
    });
  });

  it('should show Access Denied for employee role', async () => {
    mockUser = { id: 1, email: 'employee@test.com', role: 'employee' };
    
    render(<UserManagement />);

    // Should show "Access Denied" message
    await waitFor(() => {
      expect(screen.getByText(/Access Denied - Manager or Admin access required/i)).toBeInTheDocument();
    });
  });

  it('should NOT show read-only banner for admin', async () => {
    mockUser = { id: 1, email: 'admin@test.com', role: 'admin' };
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, email: 'user1@test.com', role: 'employee', first_name: 'John', last_name: 'Doe' },
      ],
    });

    render(<UserManagement />);

    // Should NOT show read-only message for admin
    await waitFor(() => {
      expect(screen.queryByText(/You have read-only access to user information/i)).not.toBeInTheDocument();
    });

    // Should show full management description
    await waitFor(() => {
      expect(screen.getByText('Manage user accounts, roles, and permissions')).toBeInTheDocument();
    });
  });
});
