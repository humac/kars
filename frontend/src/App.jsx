import { useState } from 'react';
import AssetRegistrationForm from './components/AssetRegistrationForm';
import AssetList from './components/AssetList';

function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAssetRegistered = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Client Asset Registration System</h1>
        <p>SOC2 Compliance - Track and manage client laptops assigned to consultants</p>
      </header>

      <div className="main-content">
        <AssetRegistrationForm onAssetRegistered={handleAssetRegistered} />
        <AssetList refresh={refreshKey} />
      </div>
    </div>
  );
}

export default App;
