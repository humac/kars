import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Profile = () => {
  const { user, getAuthHeaders, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Initialize form with user data
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setSuccess(true);

      // Update user in context
      updateUser(data.user);

      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2>Profile Management</h2>

      <div style={{ marginBottom: '30px', padding: '15px', background: '#f7fafc', borderRadius: '6px' }}>
        <p><strong>Email:</strong> {user?.email}</p>
        <p>
          <strong>Role:</strong>{' '}
          <span
            style={{
              textTransform: 'capitalize',
              padding: '4px 12px',
              borderRadius: '4px',
              background: user?.role === 'admin' ? '#667eea' : user?.role === 'manager' ? '#48bb78' : '#4299e1',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.9rem'
            }}
          >
            {user?.role}
          </span>
        </p>
        <p><strong>Current Name:</strong> {user?.name || 'Not set'}</p>
      </div>

      {success && (
        <div className="alert alert-success">
          Profile updated successfully!
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="first_name">First Name *</label>
          <input
            type="text"
            id="first_name"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            required
            placeholder="John"
          />
        </div>

        <div className="form-group">
          <label htmlFor="last_name">Last Name *</label>
          <input
            type="text"
            id="last_name"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            required
            placeholder="Doe"
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Updating...' : 'Update Profile'}
        </button>
      </form>
    </div>
  );
};

export default Profile;
