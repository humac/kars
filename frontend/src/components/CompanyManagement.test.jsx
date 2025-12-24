import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompanyManagement from './CompanyManagement';
import { AuthProvider } from '@/contexts/AuthContext';

// Mock fetch globally
global.fetch = vi.fn();

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Helper to wrap component with AuthProvider
const renderWithAuth = (userRole = 'admin') => {
  // Mock auth/me to set up the user
  global.fetch.mockImplementation((url) => {
    if (url === '/api/auth/me') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ email: 'test@example.com', role: userRole }),
      });
    }
    if (url === '/api/companies') {
      return Promise.resolve({
        ok: true,
        json: async () => [
          { id: 1, name: 'Acme Corp', description: 'Tech company', created_date: '2024-01-15' },
          { id: 2, name: 'Beta Inc', description: 'Finance company', created_date: '2024-02-20' },
          { id: 3, name: 'Gamma LLC', description: null, created_date: '2024-03-10' },
        ],
      });
    }
    if (url === '/api/assets') {
      return Promise.resolve({
        ok: true,
        json: async () => [
          { id: 1, company_name: 'Acme Corp' },
          { id: 2, company_name: 'Acme Corp' },
          { id: 3, company_name: 'Beta Inc' },
        ],
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });

  // Pre-set token to trigger auth/me call
  localStorage.setItem('token', 'test-token');

  return render(
    <AuthProvider>
      <CompanyManagement />
    </AuthProvider>
  );
};

describe('CompanyManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('rendering', () => {
    it('shows loading spinner initially', () => {
      global.fetch.mockImplementation(() => new Promise(() => {})); // Never resolves
      localStorage.setItem('token', 'test-token');

      render(
        <AuthProvider>
          <CompanyManagement />
        </AuthProvider>
      );

      expect(screen.getByText('Loading companies...')).toBeInTheDocument();
    });

    it('renders company list after loading', async () => {
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getByText('Company Management (3)')).toBeInTheDocument();
      });

      // Use getAllByText since mobile and desktop views render duplicates
      expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Beta Inc').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Gamma LLC').length).toBeGreaterThan(0);
    });

    it('displays asset counts for each company', async () => {
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
      });

      // Acme Corp has 2 assets, Beta Inc has 1, Gamma LLC has 0
      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');

      // Row 0 is header, rows 1-3 are data
      expect(within(rows[1]).getByText('2')).toBeInTheDocument(); // Acme Corp
      expect(within(rows[2]).getByText('1')).toBeInTheDocument(); // Beta Inc
      expect(within(rows[3]).getByText('0')).toBeInTheDocument(); // Gamma LLC
    });

    it('shows empty state when no companies exist', async () => {
      global.fetch.mockImplementation((url) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ email: 'test@example.com', role: 'admin' }),
          });
        }
        if (url === '/api/companies') {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        if (url === '/api/assets') {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      localStorage.setItem('token', 'test-token');
      render(
        <AuthProvider>
          <CompanyManagement />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('No companies registered yet.')).toBeInTheDocument();
      });
    });
  });

  describe('RBAC - Admin access', () => {
    it('shows Add Company button for admin', async () => {
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add company/i })).toBeInTheDocument();
      });
    });

    it('shows Bulk Import button for admin', async () => {
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /bulk import/i })).toBeInTheDocument();
      });
    });

    it('shows edit and delete buttons for each company', async () => {
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
      });

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');

      // Each data row should have edit and delete buttons (header is row 0)
      for (let i = 1; i <= 3; i++) {
        const editButtons = within(rows[i]).getAllByRole('button');
        expect(editButtons.length).toBeGreaterThanOrEqual(2); // At least edit and delete
      }
    });

    it('shows checkboxes for bulk selection', async () => {
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
      });

      const table = screen.getByRole('table');
      const checkboxes = within(table).getAllByRole('checkbox');
      expect(checkboxes.length).toBe(4); // 1 header + 3 rows
    });
  });

  describe('RBAC - Non-admin access', () => {
    it('shows read-only banner for managers', async () => {
      renderWithAuth('manager');

      await waitFor(() => {
        expect(screen.getByText('Read-Only Access')).toBeInTheDocument();
      });
    });

    it('hides Add Company button for managers', async () => {
      renderWithAuth('manager');

      await waitFor(() => {
        expect(screen.getByText('Company Management (3)')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /add company/i })).not.toBeInTheDocument();
    });

    it('hides Bulk Import button for non-admins', async () => {
      renderWithAuth('employee');

      await waitFor(() => {
        expect(screen.getByText('Company Management (3)')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /bulk import/i })).not.toBeInTheDocument();
    });

    it('hides checkboxes for bulk selection from non-admins', async () => {
      renderWithAuth('attestation_coordinator');

      await waitFor(() => {
        expect(screen.getByText('Company Management (3)')).toBeInTheDocument();
      });

      const table = screen.getByRole('table');
      const checkboxes = within(table).queryAllByRole('checkbox');
      expect(checkboxes.length).toBe(0);
    });

    it('hides edit/delete actions from non-admins', async () => {
      renderWithAuth('manager');

      await waitFor(() => {
        expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
      });

      // Actions column header should not be present
      expect(screen.queryByText('Actions')).not.toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('filters companies by name', async () => {
      const user = userEvent.setup();
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText(/search companies/i);
      await user.type(searchInput, 'Acme');

      expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
      expect(screen.queryByText('Beta Inc')).not.toBeInTheDocument();
      expect(screen.queryByText('Gamma LLC')).not.toBeInTheDocument();
    });

    it('filters companies by description', async () => {
      const user = userEvent.setup();
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getByText('Company Management (3)')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search companies/i);
      await user.type(searchInput, 'finance');

      expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
      expect(screen.getAllByText('Beta Inc').length).toBeGreaterThan(0);
      expect(screen.queryByText('Gamma LLC')).not.toBeInTheDocument();
    });

    it('shows all companies when search is cleared', async () => {
      const user = userEvent.setup();
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getByText('Company Management (3)')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search companies/i);
      await user.type(searchInput, 'Acme');
      expect(screen.queryByText('Beta Inc')).not.toBeInTheDocument();

      await user.clear(searchInput);
      expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Beta Inc').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Gamma LLC').length).toBeGreaterThan(0);
    });
  });

  describe('add company', () => {
    it('opens add dialog when Add Company button clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add company/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add company/i }));

      expect(screen.getByText('Add New Company')).toBeInTheDocument();
      expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it('submits new company form', async () => {
      const user = userEvent.setup();
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add company/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add company/i }));

      const nameInput = screen.getByLabelText(/company name/i);
      const descInput = screen.getByLabelText(/description/i);

      await user.type(nameInput, 'New Company');
      await user.type(descInput, 'A new company description');

      // Mock the POST request
      global.fetch.mockImplementation((url, options) => {
        if (url === '/api/companies' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 4, name: 'New Company', description: 'A new company description' }),
          });
        }
        // Return default mocks for other requests
        if (url === '/api/companies') {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: 1, name: 'Acme Corp', description: 'Tech company', created_date: '2024-01-15' },
              { id: 4, name: 'New Company', description: 'A new company description', created_date: '2024-12-20' },
            ],
          });
        }
        if (url === '/api/assets') {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      await user.click(screen.getByRole('button', { name: /^add company$/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/companies', expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'New Company', description: 'A new company description' }),
        }));
      });
    });
  });

  describe('edit company', () => {
    it('opens edit dialog with pre-filled data', async () => {
      const user = userEvent.setup();
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
      });

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      const acmeRow = rows[1]; // First data row

      // Find edit button in Acme row
      const editButton = within(acmeRow).getAllByRole('button')[0]; // First button is edit
      await user.click(editButton);

      expect(screen.getByText('Edit Company')).toBeInTheDocument();
      expect(screen.getByLabelText(/company name/i)).toHaveValue('Acme Corp');
      expect(screen.getByLabelText(/description/i)).toHaveValue('Tech company');
    });
  });

  describe('delete company', () => {
    it('shows delete confirmation dialog', async () => {
      const user = userEvent.setup();
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
      });

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      const acmeRow = rows[1];

      // Find delete button (second button in actions)
      const buttons = within(acmeRow).getAllByRole('button');
      const deleteButton = buttons[buttons.length - 1]; // Last button is delete
      await user.click(deleteButton);

      expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
      expect(screen.getByText(/are you sure you want to delete "Acme Corp"/i)).toBeInTheDocument();
    });

    it('calls delete API when confirmed', async () => {
      const user = userEvent.setup();
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
      });

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      const acmeRow = rows[1];

      const buttons = within(acmeRow).getAllByRole('button');
      const deleteButton = buttons[buttons.length - 1];
      await user.click(deleteButton);

      // Mock delete response
      global.fetch.mockImplementation((url, options) => {
        if (url === '/api/companies/1' && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          });
        }
        if (url === '/api/companies') {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: 2, name: 'Beta Inc', description: 'Finance company', created_date: '2024-02-20' },
              { id: 3, name: 'Gamma LLC', description: null, created_date: '2024-03-10' },
            ],
          });
        }
        if (url === '/api/assets') {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/companies/1', expect.objectContaining({
          method: 'DELETE',
        }));
      });
    });
  });

  describe('bulk selection', () => {
    it('selects individual companies', async () => {
      const user = userEvent.setup();
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
      });

      const table = screen.getByRole('table');
      const checkboxes = within(table).getAllByRole('checkbox');

      // Click first company checkbox (index 1, 0 is header)
      await user.click(checkboxes[1]);

      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });

    it('selects all companies with header checkbox', async () => {
      const user = userEvent.setup();
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
      });

      const table = screen.getByRole('table');
      const checkboxes = within(table).getAllByRole('checkbox');

      // Click header checkbox
      await user.click(checkboxes[0]);

      expect(screen.getByText('3 selected')).toBeInTheDocument();
    });

    it('shows bulk actions bar when items selected', async () => {
      const user = userEvent.setup();
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
      });

      const table = screen.getByRole('table');
      const checkboxes = within(table).getAllByRole('checkbox');

      await user.click(checkboxes[1]);

      expect(screen.getByRole('button', { name: /bulk edit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    });

    it('clears selection when Clear button clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
      });

      const table = screen.getByRole('table');
      const checkboxes = within(table).getAllByRole('checkbox');

      await user.click(checkboxes[1]);
      expect(screen.getByText('1 selected')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /clear/i }));
      expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
    });
  });

  describe('bulk edit', () => {
    it('opens bulk edit dialog', async () => {
      const user = userEvent.setup();
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
      });

      const table = screen.getByRole('table');
      const checkboxes = within(table).getAllByRole('checkbox');

      await user.click(checkboxes[1]);
      await user.click(screen.getByRole('button', { name: /bulk edit/i }));

      expect(screen.getByText('Bulk edit selected companies')).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });
  });

  describe('import modal', () => {
    it('opens import modal when Bulk Import clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth('admin');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /bulk import/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /bulk import/i }));

      expect(screen.getByText('Import Companies from CSV')).toBeInTheDocument();
      expect(screen.getByText('Choose CSV')).toBeInTheDocument();
    });
  });
});
