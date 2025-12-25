/**
 * Asset Routes
 * Handles: list, create, update, delete, bulk operations, import
 */

import { Router } from 'express';
import { unlink } from 'fs/promises';
import { VALID_STATUSES } from '../utils/constants.js';
import { requireFields, validateStatus, validateIdArray } from '../middleware/validation.js';
import { requireAsset, requireAssetPermission } from '../middleware/authorization.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger({ module: 'assets' });

/**
 * Create and configure the assets router
 * @param {Object} deps - Dependencies
 */
export default function createAssetsRouter(deps) {
  const router = Router();

  const {
    assetDb,
    userDb,
    auditDb,
    assetTypeDb,
    authenticate,
    authorize,
    upload,
    parseCSVFile,
  } = deps;

  // Create authorization middleware instances
  const fetchAsset = requireAsset(assetDb);
  const requireEditPermission = requireAssetPermission(assetDb, userDb, { action: 'edit' });
  const requireDeletePermission = requireAssetPermission(assetDb, userDb, { action: 'delete' });

  // Get all assets (with role-based filtering)
  router.get('/', authenticate, async (req, res) => {
    try {
      const user = await userDb.getById(req.user.id);
      const filteredAssets = await assetDb.getScopedForUser(user);
      res.json(filteredAssets);
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error fetching assets');
      res.status(500).json({ error: 'Failed to fetch assets' });
    }
  });

  // Search assets
  router.get('/search', authenticate, async (req, res) => {
    try {
      const filters = {
        employee_name: req.query.employee,
        manager_name: req.query.manager,
        company_name: req.query.company,
        status: req.query.status
      };

      const assets = await assetDb.search(filters);
      res.json(assets);
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error searching assets');
      res.status(500).json({ error: 'Failed to search assets' });
    }
  });

  // Get single asset by ID
  router.get('/:id', authenticate, fetchAsset, (req, res) => {
    res.json(req.asset);
  });

  // Bulk import assets via CSV
  router.post('/import', authenticate, authorize('admin', 'manager'), upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    try {
      const records = await parseCSVFile(req.file.path);
      const requiredFields = [
        'employee_first_name',
        'employee_last_name',
        'employee_email',
        'company_name',
        'asset_type',
        'serial_number',
        'asset_tag'
      ];
      const validAssetTypes = (await assetTypeDb.getActive()).map(t => t.name.toLowerCase());

      let imported = 0;
      const errors = [];

      for (let index = 0; index < records.length; index++) {
        const row = records[index];
        const normalizedRow = Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key.trim(), (value || '').trim()])
        );

        const missingFields = requiredFields.filter((field) => !normalizedRow[field]);
        if (missingFields.length > 0) {
          errors.push(`Row ${index + 2}: Missing required fields: ${missingFields.join(', ')}`);
          continue;
        }

        const status = normalizedRow.status ? normalizedRow.status.toLowerCase() : 'active';
        if (normalizedRow.status && !VALID_STATUSES.includes(status)) {
          errors.push(`Row ${index + 2}: Invalid status '${normalizedRow.status}'. Valid statuses: ${VALID_STATUSES.join(', ')}`);
          continue;
        }

        const asset_type = normalizedRow.asset_type ? normalizedRow.asset_type.toLowerCase() : '';
        if (!validAssetTypes.includes(asset_type)) {
          errors.push(`Row ${index + 2}: Invalid asset_type '${normalizedRow.asset_type}'. Valid types: ${validAssetTypes.join(', ')}`);
          continue;
        }

        const assetData = {
          employee_first_name: normalizedRow.employee_first_name,
          employee_last_name: normalizedRow.employee_last_name,
          employee_email: normalizedRow.employee_email,
          manager_first_name: normalizedRow.manager_first_name || '',
          manager_last_name: normalizedRow.manager_last_name || '',
          manager_email: normalizedRow.manager_email || '',
          company_name: normalizedRow.company_name,
          asset_type: asset_type,
          make: normalizedRow.make || '',
          model: normalizedRow.model || '',
          serial_number: normalizedRow.serial_number,
          asset_tag: normalizedRow.asset_tag,
          status: status,
          issued_date: normalizedRow.issued_date || null,
          returned_date: normalizedRow.returned_date || null,
          notes: normalizedRow.notes || ''
        };

        try {
          const result = await assetDb.create(assetData);
          const newAsset = await assetDb.getById(result.id);

          await auditDb.log(
            'CREATE',
            'asset',
            newAsset.id,
            `${assetData.serial_number} - ${assetData.employee_first_name} ${assetData.employee_last_name}`,
            { ...assetData, imported: true },
            req.user.email
          );

          imported += 1;
        } catch (error) {
          errors.push(`Row ${index + 2}: ${error.message}`);
        }
      }

      res.json({
        message: `Imported ${imported} assets${errors.length ? ` with ${errors.length} issues` : ''}`,
        imported,
        failed: errors.length,
        errors
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error importing assets');
      res.status(500).json({ error: 'Failed to import assets' });
    } finally {
      await unlink(req.file.path);
    }
  });

  // Create new asset
  router.post('/', authenticate, requireFields('employee_first_name', 'employee_last_name', 'employee_email', 'company_name', 'asset_type', 'serial_number', 'asset_tag'), async (req, res) => {
    try {
      const {
        employee_first_name,
        employee_last_name,
        employee_email,
        manager_first_name,
        manager_last_name,
        manager_email,
        company_name,
        asset_type,
        make,
        model,
        serial_number,
        asset_tag
      } = req.body;

      const validAssetTypes = (await assetTypeDb.getActive()).map(t => t.name.toLowerCase());
      if (!validAssetTypes.includes(asset_type.toLowerCase())) {
        return res.status(400).json({
          error: `Invalid asset_type. Valid types: ${validAssetTypes.join(', ')}`
        });
      }

      const result = await assetDb.create(req.body);
      const newAsset = await assetDb.getById(result.id);

      const employee_name = `${employee_first_name} ${employee_last_name}`;
      await auditDb.log(
        'CREATE',
        'asset',
        newAsset.id,
        `${serial_number} - ${employee_name}`,
        {
          employee_first_name,
          employee_last_name,
          employee_email,
          manager_first_name,
          manager_last_name,
          manager_email,
          company_name,
          asset_type,
          make,
          model,
          serial_number,
          asset_tag
        },
        req.user.email
      );

      res.status(201).json({
        message: 'Asset registered successfully',
        asset: newAsset
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error creating asset');
      res.status(500).json({ error: 'Failed to register asset' });
    }
  });

  // Bulk status update
  router.patch('/bulk/status', authenticate, validateIdArray('ids'), requireFields('status'), validateStatus(), async (req, res) => {
    try {
      const { ids, status } = req.body;

      const user = await userDb.getById(req.user.id);
      const assets = await assetDb.getByIds(ids);
      const assetMap = new Map(assets.map(asset => [asset.id, asset]));

      const results = { updated: [], failed: [] };
      const allowedIds = [];

      for (const id of ids) {
        const asset = assetMap.get(id);
        if (!asset) {
          results.failed.push({ id, reason: 'Asset not found' });
          continue;
        }

        if (user.role !== 'admin' && asset.employee_email !== user.email) {
          results.failed.push({ id, reason: 'Permission denied' });
          continue;
        }

        allowedIds.push(id);
      }

      if (allowedIds.length > 0) {
        await assetDb.bulkUpdateStatus(allowedIds, status);

        for (const id of allowedIds) {
          const asset = assetMap.get(id);
          await auditDb.log(
            'STATUS_CHANGE',
            'asset',
            id,
            `${asset.serial_number} - ${asset.employee_first_name} ${asset.employee_last_name}`,
            {
              old_status: asset.status,
              new_status: status,
              asset_type: asset.asset_type,
              employee_email: asset.employee_email,
              bulk_operation: true
            },
            req.user.email
          );
          results.updated.push(id);
        }
      }

      res.json({
        message: `Updated ${results.updated.length} assets`,
        updated: results.updated,
        failed: results.failed
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error bulk updating status');
      res.status(500).json({ error: 'Failed to update assets' });
    }
  });

  // Bulk delete
  router.delete('/bulk/delete', authenticate, authorize('admin'), validateIdArray('ids'), async (req, res) => {
    try {
      const { ids } = req.body;

      const assets = await assetDb.getByIds(ids);
      const assetMap = new Map(assets.map(asset => [asset.id, asset]));

      const results = { deleted: [], failed: [] };

      for (const id of ids) {
        const asset = assetMap.get(id);
        if (!asset) {
          results.failed.push({ id, reason: 'Asset not found' });
          continue;
        }

        try {
          await assetDb.delete(id);
          await auditDb.log(
            'DELETE',
            'asset',
            id,
            `${asset.serial_number} - ${asset.employee_first_name} ${asset.employee_last_name}`,
            {
              asset_type: asset.asset_type,
              employee_email: asset.employee_email,
              bulk_operation: true
            },
            req.user.email
          );
          results.deleted.push(id);
        } catch (error) {
          results.failed.push({ id, reason: error.message });
        }
      }

      res.json({
        message: `Deleted ${results.deleted.length} assets`,
        deleted: results.deleted,
        failed: results.failed
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error bulk deleting assets');
      res.status(500).json({ error: 'Failed to delete assets' });
    }
  });

  // Bulk manager update
  router.patch('/bulk/manager', authenticate, authorize('admin'), validateIdArray('ids'), requireFields('manager_first_name', 'manager_last_name', 'manager_email'), async (req, res) => {
    try {
      const { ids, manager_first_name, manager_last_name, manager_email } = req.body;

      const assets = await assetDb.getByIds(ids);
      const assetMap = new Map(assets.map(asset => [asset.id, asset]));

      const results = { updated: [], failed: [] };

      for (const id of ids) {
        const asset = assetMap.get(id);
        if (!asset) {
          results.failed.push({ id, reason: 'Asset not found' });
          continue;
        }

        try {
          await assetDb.update(id, { manager_first_name, manager_last_name, manager_email });
          await auditDb.log(
            'UPDATE',
            'asset',
            id,
            `${asset.serial_number} - ${asset.employee_first_name} ${asset.employee_last_name}`,
            {
              old_manager: `${asset.manager_first_name} ${asset.manager_last_name}`,
              new_manager: `${manager_first_name} ${manager_last_name}`,
              manager_email,
              bulk_operation: true
            },
            req.user.email
          );
          results.updated.push(id);
        } catch (error) {
          results.failed.push({ id, reason: error.message });
        }
      }

      res.json({
        message: `Updated manager for ${results.updated.length} assets`,
        updated: results.updated,
        failed: results.failed
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error bulk updating manager');
      res.status(500).json({ error: 'Failed to update assets' });
    }
  });

  // Update asset status
  router.patch('/:id/status', authenticate, fetchAsset, requireFields('status'), validateStatus(), async (req, res) => {
    try {
      const { status, notes } = req.body;
      const asset = req.asset;

      const oldStatus = asset.status;
      await assetDb.updateStatus(req.params.id, status, notes);
      const updatedAsset = await assetDb.getById(req.params.id);

      const employeeName = `${asset.employee_first_name} ${asset.employee_last_name}`;
      await auditDb.log(
        'STATUS_CHANGE',
        'asset',
        asset.id,
        `${asset.serial_number} - ${employeeName}`,
        {
          old_status: oldStatus,
          new_status: status,
          notes,
          asset_type: asset.asset_type,
          employee_email: asset.employee_email
        },
        req.user.email
      );

      res.json({
        message: 'Status updated successfully',
        asset: updatedAsset
      });
    } catch (error) {
      logger.error({ err: error, assetId: req.params.id, userId: req.user?.id }, 'Error updating status');
      res.status(500).json({ error: 'Failed to update status' });
    }
  });

  // Update asset
  router.put('/:id', authenticate, requireEditPermission, requireFields('employee_first_name', 'employee_last_name', 'employee_email', 'company_name', 'asset_type', 'serial_number', 'asset_tag'), async (req, res) => {
    try {
      const asset = req.asset;
      const {
        employee_first_name,
        employee_last_name,
        asset_type,
        serial_number
      } = req.body;

      const validAssetTypes = (await assetTypeDb.getActive()).map(t => t.name.toLowerCase());
      if (!validAssetTypes.includes(asset_type.toLowerCase())) {
        return res.status(400).json({
          error: `Invalid asset_type. Valid types: ${validAssetTypes.join(', ')}`
        });
      }

      await assetDb.update(req.params.id, req.body);
      const updatedAsset = await assetDb.getById(req.params.id);

      await auditDb.log(
        'UPDATE',
        'asset',
        asset.id,
        `${serial_number} - ${employee_first_name} ${employee_last_name}`,
        {
          changes: req.body,
          asset_type: updatedAsset.asset_type,
          employee_email: updatedAsset.employee_email
        },
        req.user.email
      );

      res.json({
        message: 'Asset updated successfully',
        asset: updatedAsset
      });
    } catch (error) {
      logger.error({ err: error, assetId: req.params.id, userId: req.user?.id }, 'Error updating asset');
      res.status(500).json({ error: 'Failed to update asset' });
    }
  });

  // Delete asset
  router.delete('/:id', authenticate, requireDeletePermission, async (req, res) => {
    try {
      const asset = req.asset;

      await assetDb.delete(req.params.id);

      await auditDb.log(
        'DELETE',
        'asset',
        asset.id,
        `${asset.serial_number} - ${asset.employee_first_name} ${asset.employee_last_name}`,
        {
          asset_type: asset.asset_type,
          employee_email: asset.employee_email
        },
        req.user.email
      );

      res.json({ message: 'Asset deleted successfully' });
    } catch (error) {
      logger.error({ err: error, assetId: req.params.id, userId: req.user?.id }, 'Error deleting asset');
      res.status(500).json({ error: 'Failed to delete asset' });
    }
  });

  return router;
}
