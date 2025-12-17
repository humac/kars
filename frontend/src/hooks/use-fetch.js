import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from './use-toast';

/**
 * Custom hook for making authenticated API calls with consistent error handling
 *
 * @example
 * // Basic usage - manual trigger
 * const { execute, loading, error } = useFetch();
 * const handleSubmit = async () => {
 *   const result = await execute('/api/assets', { method: 'POST', body: data });
 *   if (result) { // success }
 * };
 *
 * @example
 * // With automatic toast on error
 * const { execute, loading } = useFetch({ showErrorToast: true });
 *
 * @example
 * // Suppress specific error codes (e.g., 404 for optional data)
 * const { execute } = useFetch({ suppressErrorCodes: [404] });
 */
export function useFetch(options = {}) {
  const {
    showErrorToast = true,
    suppressErrorCodes = [],
    onUnauthorized = null, // Custom handler for 401
  } = options;

  const { getAuthHeaders, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (url, fetchOptions = {}) => {
    const {
      method = 'GET',
      body = null,
      headers = {},
      skipAuth = false,
      successMessage = null,
      errorMessage = null,
    } = fetchOptions;

    setLoading(true);
    setError(null);

    try {
      const requestHeaders = {
        ...(skipAuth ? {} : getAuthHeaders()),
        ...headers,
      };

      // Add Content-Type for requests with body (unless it's FormData)
      if (body && !(body instanceof FormData)) {
        requestHeaders['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body instanceof FormData ? body : (body ? JSON.stringify(body) : null),
      });

      // Handle 401 Unauthorized - user session expired
      if (response.status === 401) {
        if (onUnauthorized) {
          onUnauthorized();
        } else {
          logout();
          toast({
            title: 'Session Expired',
            description: 'Please log in again.',
            variant: 'destructive',
          });
        }
        return null;
      }

      // Parse response
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Handle error responses
      if (!response.ok) {
        const errorMsg = data?.error || data?.message || errorMessage || `Request failed (${response.status})`;

        // Check if this error code should be suppressed
        if (!suppressErrorCodes.includes(response.status)) {
          setError(errorMsg);

          if (showErrorToast) {
            toast({
              title: 'Error',
              description: errorMsg,
              variant: 'destructive',
            });
          }
        }

        return null;
      }

      // Success
      if (successMessage) {
        toast({
          title: 'Success',
          description: successMessage,
          variant: 'success',
        });
      }

      return data;
    } catch (err) {
      const errorMsg = errorMessage || err.message || 'Network error occurred';
      setError(errorMsg);

      if (showErrorToast) {
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
      }

      return null;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, logout, showErrorToast, suppressErrorCodes, onUnauthorized]);

  /**
   * Convenience method for GET requests
   */
  const get = useCallback((url, options = {}) => {
    return execute(url, { method: 'GET', ...options });
  }, [execute]);

  /**
   * Convenience method for POST requests
   */
  const post = useCallback((url, body, options = {}) => {
    return execute(url, { method: 'POST', body, ...options });
  }, [execute]);

  /**
   * Convenience method for PUT requests
   */
  const put = useCallback((url, body, options = {}) => {
    return execute(url, { method: 'PUT', body, ...options });
  }, [execute]);

  /**
   * Convenience method for PATCH requests
   */
  const patch = useCallback((url, body, options = {}) => {
    return execute(url, { method: 'PATCH', body, ...options });
  }, [execute]);

  /**
   * Convenience method for DELETE requests
   */
  const del = useCallback((url, options = {}) => {
    return execute(url, { method: 'DELETE', ...options });
  }, [execute]);

  return {
    execute,
    get,
    post,
    put,
    patch,
    del,
    loading,
    error,
    setError,
  };
}

export default useFetch;
