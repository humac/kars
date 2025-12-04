import { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  LayoutDashboard,
  Building2,
  FileBarChart,
  Settings,
  User,
  LogOut,
  Menu,
  X,
  Loader2,
} from 'lucide-react';
import Dashboard from '@/components/Dashboard';
import CompanyManagementNew from '@/components/CompanyManagementNew';
import AuditReportingNew from '@/components/AuditReportingNew';
import AdminSettingsNew from '@/components/AdminSettingsNew';
import ProfileNew from '@/components/ProfileNew';
import AuthPageNew from '@/components/AuthPageNew';
import OIDCCallback from '@/components/OIDCCallback';

function AppNew() {
  const { user, logout, loading, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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
    return <AuthPageNew />;
  }

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/', role: null },
    { label: 'Companies', icon: Building2, path: '/companies', role: 'admin' },
    { label: 'Audit & Reports', icon: FileBarChart, path: '/audit', role: null },
    { label: 'Admin Settings', icon: Settings, path: '/admin', role: 'admin' },
  ];

  const visibleNavItems = navItems.filter(item => !item.role || user?.role === item.role);

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/assets';
    }
    return location.pathname === path;
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
        <div className="container mx-auto flex h-16 items-center justify-between">
          {/* Logo and Nav */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
                <Laptop className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg hidden sm:block">ARS</span>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
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
            <div className="container mx-auto py-4 space-y-4">
              {/* User Info */}
              <div className="flex items-center gap-3 pb-4 border-b">
                <Avatar className="h-10 w-10">
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
      <main className="container mx-auto py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/assets" element={<Dashboard />} />
          {user?.role === 'admin' && (
            <Route path="/companies" element={<CompanyManagementNew />} />
          )}
          <Route path="/audit" element={<AuditReportingNew />} />
          {user?.role === 'admin' && (
            <Route path="/admin" element={<AdminSettingsNew />} />
          )}
          <Route path="/profile" element={<ProfileNew />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t py-4 mt-auto">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          SOC2 Compliance - Asset Registration System
        </div>
      </footer>
    </div>
  );
}

export default AppNew;
