/**
 * HubSpot Integration Module Tests
 * 
 * Tests for HubSpot API integration functions including connection testing,
 * company fetching, and syncing to KARS database.
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { testHubSpotConnection, fetchHubSpotCompanies, syncCompaniesToKARS } from './hubspot.js';

// Mock fetch globally
global.fetch = jest.fn();

describe('HubSpot Integration', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Reset all mocks after each test
    jest.resetAllMocks();
  });

  describe('testHubSpotConnection', () => {
    test('should return error when access token is missing', async () => {
      const result = await testHubSpotConnection('');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Access token is required');
      expect(fetch).not.toHaveBeenCalled();
    });

    test('should return success when API connection succeeds', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] })
      });

      const result = await testHubSpotConnection('test-token');
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Successfully connected to HubSpot API');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.hubapi.com/crm/v3/objects/companies?limit=1',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }
        })
      );
    });

    test('should return error when API returns error response', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Invalid token' })
      });

      const result = await testHubSpotConnection('invalid-token');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('HubSpot API error: Invalid token');
    });

    test('should handle API error without message in response', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({})
      });

      const result = await testHubSpotConnection('test-token');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('HubSpot API error: Bad Request');
    });

    test('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await testHubSpotConnection('test-token');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Connection failed: Network error');
    });
  });

  describe('fetchHubSpotCompanies', () => {
    test('should throw error when access token is missing', async () => {
      await expect(fetchHubSpotCompanies('')).rejects.toThrow('Access token is required');
      expect(fetch).not.toHaveBeenCalled();
    });

    test('should fetch companies successfully without pagination', async () => {
      const mockCompanies = [
        { id: '1', properties: { name: 'Company A', description: 'Description A' } },
        { id: '2', properties: { name: 'Company B', description: 'Description B' } }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockCompanies })
      });

      const companies = await fetchHubSpotCompanies('test-token');
      
      expect(companies).toEqual(mockCompanies);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('should handle pagination correctly', async () => {
      const firstBatch = [
        { id: '1', properties: { name: 'Company A' } }
      ];
      const secondBatch = [
        { id: '2', properties: { name: 'Company B' } }
      ];

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: firstBatch,
            paging: { next: { after: 'cursor-1' } }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: secondBatch
          })
        });

      const companies = await fetchHubSpotCompanies('test-token');
      
      expect(companies).toEqual([...firstBatch, ...secondBatch]);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('should throw error when API request fails', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Forbidden',
        json: async () => ({ message: 'Access denied' })
      });

      await expect(fetchHubSpotCompanies('test-token')).rejects.toThrow(
        'Failed to fetch companies from HubSpot: HubSpot API error: Access denied'
      );
    });

    test('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(fetchHubSpotCompanies('test-token')).rejects.toThrow(
        'Failed to fetch companies from HubSpot: Network timeout'
      );
    });
  });

  describe('syncCompaniesToKARS', () => {
    let mockCompanyDb;
    let mockAuditDb;

    beforeEach(() => {
      mockCompanyDb = {
        getByHubSpotId: jest.fn(),
        getByName: jest.fn(),
        updateByHubSpotId: jest.fn(),
        setHubSpotId: jest.fn(),
        createWithHubSpotId: jest.fn()
      };

      mockAuditDb = {
        log: jest.fn()
      };
    });

    test('should create new companies from HubSpot', async () => {
      const mockHubSpotCompanies = [
        { id: 'hs-1', properties: { name: 'New Company', description: 'New Desc' } }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockHubSpotCompanies })
      });

      mockCompanyDb.getByHubSpotId.mockResolvedValue(null);
      mockCompanyDb.getByName.mockResolvedValue(null);
      mockCompanyDb.createWithHubSpotId.mockResolvedValue({ id: 1 });

      const result = await syncCompaniesToKARS('test-token', mockCompanyDb, mockAuditDb, 'admin@test.com');

      expect(result.companiesFound).toBe(1);
      expect(result.companiesCreated).toBe(1);
      expect(result.companiesUpdated).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockCompanyDb.createWithHubSpotId).toHaveBeenCalledWith({
        name: 'New Company',
        description: 'New Desc',
        hubspot_id: 'hs-1'
      });
    });

    test('should update existing companies when data changes', async () => {
      const mockHubSpotCompanies = [
        { id: 'hs-1', properties: { name: 'Updated Company', description: 'Updated Desc' } }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockHubSpotCompanies })
      });

      mockCompanyDb.getByHubSpotId.mockResolvedValue({
        id: 1,
        name: 'Old Company',
        description: 'Old Desc'
      });

      const result = await syncCompaniesToKARS('test-token', mockCompanyDb, mockAuditDb, 'admin@test.com');

      expect(result.companiesFound).toBe(1);
      expect(result.companiesCreated).toBe(0);
      expect(result.companiesUpdated).toBe(1);
      expect(mockCompanyDb.updateByHubSpotId).toHaveBeenCalledWith('hs-1', {
        name: 'Updated Company',
        description: 'Updated Desc'
      });
    });

    test('should link existing company by name when no HubSpot ID exists', async () => {
      const mockHubSpotCompanies = [
        { id: 'hs-1', properties: { name: 'Existing Company', description: 'Desc' } }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockHubSpotCompanies })
      });

      mockCompanyDb.getByHubSpotId.mockResolvedValue(null);
      mockCompanyDb.getByName.mockResolvedValue({ id: 1, name: 'Existing Company' });

      const result = await syncCompaniesToKARS('test-token', mockCompanyDb, mockAuditDb, 'admin@test.com');

      expect(result.companiesFound).toBe(1);
      expect(result.companiesCreated).toBe(0);
      expect(result.companiesUpdated).toBe(1);
      expect(mockCompanyDb.setHubSpotId).toHaveBeenCalledWith(1, 'hs-1');
    });

    test('should handle errors for individual companies without failing entire sync', async () => {
      const mockHubSpotCompanies = [
        { id: 'hs-1', properties: { name: 'Good Company' } },
        { id: 'hs-2', properties: { name: 'Bad Company' } }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockHubSpotCompanies })
      });

      mockCompanyDb.getByHubSpotId
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockCompanyDb.getByName
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockCompanyDb.createWithHubSpotId
        .mockResolvedValueOnce({ id: 1 })
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await syncCompaniesToKARS('test-token', mockCompanyDb, mockAuditDb, 'admin@test.com');

      expect(result.companiesFound).toBe(2);
      expect(result.companiesCreated).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        company_id: 'hs-2',
        company_name: 'Bad Company',
        error: 'Database error'
      });
    });

    test('should throw error when HubSpot API fails', async () => {
      fetch.mockRejectedValueOnce(new Error('API error'));

      await expect(
        syncCompaniesToKARS('test-token', mockCompanyDb, mockAuditDb, 'admin@test.com')
      ).rejects.toThrow('HubSpot sync failed: Failed to fetch companies from HubSpot: API error');
    });

    test('should handle companies without description', async () => {
      const mockHubSpotCompanies = [
        { id: 'hs-1', properties: { name: 'Company Without Desc' } }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockHubSpotCompanies })
      });

      mockCompanyDb.getByHubSpotId.mockResolvedValue(null);
      mockCompanyDb.getByName.mockResolvedValue(null);
      mockCompanyDb.createWithHubSpotId.mockResolvedValue({ id: 1 });

      const result = await syncCompaniesToKARS('test-token', mockCompanyDb, mockAuditDb, 'admin@test.com');

      expect(result.companiesCreated).toBe(1);
      expect(mockCompanyDb.createWithHubSpotId).toHaveBeenCalledWith({
        name: 'Company Without Desc',
        description: '',
        hubspot_id: 'hs-1'
      });
    });
  });
});
