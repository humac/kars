import { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  Tabs,
  Tab,
  useMediaQuery,
  useTheme,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Chip,
} from '@mui/material';
import {
  AccountCircle,
  ExitToApp,
  Dashboard,
  Business,
  Assessment,
  AdminPanelSettings,
} from '@mui/icons-material';
import { useAuth } from './contexts/AuthContext';
import AssetList from './components/AssetList';
import CompanyManagement from './components/CompanyManagement';
import AuditReporting from './components/AuditReporting';
import Profile from './components/Profile';
import AdminSettings from './components/AdminSettings';
import AuthPage from './components/AuthPage';

function App() {
  const { user, logout, loading, isAuthenticated } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleAssetRegistered = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <Typography variant="h5" color="text.secondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  const tabConfig = [
    { label: 'Asset Management', icon: <Dashboard />, value: 0, role: null },
    { label: 'Company Management', icon: <Business />, value: 1, role: 'admin' },
    { label: 'Audit & Reporting', icon: <Assessment />, value: 2, role: null },
    { label: 'Profile', icon: <AccountCircle />, value: 3, role: null },
    { label: 'Admin Settings', icon: <AdminPanelSettings />, value: 4, role: 'admin' },
  ];

  const visibleTabs = tabConfig.filter(tab => !tab.role || user?.role === tab.role);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* AppBar */}
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="div" fontWeight={600}>
              ARS - Asset Registration System
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              SOC2 Compliance - Track and manage client assets
            </Typography>
          </Box>

          {/* User Menu */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {!isMobile && (
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" fontWeight={600}>
                  {user?.first_name} {user?.last_name}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  {user?.email}
                </Typography>
              </Box>
            )}
            <Chip
              label={user?.role?.toUpperCase()}
              size="small"
              color="secondary"
              sx={{ fontWeight: 600 }}
            />
            <IconButton
              color="inherit"
              onClick={handleMenuOpen}
              size="large"
            >
              <Avatar sx={{ width: 36, height: 36, bgcolor: 'secondary.main' }}>
                {user?.first_name?.charAt(0)}
              </Avatar>
            </IconButton>
          </Box>

          {/* User Dropdown Menu */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem disabled>
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {user?.first_name} {user?.last_name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.email}
                </Typography>
              </Box>
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ExitToApp sx={{ mr: 1 }} fontSize="small" />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>

        {/* Navigation Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant={isMobile ? 'scrollable' : 'standard'}
            scrollButtons={isMobile ? 'auto' : false}
            sx={{ px: isMobile ? 0 : 3 }}
          >
            {visibleTabs.map((tab) => (
              <Tab
                key={tab.value}
                label={tab.label}
                icon={tab.icon}
                iconPosition="start"
                value={tab.value}
              />
            ))}
          </Tabs>
        </Box>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ flexGrow: 1, py: 3 }}>
        {activeTab === 0 && (
          <AssetList refresh={refreshKey} onAssetRegistered={handleAssetRegistered} />
        )}
        {activeTab === 1 && user?.role === 'admin' && <CompanyManagement />}
        {activeTab === 2 && <AuditReporting />}
        {activeTab === 3 && <Profile />}
        {activeTab === 4 && user?.role === 'admin' && <AdminSettings />}
      </Container>
    </Box>
  );
}

export default App;
