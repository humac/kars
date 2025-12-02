import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Profile = () => {
  const { user, getAuthHeaders, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [error, setError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

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

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
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

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    // Client-side validation
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      setPasswordLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long');
      setPasswordLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(passwordData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      setPasswordSuccess(true);

      // Clear password form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      setTimeout(() => setPasswordSuccess(false), 5000);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="card" style={{ marginBottom: '30px' }}>
        <h2>Profile Information</h2>

        <div style={{ marginBottom: '30px', padding: '15px', background: '#f7fafc', borderRadius: '6px' }}>
          <p><strong>Email:</strong> {user?.email}</p>
          <p>
            <strong>Role:</strong>{' '}
            <span
              style={{
                textTransform: 'capitalize',
                padding: '4px 12px',
                borderRadius: '4px',
                background: user?.role === 'admin' ? '#2b75a7' : user?.role === 'manager' ? '#184a7b' : '#172b51',
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

      <div className="card">
        <h2>Change Password</h2>

        {passwordSuccess && (
          <div className="alert alert-success">
            Password changed successfully!
          </div>
        )}

        {passwordError && (
          <div className="alert alert-error">
            {passwordError}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit}>
          <div className="form-group">
            <label htmlFor="currentPassword">Current Password *</label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              value={passwordData.currentPassword}
              onChange={handlePasswordChange}
              required
              placeholder="Enter current password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">New Password *</label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              value={passwordData.newPassword}
              onChange={handlePasswordChange}
              required
              placeholder="Enter new password (min 6 characters)"
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={passwordData.confirmPassword}
              onChange={handlePasswordChange}
              required
              placeholder="Confirm new password"
              minLength={6}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={passwordLoading}>
            {passwordLoading ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;
