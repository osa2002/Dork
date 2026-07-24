/**
 * Enterprise Platform Administration - Service Contracts
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Clean Architecture & Service Abstractions
 */

import {
  ITenantOverviewEntity,
  ITenantResourceUsageEntity,
  IPlatformMetricSnapshotEntity,
  ISystemAuditRecordEntity,
  IPlatformConfigEntity,
  IOperationsDashboardEntity,
  ISystemDiagnosticsEntity,
  IPlatformIncidentEntity,
  ISystemAlertEntity,
  IMaintenanceWindowEntity,
  IUserSessionEntity,
  ILoginHistoryEntity,
  IFAILEDLoginAnalyticsEntity,
  ISuspiciousActivityEntity,
  IDeviceInventoryEntity,
  IRoleAssignmentEntity,
  IPermissionAuditSummaryEntity,
  IApiKeyEntity,
  ISecretRotationTrackingEntity
} from "../models/adminModels";
import {
  TenantListQueryDTO,
  TenantListResponseDTO,
  UpdateTenantStatusDTO,
  UpdateTenantPlanDTO,
  SoftDeleteTenantDTO,
  TenantAuditHistoryQueryDTO,
  AuditLogQueryDTO,
  AuditLogResponseDTO,
  UpdatePlatformConfigDTO,
  OperationsDashboardQueryDTO,
  OperationsDashboardResponseDTO,
  IncidentQueryDTO,
  IncidentListResponseDTO,
  CreateIncidentDTO,
  UpdateIncidentDTO,
  AlertQueryDTO,
  AlertListResponseDTO,
  CreateMaintenanceWindowDTO,
  UpdateMaintenanceStatusDTO,
  SessionQueryDTO,
  SessionListResponseDTO,
  RevokeUserSessionsDTO,
  LoginHistoryQueryDTO,
  LoginHistoryResponseDTO,
  SuspiciousActivityQueryDTO,
  SuspiciousActivityResponseDTO,
  UpdateSuspiciousActivityDTO,
  DeviceInventoryQueryDTO,
  DeviceInventoryResponseDTO,
  UpdateDeviceStatusDTO,
  UpdateRoleAssignmentDTO,
  CreateApiKeyDTO,
  ApiKeyListResponseDTO
} from "../dto/adminDTOs";
import { IAdminIdentity } from "../permissions/adminPermissions";

export interface ITenantManagementService {
  listTenants(query: TenantListQueryDTO, actor: IAdminIdentity): Promise<TenantListResponseDTO>;
  getTenantDetails(shopId: string, actor: IAdminIdentity): Promise<ITenantOverviewEntity>;
  changeTenantStatus(
    shopId: string,
    dto: UpdateTenantStatusDTO,
    actor: IAdminIdentity
  ): Promise<ITenantOverviewEntity>;
  changeTenantPlan(
    shopId: string,
    dto: UpdateTenantPlanDTO,
    actor: IAdminIdentity
  ): Promise<ITenantOverviewEntity>;
  softDeleteTenant(
    shopId: string,
    dto: SoftDeleteTenantDTO,
    actor: IAdminIdentity
  ): Promise<ITenantOverviewEntity>;
  getResourceUsage(
    shopId: string,
    actor: IAdminIdentity
  ): Promise<ITenantResourceUsageEntity>;
  getTenantAuditHistory(
    shopId: string,
    query: TenantAuditHistoryQueryDTO,
    actor: IAdminIdentity
  ): Promise<AuditLogResponseDTO>;
}

export interface IPlatformTelemetryService {
  getSystemOverviewMetrics(actor: IAdminIdentity): Promise<IPlatformMetricSnapshotEntity>;
  getMetricsHistory(
    timeframe: "1h" | "24h" | "7d" | "30d",
    actor: IAdminIdentity
  ): Promise<IPlatformMetricSnapshotEntity[]>;
}

export interface ISystemGovernanceService {
  getAuditLogs(query: AuditLogQueryDTO, actor: IAdminIdentity): Promise<AuditLogResponseDTO>;
  getPlatformConfiguration(actor: IAdminIdentity): Promise<IPlatformConfigEntity>;
  updatePlatformConfiguration(
    dto: UpdatePlatformConfigDTO,
    actor: IAdminIdentity
  ): Promise<IPlatformConfigEntity>;
}

export interface IAdminSecurityService {
  verifyAdminTokenAndPermissions(
    bearerToken: string,
    requiredPermission?: string
  ): Promise<IAdminIdentity>;
  revokeAdminSession(adminId: string, actor: IAdminIdentity): Promise<void>;
}

export interface IOperationsDashboardService {
  getOperationsDashboardMetrics(
    query: OperationsDashboardQueryDTO,
    actor: IAdminIdentity
  ): Promise<OperationsDashboardResponseDTO>;
}

export interface IMonitoringAdminService {
  getSystemDiagnostics(actor: IAdminIdentity): Promise<ISystemDiagnosticsEntity>;
  listIncidents(query: IncidentQueryDTO, actor: IAdminIdentity): Promise<IncidentListResponseDTO>;
  getIncidentDetails(incidentId: string, actor: IAdminIdentity): Promise<IPlatformIncidentEntity>;
  createIncident(dto: CreateIncidentDTO, actor: IAdminIdentity): Promise<IPlatformIncidentEntity>;
  updateIncident(
    incidentId: string,
    dto: UpdateIncidentDTO,
    actor: IAdminIdentity
  ): Promise<IPlatformIncidentEntity>;
  listAlerts(query: AlertQueryDTO, actor: IAdminIdentity): Promise<AlertListResponseDTO>;
  acknowledgeAlert(alertId: string, actor: IAdminIdentity): Promise<ISystemAlertEntity>;
  listMaintenanceWindows(actor: IAdminIdentity): Promise<IMaintenanceWindowEntity[]>;
  scheduleMaintenanceWindow(
    dto: CreateMaintenanceWindowDTO,
    actor: IAdminIdentity
  ): Promise<IMaintenanceWindowEntity>;
  updateMaintenanceStatus(
    maintenanceId: string,
    dto: UpdateMaintenanceStatusDTO,
    actor: IAdminIdentity
  ): Promise<IMaintenanceWindowEntity>;
}

export interface ISecurityAdminService {
  listActiveSessions(query: SessionQueryDTO, actor: IAdminIdentity): Promise<SessionListResponseDTO>;
  revokeSession(sessionId: string, actor: IAdminIdentity): Promise<IUserSessionEntity>;
  revokeAllUserSessions(dto: RevokeUserSessionsDTO, actor: IAdminIdentity): Promise<{ revokedCount: number }>;
  listLoginHistory(query: LoginHistoryQueryDTO, actor: IAdminIdentity): Promise<LoginHistoryResponseDTO>;
  getFailedLoginAnalytics(actor: IAdminIdentity): Promise<IFAILEDLoginAnalyticsEntity>;
  listSuspiciousActivities(query: SuspiciousActivityQueryDTO, actor: IAdminIdentity): Promise<SuspiciousActivityResponseDTO>;
  updateSuspiciousActivity(activityId: string, dto: UpdateSuspiciousActivityDTO, actor: IAdminIdentity): Promise<ISuspiciousActivityEntity>;
  listDeviceInventory(query: DeviceInventoryQueryDTO, actor: IAdminIdentity): Promise<DeviceInventoryResponseDTO>;
  updateDeviceStatus(deviceId: string, dto: UpdateDeviceStatusDTO, actor: IAdminIdentity): Promise<IDeviceInventoryEntity>;
  listRoleAssignments(actor: IAdminIdentity): Promise<IRoleAssignmentEntity[]>;
  updateRoleAssignment(adminId: string, dto: UpdateRoleAssignmentDTO, actor: IAdminIdentity): Promise<IRoleAssignmentEntity>;
  getPermissionAuditSummary(actor: IAdminIdentity): Promise<IPermissionAuditSummaryEntity>;
  listApiKeys(actor: IAdminIdentity): Promise<ApiKeyListResponseDTO>;
  createApiKey(dto: CreateApiKeyDTO, actor: IAdminIdentity): Promise<IApiKeyEntity>;
  revokeApiKey(keyId: string, actor: IAdminIdentity): Promise<IApiKeyEntity>;
  listSecretRotationStatus(actor: IAdminIdentity): Promise<ISecretRotationTrackingEntity[]>;
  triggerSecretRotation(secretId: string, actor: IAdminIdentity): Promise<ISecretRotationTrackingEntity>;
}


