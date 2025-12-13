import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function usePendingAttestations() {
  const { getAuthHeaders, isAuthenticated } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchPendingCount = async () => {
    if (!isAuthenticated) {
      setPendingCount(0);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/attestation/my-attestations', {
        headers: { ...getAuthHeaders() }
      });
      
      if (!res.ok) {
        setPendingCount(0);
        return;
      }

      const data = await res.json();
      const attestations = data.attestations || [];
      
      // Count attestations that are not completed
      const pending = attestations.filter(a => a.status !== 'completed').length;
      setPendingCount(pending);
    } catch (err) {
      console.error('Error fetching pending attestations:', err);
      setPendingCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingCount();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchPendingCount, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, getAuthHeaders]);

  return { pendingCount, loading, refresh: fetchPendingCount };
}
