/**
 * Audit & Reporting Routes
 * Handles: audit logs, entity history, stats, exports
 */

import { Router } from 'express';

/**
 * Create and configure the audit router
 * @param {Object} deps - Dependencies
 */
export default function createAuditRouter(deps) {
  const router = Router();

  const {
    auditDb,
    userDb,
    authenticate,
    authorize,
  } = deps;

  // Get all audit logs (with role-based filtering)
  router.get('/logs', authenticate, authorize('admin', 'manager', 'attestation_coordinator'), async (req, res) => {
    try {
      const user = await userDb.getById(req.user.id);

      const options = {
        entityType: req.query.entityType,
        entityId: req.query.entityId,
        action: req.query.action,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        userEmail: req.query.userEmail,
        limit: req.query.limit ? parseInt(req.query.limit) : undefined
      };

      let logs = await auditDb.getAll(options);

      // Role-based filtering
      if (user.role === 'employee') {
        logs = logs.filter(log => log.user_email === user.email);
      }

      res.json(logs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  });

  // Get audit logs for specific entity
  router.get('/entity/:type/:id', async (req, res) => {
    try {
      const logs = await auditDb.getByEntity(req.params.type, req.params.id);
      res.json(logs);
    } catch (error) {
      console.error('Error fetching entity audit logs:', error);
      res.status(500).json({ error: 'Failed to fetch entity audit logs' });
    }
  });

  // Get recent audit logs
  router.get('/recent', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 100;
      const logs = await auditDb.getRecent(limit);
      res.json(logs);
    } catch (error) {
      console.error('Error fetching recent audit logs:', error);
      res.status(500).json({ error: 'Failed to fetch recent audit logs' });
    }
  });

  // Get audit statistics
  router.get('/stats', async (req, res) => {
    try {
      const stats = await auditDb.getStats(req.query.startDate, req.query.endDate);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching audit stats:', error);
      res.status(500).json({ error: 'Failed to fetch audit stats' });
    }
  });

  // Export audit logs as CSV
  router.get('/export', authenticate, authorize('admin', 'manager', 'attestation_coordinator'), async (req, res) => {
    try {
      const user = await userDb.getById(req.user.id);

      const options = {
        entityType: req.query.entityType,
        action: req.query.action,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        userEmail: req.query.userEmail
      };

      let logs = await auditDb.getAll(options);

      // Role-based filtering
      if (user.role === 'employee') {
        logs = logs.filter(log => log.user_email === user.email);
      }

      // Generate CSV
      const headers = ['ID', 'Timestamp', 'Action', 'Entity Type', 'Entity Name', 'Details', 'User Email'];
      const csvRows = [headers.join(',')];

      logs.forEach(log => {
        const row = [
          log.id,
          log.timestamp,
          log.action,
          log.entity_type,
          `"${log.entity_name || ''}"`,
          `"${log.details || ''}"`,
          log.user_email || ''
        ];
        csvRows.push(row.join(','));
      });

      const csv = csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      res.status(500).json({ error: 'Failed to export audit logs' });
    }
  });

  return router;
}
