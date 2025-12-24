import { useState, useMemo, useEffect, useCallback } from 'react';

/**
 * Custom hook for table filtering and pagination
 * Consolidates duplicate filter/pagination logic across components
 *
 * @param {Array} items - The items to filter/paginate
 * @param {Object} options - Configuration options
 * @param {string[]} options.searchFields - Fields to search in (for simple string search)
 * @param {Function} options.filterFn - Custom filter function (items, searchTerm) => filteredItems
 * @param {number} options.defaultPageSize - Default page size (default: 10)
 * @returns {Object} Filter and pagination state and helpers
 *
 * @example
 * // Simple usage with searchFields
 * const { searchTerm, setSearchTerm, paginatedItems, ... } = useTableFilters(users, {
 *   searchFields: ['name', 'email'],
 *   defaultPageSize: 10
 * });
 *
 * @example
 * // Advanced usage with custom filter function
 * const { paginatedItems, ... } = useTableFilters(assets, {
 *   filterFn: (items, searchTerm) => items.filter(item =>
 *     item.name.includes(searchTerm) && item.status === 'active'
 *   ),
 *   defaultPageSize: 25
 * });
 */
export const useTableFilters = (items, options = {}) => {
  const {
    searchFields = [],
    filterFn,
    defaultPageSize = 10
  } = options;

  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Filter items using custom function or searchFields
  const filteredItems = useMemo(() => {
    if (!items) return [];

    // Use custom filter function if provided
    if (filterFn) {
      return filterFn(items, searchTerm);
    }

    // Default: filter by searchFields
    if (!searchTerm || searchFields.length === 0) {
      return items;
    }

    const term = searchTerm.toLowerCase();
    return items.filter(item =>
      searchFields.some(field => {
        const value = item[field];
        return value && String(value).toLowerCase().includes(term);
      })
    );
  }, [items, searchTerm, searchFields, filterFn]);

  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize) || 1);

  // Reset to page 1 when pageSize or filtered results change
  useEffect(() => {
    setPage(1);
  }, [pageSize, filteredItems.length]);

  // Ensure page is within bounds when totalPages decreases
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  // Calculate paginated items
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  // Reset all filters and pagination
  const reset = useCallback(() => {
    setSearchTerm('');
    setPage(1);
    setPageSize(defaultPageSize);
  }, [defaultPageSize]);

  return {
    // Search state
    searchTerm,
    setSearchTerm,
    // Pagination state
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    // Computed data
    filteredItems,
    paginatedItems,
    // Helpers
    totalItems: filteredItems.length,
    reset
  };
};

export default useTableFilters;
