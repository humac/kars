import { useState } from 'react';
import AssetList from './components/AssetList';
import CompanyManagement from './components/CompanyManagement';
import AuditReporting from './components/AuditReporting';

function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState('assets');

  const handleAssetRegistered = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Client Asset Registration System</h1>
        <p>SOC2 Compliance - Track and manage client laptops assigned to consultants</p>
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
      </div>

      {activeTab === 'assets' && (
        <AssetList refresh={refreshKey} onAssetRegistered={handleAssetRegistered} />
      )}

      {activeTab === 'companies' && <CompanyManagement />}

      {activeTab === 'audit' && <AuditReporting />}
    </div>
  );
}

export default App;
