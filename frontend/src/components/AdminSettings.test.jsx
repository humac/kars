import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Mock child components to avoid their complexity
vi.mock('./OIDCSettings', () => ({ default: () => <div data-testid="oidc-settings">OIDC</div> }));
vi.mock('./SecuritySettings', () => ({ default: () => <div data-testid="security-settings">Security</div> }));
vi.mock('./HubSpotSettings', () => ({ default: () => <div data-testid="hubspot-settings">HubSpot</div> }));
vi.mock('./NotificationSettings', () => ({ default: () => <div data-testid="notification-settings">Notifications</div> }));
vi.mock('./AssetTypesSettings', () => ({ default: () => <div data-testid="asset-types-settings">Asset Types</div> }));
vi.mock('./SystemSettings', () => ({ default: () => <div data-testid="system-settings">System</div> }));

// Variable to control user role
let mockUserRole = 'admin';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'test@test.com', role: mockUserRole },
    getAuthHeaders: () => ({ Authorization: 'Bearer token' }),
  }),
}));

// Mock fetch
global.fetch = vi.fn(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({
    logo_data: null,
    site_name: 'KARS',
    sub_title: 'Test Subtitle',
    primary_color: '#3B82F6',
  }),
}));

import AdminSettings from './AdminSettings';

const renderSettings = () => {
  return render(
    <BrowserRouter>
      <AdminSettings />
    </BrowserRouter>
  );
};

describe('AdminSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRole = 'admin';
  });

  describe('Access Control', () => {
    it('shows access denied for employee role', () => {
      mockUserRole = 'employee';
      renderSettings();
      expect(screen.getByText(/Access Denied/)).toBeInTheDocument();
    });

    it('shows access denied for manager role', () => {
      mockUserRole = 'manager';
      renderSettings();
      expect(screen.getByText(/Access Denied/)).toBeInTheDocument();
    });

    it('shows access denied for attestation_coordinator role', () => {
      mockUserRole = 'attestation_coordinator';
      renderSettings();
      expect(screen.getByText(/Access Denied/)).toBeInTheDocument();
    });

    it('shows settings for admin role', () => {
      mockUserRole = 'admin';
      renderSettings();
      expect(screen.getByText('Admin Settings')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    beforeEach(() => {
      mockUserRole = 'admin';
    });

    it('renders Branding tab', () => {
      renderSettings();
      expect(screen.getByRole('tab', { name: /Branding/i })).toBeInTheDocument();
    });

    it('renders Asset Types tab', () => {
      renderSettings();
      expect(screen.getByRole('tab', { name: /Asset Types/i })).toBeInTheDocument();
    });

    it('renders Security tab', () => {
      renderSettings();
      expect(screen.getByRole('tab', { name: /Security/i })).toBeInTheDocument();
    });

    it('renders System tab', () => {
      renderSettings();
      expect(screen.getByRole('tab', { name: /System/i })).toBeInTheDocument();
    });

    it('renders Notifications tab', () => {
      renderSettings();
      expect(screen.getByRole('tab', { name: /Notifications/i })).toBeInTheDocument();
    });

    it('renders Integrations tab', () => {
      renderSettings();
      expect(screen.getByRole('tab', { name: /Integrations/i })).toBeInTheDocument();
    });

    it('renders Database tab', () => {
      renderSettings();
      expect(screen.getByRole('tab', { name: /Database/i })).toBeInTheDocument();
    });

    it('shows Branding content by default', async () => {
      renderSettings();
      await waitFor(() => {
        expect(screen.getByText('Branding Settings')).toBeInTheDocument();
      });
    });
  });

  describe('Branding Tab (default)', () => {
    beforeEach(() => {
      mockUserRole = 'admin';
    });

    it('shows Company Logo section', async () => {
      renderSettings();
      await waitFor(() => {
        expect(screen.getByText('Company Logo')).toBeInTheDocument();
      });
    });

    it('shows Site Name field', async () => {
      renderSettings();
      await waitFor(() => {
        expect(screen.getByLabelText('Site Name')).toBeInTheDocument();
      });
    });

    it('shows Subtitle field', async () => {
      renderSettings();
      await waitFor(() => {
        expect(screen.getByLabelText('Subtitle')).toBeInTheDocument();
      });
    });

    it('shows Favicon section', async () => {
      renderSettings();
      await waitFor(() => {
        expect(screen.getByText('Favicon')).toBeInTheDocument();
      });
    });

    it('shows Primary Brand Color field', async () => {
      renderSettings();
      await waitFor(() => {
        expect(screen.getByText('Primary Brand Color')).toBeInTheDocument();
      });
    });

    it('shows App URL field', async () => {
      renderSettings();
      await waitFor(() => {
        expect(screen.getByLabelText('App URL')).toBeInTheDocument();
      });
    });

    it('shows Footer Label field', async () => {
      renderSettings();
      await waitFor(() => {
        expect(screen.getByLabelText('Footer Label')).toBeInTheDocument();
      });
    });

    it('shows Save Changes button', async () => {
      renderSettings();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
      });
    });

    it('shows Choose Image button for logo', async () => {
      renderSettings();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Choose Image' })).toBeInTheDocument();
      });
    });

    it('shows Choose Favicon button', async () => {
      renderSettings();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Choose Favicon' })).toBeInTheDocument();
      });
    });

    it('shows email logo toggle', async () => {
      renderSettings();
      await waitFor(() => {
        expect(screen.getByText('Include logo in email headers')).toBeInTheDocument();
      });
    });
  });

  describe('Fetches branding settings', () => {
    beforeEach(() => {
      mockUserRole = 'admin';
    });

    it('calls branding API on mount', async () => {
      renderSettings();
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/branding');
      });
    });

    it('populates site name from API response', async () => {
      renderSettings();
      await waitFor(() => {
        const input = screen.getByLabelText('Site Name');
        expect(input).toHaveValue('KARS');
      });
    });
  });
});
