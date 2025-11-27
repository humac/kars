import { useState, useEffect } from 'react';
import StatusUpdateModal from './StatusUpdateModal';

const AssetList = ({ refresh }) => {
  const [assets, setAssets] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [filters, setFilters] = useState({
    employee: '',
    manager: '',
    client: '',
    status: ''
  });

  useEffect(() => {
    fetchAssets();
  }, [refresh]);

  useEffect(() => {
    applyFilters();
  }, [assets, filters]);

  const fetchAssets = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/assets');
      if (!response.ok) {
        throw new Error('Failed to fetch assets');
      }
      const data = await response.json();
      setAssets(data);
      setFilteredAssets(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...assets];

    if (filters.employee) {
      filtered = filtered.filter(asset =>
        asset.employee_name.toLowerCase().includes(filters.employee.toLowerCase()) ||
        (asset.employee_email && asset.employee_email.toLowerCase().includes(filters.employee.toLowerCase()))
      );
    }

    if (filters.manager) {
      filtered = filtered.filter(asset =>
        asset.manager_name.toLowerCase().includes(filters.manager.toLowerCase()) ||
        (asset.manager_email && asset.manager_email.toLowerCase().includes(filters.manager.toLowerCase()))
      );
    }

    if (filters.client) {
      filtered = filtered.filter(asset =>
        asset.client_name.toLowerCase().includes(filters.client.toLowerCase())
      );
    }

    if (filters.status) {
      filtered = filtered.filter(asset =>
        asset.status === filters.status
      );
    }

    setFilteredAssets(filtered);
  };

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const clearFilters = () => {
    setFilters({
      employee: '',
      manager: '',
      client: '',
      status: ''
    });
  };

  const handleStatusUpdate = (asset) => {
    setSelectedAsset(asset);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedAsset(null);
  };

  const handleStatusUpdated = () => {
    fetchAssets();
    handleModalClose();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusClass = (status) => {
    return `status-badge status-${status}`;
  };

  if (loading) {
    return (
      <div className="card">
        <h2>Asset Inventory</h2>
        <div className="loading">Loading assets...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2>Asset Inventory</h2>
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Asset Inventory ({filteredAssets.length} assets)</h2>

      <div className="search-bar">
        <input
          type="text"
          name="employee"
          placeholder="Search by employee..."
          value={filters.employee}
          onChange={handleFilterChange}
        />
        <input
          type="text"
          name="manager"
          placeholder="Search by manager..."
          value={filters.manager}
          onChange={handleFilterChange}
        />
        <input
          type="text"
          name="client"
          placeholder="Search by client..."
          value={filters.client}
          onChange={handleFilterChange}
        />
        <select
          name="status"
          value={filters.status}
          onChange={handleFilterChange}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="returned">Returned</option>
          <option value="lost">Lost</option>
          <option value="damaged">Damaged</option>
          <option value="retired">Retired</option>
        </select>
      </div>

      {(filters.employee || filters.manager || filters.client || filters.status) && (
        <div style={{ marginBottom: '15px' }}>
          <button onClick={clearFilters} className="btn btn-secondary">
            Clear Filters
          </button>
        </div>
      )}

      {filteredAssets.length === 0 ? (
        <div className="empty-state">
          <p>No assets found matching your search criteria.</p>
        </div>
      ) : (
        <div className="asset-table">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Employee Email</th>
                <th>Manager</th>
                <th>Manager Email</th>
                <th>Client</th>
                <th>Serial Number</th>
                <th>Asset Tag</th>
                <th>Status</th>
                <th>Registered</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => (
                <tr key={asset.id}>
                  <td>{asset.employee_name}</td>
                  <td>{asset.employee_email || '-'}</td>
                  <td>{asset.manager_name}</td>
                  <td>{asset.manager_email || '-'}</td>
                  <td>{asset.client_name}</td>
                  <td>{asset.laptop_serial_number}</td>
                  <td>{asset.laptop_asset_tag}</td>
                  <td>
                    <span className={getStatusClass(asset.status)}>
                      {asset.status.toUpperCase()}
                    </span>
                  </td>
                  <td>{formatDate(asset.registration_date)}</td>
                  <td>{formatDate(asset.last_updated)}</td>
                  <td>
                    <div className="actions">
                      <button
                        onClick={() => handleStatusUpdate(asset)}
                        className="btn btn-secondary"
                      >
                        Update Status
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && selectedAsset && (
        <StatusUpdateModal
          asset={selectedAsset}
          onClose={handleModalClose}
          onUpdate={handleStatusUpdated}
        />
      )}
    </div>
  );
};

export default AssetList;
