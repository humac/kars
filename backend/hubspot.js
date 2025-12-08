/**
 * HubSpot CRM API Integration Module
 * 
 * This module provides functions to interact with the HubSpot CRM API
 * for syncing company data into KARS.
 * 
 * HubSpot API Documentation:
 * - Base URL: https://api.hubapi.com
 * - Authentication: Private App Access Token via Bearer token
 * - Companies endpoint: GET /crm/v3/objects/companies
 * - Reference: https://developers.hubspot.com/docs/api/crm/companies
 */

/**
 * Test HubSpot API connection with the provided access token
 * @param {string} accessToken - HubSpot Private App Access Token
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const testHubSpotConnection = async (accessToken) => {
  if (!accessToken) {
    return { success: false, message: 'Access token is required' };
  }

  try {
    const response = await fetch('https://api.hubapi.com/crm/v3/objects/companies?limit=1', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `HubSpot API error: ${errorData.message || response.statusText}`
      };
    }

    return {
      success: true,
      message: 'Successfully connected to HubSpot API'
    };
  } catch (error) {
    return {
      success: false,
      message: `Connection failed: ${error.message}`
    };
  }
};

/**
 * Fetch all companies from HubSpot with pagination support
 * @param {string} accessToken - HubSpot Private App Access Token
 * @returns {Promise<Array>} Array of company objects
 */
export const fetchHubSpotCompanies = async (accessToken) => {
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  const companies = [];
  let after = null;
  const limit = 100; // HubSpot API limit per request

  try {
    do {
      const url = new URL('https://api.hubapi.com/crm/v3/objects/companies');
      url.searchParams.append('limit', limit);
      url.searchParams.append('properties', 'name,description');
      if (after) {
        url.searchParams.append('after', after);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HubSpot API error: ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      
      if (data.results && Array.isArray(data.results)) {
        companies.push(...data.results);
      }

      // Check for pagination
      after = data.paging?.next?.after || null;
    } while (after);

    return companies;
  } catch (error) {
    throw new Error(`Failed to fetch companies from HubSpot: ${error.message}`);
  }
};

/**
 * Sync companies from HubSpot to KARS database
 * @param {string} accessToken - HubSpot Private App Access Token
 * @param {Object} companyDb - Company database methods
 * @param {Object} auditDb - Audit log database methods
 * @param {string} userEmail - Email of user performing the sync
 * @returns {Promise<{companiesFound: number, companiesCreated: number, companiesUpdated: number, errors: Array}>}
 */
export const syncCompaniesToKARS = async (accessToken, companyDb, auditDb, userEmail = null) => {
  const result = {
    companiesFound: 0,
    companiesCreated: 0,
    companiesUpdated: 0,
    errors: []
  };

  try {
    // Fetch all companies from HubSpot
    const hubspotCompanies = await fetchHubSpotCompanies(accessToken);
    result.companiesFound = hubspotCompanies.length;

    // Sync each company
    for (const hsCompany of hubspotCompanies) {
      try {
        const hubspotId = hsCompany.id;
        const name = hsCompany.properties?.name || `HubSpot Company ${hubspotId}`;
        const description = hsCompany.properties?.description || '';

        // Check if company already exists by HubSpot ID
        const existingCompany = await companyDb.getByHubSpotId(hubspotId);

        if (existingCompany) {
          // Update existing company if data has changed
          if (existingCompany.name !== name || existingCompany.description !== description) {
            await companyDb.updateByHubSpotId(hubspotId, { name, description });
            result.companiesUpdated++;
            
            await auditDb.log(
              'update',
              'company',
              existingCompany.id,
              name,
              `Updated from HubSpot sync (HubSpot ID: ${hubspotId})`,
              userEmail
            );
          }
        } else {
          // Check if a company with the same name already exists (but different HubSpot ID)
          const companyByName = await companyDb.getByName(name);
          
          if (companyByName) {
            // Company exists with same name but no HubSpot ID - link it
            await companyDb.setHubSpotId(companyByName.id, hubspotId);
            result.companiesUpdated++;
            
            await auditDb.log(
              'update',
              'company',
              companyByName.id,
              name,
              `Linked to HubSpot (HubSpot ID: ${hubspotId})`,
              userEmail
            );
          } else {
            // Create new company with HubSpot ID
            const newCompany = await companyDb.createWithHubSpotId({
              name,
              description,
              hubspot_id: hubspotId
            });
            result.companiesCreated++;
            
            await auditDb.log(
              'create',
              'company',
              newCompany.id,
              name,
              `Created from HubSpot sync (HubSpot ID: ${hubspotId})`,
              userEmail
            );
          }
        }
      } catch (error) {
        result.errors.push({
          company_id: hsCompany.id,
          company_name: hsCompany.properties?.name || 'Unknown',
          error: error.message
        });
      }
    }
  } catch (error) {
    throw new Error(`HubSpot sync failed: ${error.message}`);
  }

  return result;
};
