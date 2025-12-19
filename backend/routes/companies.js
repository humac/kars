/**
 * Company Management Routes
 * Handles: list, create, update, delete, import companies
 */

import { Router } from 'express';
import { unlink } from 'fs/promises';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger({ module: 'companies' });

/**
 * Create and configure the companies router
 * @param {Object} deps - Dependencies
 */
export default function createCompaniesRouter(deps) {
  const router = Router();

  const {
    companyDb,
    auditDb,
    authenticate,
    authorize,
    upload,
    parseCSVFile,
  } = deps;

  // Get all companies (admin and manager read-only - full details)
  router.get('/', authenticate, authorize('admin', 'attestation_coordinator', 'manager'), async (req, res) => {
    try {
      const companies = await companyDb.getAll();
      res.json(companies);
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error fetching companies');
      res.status(500).json({ error: 'Failed to fetch companies' });
    }
  });

  // Get company names for dropdown (all authenticated users)
  router.get('/names', authenticate, async (req, res) => {
    try {
      const companies = await companyDb.getAll();
      const companyNames = companies.map(c => ({ id: c.id, name: c.name }));
      res.json(companyNames);
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error fetching company names');
      res.status(500).json({ error: 'Failed to fetch company names' });
    }
  });

  // Bulk import companies via CSV (admin only)
  router.post('/import', authenticate, authorize('admin'), upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    try {
      const records = await parseCSVFile(req.file.path);
      let imported = 0;
      const errors = [];

      for (let index = 0; index < records.length; index++) {
        const row = records[index];
        const name = (row.name || '').trim();
        const description = (row.description || '').trim();

        if (!name) {
          errors.push(`Row ${index + 2}: Company name is required`);
          continue;
        }

        try {
          const existing = await companyDb.getByName(name);
          if (existing) {
            errors.push(`Row ${index + 2}: A company with the name "${name}" already exists`);
            continue;
          }

          const result = await companyDb.create({ name, description });
          const newCompany = await companyDb.getById(result.id);

          await auditDb.log(
            'CREATE',
            'company',
            newCompany.id,
            name,
            { description: newCompany.description, imported: true },
            req.user.email
          );

          imported += 1;
        } catch (error) {
          errors.push(`Row ${index + 2}: ${error.message}`);
        }
      }

      res.json({
        message: `Imported ${imported} companies${errors.length ? ` with ${errors.length} issues` : ''}`,
        imported,
        failed: errors.length,
        errors
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error importing companies');
      res.status(500).json({ error: 'Failed to import companies' });
    } finally {
      await unlink(req.file.path);
    }
  });

  // Get single company by ID
  router.get('/:id', async (req, res) => {
    try {
      const company = await companyDb.getById(req.params.id);
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }
      res.json(company);
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error fetching company');
      res.status(500).json({ error: 'Failed to fetch company' });
    }
  });

  // Create new company (admin only)
  router.post('/', authenticate, authorize('admin'), async (req, res) => {
    try {
      const { name } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Company name is required' });
      }

      const existing = await companyDb.getByName(name);
      if (existing) {
        return res.status(409).json({ error: 'A company with this name already exists' });
      }

      const result = await companyDb.create(req.body);
      const newCompany = await companyDb.getById(result.id);

      res.status(201).json({
        message: 'Company registered successfully',
        company: newCompany
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error creating company');

      if (error.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'A company with this name already exists' });
      }

      res.status(500).json({ error: 'Failed to register company' });
    }
  });

  // Update company (admin only)
  router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
      const company = await companyDb.getById(req.params.id);
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      const { name } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Company name is required' });
      }

      const existing = await companyDb.getByName(name);
      if (existing && existing.id !== parseInt(req.params.id)) {
        return res.status(409).json({ error: 'A company with this name already exists' });
      }

      await companyDb.update(req.params.id, req.body);
      const updatedCompany = await companyDb.getById(req.params.id);

      res.json({
        message: 'Company updated successfully',
        company: updatedCompany
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error updating company');

      if (error.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'A company with this name already exists' });
      }

      res.status(500).json({ error: 'Failed to update company' });
    }
  });

  // Delete company (admin only)
  router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
      const company = await companyDb.getById(req.params.id);
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      if (await companyDb.hasAssets(company.id)) {
        return res.status(409).json({
          error: 'Cannot delete company with existing assets. Please reassign or delete assets first.'
        });
      }

      await companyDb.delete(req.params.id);
      res.json({ message: 'Company deleted successfully' });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error deleting company');
      res.status(500).json({ error: 'Failed to delete company' });
    }
  });

  return router;
}
