import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssetTable from './AssetTable';
import { AuthProvider } from '../contexts/AuthContext';

// Mock fetch
global.fetch = vi.fn();
global.confirm = vi.fn();

// Mock useAuth hook
const mockGetAuthHeaders = vi.fn(() => ({ Authorization: 'Bearer test-token' }));
vi.mock('../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      getAuthHeaders: mockGetAuthHeaders,
    }),
  };
});

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

  it('allows admin users to edit assets', () => {
    const currentUser = { roles: ['admin'] };
    
    render(
      <AssetTable
        assets={sampleAssets}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    const editButtons = screen.getAllByText('Edit');
    expect(editButtons[0]).not.toBeDisabled();
  });

  it('disables edit for non-admin/non-editor users', () => {
    const currentUser = { roles: ['user'] };
    
    render(
      <AssetTable
        assets={sampleAssets}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    const editButtons = screen.getAllByText('Edit');
    expect(editButtons[0]).toBeDisabled();
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

    const editButtons = screen.getAllByText('Edit');
    await user.click(editButtons[0]);

    expect(mockOnEdit).toHaveBeenCalledWith(sampleAssets[0]);
  });

  it('prompts for confirmation before deleting', async () => {
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

    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);

    expect(global.confirm).toHaveBeenCalled();
  });

  it('calls delete API and onDelete callback when confirmed', async () => {
    const user = userEvent.setup();
    const currentUser = { roles: ['admin'] };
    global.confirm.mockReturnValue(true);
    global.fetch.mockResolvedValueOnce({ ok: true });
    
    render(
      <AssetTable
        assets={sampleAssets}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        currentUser={currentUser}
      />
    );

    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/assets/1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(mockOnDelete).toHaveBeenCalledWith(1);
    });
  });
});
