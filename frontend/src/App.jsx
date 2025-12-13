import { useEffect, useState } from 'react';
import { Navigate, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Laptop,
  Building2,
  Users,
  FileBarChart,
  Settings,
  User,
  LogOut,
  Menu,
  X,
  Loader2,
  Moon,
  Sun,
} from 'lucide-react';
import Dashboard from '@/components/Dashboard';
import AssetsPage from '@/pages/AssetsPage';
import CompanyManagement from '@/components/CompanyManagement';
import UserManagement from '@/components/UserManagement';
import AuditReporting from '@/components/AuditReporting';
import AdminSettings from '@/components/AdminSettings';
import Profile from '@/components/Profile';
import AuthPage from '@/components/AuthPage';
import OIDCCallback from '@/components/OIDCCallback';
import CompleteProfile from '@/components/CompleteProfile';

function AppNew() {
  const { user, logout, loading, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [brandingLogo, setBrandingLogo] = useState(null);
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    return localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });
  const navigate = useNavigate();
  const location = useLocation();

  // Load and apply branding settings
  const loadBranding = async () => {
    try {
      const response = await fetch('/api/branding');
      if (!response.ok) return;
      const data = await response.json();
      
      // Set logo
      if (data.logo_data) {
        setBrandingLogo(data.logo_data);
      }
      
      // Set primary color as CSS variable
      if (data.primary_color) {
        document.documentElement.style.setProperty('--primary', data.primary_color);
        // Convert hex to HSL for Tailwind compatibility
        const hex = data.primary_color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16) / 255;
        const g = parseInt(hex.substr(2, 2), 16) / 255;
        const b = parseInt(hex.substr(4, 2), 16) / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
          }
        }
        
        // Set as HSL for Tailwind
        document.documentElement.style.setProperty('--primary', `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`);
      }
      
      // Update favicon
      if (data.favicon_data) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = data.favicon_data;
      }
      
      // Update page title
      const siteName = data.site_name || 'KARS';
      document.title = siteName;
    } catch (error) {
      console.error('Failed to load branding:', error);
    }
  };

  useEffect(() => {
    loadBranding();
    
    // Listen for branding updates from AdminSettings
    const handleBrandingUpdate = () => {
      loadBranding();
    };
    
    window.addEventListener('brandingUpdated', handleBrandingUpdate);
    
    return () => {
      window.removeEventListener('brandingUpdated', handleBrandingUpdate);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Handle OIDC callback route (no authentication required)
  if (location.pathname === '/auth/callback') {
    return <OIDCCallback />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  // Check if user needs to complete profile
  if (user && (user.profile_complete === 0 || user.profile_complete === false)) {
    return <CompleteProfile />;
  }

  const navItems = [
    { label: 'Assets', icon: Laptop, path: '/assets' },
    { label: 'Companies', icon: Building2, path: '/companies', roles: ['admin'] },
    { label: 'Users', icon: Users, path: '/users', roles: ['admin', 'manager'] },
    { label: 'Audit & Reports', icon: FileBarChart, path: '/audit' },
    { label: 'Admin Settings', icon: Settings, path: '/admin', roles: ['admin'] },
  ];

  const visibleNavItems = navItems.filter(item => !item.roles || item.roles.includes(user?.role));

  const isActive = (path) => {
    if (path === '/assets') {
      return location.pathname === '/' || location.pathname === '/assets';
    }
    return location.pathname === path;
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleNavigation = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-6 flex h-16 items-center justify-between">
          {/* Logo and Nav */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/assets')}>
              {brandingLogo ? (
                <img
                  src={brandingLogo}
                  alt="Company logo"
                  className="h-9 w-auto max-h-10 object-contain"
                />
              ) : (
                <>
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
                    <Laptop className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="font-semibold text-lg hidden sm:block">KARS</span>
                </>
              )}
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {visibleNavItems.map((item) => (
                <Button
                  key={item.path}
                  variant={isActive(item.path) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handleNavigation(item.path)}
                  className="gap-2"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              ))}
            </nav>
          </div>

          {/* User Menu - Desktop */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex flex-col items-end text-sm">
              <span className="font-medium">{user?.first_name} {user?.last_name}</span>
              <span className="text-muted-foreground text-xs">{user?.email}</span>
            </div>
            <Badge variant="secondary" className="uppercase text-xs">
              {user?.role}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              <span className="sr-only">Toggle theme</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    {user?.profile_image && (
                      <AvatarImage src={user.profile_image} alt="Profile" />
                    )}
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user?.first_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.first_name} {user?.last_name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-background">
            <div className="container mx-auto px-4 md:px-6 py-4 space-y-4">
              {/* User Info */}
              <div className="flex items-center gap-3 pb-4 border-b">
                <Avatar className="h-10 w-10">
                  {user?.profile_image && (
                    <AvatarImage src={user.profile_image} alt="Profile" />
                  )}
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {user?.first_name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{user?.first_name} {user?.last_name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
                <Badge variant="secondary" className="uppercase text-xs">
                  {user?.role}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Appearance</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={toggleTheme}
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="h-4 w-4" />
                      Light
                    </>
                  ) : (
                    <>
                      <Moon className="h-4 w-4" />
                      Dark
                    </>
                  )}
                </Button>
              </div>

              {/* Navigation */}
              <nav className="space-y-1">
                {visibleNavItems.map((item) => (
                  <Button
                    key={item.path}
                    variant={isActive(item.path) ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-2"
                    onClick={() => handleNavigation(item.path)}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                ))}
                <Separator />
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2"
                  onClick={() => handleNavigation('/profile')}
                >
                  <User className="h-4 w-4" />
                  Profile
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </nav>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 md:px-6 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/assets" replace />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/assets/dashboard" element={<Dashboard />} />
          {user?.role === 'admin' && (
            <Route path="/companies" element={<CompanyManagement />} />
          )}
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <Route path="/users" element={<UserManagement />} />
          )}
          <Route path="/audit" element={<AuditReporting />} />
          {user?.role === 'admin' && (
            <Route path="/admin" element={<AdminSettings />} />
          )}
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t py-4 mt-auto">
        <div className="container mx-auto px-4 md:px-6 text-center text-sm text-muted-foreground">
          SOC2 Compliance - KeyData Asset Registration System
        </div>
      </footer>
    </div>
  );
}

export default AppNew;
