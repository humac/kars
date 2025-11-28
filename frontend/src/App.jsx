import { useState } from 'react';
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
  const [activeTab, setActiveTab] = useState('assets');

  const handleAssetRegistered = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="loading" style={{ marginTop: '100px', fontSize: '1.2rem' }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Client Asset Registration System</h1>
          <p>SOC2 Compliance - Track and manage client laptops assigned to consultants</p>
        </div>
        <div className="user-menu">
          <div className="user-info">
            <div className="user-name">{user.name}</div>
            <div className="user-email">{user.email}</div>
          </div>
          <button onClick={logout} className="btn-logout">
            Logout
          </button>
        </div>
      </header>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'assets' ? 'active' : ''}`}
          onClick={() => setActiveTab('assets')}
        >
          Asset Management
        </button>
        <button
          className={`tab ${activeTab === 'companies' ? 'active' : ''}`}
          onClick={() => setActiveTab('companies')}
        >
          Company Management
        </button>
        <button
          className={`tab ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          Audit & Reporting
        </button>
        <button
          className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
        {user?.role === 'admin' && (
          <button
            className={`tab ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
            style={{ background: '#667eea', color: 'white' }}
          >
            Admin Settings
          </button>
        )}
      </div>

      {activeTab === 'assets' && (
        <AssetList refresh={refreshKey} onAssetRegistered={handleAssetRegistered} />
      )}

      {activeTab === 'companies' && <CompanyManagement />}

      {activeTab === 'audit' && <AuditReporting />}

      {activeTab === 'profile' && <Profile />}

      {activeTab === 'admin' && user?.role === 'admin' && <AdminSettings />}
    </div>
  );
}

export default App;
