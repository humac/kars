import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BulkAssetActions from './BulkAssetActions';

// Mock fetch globally
global.fetch = vi.fn();

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-url');

// Mock useAuth
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    getAuthHeaders: () => ({ 'Authorization': 'Bearer test-token' }),
  }),
}));

// Mock useToast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

const mockAssets = [
  { id: 1, employee_email: 'alice@test.com', asset_type: 'laptop', status: 'active' },
  { id: 2, employee_email: 'bob@test.com', asset_type: 'laptop', status: 'active' },
  { id: 3, employee_email: 'alice@test.com', asset_type: 'mobile', status: 'returned' },
];

const defaultProps = {
  selectedIds: new Set([1, 2]),
  filteredAssets: mockAssets,
  hasActiveFilters: false,
  onClearSelection: vi.fn(),
  onBulkDelete: vi.fn(),
  onRefresh: vi.fn(),
};

describe('BulkAssetActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders selection count', () => {
      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={{ role: 'admin', email: 'admin@test.com' }}
        />
      );

      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });

    it('renders asset count', () => {
      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={{ role: 'admin', email: 'admin@test.com' }}
        />
      );

      expect(screen.getByText('Showing 3 assets')).toBeInTheDocument();
    });

    it('does not render selection bar when nothing selected', () => {
      render(
        <BulkAssetActions
          {...defaultProps}
          selectedIds={new Set()}
          currentUser={{ role: 'admin', email: 'admin@test.com' }}
        />
      );

      expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    });

    it('shows export filtered button when filters are active', () => {
      render(
        <BulkAssetActions
          {...defaultProps}
          hasActiveFilters={true}
          currentUser={{ role: 'admin', email: 'admin@test.com' }}
        />
      );

      expect(screen.getByRole('button', { name: /export filtered/i })).toBeInTheDocument();
    });
  });

  describe('RBAC - Admin user', () => {
    const adminUser = { role: 'admin', email: 'admin@test.com' };

    it('shows delete button for admin', () => {
      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={adminUser}
        />
      );

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('shows bulk edit button for admin', () => {
      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={adminUser}
        />
      );

      expect(screen.getByRole('button', { name: /bulk edit/i })).toBeInTheDocument();
    });

    it('shows export button for admin', () => {
      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={adminUser}
        />
      );

      expect(screen.getByRole('button', { name: /^export$/i })).toBeInTheDocument();
    });

    it('shows clear button for admin', () => {
      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={adminUser}
        />
      );

      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    });
  });

  describe('RBAC - Manager user', () => {
    const managerUser = { role: 'manager', email: 'manager@test.com' };

    it('hides delete button for manager', () => {
      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={managerUser}
        />
      );

      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('hides bulk edit button when manager does not own selected assets', () => {
      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={managerUser}
        />
      );

      expect(screen.queryByRole('button', { name: /bulk edit/i })).not.toBeInTheDocument();
    });

    it('still shows export button for manager', () => {
      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={managerUser}
        />
      );

      expect(screen.getByRole('button', { name: /^export$/i })).toBeInTheDocument();
    });
  });

  describe('RBAC - Employee user', () => {
    const employeeUser = { role: 'employee', email: 'alice@test.com' };

    it('hides delete button for employee', () => {
      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={employeeUser}
        />
      );

      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('shows bulk edit when employee owns at least one selected asset', () => {
      // alice@test.com owns assets 1 and 3
      // Selected: 1, 2 - Alice owns asset 1
      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={employeeUser}
        />
      );

      expect(screen.getByRole('button', { name: /bulk edit/i })).toBeInTheDocument();
    });

    it('hides bulk edit when employee does not own any selected assets', () => {
      // bob@test.com owns only asset 2
      const bobUser = { role: 'employee', email: 'bob@test.com' };

      // Select only asset 1 (owned by alice)
      render(
        <BulkAssetActions
          {...defaultProps}
          selectedIds={new Set([1])}
          currentUser={bobUser}
        />
      );

      expect(screen.queryByRole('button', { name: /bulk edit/i })).not.toBeInTheDocument();
    });

    it('shows bulk edit when employee owns the only selected asset', () => {
      const bobUser = { role: 'employee', email: 'bob@test.com' };

      // Select only asset 2 (owned by bob)
      render(
        <BulkAssetActions
          {...defaultProps}
          selectedIds={new Set([2])}
          currentUser={bobUser}
        />
      );

      expect(screen.getByRole('button', { name: /bulk edit/i })).toBeInTheDocument();
    });
  });

  describe('RBAC - Attestation Coordinator', () => {
    const coordUser = { role: 'attestation_coordinator', email: 'coord@test.com' };

    it('hides delete button for attestation_coordinator', () => {
      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={coordUser}
        />
      );

      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('hides bulk edit button for attestation_coordinator (read-only)', () => {
      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={coordUser}
        />
      );

      expect(screen.queryByRole('button', { name: /bulk edit/i })).not.toBeInTheDocument();
    });

    it('still shows export button for attestation_coordinator', () => {
      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={coordUser}
        />
      );

      expect(screen.getByRole('button', { name: /^export$/i })).toBeInTheDocument();
    });
  });

  describe('bulk edit dialog', () => {
    const adminUser = { role: 'admin', email: 'admin@test.com' };

    it('opens bulk edit dialog when button clicked', async () => {
      const user = userEvent.setup();
      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={adminUser}
        />
      );

      await user.click(screen.getByRole('button', { name: /bulk edit/i }));

      expect(screen.getByText('Bulk edit selected assets')).toBeInTheDocument();
      // Check for dialog description
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('shows form elements in dialog', async () => {
      const user = userEvent.setup();
      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={adminUser}
        />
      );

      await user.click(screen.getByRole('button', { name: /bulk edit/i }));

      // Check for the combobox (select) and textarea by their placeholders
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/add a note/i)).toBeInTheDocument();
    });

    it('allows entering a note in the dialog', async () => {
      const user = userEvent.setup();
      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={adminUser}
        />
      );

      await user.click(screen.getByRole('button', { name: /bulk edit/i }));

      const noteInput = screen.getByLabelText(/note/i);
      await user.type(noteInput, 'Test note for bulk update');

      expect(noteInput).toHaveValue('Test note for bulk update');
    });

    it('has apply changes button disabled when no status selected', async () => {
      const user = userEvent.setup();
      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={adminUser}
        />
      );

      await user.click(screen.getByRole('button', { name: /bulk edit/i }));

      // Apply button should be disabled when no status is selected
      expect(screen.getByRole('button', { name: /apply changes/i })).toBeDisabled();
    });

    it('shows cancel button in dialog', async () => {
      const user = userEvent.setup();
      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={adminUser}
        />
      );

      await user.click(screen.getByRole('button', { name: /bulk edit/i }));

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe('delete functionality', () => {
    it('calls onBulkDelete when delete button clicked', async () => {
      const user = userEvent.setup();
      const mockOnBulkDelete = vi.fn();

      render(
        <BulkAssetActions
          {...defaultProps}
          onBulkDelete={mockOnBulkDelete}
          currentUser={{ role: 'admin', email: 'admin@test.com' }}
        />
      );

      await user.click(screen.getByRole('button', { name: /delete/i }));

      expect(mockOnBulkDelete).toHaveBeenCalled();
    });
  });

  describe('clear selection', () => {
    it('calls onClearSelection when clear button clicked', async () => {
      const user = userEvent.setup();
      const mockOnClearSelection = vi.fn();

      render(
        <BulkAssetActions
          {...defaultProps}
          onClearSelection={mockOnClearSelection}
          currentUser={{ role: 'admin', email: 'admin@test.com' }}
        />
      );

      await user.click(screen.getByRole('button', { name: /clear/i }));

      expect(mockOnClearSelection).toHaveBeenCalled();
    });
  });

  describe('export functionality', () => {
    it('exports selected assets when export button clicked', async () => {
      const user = userEvent.setup();
      const mockClick = vi.fn();
      const originalCreateElement = document.createElement.bind(document);

      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        const element = originalCreateElement(tag);
        if (tag === 'a') {
          element.click = mockClick;
        }
        return element;
      });

      render(
        <BulkAssetActions
          {...defaultProps}
          currentUser={{ role: 'admin', email: 'admin@test.com' }}
        />
      );

      await user.click(screen.getByRole('button', { name: /^export$/i }));

      expect(mockClick).toHaveBeenCalled();
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe('email case insensitivity', () => {
    it('matches asset ownership case-insensitively', () => {
      // User email is uppercase, asset email is lowercase
      const userWithUpperCase = { role: 'employee', email: 'ALICE@TEST.COM' };

      render(
        <BulkAssetActions
          {...defaultProps}
          selectedIds={new Set([1])} // Asset 1 has alice@test.com
          currentUser={userWithUpperCase}
        />
      );

      // Should show bulk edit because alice@test.com matches ALICE@TEST.COM
      expect(screen.getByRole('button', { name: /bulk edit/i })).toBeInTheDocument();
    });
  });
});
