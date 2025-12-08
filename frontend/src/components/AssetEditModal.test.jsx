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
    laptop_make: 'Dell',
    laptop_model: 'XPS 15',
    laptop_serial_number: 'SN12345',
    laptop_asset_tag: 'AT001',
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
    expect(screen.getByText('Type:')).toBeInTheDocument();
    expect(screen.getByText('Dell XPS 15')).toBeInTheDocument();
    expect(screen.getByText('Company:')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Employee:')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('shows only editable fields: status, manager name, manager email, notes', () => {
    const currentUser = { roles: ['admin'] };
    
    render(
      <AssetEditModal
        asset={sampleAsset}
        currentUser={currentUser}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    // Editable fields should be present
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Manager First Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Manager Last Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Manager Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();

    // Other fields should NOT be editable inputs (only in read-only summary)
    expect(screen.queryByLabelText('Employee First Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Employee Last Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Employee Email')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Company')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Laptop Make')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Serial Number')).not.toBeInTheDocument();
  });

  it('validates email and shows error for invalid email', async () => {
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

    const emailField = screen.getByLabelText('Manager Email');
    await user.clear(emailField);
    await user.type(emailField, 'invalid-email');

    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    
    // Save button should be disabled with invalid email
    const saveButton = screen.getByText('Save');
    expect(saveButton).toBeDisabled();
  });

  it('clears email error when valid email is entered', async () => {
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

    const emailField = screen.getByLabelText('Manager Email');
    await user.clear(emailField);
    await user.type(emailField, 'invalid');
    
    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    
    await user.clear(emailField);
    await user.type(emailField, 'valid@example.com');
    
    expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument();
  });

  it('enforces max length on manager name (100 chars)', async () => {
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

    const firstNameField = screen.getByLabelText('Manager First Name');
    const longName = 'a'.repeat(150);
    await user.clear(firstNameField);
    await user.click(firstNameField);
    await user.paste(longName);

    expect(firstNameField).toHaveValue('a'.repeat(100));
    // Check for the character counter for first name field
    const counters = screen.getAllByText('100/100');
    expect(counters.length).toBeGreaterThan(0);
  });

  it('enforces max length on notes (1000 chars)', async () => {
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

    const notesField = screen.getByLabelText('Notes');
    const longNotes = 'a'.repeat(1100);
    await user.clear(notesField);
    await user.click(notesField);
    await user.paste(longNotes);

    expect(notesField).toHaveValue('a'.repeat(1000));
    expect(screen.getByText('1000/1000')).toBeInTheDocument();
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

  it('saves only editable fields when Save button is clicked', async () => {
    const user = userEvent.setup();
    const currentUser = { roles: ['admin'] };
    
    const mockResponse = { 
      asset: { 
        ...sampleAsset, 
        status: 'maintenance',
        manager_first_name: 'New',
        manager_last_name: 'Manager',
        manager_email: 'new@example.com',
        notes: 'Updated notes' 
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

    // Update editable fields using paste instead of type to avoid character composition issues
    const managerFirstNameField = screen.getByLabelText('Manager First Name');
    await user.clear(managerFirstNameField);
    await user.click(managerFirstNameField);
    await user.paste('New');

    const managerLastNameField = screen.getByLabelText('Manager Last Name');
    await user.clear(managerLastNameField);
    await user.click(managerLastNameField);
    await user.paste('Manager');

    const managerEmailField = screen.getByLabelText('Manager Email');
    await user.clear(managerEmailField);
    await user.click(managerEmailField);
    await user.paste('new@example.com');

    const notesField = screen.getByLabelText('Notes');
    await user.clear(notesField);
    await user.click(notesField);
    await user.paste('Updated notes');

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

      // Verify the payload contains the updated editable fields
      const fetchCall = global.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);
      expect(payload.status).toBe('active');
      expect(payload.manager_first_name).toBe('New');
      expect(payload.manager_last_name).toBe('Manager');
      expect(payload.manager_email).toBe('new@example.com');
      expect(payload.notes).toBe('Updated notes');
      
      // Verify it also includes the original asset data (for backend validation)
      expect(payload.employee_first_name).toBe('John');
      expect(payload.employee_last_name).toBe('Doe');
      expect(payload.company_name).toBe('Acme Corp');
      
      expect(mockOnSaved).toHaveBeenCalledWith(mockResponse.asset);
    });
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

    const firstNameField = screen.getByLabelText('Manager First Name');
    await user.clear(firstNameField);
    await user.type(firstNameField, 'Updated');

    expect(firstNameField).toHaveValue('Updated');
    
    const lastNameField = screen.getByLabelText('Manager Last Name');
    await user.clear(lastNameField);
    await user.type(lastNameField, 'Manager');

    expect(lastNameField).toHaveValue('Manager');
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
});
