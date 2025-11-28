import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const AdminSettings = () => {
  const { getAuthHeaders, user } = useAuth();
  const [activeView, setActiveView] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (activeView === 'users') {
      fetchUsers();
    }
  }, [activeView]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/users', {
        headers: {
          ...getAuthHeaders()
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/auth/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ role: newRole })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user role');
      }

      setSuccess(`User role updated to ${newRole}`);
      fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders()
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      setSuccess('User deleted successfully');
      fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const getRoleBadgeStyle = (role) => {
    const colors = {
      admin: '#667eea',
      manager: '#48bb78',
      employee: '#4299e1'
    };
    return {
      padding: '4px 12px',
      borderRadius: '4px',
      background: colors[role] || '#718096',
      color: 'white',
      fontWeight: 'bold',
      fontSize: '0.85rem',
      textTransform: 'capitalize'
    };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (user?.role !== 'admin') {
    return (
      <div className="card">
        <h2>Access Denied</h2>
        <p>You do not have permission to access this page. Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Admin Settings</h2>

      <div className="tabs" style={{ marginTop: '20px', marginBottom: '20px' }}>
        <button
          className={`tab ${activeView === 'users' ? 'active' : ''}`}
          onClick={() => setActiveView('users')}
        >
          User Management
        </button>
        <button
          className={`tab ${activeView === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveView('overview')}
        >
          System Overview
        </button>
        <button
          className={`tab ${activeView === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveView('settings')}
        >
          Application Settings
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: '20px' }}>
          {success}
        </div>
      )}

      {/* User Management View */}
      {activeView === 'users' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>Manage Users & Roles</h3>
            <p style={{ color: '#718096', margin: 0 }}>Total Users: {users.length}</p>
          </div>

          {loading ? (
            <div className="loading">Loading users...</div>
          ) : (
            <div className="asset-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={u.id === user.id}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e0',
                            background: 'white',
                            cursor: u.id === user.id ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <option value="employee">Employee</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td>{formatDate(u.created_at)}</td>
                      <td>{formatDate(u.last_login)}</td>
                      <td>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          disabled={u.id === user.id}
                          className="btn btn-secondary"
                          style={{
                            background: u.id === user.id ? '#e2e8f0' : '#e53e3e',
                            color: u.id === user.id ? '#a0aec0' : 'white',
                            cursor: u.id === user.id ? 'not-allowed' : 'pointer',
                            padding: '6px 12px'
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: '30px', padding: '20px', background: '#f7fafc', borderRadius: '8px' }}>
            <h4 style={{ marginTop: 0 }}>Role Descriptions</h4>
            <div style={{ display: 'grid', gap: '15px' }}>
              <div>
                <span style={getRoleBadgeStyle('admin')}>Admin</span>
                <p style={{ margin: '10px 0 0 0', color: '#4a5568' }}>
                  Full system access. Can manage all users, view all assets and reports, configure system settings.
                </p>
              </div>
              <div>
                <span style={getRoleBadgeStyle('manager')}>Manager</span>
                <p style={{ margin: '10px 0 0 0', color: '#4a5568' }}>
                  Can view their own assets plus assets of employees they manage. Access to audit reports for their team.
                </p>
              </div>
              <div>
                <span style={getRoleBadgeStyle('employee')}>Employee</span>
                <p style={{ margin: '10px 0 0 0', color: '#4a5568' }}>
                  Can only view and manage their own asset registrations.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Overview */}
      {activeView === 'overview' && (
        <div>
          <h3>System Overview</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginTop: '20px' }}>
            <div style={{ padding: '20px', background: '#f7fafc', borderRadius: '8px', border: '2px solid #667eea' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#667eea' }}>
                {users.length}
              </div>
              <div style={{ color: '#4a5568', marginTop: '5px' }}>Total Users</div>
            </div>

            <div style={{ padding: '20px', background: '#f7fafc', borderRadius: '8px', border: '2px solid #48bb78' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#48bb78' }}>
                {users.filter(u => u.role === 'admin').length}
              </div>
              <div style={{ color: '#4a5568', marginTop: '5px' }}>Administrators</div>
            </div>

            <div style={{ padding: '20px', background: '#f7fafc', borderRadius: '8px', border: '2px solid #4299e1' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4299e1' }}>
                {users.filter(u => u.role === 'manager').length}
              </div>
              <div style={{ color: '#4a5568', marginTop: '5px' }}>Managers</div>
            </div>

            <div style={{ padding: '20px', background: '#f7fafc', borderRadius: '8px', border: '2px solid #ed8936' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ed8936' }}>
                {users.filter(u => u.role === 'employee').length}
              </div>
              <div style={{ color: '#4a5568', marginTop: '5px' }}>Employees</div>
            </div>
          </div>

          <div style={{ marginTop: '30px', padding: '20px', background: '#f7fafc', borderRadius: '8px' }}>
            <h4 style={{ marginTop: 0 }}>System Information</h4>
            <p><strong>Application:</strong> Client Asset Registration System</p>
            <p><strong>Purpose:</strong> SOC2 Compliance - Track and manage client laptops</p>
            <p><strong>Features:</strong></p>
            <ul style={{ color: '#4a5568' }}>
              <li>Role-based access control (Admin, Manager, Employee)</li>
              <li>Asset registration and tracking</li>
              <li>Company management</li>
              <li>Comprehensive audit logging</li>
              <li>Customizable reporting and exports</li>
            </ul>
          </div>
        </div>
      )}

      {/* Application Settings */}
      {activeView === 'settings' && (
        <div>
          <h3>Application Settings</h3>

          <div style={{ marginTop: '20px' }}>
            <div style={{ padding: '20px', background: '#f7fafc', borderRadius: '8px', marginBottom: '20px' }}>
              <h4 style={{ marginTop: 0 }}>Company Management</h4>
              <p style={{ color: '#4a5568' }}>
                Manage registered companies through the Company Management tab. Companies can be created, edited, and deleted as needed.
              </p>
              <button
                onClick={() => window.location.hash = '#companies'}
                className="btn btn-primary"
                style={{ marginTop: '10px' }}
              >
                Go to Company Management
              </button>
            </div>

            <div style={{ padding: '20px', background: '#f7fafc', borderRadius: '8px', marginBottom: '20px' }}>
              <h4 style={{ marginTop: 0 }}>Audit & Compliance</h4>
              <p style={{ color: '#4a5568' }}>
                All asset operations are automatically logged for SOC2 compliance. View detailed audit trails and generate reports through the Audit & Reporting tab.
              </p>
              <p style={{ color: '#4a5568', marginTop: '10px' }}>
                <strong>Audit Features:</strong>
              </p>
              <ul style={{ color: '#4a5568' }}>
                <li>Comprehensive activity logging</li>
                <li>User attribution for all actions</li>
                <li>Timestamp tracking</li>
                <li>CSV export capabilities</li>
                <li>Role-based audit visibility</li>
              </ul>
            </div>

            <div style={{ padding: '20px', background: '#f7fafc', borderRadius: '8px', marginBottom: '20px' }}>
              <h4 style={{ marginTop: 0 }}>Data Management</h4>
              <p style={{ color: '#4a5568' }}>
                The system uses SQLite for data storage. Database backups are recommended for production deployments.
              </p>
              <p style={{ color: '#4a5568', marginTop: '10px' }}>
                <strong>Recommended Practices:</strong>
              </p>
              <ul style={{ color: '#4a5568' }}>
                <li>Regular database backups</li>
                <li>Periodic audit log reviews</li>
                <li>User access reviews (quarterly)</li>
                <li>Asset verification (monthly)</li>
              </ul>
            </div>

            <div style={{ padding: '20px', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
              <h4 style={{ marginTop: 0, color: '#856404' }}>⚠️ Security Best Practices</h4>
              <ul style={{ color: '#856404', marginBottom: 0 }}>
                <li>Regularly review user roles and permissions</li>
                <li>Remove inactive user accounts</li>
                <li>Enforce strong password policies</li>
                <li>Monitor audit logs for suspicious activity</li>
                <li>Keep the application updated</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
