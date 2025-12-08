import { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';

const UsersContext = createContext(null);

export const UsersProvider = ({ children }) => {
  const { getAuthHeaders, isAuthenticated } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/auth/users', {
          headers: getAuthHeaders()
        });

        if (response.ok) {
          const data = await response.json();
          setUsers(data);
        } else {
          // If we can't fetch users (e.g., not admin), just set empty array
          // This is defensive - we don't want to break the UI
          setUsers([]);
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
        setError(err.message);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]); // getAuthHeaders intentionally omitted - only fetch once on authentication

  // Build a map for efficient lookups
  const usersById = useMemo(() => {
    const map = {};
    users.forEach(user => {
      if (user.id) {
        map[user.id] = user;
      }
    });
    return map;
  }, [users]);

  // Helper function to get full name
  const getFullName = useCallback((userId) => {
    if (!userId) return null;
    const user = usersById[userId];
    if (!user) return null;
    
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || null;
  }, [usersById]);

  // Helper function to get email
  const getEmail = useCallback((userId) => {
    if (!userId) return null;
    const user = usersById[userId];
    return user?.email || null;
  }, [usersById]);

  // Refresh function for manual updates
  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/auth/users', {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError(err.message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, getAuthHeaders]);

  const value = {
    users,
    usersById,
    loading,
    error,
    getFullName,
    getEmail,
    refresh
  };

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>;
};

export const useUsers = () => {
  const context = useContext(UsersContext);
  if (!context) {
    throw new Error('useUsers must be used within UsersProvider');
  }
  return context;
};
