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

describe('AssetEditModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSaved = vi.fn();

  const sampleAsset = {
    id: 1,
    employee_name: 'John Doe',
    employee_email: 'john@example.com',
    company_name: 'Acme Corp',
    laptop_make: 'Dell',
    laptop_model: 'XPS 15',
    laptop_serial_number: 'SN12345',
    laptop_asset_tag: 'AT001',
    status: 'active',
    notes: 'Test notes',
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

  it('shows all fields for admin users', () => {
    const currentUser = { roles: ['admin'] };
    
    render(
      <AssetEditModal
        asset={sampleAsset}
        currentUser={currentUser}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    expect(screen.getByLabelText('Employee Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Employee Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Company')).toBeInTheDocument();
    expect(screen.getByLabelText('Laptop Make')).toBeInTheDocument();
    expect(screen.getByLabelText('Laptop Model')).toBeInTheDocument();
    expect(screen.getByLabelText('Serial Number')).toBeInTheDocument();
    expect(screen.getByLabelText('Asset Tag')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument(); // Select doesn't have direct label association
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('shows limited fields for editor users', () => {
    const currentUser = { roles: ['editor'] };
    
    render(
      <AssetEditModal
        asset={sampleAsset}
        currentUser={currentUser}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    expect(screen.getByLabelText('Employee Name')).toBeInTheDocument();
    expect(screen.queryByLabelText('Employee Email')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Company')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('shows only notes field for regular users', () => {
    const currentUser = { roles: ['user'] };
    
    render(
      <AssetEditModal
        asset={sampleAsset}
        currentUser={currentUser}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    expect(screen.queryByLabelText('Employee Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Employee Email')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('shows message when user has no permissions', () => {
    const currentUser = { roles: [] };
    
    render(
      <AssetEditModal
        asset={sampleAsset}
        currentUser={currentUser}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    expect(screen.getByText(/You do not have permissions to edit any fields/i)).toBeInTheDocument();
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

  it('calls onClose when clicking cancel button', async () => {
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

  it('saves asset and calls onSaved when Save button is clicked', async () => {
    const user = userEvent.setup();
    const currentUser = { roles: ['admin'] };
    
    const mockResponse = { asset: { ...sampleAsset, notes: 'Updated notes' } };
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

    const notesField = screen.getByLabelText('Notes');
    await user.clear(notesField);
    await user.type(notesField, 'Updated notes');

    const saveButton = screen.getByText('Save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/assets/1',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(mockOnSaved).toHaveBeenCalledWith(mockResponse.asset);
    });
  });

  it('disables Save button when user has no permissions', () => {
    const currentUser = { roles: [] };
    
    render(
      <AssetEditModal
        asset={sampleAsset}
        currentUser={currentUser}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    const saveButton = screen.getByText('Save');
    expect(saveButton).toBeDisabled();
  });

  it('updates form fields on user input', async () => {
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

    const nameField = screen.getByLabelText('Employee Name');
    await user.clear(nameField);
    await user.type(nameField, 'Jane Doe');

    expect(nameField).toHaveValue('Jane Doe');
  });
});
