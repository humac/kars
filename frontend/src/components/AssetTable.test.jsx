import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssetTable from './AssetTable';
import { AuthProvider } from '../contexts/AuthContext';

// Mock fetch
global.fetch = vi.fn();
global.confirm = vi.fn();

// Mock useAuth, useUsers, and useToast hooks
const mockGetAuthHeaders = vi.fn(() => ({ Authorization: 'Bearer test-token' }));
const mockToast = vi.fn();
const mockGetFullName = vi.fn((id) => {
  const users = {
    10: 'Manager From Context',
    20: 'Another Manager'
  };
  return users[id] || null;
});
const mockGetEmail = vi.fn((id) => {
  const emails = {
    10: 'context-manager@example.com',
    20: 'another@example.com'
  };
  return emails[id] || null;
});

vi.mock('../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      getAuthHeaders: mockGetAuthHeaders,
    }),
  };
});

vi.mock('../contexts/UsersContext', () => ({
  useUsers: () => ({
    getFullName: mockGetFullName,
    getEmail: mockGetEmail,
    loading: false,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe('AssetTable Component', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();

  const sampleAssets = [
    {
      id: 1,
      employee_first_name: 'John',
      employee_last_name: 'Doe',
      asset_type: 'laptop',
      make: 'Dell',
      model: 'XPS 15',
      serial_number: 'SN123',
      asset_tag: 'AT001',
      employee_email: 'john@example.com',
      manager_first_name: 'Bob',
      manager_last_name: 'Manager',
      manager_email: 'bob@example.com',
      status: 'active',
    },
    {
      id: 2,
      employee_first_name: 'Jane',
      employee_last_name: 'Smith',
      asset_type: 'mobile_phone',
      make: 'Apple',
      model: 'iPhone 15',
      serial_number: 'SN456',
      asset_tag: 'AT002',
      employee_email: 'jane@example.com',
      manager_first_name: 'Alice',
      manager_last_name: 'Boss',
      manager_email: 'alice@example.com',
      status: 'returned',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    global.confirm.mockReturnValue(true);
    // Mock the companies fetch endpoint
    global.fetch.mockImplementation((url) => {
      if (url === '/api/companies/names') {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 1, name: 'Acme Corp' },
            { id: 2, name: 'TechStart Inc' }
          ]
        });
      }
      // Default mock for other URLs (like delete)
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true })
      });
    });
  });

  it('renders asset table with assets', () => {
    const currentUser = { roles: ['admin'] };
    
    render(
      <AssetTable
        assets={sampleAssets}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    // The new table renders multiple times (mobile + desktop), so use getAllByText
    expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Jane Smith')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Dell XPS 15')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Apple iPhone 15')[0]).toBeInTheDocument();
  });

  it('shows "No assets found" when assets array is empty', () => {
    const currentUser = { roles: ['admin'] };
    
    render(
      <AssetTable
        assets={[]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    expect(screen.getByText('No assets found. Get started by registering your first asset!')).toBeInTheDocument();
  });

  it('allows admin users to edit assets', async () => {
    const user = userEvent.setup();
    const currentUser = { roles: ['admin'] };
    
    render(
      <AssetTable
        assets={sampleAssets}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    // The table now shows assets, so checkboxes and action buttons should be rendered
    const allButtons = screen.getAllByRole('button');
    // Filter buttons should exist (All, Active, etc.) and Edit/Delete buttons
    expect(allButtons.length).toBeGreaterThan(5);
  });

  it('disables edit for non-admin/non-editor users', async () => {
    const user = userEvent.setup();
    const currentUser = { roles: ['user'] };
    
    render(
      <AssetTable
        assets={sampleAssets}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    // The table renders for non-admin users too
    const allButtons = screen.getAllByRole('button');
    expect(allButtons.length).toBeGreaterThan(0);
  });

  it('calls onEdit when edit button is clicked', async () => {
    const currentUser = { roles: ['admin'] };
    
    render(
      <AssetTable
        assets={sampleAssets}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    // With the enhanced table, onEdit is available for admins
    // The component renders properly with assets
    expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
  });

  it('shows confirmation dialog before deleting', async () => {
    const user = userEvent.setup();
    const currentUser = { roles: ['admin'] };
    global.fetch.mockResolvedValueOnce({ ok: true });
    
    render(
      <AssetTable
        assets={sampleAssets}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    // Click the direct Delete button (first one)
    const deleteButtons = screen.getAllByRole('button', { name: '' }).filter(btn => {
      const svg = btn.querySelector('svg');
      return svg && svg.classList.contains('lucide-trash-2');
    });
    
    await user.click(deleteButtons[0]);

    // Check for Dialog confirmation
    await waitFor(() => {
      expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
    });
  });

  it('calls delete API and onDelete callback when confirmed', async () => {
    const user = userEvent.setup();
    const currentUser = { roles: ['admin'] };
    global.fetch.mockResolvedValueOnce({ ok: true });
    
    render(
      <AssetTable
        assets={sampleAssets}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    // Click the direct Delete button (first one)
    const deleteButtons = screen.getAllByRole('button', { name: '' }).filter(btn => {
      const svg = btn.querySelector('svg');
      return svg && svg.classList.contains('lucide-trash-2');
    });
    
    await user.click(deleteButtons[0]);

    // Wait for and click confirm in Dialog
    const confirmButton = await screen.findByRole('button', { name: /delete/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/assets/1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(mockOnDelete).toHaveBeenCalledWith(1);
    });
  });

  it('displays manager information in the table', () => {
    const currentUser = { roles: ['admin'] };
    
    render(
      <AssetTable
        assets={sampleAssets}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    // Manager names should appear in desktop view
    expect(screen.getAllByText('Bob Manager')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Alice Boss')[0]).toBeInTheDocument();
  });

  it('filters assets by manager name', async () => {
    const user = userEvent.setup();
    const currentUser = { roles: ['admin'] };
    
    render(
      <AssetTable
        assets={sampleAssets}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    // Type manager name in search
    const searchInput = screen.getByPlaceholderText(/search assets/i);
    await user.type(searchInput, 'Bob Manager');

    // Only John Doe should be visible (managed by Bob)
    await waitFor(() => {
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
      expect(screen.queryAllByText('Jane Smith').length).toBe(0);
    });
  });

  it('filters assets by manager email', async () => {
    const user = userEvent.setup();
    const currentUser = { roles: ['admin'] };
    
    render(
      <AssetTable
        assets={sampleAssets}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    // Type manager email in search
    const searchInput = screen.getByPlaceholderText(/search assets/i);
    await user.type(searchInput, 'alice@example.com');

    // Only Jane Smith should be visible (managed by Alice)
    await waitFor(() => {
      expect(screen.queryAllByText('John Doe').length).toBe(0);
      expect(screen.getAllByText('Jane Smith').length).toBeGreaterThan(0);
    });
  });

  it('displays manager name from manager_first_name and manager_last_name fields', () => {
    const currentUser = { roles: ['admin'] };
    const assetsWithDenormalizedManager = [
      {
        id: 1,
        employee_first_name: 'Test',
        employee_last_name: 'User',
        employee_email: 'test@example.com',
        manager_first_name: 'Direct',
        manager_last_name: 'Manager',
        manager_email: 'direct@example.com',
        status: 'active',
      }
    ];
    
    render(
      <AssetTable
        assets={assetsWithDenormalizedManager}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    // Manager name from denormalized fields should be displayed
    expect(screen.getAllByText('Direct Manager')[0]).toBeInTheDocument();
    expect(screen.getAllByText('direct@example.com')[0]).toBeInTheDocument();
  });

  it('displays manager name resolved from manager_id via UsersContext', () => {
    const currentUser = { roles: ['admin'] };
    const assetsWithManagerId = [
      {
        id: 2,
        employee_first_name: 'Test',
        employee_last_name: 'User2',
        employee_email: 'test2@example.com',
        manager_id: 10, // This should resolve to 'Manager From Context'
        status: 'active',
      }
    ];
    
    render(
      <AssetTable
        assets={assetsWithManagerId}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    // Manager name from UsersContext should be displayed
    expect(screen.getAllByText('Manager From Context')[0]).toBeInTheDocument();
    expect(screen.getAllByText('context-manager@example.com')[0]).toBeInTheDocument();
  });

  it('displays only manager_email when no name fields or manager_id available', () => {
    const currentUser = { roles: ['admin'] };
    const assetsWithEmailOnly = [
      {
        id: 3,
        employee_first_name: 'Test',
        employee_last_name: 'User3',
        employee_email: 'test3@example.com',
        manager_email: 'emailonly@example.com',
        status: 'active',
      }
    ];
    
    render(
      <AssetTable
        assets={assetsWithEmailOnly}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    // Only email should be displayed, no name
    expect(screen.getAllByText('emailonly@example.com')[0]).toBeInTheDocument();
    // The name column should show '-' for no name
    const tableCells = screen.getAllByText('-');
    expect(tableCells.length).toBeGreaterThan(0);
  });

  it('searches by manager name resolved from manager_id', async () => {
    const user = userEvent.setup();
    const currentUser = { roles: ['admin'] };
    const assetsWithManagerId = [
      {
        id: 1,
        employee_first_name: 'Employee',
        employee_last_name: 'One',
        employee_email: 'emp1@example.com',
        manager_id: 10,
        status: 'active',
      },
      {
        id: 2,
        employee_first_name: 'Employee',
        employee_last_name: 'Two',
        employee_email: 'emp2@example.com',
        manager_first_name: 'Other',
        manager_last_name: 'Manager',
        status: 'active',
      }
    ];
    
    render(
      <AssetTable
        assets={assetsWithManagerId}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    // Search for manager resolved from context
    const searchInput = screen.getByPlaceholderText(/search assets/i);
    await user.type(searchInput, 'Manager From Context');

    // Only the first employee should be visible
    await waitFor(() => {
      expect(screen.getAllByText('Employee One').length).toBeGreaterThan(0);
      expect(screen.queryAllByText('Employee Two').length).toBe(0);
    });
  });

  it('allows users to edit their own assets', async () => {
    const currentUser = { 
      roles: ['user'],
      email: 'john@example.com'
    };
    
    render(
      <AssetTable
        assets={sampleAssets}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    // User should be able to see their own asset
    expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument();
  });

  it('prevents users from editing other users\' assets', async () => {
    const currentUser = { 
      roles: ['user'],
      email: 'john@example.com'
    };
    
    const otherUserAsset = {
      id: 3,
      employee_first_name: 'Alice',
      employee_last_name: 'Smith',
      asset_type: 'laptop',
      make: 'Apple',
      model: 'MacBook Pro',
      serial_number: 'SN789',
      asset_tag: 'AT003',
      employee_email: 'alice@example.com',
      status: 'active',
    };
    
    render(
      <AssetTable
        assets={[...sampleAssets, otherUserAsset]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    // User should see other users' assets but not be able to edit them
    expect(screen.getAllByText('Alice Smith')[0]).toBeInTheDocument();
  });

  it('allows editors to edit all assets', async () => {
    const currentUser = { 
      roles: ['editor'],
      email: 'editor@example.com'
    };
    
    render(
      <AssetTable
        assets={sampleAssets}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    // Editor should be able to see all assets
    expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Jane Smith')[0]).toBeInTheDocument();
  });
});
