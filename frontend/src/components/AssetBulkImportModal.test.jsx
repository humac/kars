import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    getAuthHeaders: () => ({ Authorization: 'Bearer token' }),
  }),
}));

// Mock fetch
global.fetch = vi.fn();

import AssetBulkImportModal from './AssetBulkImportModal';

const defaultProps = {
  onClose: vi.fn(),
  onImported: vi.fn(),
};

const renderModal = (props = {}) => {
  return render(<AssetBulkImportModal {...defaultProps} {...props} />);
};

// Helper to create a mock CSV file
const createMockFile = (name = 'test.csv', type = 'text/csv', size = 1024) => {
  const file = new File(['test content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('AssetBulkImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  describe('Rendering', () => {
    it('renders modal title', () => {
      renderModal();
      expect(screen.getByText('Bulk Import Assets')).toBeInTheDocument();
    });

    it('renders modal description', () => {
      renderModal();
      expect(screen.getByText(/Upload a CSV file to import multiple assets/)).toBeInTheDocument();
    });

    it('renders required fields list', () => {
      renderModal();
      expect(screen.getByText('Required fields:')).toBeInTheDocument();
      expect(screen.getByText('employee_first_name')).toBeInTheDocument();
      expect(screen.getByText('employee_last_name')).toBeInTheDocument();
      expect(screen.getByText('employee_email')).toBeInTheDocument();
      expect(screen.getByText('company_name')).toBeInTheDocument();
      expect(screen.getByText(/asset_type/)).toBeInTheDocument();
      expect(screen.getByText('serial_number (must be unique)')).toBeInTheDocument();
      expect(screen.getByText('asset_tag (must be unique)')).toBeInTheDocument();
    });

    it('renders optional fields list', () => {
      renderModal();
      expect(screen.getByText('Optional fields:')).toBeInTheDocument();
      expect(screen.getByText('manager_first_name')).toBeInTheDocument();
      expect(screen.getByText('manager_last_name')).toBeInTheDocument();
      expect(screen.getByText('manager_email')).toBeInTheDocument();
      expect(screen.getByText('make')).toBeInTheDocument();
      expect(screen.getByText('model')).toBeInTheDocument();
      expect(screen.getByText(/status/)).toBeInTheDocument();
      expect(screen.getByText('notes')).toBeInTheDocument();
    });

    it('renders Choose CSV File button', () => {
      renderModal();
      expect(screen.getByText('Choose CSV File')).toBeInTheDocument();
    });

    it('renders Example CSV download link', () => {
      renderModal();
      expect(screen.getByText('Example CSV')).toBeInTheDocument();
    });

    it('renders Cancel button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders Import Assets button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Import Assets' })).toBeInTheDocument();
    });

    it('has correct example CSV download href', () => {
      renderModal();
      const link = screen.getByText('Example CSV').closest('a');
      expect(link).toHaveAttribute('href', '/import_assets.csv');
      expect(link).toHaveAttribute('download');
    });
  });

  describe('Button States', () => {
    it('disables Import button when no file selected', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Import Assets' })).toBeDisabled();
    });

    it('enables Import button when file is selected', () => {
      renderModal();
      const file = createMockFile();
      const input = document.querySelector('input[type="file"]');

      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByRole('button', { name: 'Import Assets' })).not.toBeDisabled();
    });
  });

  describe('File Selection', () => {
    it('shows selected file name', () => {
      renderModal();
      const file = createMockFile('assets.csv');
      const input = document.querySelector('input[type="file"]');

      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByText('Selected file:')).toBeInTheDocument();
      expect(screen.getByText('assets.csv')).toBeInTheDocument();
    });

    it('shows file size in KB', () => {
      renderModal();
      const file = createMockFile('assets.csv', 'text/csv', 2048);
      const input = document.querySelector('input[type="file"]');

      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByText('(2.0 KB)')).toBeInTheDocument();
    });

    it('changes button text after file selected', () => {
      renderModal();
      const file = createMockFile();
      const input = document.querySelector('input[type="file"]');

      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByText('Change File')).toBeInTheDocument();
    });

    it('rejects non-CSV files', () => {
      renderModal();
      const file = createMockFile('test.txt', 'text/plain');
      const input = document.querySelector('input[type="file"]');

      fireEvent.change(input, { target: { files: [file] } });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Invalid File Type',
        description: 'Please select a CSV file',
        variant: 'destructive',
      });
    });

    it('accepts CSV by extension', () => {
      renderModal();
      const file = createMockFile('data.csv', 'application/octet-stream');
      const input = document.querySelector('input[type="file"]');

      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByText('data.csv')).toBeInTheDocument();
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('accepts CSV by MIME type', () => {
      renderModal();
      const file = createMockFile('data', 'text/csv');
      const input = document.querySelector('input[type="file"]');

      fireEvent.change(input, { target: { files: [file] } });

      // Should not show error toast
      expect(mockToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Invalid File Type' })
      );
    });
  });

  describe('Import Flow', () => {
    it('shows toast error when importing without file', () => {
      renderModal();
      const form = document.querySelector('form');

      fireEvent.submit(form);

      expect(mockToast).toHaveBeenCalledWith({
        title: 'No File Selected',
        description: 'Please select a CSV file to import',
        variant: 'destructive',
      });
    });

    it('calls import API with file', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ imported: 5, failed: 0, message: 'Success' }),
      });

      renderModal();
      const file = createMockFile('assets.csv');
      const input = document.querySelector('input[type="file"]');

      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: 'Import Assets' }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/assets/import', expect.objectContaining({
          method: 'POST',
        }));
      });
    });

    it('shows loading state during import', async () => {
      global.fetch.mockImplementation(() => new Promise(() => {}));

      renderModal();
      const file = createMockFile();
      const input = document.querySelector('input[type="file"]');

      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: 'Import Assets' }));

      expect(screen.getByText('Importing...')).toBeInTheDocument();
    });

    it('shows success message on successful import', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ imported: 3, failed: 0, message: '3 assets imported' }),
      });

      renderModal();
      const file = createMockFile();
      const input = document.querySelector('input[type="file"]');

      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: 'Import Assets' }));

      await waitFor(() => {
        expect(screen.getByText(/Successfully imported 3 assets/)).toBeInTheDocument();
      });
    });

    it('calls onImported callback on success', async () => {
      const onImported = vi.fn();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ imported: 2, failed: 0, message: 'Done' }),
      });

      renderModal({ onImported });
      const file = createMockFile();
      const input = document.querySelector('input[type="file"]');

      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: 'Import Assets' }));

      await waitFor(() => {
        expect(onImported).toHaveBeenCalled();
      });
    });

    it('shows error count and messages on partial failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          imported: 2,
          failed: 1,
          errors: ['Row 3: Invalid email format'],
          message: '2 imported, 1 failed',
        }),
      });

      renderModal();
      const file = createMockFile();
      const input = document.querySelector('input[type="file"]');

      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: 'Import Assets' }));

      await waitFor(() => {
        expect(screen.getByText(/1 error occurred:/)).toBeInTheDocument();
        expect(screen.getByText('Row 3: Invalid email format')).toBeInTheDocument();
      });
    });

    it('shows toast error on API failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      renderModal();
      const file = createMockFile();
      const input = document.querySelector('input[type="file"]');

      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: 'Import Assets' }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Import Error',
          description: 'Server error',
          variant: 'destructive',
        });
      });
    });

    it('shows toast when no assets imported', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ imported: 0, failed: 3, errors: ['err1', 'err2', 'err3'] }),
      });

      renderModal();
      const file = createMockFile();
      const input = document.querySelector('input[type="file"]');

      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: 'Import Assets' }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Import Issues',
          description: 'No assets were imported. Please check the errors below.',
          variant: 'destructive',
        });
      });
    });
  });

  describe('Close Behavior', () => {
    it('calls onClose when Cancel clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onClose).toHaveBeenCalled();
    });

    it('changes Cancel to Close after import result', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ imported: 1, failed: 0, message: 'Done' }),
      });

      renderModal();
      const file = createMockFile();
      const input = document.querySelector('input[type="file"]');

      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: 'Import Assets' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
      });
    });

    it('hides Import button after successful import', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ imported: 1, failed: 0, message: 'Done' }),
      });

      renderModal();
      const file = createMockFile();
      const input = document.querySelector('input[type="file"]');

      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: 'Import Assets' }));

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Import Assets' })).not.toBeInTheDocument();
      });
    });

    it('does not close while importing', async () => {
      const onClose = vi.fn();
      global.fetch.mockImplementation(() => new Promise(() => {}));

      renderModal({ onClose });
      const file = createMockFile();
      const input = document.querySelector('input[type="file"]');

      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: 'Import Assets' }));

      // Try to close while importing
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('File Input', () => {
    it('has correct accept attribute', () => {
      renderModal();
      const input = document.querySelector('input[type="file"]');
      expect(input).toHaveAttribute('accept', '.csv');
    });

    it('is hidden', () => {
      renderModal();
      const input = document.querySelector('input[type="file"]');
      expect(input).toHaveClass('hidden');
    });

    it('is disabled while importing', async () => {
      global.fetch.mockImplementation(() => new Promise(() => {}));

      renderModal();
      const file = createMockFile();
      const input = document.querySelector('input[type="file"]');

      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: 'Import Assets' }));

      expect(input).toBeDisabled();
    });
  });
});
