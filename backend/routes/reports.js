/**
 * Reports Routes
 * Handles: summary, enhanced summary, statistics, compliance, trends
 */

import { Router } from 'express';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger({ module: 'reports' });

/**
 * Create and configure the reports router
 * @param {Object} deps - Dependencies
 */
export default function createReportsRouter(deps) {
  const router = Router();

  const {
    userDb,
    assetDb,
    auditDb,
    assetTypeDb,
    attestationCampaignDb,
    attestationRecordDb,
    authenticate,
    authorize,
  } = deps;

  // Asset summary report (with role-based filtering)
  router.get('/summary', authenticate, async (req, res) => {
    try {
      const user = await userDb.getById(req.user.id);
      const allAssets = await assetDb.getAll();

      // Filter assets based on role
      let assets;
      if (user.role === 'admin' || user.role === 'manager' || user.role === 'attestation_coordinator') {
        // Admin, Manager, and Attestation Coordinator see all assets
        assets = allAssets;
      } else {
        // Employee sees only own assets
        assets = allAssets.filter(asset =>
          asset.employee_email === user.email
        );
      }

      const summary = {
        total: assets.length,
        by_status: {},
        by_company: {},
        by_manager: {},
        by_type: {}
      };

      // Get asset type display names
      const assetTypes = await assetTypeDb.getAll();
      const typeDisplayMap = {};
      assetTypes.forEach(type => {
        typeDisplayMap[type.name] = type.display_name;
      });

      assets.forEach(asset => {
        // Status breakdown
        summary.by_status[asset.status] = (summary.by_status[asset.status] || 0) + 1;

        // Company breakdown
        summary.by_company[asset.company_name] = (summary.by_company[asset.company_name] || 0) + 1;

        // Manager breakdown
        const managerFullName = asset.manager_first_name && asset.manager_last_name
          ? `${asset.manager_first_name} ${asset.manager_last_name}`
          : 'No Manager';
        summary.by_manager[managerFullName] = (summary.by_manager[managerFullName] || 0) + 1;

        // Type breakdown
        const typeName = asset.asset_type || 'other';
        const displayName = typeDisplayMap[typeName] || typeName;
        summary.by_type[displayName] = (summary.by_type[displayName] || 0) + 1;
      });

      res.json(summary);
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error generating summary report');
      res.status(500).json({ error: 'Failed to generate summary report' });
    }
  });

  // Enhanced summary report with trends and comparisons
  router.get('/summary-enhanced', authenticate, async (req, res) => {
    try {
      const user = await userDb.getById(req.user.id);
      const allAssets = await assetDb.getAll();

      // Filter assets based on role
      let assets;
      if (user.role === 'admin' || user.role === 'manager' || user.role === 'attestation_coordinator') {
        assets = allAssets;
      } else {
        assets = allAssets.filter(asset => asset.employee_email === user.email);
      }

      // Calculate current period stats
      const now = new Date();
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

      const currentAssets = assets.filter(a => a.registration_date && new Date(a.registration_date) <= now);
      const previousAssets = assets.filter(a => a.registration_date && new Date(a.registration_date) <= thirtyDaysAgo);

      const totalChange = currentAssets.length - previousAssets.length;

      // Status breakdown
      const byStatus = { active: 0, returned: 0, lost: 0, damaged: 0, retired: 0 };
      currentAssets.forEach(asset => {
        if (Object.prototype.hasOwnProperty.call(byStatus, asset.status)) {
          byStatus[asset.status]++;
        }
      });

      // Company breakdown (top 10)
      const companyMap = {};
      currentAssets.forEach(asset => {
        const company = asset.company_name || 'Unknown';
        companyMap[company] = (companyMap[company] || 0) + 1;
      });
      const byCompany = Object.entries(companyMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Manager breakdown
      const managerMap = {};
      currentAssets.forEach(asset => {
        const name = asset.manager_first_name && asset.manager_last_name
          ? `${asset.manager_first_name} ${asset.manager_last_name}`
          : 'No Manager';
        const email = asset.manager_email || 'N/A';
        const key = `${name}|${email}`;
        managerMap[key] = (managerMap[key] || 0) + 1;
      });
      const byManager = Object.entries(managerMap)
        .map(([key, count]) => {
          const [name, email] = key.split('|');
          return { name, email, count };
        })
        .sort((a, b) => b.count - a.count);

      // Type breakdown - use display names from asset_types table
      const assetTypes = await assetTypeDb.getAll();
      const typeDisplayMap = {};
      assetTypes.forEach(type => {
        typeDisplayMap[type.name] = type.display_name;
      });

      const typeMap = {};
      currentAssets.forEach(asset => {
        const typeName = asset.asset_type || 'other';
        const displayName = typeDisplayMap[typeName] || typeName;
        typeMap[displayName] = (typeMap[displayName] || 0) + 1;
      });

      // Calculate compliance score (simplified)
      const activeAssets = currentAssets.filter(a => a.status === 'active');
      const assetsWithManagers = activeAssets.filter(a => a.manager_email).length;
      const complianceScore = activeAssets.length > 0
        ? Math.round((assetsWithManagers / activeAssets.length) * 100)
        : 100;

      res.json({
        total: currentAssets.length,
        totalChange,
        byStatus,
        byCompany,
        byManager,
        byType: typeMap,
        complianceScore
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error generating enhanced summary');
      res.status(500).json({ error: 'Failed to generate enhanced summary' });
    }
  });

  // Enhanced statistics with time series data
  router.get('/statistics-enhanced', authenticate, authorize('admin', 'manager', 'attestation_coordinator'), async (req, res) => {
    try {
      const period = parseInt(req.query.period) || 30;
      const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

      // Get audit logs for the period
      const logs = await auditDb.getAll();
      const filteredLogs = logs.filter(log => new Date(log.timestamp) >= startDate);

      // Activity by day
      const activityByDay = {};
      filteredLogs.forEach(log => {
        const date = new Date(log.timestamp).toISOString().split('T')[0];
        if (!activityByDay[date]) {
          activityByDay[date] = { date, CREATE: 0, UPDATE: 0, STATUS_CHANGE: 0, DELETE: 0 };
        }
        const action = log.action || 'UPDATE';
        if (Object.prototype.hasOwnProperty.call(activityByDay[date], action)) {
          activityByDay[date][action]++;
        }
      });

      const activityArray = Object.values(activityByDay).sort((a, b) =>
        new Date(a.date) - new Date(b.date)
      );

      // Action breakdown
      const actionBreakdown = {};
      filteredLogs.forEach(log => {
        const action = log.action || 'UPDATE';
        actionBreakdown[action] = (actionBreakdown[action] || 0) + 1;
      });
      const actionBreakdownArray = Object.entries(actionBreakdown)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count);

      // Top users
      const userActivity = {};
      filteredLogs.forEach(log => {
        const email = log.user_email || 'System';
        userActivity[email] = (userActivity[email] || 0) + 1;
      });
      const topUsers = Object.entries(userActivity)
        .map(([email, count]) => ({ email, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Recent activity (last 20)
      const recentActivity = filteredLogs
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 20)
        .map(log => ({
          timestamp: log.timestamp,
          action: log.action,
          entity_type: log.entity_type,
          entity_name: log.entity_name,
          user_email: log.user_email
        }));

      res.json({
        activityByDay: activityArray,
        actionBreakdown: actionBreakdownArray,
        topUsers,
        recentActivity
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error generating enhanced statistics');
      res.status(500).json({ error: 'Failed to generate enhanced statistics' });
    }
  });

  // Compliance metrics
  router.get('/compliance', authenticate, authorize('admin', 'manager', 'attestation_coordinator'), async (req, res) => {
    try {
      const user = await userDb.getById(req.user.id);
      const allAssets = await assetDb.getAll();

      // Filter assets based on role
      let assets;
      if (user.role === 'admin' || user.role === 'manager' || user.role === 'attestation_coordinator') {
        assets = allAssets;
      } else {
        assets = allAssets.filter(asset => asset.employee_email === user.email);
      }

      // Calculate at-risk assets (lost + damaged)
      const atRiskAssets = assets.filter(a => a.status === 'lost' || a.status === 'damaged').length;

      // Get attestation campaigns
      const campaigns = await attestationCampaignDb.getAll();
      const activeCampaigns = campaigns.filter(c => c.status === 'active');

      // Calculate campaign progress
      const campaignProgress = [];
      for (const campaign of activeCampaigns.slice(0, 5)) {
        try {
          const records = await attestationRecordDb.getByCampaignId(campaign.id);
          const completed = records.filter(r => r.status === 'completed').length;
          const total = records.length;
          campaignProgress.push({
            name: campaign.name,
            progress: total > 0 ? Math.round((completed / total) * 100) : 0,
            completed,
            total
          });
        } catch (err) {
          logger.error({ err, userId: req.user?.id, campaignId: campaign.id }, 'Error getting records for campaign');
        }
      }

      // Overdue attestations (estimate based on active campaigns)
      let overdueAttestations = 0;
      for (const campaign of activeCampaigns) {
        try {
          const records = await attestationRecordDb.getByCampaignId(campaign.id);
          const now = new Date();
          const overdue = records.filter(r => {
            if (r.status !== 'pending') return false;
            if (!campaign.end_date) return false;
            return new Date(campaign.end_date) < now;
          }).length;
          overdueAttestations += overdue;
        } catch (err) {
          logger.error({ err, userId: req.user?.id, campaignId: campaign.id }, 'Error calculating overdue for campaign');
        }
      }

      // Attested this quarter
      const quarterStart = new Date();
      quarterStart.setMonth(Math.floor(quarterStart.getMonth() / 3) * 3, 1);
      quarterStart.setHours(0, 0, 0, 0);

      let attestedThisQuarter = 0;
      for (const campaign of campaigns) {
        if (new Date(campaign.start_date) >= quarterStart) {
          try {
            const records = await attestationRecordDb.getByCampaignId(campaign.id);
            attestedThisQuarter += records.filter(r => r.status === 'completed').length;
          } catch (err) {
            logger.error({ err, userId: req.user?.id, campaignId: campaign.id }, 'Error counting quarterly attestations for campaign');
          }
        }
      }

      // Risk indicators
      const riskIndicators = [];
      const lostCount = assets.filter(a => a.status === 'lost').length;
      const damagedCount = assets.filter(a => a.status === 'damaged').length;

      if (lostCount > 0) {
        riskIndicators.push({ type: 'Lost Assets', count: lostCount, severity: 'high', description: 'Assets marked as lost' });
      }
      if (damagedCount > 0) {
        riskIndicators.push({ type: 'Damaged Assets', count: damagedCount, severity: 'medium', description: 'Assets marked as damaged' });
      }
      if (overdueAttestations > 0) {
        riskIndicators.push({ type: 'Overdue Attestations', count: overdueAttestations, severity: 'medium', description: 'Past due date' });
      }

      // Compliance checklist
      const activeAssets = assets.filter(a => a.status === 'active');
      const assetsWithOwners = activeAssets.filter(a => a.employee_email).length;
      const assetsWithManagers = activeAssets.filter(a => a.manager_email).length;
      const assetsWithCompanies = activeAssets.filter(a => a.company_name).length;

      const checklist = [
        {
          item: 'All active assets have owners',
          status: assetsWithOwners === activeAssets.length ? 'pass' : 'fail',
          description: `${assetsWithOwners}/${activeAssets.length} assets have assigned owners`
        },
        {
          item: 'All active assets have managers',
          status: assetsWithManagers === activeAssets.length ? 'pass' : 'warn',
          description: `${assetsWithManagers}/${activeAssets.length} assets have assigned managers`
        },
        {
          item: 'All active assets assigned to companies',
          status: assetsWithCompanies === activeAssets.length ? 'pass' : 'warn',
          description: `${assetsWithCompanies}/${activeAssets.length} assets assigned to companies`
        },
        {
          item: 'Active attestation campaigns',
          status: activeCampaigns.length > 0 ? 'pass' : 'warn',
          description: `${activeCampaigns.length} active campaigns running`
        },
        {
          item: 'No overdue attestations',
          status: overdueAttestations === 0 ? 'pass' : 'fail',
          description: `${overdueAttestations} attestations overdue`
        },
        {
          item: 'No at-risk assets',
          status: atRiskAssets === 0 ? 'pass' : (atRiskAssets < 5 ? 'warn' : 'fail'),
          description: `${atRiskAssets} assets at risk`
        }
      ];

      // Calculate overall compliance score
      const passCount = checklist.filter(c => c.status === 'pass').length;
      const score = Math.round((passCount / checklist.length) * 100);

      res.json({
        score,
        overdueAttestations,
        atRiskAssets,
        attestedThisQuarter,
        campaigns: campaignProgress,
        riskIndicators,
        checklist
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error generating compliance report');
      res.status(500).json({ error: 'Failed to generate compliance report' });
    }
  });

  // Trend data with period comparison
  router.get('/trends', authenticate, authorize('admin', 'manager', 'attestation_coordinator'), async (req, res) => {
    try {
      const user = await userDb.getById(req.user.id);
      const period = parseInt(req.query.period) || 30;

      const allAssets = await assetDb.getAll();

      // Filter assets based on role
      let assets;
      if (user.role === 'admin' || user.role === 'manager' || user.role === 'attestation_coordinator') {
        assets = allAssets;
      } else {
        assets = allAssets.filter(asset => asset.employee_email === user.email);
      }

      // Asset growth over time - optimized approach
      const now = new Date();
      const startDate = new Date(now - period * 24 * 60 * 60 * 1000);

      // Sort assets by creation date once
      const sortedAssets = [...assets].sort((a, b) =>
        new Date(a.registration_date) - new Date(b.registration_date)
      );

      const sampleInterval = Math.max(1, Math.floor(period / 30));
      const assetGrowth = [];

      let assetIndex = 0;
      for (let i = 0; i <= period; i++) {
        if (i % sampleInterval !== 0 && i !== period) continue;

        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        // Count assets up to this date using sorted array
        while (assetIndex < sortedAssets.length &&
               new Date(sortedAssets[assetIndex].registration_date) <= date) {
          assetIndex++;
        }

        assetGrowth.push({ date: dateStr, count: assetIndex });
      }

      // Status changes over time - optimized
      const statusChanges = [];
      for (let i = 0; i <= period; i += sampleInterval) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        const statusCount = { date: dateStr, active: 0, returned: 0, lost: 0, damaged: 0, retired: 0 };

        // Count only assets created before or on this date
        for (const asset of assets) {
          if (new Date(asset.registration_date) <= date) {
            if (Object.prototype.hasOwnProperty.call(statusCount, asset.status)) {
              statusCount[asset.status]++;
            }
          }
        }

        statusChanges.push(statusCount);
      }

      // Current vs previous period metrics
      const currentPeriodStart = new Date(now - period * 24 * 60 * 60 * 1000);
      const previousPeriodStart = new Date(now - 2 * period * 24 * 60 * 60 * 1000);
      const previousPeriodEnd = currentPeriodStart;

      const currentAssets = assets.filter(a => {
        const registrationDate = new Date(a.registration_date);
        return registrationDate >= currentPeriodStart && registrationDate <= now;
      });

      const previousAssets = assets.filter(a => {
        const registrationDate = new Date(a.registration_date);
        return registrationDate >= previousPeriodStart && registrationDate < previousPeriodEnd;
      });

      const allCurrentAssets = assets.filter(a => new Date(a.registration_date) <= now);
      const allPreviousAssets = assets.filter(a => new Date(a.registration_date) < previousPeriodEnd);

      const currentActiveCount = allCurrentAssets.filter(a => a.status === 'active').length;
      const previousActiveCount = allPreviousAssets.filter(a => a.status === 'active').length;

      const current = {
        totalAssets: allCurrentAssets.length,
        activeRate: allCurrentAssets.length > 0 ? currentActiveCount / allCurrentAssets.length : 0,
        newAssets: currentAssets.length
      };

      const previous = {
        totalAssets: allPreviousAssets.length,
        activeRate: allPreviousAssets.length > 0 ? previousActiveCount / allPreviousAssets.length : 0,
        newAssets: previousAssets.length
      };

      const changes = {
        totalAssets: current.totalAssets - previous.totalAssets,
        activeRate: current.activeRate - previous.activeRate,
        newAssets: current.newAssets - previous.newAssets
      };

      res.json({
        assetGrowth,
        statusChanges,
        metricsComparison: {
          current,
          previous,
          changes
        }
      });
    } catch (error) {
      logger.error({ err: error, userId: req.user?.id }, 'Error generating trends report');
      res.status(500).json({ error: 'Failed to generate trends report' });
    }
  });

  return router;
}
