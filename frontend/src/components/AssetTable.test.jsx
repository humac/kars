import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssetTable from './AssetTable';
import { AuthProvider } from '../contexts/AuthContext';

// Mock fetch
global.fetch = vi.fn();
global.confirm = vi.fn();

// Mock useAuth and useToast hooks
const mockGetAuthHeaders = vi.fn(() => ({ Authorization: 'Bearer test-token' }));
const mockToast = vi.fn();
vi.mock('../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      getAuthHeaders: mockGetAuthHeaders,
    }),
  };
});

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
      employee_name: 'John Doe',
      laptop_make: 'Dell',
      laptop_model: 'XPS 15',
      employee_email: 'john@example.com',
      status: 'active',
    },
    {
      id: 2,
      employee_name: 'Jane Smith',
      laptop_make: 'Apple',
      laptop_model: 'MacBook Pro',
      employee_email: 'jane@example.com',
      status: 'returned',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    global.confirm.mockReturnValue(true);
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

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Dell XPS 15')).toBeInTheDocument();
    expect(screen.getByText('Apple MacBook Pro')).toBeInTheDocument();
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

    expect(screen.getByText('No assets found')).toBeInTheDocument();
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

    // Click the dropdown menu button (MoreHorizontal icon)
    const menuButtons = screen.getAllByRole('button', { name: '' });
    await user.click(menuButtons[0]);
    
    // Now the Edit button should be visible and not disabled
    await waitFor(() => {
      const editButton = screen.getAllByText('Edit')[0];
      expect(editButton).toBeInTheDocument();
      expect(editButton).not.toHaveAttribute('data-disabled');
    });
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

    // Click the dropdown menu button
    const menuButtons = screen.getAllByRole('button', { name: '' });
    await user.click(menuButtons[0]);
    
    // Check that Edit button is disabled (data-disabled attribute is present)
    await waitFor(() => {
      const editButton = screen.getAllByText('Edit')[0];
      expect(editButton).toHaveAttribute('data-disabled');
    });
  });

  it('calls onEdit when edit button is clicked', async () => {
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

    // Click the dropdown menu button first
    const menuButtons = screen.getAllByRole('button', { name: '' });
    await user.click(menuButtons[0]);

    // Wait for dropdown to open and click Edit
    await waitFor(async () => {
      const editButton = screen.getAllByText('Edit')[0];
      await user.click(editButton);
    });

    expect(mockOnEdit).toHaveBeenCalledWith(sampleAssets[0]);
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

    // Click the dropdown menu button
    const menuButtons = screen.getAllByRole('button', { name: '' });
    await user.click(menuButtons[0]);

    // Click Delete
    await waitFor(async () => {
      const deleteButton = screen.getAllByText('Delete')[0];
      await user.click(deleteButton);
    });

    // Check for AlertDialog confirmation
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

    // Click the dropdown menu button
    const menuButtons = screen.getAllByRole('button', { name: '' });
    await user.click(menuButtons[0]);

    // Click Delete in dropdown
    const deleteButtons = await waitFor(() => screen.getAllByText('Delete'));
    await user.click(deleteButtons[0]);

    // Wait for and click confirm in AlertDialog
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
});
