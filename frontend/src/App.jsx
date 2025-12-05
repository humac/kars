import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
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
  Divider,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  AccountCircle,
  ExitToApp,
  Dashboard,
  Business,
  Assessment,
  AdminPanelSettings,
  Person,
} from '@mui/icons-material';
import { useAuth } from './contexts/AuthContext';
import AssetList from './components/AssetList';
import CompanyManagement from './components/CompanyManagement';
import AuditReporting from './components/AuditReporting';
import Profile from './components/Profile';
import AdminSettings from './components/AdminSettings';
import AuthPage from './components/AuthPage';
import OIDCCallback from './components/OIDCCallback';

function App() {
  const { user, logout, loading, isAuthenticated } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();

  const handleAssetRegistered = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileClick = () => {
    handleMenuClose();
    navigate('/profile');
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
  };

  // Determine active tab based on current route
  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/' || path === '/assets') return 0;
    if (path === '/companies') return 1;
    if (path === '/audit') return 2;
    if (path === '/admin') return 3;
    return false;
  };

  const handleTabChange = (event, newValue) => {
    const routes = ['/', '/companies', '/audit', '/admin'];
    navigate(routes[newValue]);
  };

  // Handle OIDC callback route (no authentication required)
  if (location.pathname === '/auth/callback') {
    return <OIDCCallback />;
  }

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
    { label: 'Asset Management', icon: <Dashboard />, value: 0, role: null, path: '/' },
    { label: 'Company Management', icon: <Business />, value: 1, role: 'admin', path: '/companies' },
    { label: 'Audit & Reporting', icon: <Assessment />, value: 2, role: null, path: '/audit' },
    { label: 'Admin Settings', icon: <AdminPanelSettings />, value: 3, role: 'admin', path: '/admin' },
  ];

  const visibleTabs = tabConfig.filter(tab => !tab.role || user?.role === tab.role);
  const activeTab = getActiveTab();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* AppBar */}
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="div" fontWeight={600}>
              KARS - KeyData Asset Registration System
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              SOC2 Compliance - Track and manage company assets
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
            PaperProps={{
              sx: { minWidth: 200 }
            }}
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
            <Divider />
            <MenuItem onClick={handleProfileClick}>
              <ListItemIcon>
                <Person fontSize="small" />
              </ListItemIcon>
              <ListItemText>Profile</ListItemText>
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <ExitToApp fontSize="small" />
              </ListItemIcon>
              <ListItemText>Logout</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>

        {/* Navigation Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
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

      {/* Main Content with Routes */}
      <Container maxWidth="xl" sx={{ flexGrow: 1, py: 3 }}>
        <Routes>
          <Route path="/" element={
            <AssetList refresh={refreshKey} onAssetRegistered={handleAssetRegistered} />
          } />
          <Route path="/assets" element={
            <AssetList refresh={refreshKey} onAssetRegistered={handleAssetRegistered} />
          } />
          {user?.role === 'admin' && (
            <Route path="/companies" element={<CompanyManagement />} />
          )}
          <Route path="/audit" element={<AuditReporting />} />
          {user?.role === 'admin' && (
            <Route path="/admin" element={<AdminSettings />} />
          )}
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </Container>
    </Box>
  );
}

export default App;
