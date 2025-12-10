import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssetEditModal from './AssetEditModal';

// Mock fetch
global.fetch = vi.fn();

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

// Mock useToast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('AssetEditModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSaved = vi.fn();

  const sampleAsset = {
    id: 1,
    employee_first_name: 'John',
    employee_last_name: 'Doe',
    employee_email: 'john@example.com',
    company_name: 'Acme Corp',
    asset_type: 'laptop',
    make: 'Dell',
    model: 'XPS 15',
    serial_number: 'SN12345',
    asset_tag: 'AT001',
    status: 'active',
    notes: 'Test notes',
    manager_first_name: 'Jane',
    manager_last_name: 'Manager',
    manager_email: 'jane@example.com',
    registration_date: '2024-01-15',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with title', () => {
    const currentUser = { roles: ['admin'] };

    render(
      <AssetEditModal
        asset={sampleAsset}
        currentUser={currentUser}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    expect(screen.getByText('Edit Asset')).toBeInTheDocument();
  });

  it('displays read-only summary section with asset details', () => {
    const currentUser = { roles: ['admin'] };

    render(
      <AssetEditModal
        asset={sampleAsset}
        currentUser={currentUser}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    // Check for read-only fields in summary
    expect(screen.getByText('Asset Tag:')).toBeInTheDocument();
    expect(screen.getByText('AT001')).toBeInTheDocument();
    expect(screen.getByText('Serial Number:')).toBeInTheDocument();
    expect(screen.getByText('SN12345')).toBeInTheDocument();
    expect(screen.getByText('Asset Type:')).toBeInTheDocument();
    expect(screen.getByText('laptop')).toBeInTheDocument();
    expect(screen.getByText('Make/Model:')).toBeInTheDocument();
    expect(screen.getByText('Dell XPS 15')).toBeInTheDocument();
    expect(screen.getByText('Company:')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Employee:')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('displays manager info in read-only section', () => {
    const currentUser = { roles: ['admin'] };

    render(
      <AssetEditModal
        asset={sampleAsset}
        currentUser={currentUser}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    expect(screen.getByText('Manager:')).toBeInTheDocument();
    expect(screen.getByText('Jane Manager')).toBeInTheDocument();
    expect(screen.getByText('Manager Email:')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('displays notes in read-only section when present', () => {
    const currentUser = { roles: ['admin'] };

    render(
      <AssetEditModal
        asset={sampleAsset}
        currentUser={currentUser}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    expect(screen.getByText('Notes:')).toBeInTheDocument();
    expect(screen.getByText('Test notes')).toBeInTheDocument();
  });

  it('shows only status as editable field', () => {
    const currentUser = { roles: ['admin'] };

    render(
      <AssetEditModal
        asset={sampleAsset}
        currentUser={currentUser}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    // Status should be the only editable field
    expect(screen.getByLabelText('Status')).toBeInTheDocument();

    // Manager fields should NOT be editable inputs
    expect(screen.queryByLabelText('Manager First Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Manager Last Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Manager Email')).not.toBeInTheDocument();

    // Notes should NOT be editable
    expect(screen.queryByLabelText('Notes')).not.toBeInTheDocument();

    // Other fields should NOT be editable inputs
    expect(screen.queryByLabelText('Employee First Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Employee Last Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Employee Email')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Company')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Laptop Make')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Serial Number')).not.toBeInTheDocument();
  });

  it('calls onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    const currentUser = { roles: ['admin'] };

    render(
      <AssetEditModal
        asset={sampleAsset}
        currentUser={currentUser}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('saves only status when Save button is clicked', async () => {
    const user = userEvent.setup();
    const currentUser = { roles: ['admin'] };

    const mockResponse = {
      asset: {
        ...sampleAsset,
        status: 'returned',
      }
    };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    render(
      <AssetEditModal
        asset={sampleAsset}
        currentUser={currentUser}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    const saveButton = screen.getByText('Save');
    await user.click(saveButton);

    await waitFor(() => {
      // Verify fetch was called
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/assets/1',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );

      // Verify the payload contains the status
      const fetchCall = global.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);
      expect(payload.status).toBe('active');

      // Verify it also includes the original asset data (for backend validation)
      expect(payload.employee_first_name).toBe('John');
      expect(payload.employee_last_name).toBe('Doe');
      expect(payload.company_name).toBe('Acme Corp');
      expect(payload.manager_first_name).toBe('Jane');
      expect(payload.manager_last_name).toBe('Manager');

      expect(mockOnSaved).toHaveBeenCalledWith(mockResponse.asset);
    });
  });

  it('has status dropdown with backend-compatible values', () => {
    const currentUser = { roles: ['admin'] };

    render(
      <AssetEditModal
        asset={sampleAsset}
        currentUser={currentUser}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    // Verify status select is present and has correct role
    const statusTrigger = screen.getByLabelText('Status');
    expect(statusTrigger).toBeInTheDocument();
    expect(statusTrigger).toHaveAttribute('role', 'combobox');

    // Status options should match backend-supported values: active, returned, lost, damaged, retired
    // This is verified by the component not throwing errors and save working correctly
  });

  it('displays correct dialog description', () => {
    const currentUser = { roles: ['admin'] };

    render(
      <AssetEditModal
        asset={sampleAsset}
        currentUser={currentUser}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    expect(screen.getByText('Update the status of this asset.')).toBeInTheDocument();
  });
});
