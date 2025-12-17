import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Package, Users, Building2 } from 'lucide-react';

const Dashboard = () => {
  const { getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState({
    assetsCount: 0,
    employeesCount: 0,
    companiesCount: 0
  });

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stats', {
        headers: { ...getAuthHeaders() }
      });
      if (response.ok) {
        const data = await response.json();
        setDashboardStats(data);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <Card className="stat-card group">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Package className="h-5 w-5 md:h-6 md:w-6 text-primary-foreground" />
              </div>
            </div>
            <div className="text-3xl md:text-4xl font-bold text-gradient mb-1">{dashboardStats.assetsCount}</div>
            <p className="text-xs md:text-sm text-muted-foreground font-medium">Total Assets</p>
          </CardContent>
        </Card>
        
        <Card className="stat-card group">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gradient-success flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Users className="h-5 w-5 md:h-6 md:w-6 text-success-foreground" />
              </div>
            </div>
            <div className="text-3xl md:text-4xl font-bold text-gradient mb-1">{dashboardStats.employeesCount}</div>
            <p className="text-xs md:text-sm text-muted-foreground font-medium">Team Members</p>
          </CardContent>
        </Card>
        
        <Card className="stat-card group">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gradient-to-br from-warning/80 to-warning flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Building2 className="h-5 w-5 md:h-6 md:w-6 text-warning-foreground" />
              </div>
            </div>
            <div className="text-3xl md:text-4xl font-bold text-gradient mb-1">{dashboardStats.companiesCount}</div>
            <p className="text-xs md:text-sm text-muted-foreground font-medium">Partners</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
