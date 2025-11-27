import { useState, useEffect } from 'react';

const AuditReporting = () => {
  const [activeView, setActiveView] = useState('logs');
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
    userEmail: '',
    limit: 100
  });

  useEffect(() => {
    if (activeView === 'logs') {
      fetchLogs();
    } else if (activeView === 'summary') {
      fetchSummary();
    } else if (activeView === 'stats') {
      fetchStats();
    }
  }, [activeView]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.action) params.append('action', filters.action);
      if (filters.entityType) params.append('entityType', filters.entityType);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.userEmail) params.append('userEmail', filters.userEmail);
      if (filters.limit) params.append('limit', filters.limit);

      const response = await fetch(`/api/audit/logs?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }
      const data = await response.json();
      setLogs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/reports/summary');
      if (!response.ok) {
        throw new Error('Failed to fetch summary');
      }
      const data = await response.json();
      setSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`/api/audit/stats?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const handleApplyFilters = () => {
    if (activeView === 'logs') {
      fetchLogs();
    } else if (activeView === 'stats') {
      fetchStats();
    }
  };

  const handleClearFilters = () => {
    setFilters({
      action: '',
      entityType: '',
      startDate: '',
      endDate: '',
      userEmail: '',
      limit: 100
    });
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.action) params.append('action', filters.action);
      if (filters.entityType) params.append('entityType', filters.entityType);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.userEmail) params.append('userEmail', filters.userEmail);

      const response = await fetch(`/api/audit/export?${params}`);
      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Error exporting data: ' + err.message);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionBadgeClass = (action) => {
    switch (action) {
      case 'CREATE':
        return 'status-badge status-active';
      case 'STATUS_CHANGE':
        return 'status-badge status-returned';
      case 'UPDATE':
        return 'status-badge status-damaged';
      case 'DELETE':
        return 'status-badge status-lost';
      default:
        return 'status-badge status-retired';
    }
  };

  return (
    <div className="card">
      <h2>Audit & Reporting</h2>

      <div className="tabs" style={{ marginTop: '20px', marginBottom: '20px' }}>
        <button
          className={`tab ${activeView === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveView('logs')}
        >
          Audit Logs
        </button>
        <button
          className={`tab ${activeView === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveView('summary')}
        >
          Summary Report
        </button>
        <button
          className={`tab ${activeView === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveView('stats')}
        >
          Statistics
        </button>
      </div>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {/* Audit Logs View */}
      {activeView === 'logs' && (
        <>
          <div className="search-bar">
            <select name="action" value={filters.action} onChange={handleFilterChange}>
              <option value="">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="STATUS_CHANGE">Status Change</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
            </select>

            <select name="entityType" value={filters.entityType} onChange={handleFilterChange}>
              <option value="">All Types</option>
              <option value="asset">Asset</option>
              <option value="company">Company</option>
            </select>

            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              placeholder="Start Date"
            />

            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              placeholder="End Date"
            />

            <input
              type="email"
              name="userEmail"
              value={filters.userEmail}
              onChange={handleFilterChange}
              placeholder="User Email"
            />

            <select name="limit" value={filters.limit} onChange={handleFilterChange}>
              <option value="50">50 records</option>
              <option value="100">100 records</option>
              <option value="250">250 records</option>
              <option value="500">500 records</option>
              <option value="">All records</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button onClick={handleApplyFilters} className="btn btn-primary" style={{ width: 'auto', padding: '10px 20px' }}>
              Apply Filters
            </button>
            <button onClick={handleClearFilters} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 20px' }}>
              Clear Filters
            </button>
            <button onClick={handleExport} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 20px', marginLeft: 'auto' }}>
              Export to CSV
            </button>
          </div>

          {loading ? (
            <div className="loading">Loading audit logs...</div>
          ) : logs.length === 0 ? (
            <div className="empty-state">
              <p>No audit logs found matching your criteria.</p>
            </div>
          ) : (
            <div className="asset-table">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Entity Type</th>
                    <th>Entity Name</th>
                    <th>Details</th>
                    <th>User</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDate(log.timestamp)}</td>
                      <td>
                        <span className={getActionBadgeClass(log.action)}>
                          {log.action}
                        </span>
                      </td>
                      <td>{log.entity_type}</td>
                      <td>{log.entity_name || '-'}</td>
                      <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.details}
                      </td>
                      <td>{log.user_email || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Summary Report View */}
      {activeView === 'summary' && (
        <>
          {loading ? (
            <div className="loading">Loading summary...</div>
          ) : summary ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div style={{ padding: '20px', background: '#f7fafc', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '15px', fontSize: '1.2rem' }}>Total Assets</h3>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#667eea' }}>
                  {summary.total}
                </div>
              </div>

              <div style={{ padding: '20px', background: '#f7fafc', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '15px', fontSize: '1.2rem' }}>By Status</h3>
                {Object.entries(summary.by_status).map(([status, count]) => (
                  <div key={status} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ textTransform: 'capitalize' }}>{status}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>

              <div style={{ padding: '20px', background: '#f7fafc', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '15px', fontSize: '1.2rem' }}>By Company</h3>
                {Object.entries(summary.by_company).map(([company, count]) => (
                  <div key={company} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>{company}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>

              <div style={{ padding: '20px', background: '#f7fafc', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '15px', fontSize: '1.2rem' }}>By Manager</h3>
                {Object.entries(summary.by_manager).slice(0, 10).map(([manager, count]) => (
                  <div key={manager} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>{manager}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
                {Object.keys(summary.by_manager).length > 10 && (
                  <div style={{ marginTop: '10px', fontSize: '0.9rem', color: '#718096' }}>
                    ...and {Object.keys(summary.by_manager).length - 10} more
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Statistics View */}
      {activeView === 'stats' && (
        <>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              placeholder="Start Date"
            />
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              placeholder="End Date"
            />
            <button onClick={handleApplyFilters} className="btn btn-primary" style={{ width: 'auto', padding: '10px 20px' }}>
              Apply Filters
            </button>
          </div>

          {loading ? (
            <div className="loading">Loading statistics...</div>
          ) : stats.length === 0 ? (
            <div className="empty-state">
              <p>No statistics available for the selected period.</p>
            </div>
          ) : (
            <div className="asset-table">
              <table>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Entity Type</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((stat, index) => (
                    <tr key={index}>
                      <td>
                        <span className={getActionBadgeClass(stat.action)}>
                          {stat.action}
                        </span>
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{stat.entity_type}</td>
                      <td><strong>{stat.count}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AuditReporting;
