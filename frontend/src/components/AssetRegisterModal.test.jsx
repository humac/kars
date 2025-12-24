import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock all dependencies BEFORE importing the component
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'admin@test.com', role: 'admin', first_name: 'Admin', last_name: 'User' },
    getAuthHeaders: () => ({ Authorization: 'Bearer token' }),
  }),
}));

// Mock fetch to return immediately
global.fetch = vi.fn(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve([]),
}));

// Import AFTER mocks are set up
import AssetRegisterModal from './AssetRegisterModal';

const renderModal = (props = {}) => {
  const defaultProps = {
    onClose: vi.fn(),
    onRegistered: vi.fn(),
    ...props,
  };

  return {
    ...render(
      <BrowserRouter>
        <AssetRegisterModal {...defaultProps} />
      </BrowserRouter>
    ),
    ...defaultProps,
  };
};

describe('AssetRegisterModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders modal title', () => {
      renderModal();
      expect(screen.getByText('Register New Asset')).toBeInTheDocument();
    });

    it('renders modal description', () => {
      renderModal();
      expect(screen.getByText(/Add a new asset to the system/)).toBeInTheDocument();
    });

    it('renders Employee Information section', () => {
      renderModal();
      expect(screen.getByText('Employee Information')).toBeInTheDocument();
    });

    it('renders Manager Information section', () => {
      renderModal();
      expect(screen.getByText('Manager Information')).toBeInTheDocument();
    });

    it('renders Asset Information section', () => {
      renderModal();
      expect(screen.getByText('Asset Information')).toBeInTheDocument();
    });
  });

  describe('Form Fields', () => {
    it('renders employee first name input', () => {
      renderModal();
      expect(screen.getByLabelText(/First Name \*/)).toBeInTheDocument();
    });

    it('renders employee last name input', () => {
      renderModal();
      expect(screen.getByLabelText(/Last Name \*/)).toBeInTheDocument();
    });

    it('renders employee email input', () => {
      renderModal();
      expect(screen.getByLabelText(/Employee Email/)).toBeInTheDocument();
    });

    it('renders serial number input', () => {
      renderModal();
      expect(screen.getByLabelText(/Serial Number/)).toBeInTheDocument();
    });

    it('renders asset tag input', () => {
      renderModal();
      expect(screen.getByLabelText(/Asset Tag/)).toBeInTheDocument();
    });

    it('renders notes textarea', () => {
      renderModal();
      expect(screen.getByLabelText('Notes')).toBeInTheDocument();
    });

    it('renders make input', () => {
      renderModal();
      expect(screen.getByLabelText('Make')).toBeInTheDocument();
    });

    it('renders model input', () => {
      renderModal();
      expect(screen.getByLabelText('Model')).toBeInTheDocument();
    });
  });

  describe('Buttons', () => {
    it('renders Cancel button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders Register Asset button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Register Asset' })).toBeInTheDocument();
    });

    it('calls onClose when Cancel is clicked', () => {
      const { onClose } = renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Input Behavior', () => {
    it('updates first name value on change', () => {
      renderModal();
      const input = screen.getByLabelText(/First Name \*/);
      fireEvent.change(input, { target: { value: 'John', name: 'employee_first_name' } });
      expect(input).toHaveValue('John');
    });

    it('updates serial number value on change', () => {
      renderModal();
      const input = screen.getByLabelText(/Serial Number/);
      fireEvent.change(input, { target: { value: 'SN12345', name: 'serial_number' } });
      expect(input).toHaveValue('SN12345');
    });

    it('updates notes value on change', () => {
      renderModal();
      const input = screen.getByLabelText('Notes');
      fireEvent.change(input, { target: { value: 'Test note', name: 'notes' } });
      expect(input).toHaveValue('Test note');
    });

    it('shows notes character count', () => {
      renderModal();
      expect(screen.getByText('0/1000')).toBeInTheDocument();
    });

    it('updates notes character count on input', () => {
      renderModal();
      const input = screen.getByLabelText('Notes');
      fireEvent.change(input, { target: { value: 'Hello', name: 'notes' } });
      expect(screen.getByText('5/1000')).toBeInTheDocument();
    });
  });

  describe('Email Validation', () => {
    it('shows error for invalid email', () => {
      renderModal();
      const input = screen.getByLabelText(/Employee Email/);
      fireEvent.change(input, { target: { value: 'invalid', name: 'employee_email' } });
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });

    it('hides error for valid email', () => {
      renderModal();
      const input = screen.getByLabelText(/Employee Email/);
      fireEvent.change(input, { target: { value: 'test@example.com', name: 'employee_email' } });
      expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument();
    });

    it('disables submit when email is invalid', () => {
      renderModal();
      const input = screen.getByLabelText(/Employee Email/);
      fireEvent.change(input, { target: { value: 'bad', name: 'employee_email' } });
      expect(screen.getByRole('button', { name: 'Register Asset' })).toBeDisabled();
    });
  });

  describe('Max Lengths', () => {
    it('has maxLength 100 on first name', () => {
      renderModal();
      expect(screen.getByLabelText(/First Name \*/)).toHaveAttribute('maxLength', '100');
    });

    it('has maxLength 100 on serial number', () => {
      renderModal();
      expect(screen.getByLabelText(/Serial Number/)).toHaveAttribute('maxLength', '100');
    });

    it('has maxLength 1000 on notes', () => {
      renderModal();
      expect(screen.getByLabelText('Notes')).toHaveAttribute('maxLength', '1000');
    });
  });

  describe('Placeholders', () => {
    it('has placeholder on first name', () => {
      renderModal();
      expect(screen.getByPlaceholderText('John')).toBeInTheDocument();
    });

    it('has placeholder on email', () => {
      renderModal();
      expect(screen.getByPlaceholderText('john.doe@company.com')).toBeInTheDocument();
    });

    it('has placeholder on serial number', () => {
      renderModal();
      expect(screen.getByPlaceholderText('ABC123456789')).toBeInTheDocument();
    });
  });
});
