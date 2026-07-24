/**
 * Enterprise Platform Administration - Controller Contracts
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Clean Architecture & Express Controller Interfaces
 */

import { Response, NextFunction } from "express";
import { AdminAuthenticatedRequest } from "../middleware/adminAuthMiddleware";

export interface IAdminTenantController {
  listTenants(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  getTenantDetails(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  updateTenantStatus(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  updateTenantPlan(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  softDeleteTenant(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  getResourceUsage(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  getTenantAuditHistory(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

export interface IAdminTelemetryController {
  getOverviewMetrics(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  getMetricsHistory(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

export interface IAdminGovernanceController {
  getAuditLogs(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  getPlatformConfig(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  updatePlatformConfig(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

export interface IAdminDashboardController {
  getDashboardOverview(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

export interface IAdminMonitoringController {
  getDiagnostics(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  listIncidents(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  getIncidentDetails(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  createIncident(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  updateIncident(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  listAlerts(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  acknowledgeAlert(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  listMaintenanceWindows(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  scheduleMaintenanceWindow(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  updateMaintenanceStatus(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

export interface IAdminSecurityController {
  listActiveSessions(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  revokeSession(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  revokeAllUserSessions(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  listLoginHistory(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  getFailedLoginAnalytics(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  listSuspiciousActivities(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  updateSuspiciousActivity(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  listDeviceInventory(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  updateDeviceStatus(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  listRoleAssignments(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  updateRoleAssignment(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  getPermissionAuditSummary(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  listApiKeys(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  createApiKey(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  revokeApiKey(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  listSecretRotationStatus(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  triggerSecretRotation(req: AdminAuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}


