/**
 * Enterprise Platform Administration - API Routes Router
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Prefix: /api/v1/admin
 */

import { Router } from "express";
import { adminCorrelationMiddleware } from "../middleware/adminCorrelationMiddleware";
import { requireAdminPermission } from "../middleware/adminAuthMiddleware";
import { AdminPermission } from "../permissions/adminPermissions";
import { validateRequest } from "../../../src/middlewares/validationMiddleware";
import { AdminTenantController } from "../controllers/AdminTenantController";
import { AdminDashboardController } from "../controllers/AdminDashboardController";
import { AdminMonitoringController } from "../controllers/AdminMonitoringController";
import { AdminSecurityController } from "../controllers/AdminSecurityController";
import { SecurityAdminService } from "../services/SecurityAdminService";
import { SecurityAdminRepository } from "../repositories/SecurityAdminRepository";
import { AdminAuditLogger } from "../services/AdminAuditLogger";
import {
  adminTenantQuerySchema,
  updateTenantStatusSchema,
  updateTenantPlanSchema,
  softDeleteTenantSchema,
  tenantAuditHistoryQuerySchema,
  adminAuditLogQuerySchema,
  updatePlatformConfigSchema,
  operationsDashboardQuerySchema,
  incidentQuerySchema,
  createIncidentSchema,
  updateIncidentSchema,
  alertQuerySchema,
  createMaintenanceSchema,
  updateMaintenanceStatusSchema,
  sessionQuerySchema,
  revokeSessionSchema,
  revokeUserSessionsSchema,
  loginHistoryQuerySchema,
  suspiciousActivityQuerySchema,
  updateSuspiciousActivitySchema,
  deviceInventoryQuerySchema,
  updateDeviceStatusSchema,
  updateRoleAssignmentSchema,
  createApiKeySchema,
  revokeApiKeySchema,
  triggerSecretRotationSchema
} from "../validation/adminValidationSchemas";

export const adminRouter = Router();

// Instantiate Repositories & Services
const securityRepo = new SecurityAdminRepository();
const securityService = new SecurityAdminService(securityRepo);

// Instantiate Controllers
const tenantController = new AdminTenantController();
const dashboardController = new AdminDashboardController();
const monitoringController = new AdminMonitoringController();
const securityController = new AdminSecurityController(securityService);

// Apply Correlation ID & Context propagation to all admin endpoints
adminRouter.use(adminCorrelationMiddleware as any);

/**
 * Health & Capabilities Endpoint
 * GET /api/v1/admin/health
 */
adminRouter.get(
  "/health",
  requireAdminPermission(AdminPermission.METRICS_READ_SYSTEM),
  async (req, res) => {
    res.json({
      status: "HEALTHY",
      module: "Enterprise Platform Administration Core & Tenant Management",
      isolatedFromShopDashboard: true,
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * Tenant Management Module Endpoints
 */

// 1. List Tenants (Pagination, Search, Filtering by Plan/Status/Region/Date, Sorting)
adminRouter.get(
  "/tenants",
  requireAdminPermission(AdminPermission.TENANT_READ),
  validateRequest(adminTenantQuerySchema),
  tenantController.listTenants as any
);

// 2. Tenant Details
adminRouter.get(
  "/tenants/:shopId",
  requireAdminPermission(AdminPermission.TENANT_READ),
  tenantController.getTenantDetails as any
);

// 3. View Tenant Resource Usage
adminRouter.get(
  "/tenants/:shopId/usage",
  requireAdminPermission(AdminPermission.TENANT_READ),
  tenantController.getResourceUsage as any
);

// 4. View Tenant Audit History
adminRouter.get(
  "/tenants/:shopId/audit-history",
  requireAdminPermission(AdminPermission.AUDIT_READ),
  validateRequest(tenantAuditHistoryQuerySchema),
  tenantController.getTenantAuditHistory as any
);

// 5. Suspend or Reactivate Tenant (Mandatory Reason + Immutable Audit Log)
adminRouter.patch(
  "/tenants/:shopId/status",
  requireAdminPermission(AdminPermission.TENANT_SUSPEND),
  validateRequest(updateTenantStatusSchema),
  tenantController.updateTenantStatus as any
);

// 6. Change Subscription Plan (Mandatory Reason + Custom Quota Override + Audit Log)
adminRouter.patch(
  "/tenants/:shopId/plan",
  requireAdminPermission(AdminPermission.TENANT_MIGRATE_TIER),
  validateRequest(updateTenantPlanSchema),
  tenantController.updateTenantPlan as any
);

// 7. Soft Delete Tenant (Mandatory Justification + Immutable Audit Log)
adminRouter.delete(
  "/tenants/:shopId",
  requireAdminPermission(AdminPermission.TENANT_DELETE),
  validateRequest(softDeleteTenantSchema),
  tenantController.softDeleteTenant as any
);

/**
 * Telemetry, Operations & Dashboard Metrics Endpoints
 */
adminRouter.get(
  "/dashboard/overview",
  requireAdminPermission(AdminPermission.METRICS_READ_SYSTEM),
  validateRequest(operationsDashboardQuerySchema),
  dashboardController.getDashboardOverview as any
);

adminRouter.get(
  "/metrics/overview",
  requireAdminPermission(AdminPermission.METRICS_READ_SYSTEM),
  validateRequest(operationsDashboardQuerySchema),
  dashboardController.getDashboardOverview as any
);

/**
 * Enterprise Monitoring & Incident Center Endpoints
 */

// 1. Live Platform System Diagnostics (Cloud Run, Firestore latency, API latency, Service status)
adminRouter.get(
  "/monitoring/diagnostics",
  requireAdminPermission(AdminPermission.METRICS_READ_SYSTEM),
  monitoringController.getDiagnostics as any
);

// 2. Incident Management - List Incidents
adminRouter.get(
  "/monitoring/incidents",
  requireAdminPermission(AdminPermission.INCIDENT_READ),
  validateRequest(incidentQuerySchema),
  monitoringController.listIncidents as any
);

// 3. Incident Management - Incident Details & Timeline
adminRouter.get(
  "/monitoring/incidents/:incidentId",
  requireAdminPermission(AdminPermission.INCIDENT_READ),
  monitoringController.getIncidentDetails as any
);

// 4. Incident Management - Declare New Incident
adminRouter.post(
  "/monitoring/incidents",
  requireAdminPermission(AdminPermission.INCIDENT_MANAGE),
  validateRequest(createIncidentSchema),
  monitoringController.createIncident as any
);

// 5. Incident Management - Update Status, Root Cause, or Timeline
adminRouter.patch(
  "/monitoring/incidents/:incidentId",
  requireAdminPermission(AdminPermission.INCIDENT_MANAGE),
  validateRequest(updateIncidentSchema),
  monitoringController.updateIncident as any
);

// 6. System Alert Engine - List Alerts
adminRouter.get(
  "/monitoring/alerts",
  requireAdminPermission(AdminPermission.METRICS_READ_SYSTEM),
  validateRequest(alertQuerySchema),
  monitoringController.listAlerts as any
);

// 7. System Alert Engine - Acknowledge Alert
adminRouter.patch(
  "/monitoring/alerts/:alertId/acknowledge",
  requireAdminPermission(AdminPermission.INCIDENT_MANAGE),
  monitoringController.acknowledgeAlert as any
);

// 8. Maintenance Mode - List Scheduled Windows
adminRouter.get(
  "/monitoring/maintenance",
  requireAdminPermission(AdminPermission.METRICS_READ_SYSTEM),
  monitoringController.listMaintenanceWindows as any
);

// 9. Maintenance Mode - Schedule Maintenance Window
adminRouter.post(
  "/monitoring/maintenance",
  requireAdminPermission(AdminPermission.MAINTENANCE_MANAGE),
  validateRequest(createMaintenanceSchema),
  monitoringController.scheduleMaintenanceWindow as any
);

// 10. Maintenance Mode - Update Maintenance Status
adminRouter.patch(
  "/monitoring/maintenance/:maintenanceId/status",
  requireAdminPermission(AdminPermission.MAINTENANCE_MANAGE),
  validateRequest(updateMaintenanceStatusSchema),
  monitoringController.updateMaintenanceStatus as any
);


/**
 * Audit Logging & Governance Endpoints
 */
adminRouter.get(
  "/audit-logs",
  requireAdminPermission(AdminPermission.AUDIT_READ),
  validateRequest(adminAuditLogQuerySchema),
  async (req: any, res, next) => {
    try {
      const logs = await AdminAuditLogger.queryLogs({
        page: req.query.page ? parseInt(req.query.page, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
        actorEmail: req.query.actorEmail,
        action: req.query.action,
        severity: req.query.severity
      });
      res.json(logs);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Global Platform Configuration Endpoints
 */
adminRouter.get(
  "/config",
  requireAdminPermission(AdminPermission.CONFIG_READ),
  async (req, res, next) => {
    res.json({
      configVersion: 1,
      globalMaintenanceMode: false,
      updatedAt: new Date().toISOString()
    });
  }
);

adminRouter.put(
  "/config",
  requireAdminPermission(AdminPermission.CONFIG_WRITE),
  validateRequest(updatePlatformConfigSchema),
  async (req, res, next) => {
    res.json({
      configVersion: 2,
      updatedAt: new Date().toISOString()
    });
  }
);

/**
 * Enterprise Security Center Backend Endpoints
 */

// 1. Active Sessions - List active user sessions
adminRouter.get(
  "/security/sessions",
  requireAdminPermission(AdminPermission.SECURITY_READ),
  validateRequest(sessionQuerySchema),
  securityController.listActiveSessions as any
);

// 2. Session Revocation - Revoke specific session
adminRouter.delete(
  "/security/sessions/:sessionId",
  requireAdminPermission(AdminPermission.SECURITY_REVOKE_SESSIONS),
  validateRequest(revokeSessionSchema),
  securityController.revokeSession as any
);

// 3. Session Revocation - Bulk revoke all user sessions
adminRouter.post(
  "/security/sessions/revoke-user",
  requireAdminPermission(AdminPermission.SECURITY_REVOKE_SESSIONS),
  validateRequest(revokeUserSessionsSchema),
  securityController.revokeAllUserSessions as any
);

// 4. Login History - Query login events & audit records
adminRouter.get(
  "/security/logins/history",
  requireAdminPermission(AdminPermission.SECURITY_READ),
  validateRequest(loginHistoryQuerySchema),
  securityController.listLoginHistory as any
);

// 5. Failed Login Analytics - Failed attempt rates, targeted accounts, origin IPs
adminRouter.get(
  "/security/logins/failed-analytics",
  requireAdminPermission(AdminPermission.SECURITY_READ),
  securityController.getFailedLoginAnalytics as any
);

// 6. Suspicious Activity Detection - Query threat alerts & anomalies
adminRouter.get(
  "/security/suspicious-activities",
  requireAdminPermission(AdminPermission.SECURITY_READ),
  validateRequest(suspiciousActivityQuerySchema),
  securityController.listSuspiciousActivities as any
);

// 7. Suspicious Activity Detection - Update investigation status & mitigation
adminRouter.patch(
  "/security/suspicious-activities/:activityId",
  requireAdminPermission(AdminPermission.SECURITY_REVOKE_SESSIONS),
  validateRequest(updateSuspiciousActivitySchema),
  securityController.updateSuspiciousActivity as any
);

// 8. Device Inventory - Query admin devices
adminRouter.get(
  "/security/devices",
  requireAdminPermission(AdminPermission.SECURITY_READ),
  validateRequest(deviceInventoryQuerySchema),
  securityController.listDeviceInventory as any
);

// 9. Device Inventory - Approve, block, or mark device as trusted
adminRouter.patch(
  "/security/devices/:deviceId",
  requireAdminPermission(AdminPermission.SECURITY_REVOKE_SESSIONS),
  validateRequest(updateDeviceStatusSchema),
  securityController.updateDeviceStatus as any
);

// 10. Role Assignment - List admin roles & MFA enforcement
adminRouter.get(
  "/security/roles",
  requireAdminPermission(AdminPermission.SECURITY_READ),
  securityController.listRoleAssignments as any
);

// 11. Role Assignment - Reassign role or custom permissions
adminRouter.patch(
  "/security/roles/:adminId",
  requireAdminPermission(AdminPermission.SECURITY_MANAGE_ROLES),
  validateRequest(updateRoleAssignmentSchema),
  securityController.updateRoleAssignment as any
);

// 12. Permission Audit - Governance summary & MFA compliance
adminRouter.get(
  "/security/permissions/audit",
  requireAdminPermission(AdminPermission.SECURITY_READ),
  securityController.getPermissionAuditSummary as any
);

// 13. API Key Management - List API keys
adminRouter.get(
  "/security/api-keys",
  requireAdminPermission(AdminPermission.SECURITY_READ),
  securityController.listApiKeys as any
);

// 14. API Key Management - Create new API key
adminRouter.post(
  "/security/api-keys",
  requireAdminPermission(AdminPermission.SECURITY_MANAGE_KEYS),
  validateRequest(createApiKeySchema),
  securityController.createApiKey as any
);

// 15. API Key Management - Revoke API key
adminRouter.delete(
  "/security/api-keys/:keyId",
  requireAdminPermission(AdminPermission.SECURITY_MANAGE_KEYS),
  validateRequest(revokeApiKeySchema),
  securityController.revokeApiKey as any
);

// 16. Secret Rotation Tracking - List secret rotation statuses
adminRouter.get(
  "/security/secrets/rotation",
  requireAdminPermission(AdminPermission.SECURITY_READ),
  securityController.listSecretRotationStatus as any
);

// 17. Secret Rotation Tracking - Trigger manual secret rotation
adminRouter.post(
  "/security/secrets/:secretId/rotate",
  requireAdminPermission(AdminPermission.SECURITY_MANAGE_KEYS),
  validateRequest(triggerSecretRotationSchema),
  securityController.triggerSecretRotation as any
);

