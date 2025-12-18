/**
 * Routes Index
 * Centralizes route mounting and dependency injection
 */

import createCompaniesRouter from './companies.js';
import createAuditRouter from './audit.js';

/**
 * Mount all route modules on the Express app
 * @param {Object} app - Express application
 * @param {Object} deps - Shared dependencies
 */
export function mountRoutes(app, deps) {
  // Companies routes
  const companiesRouter = createCompaniesRouter({
    companyDb: deps.companyDb,
    auditDb: deps.auditDb,
    authenticate: deps.authenticate,
    authorize: deps.authorize,
    upload: deps.upload,
    parseCSVFile: deps.parseCSVFile,
  });
  app.use('/api/companies', companiesRouter);

  // Audit routes
  const auditRouter = createAuditRouter({
    auditDb: deps.auditDb,
    userDb: deps.userDb,
    authenticate: deps.authenticate,
    authorize: deps.authorize,
  });
  app.use('/api/audit', auditRouter);

  console.log('Mounted route modules: companies, audit');
}

export default mountRoutes;
