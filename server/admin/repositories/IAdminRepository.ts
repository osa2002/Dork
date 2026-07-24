/**
 * Enterprise Platform Administration - Repository Interfaces
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Clean Architecture & Repository Pattern
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
  AuditLogQueryDTO,
  AuditLogResponseDTO,
  OperationsDashboardQueryDTO,
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

export interface ITenantAdminRepository {
  findTenants(query: TenantListQueryDTO): Promise<TenantListResponseDTO>;
  getTenantById(shopId: string): Promise<ITenantOverviewEntity | null>;
  updateTenantStatus(
    shopId: string,
    status: "ACTIVE" | "SUSPENDED",
    reason: string,
    actorEmail: string
  ): Promise<ITenantOverviewEntity>;
  updateTenantPlan(
    shopId: string,
    planType: "free" | "pro" | "enterprise",
    customQuotaOverride: number | undefined,
    reason: string,
    actorEmail: string
  ): Promise<ITenantOverviewEntity>;
  softDeleteTenant(
    shopId: string,
    reason: string,
    actorEmail: string
  ): Promise<ITenantOverviewEntity>;
  getTenantResourceUsage(shopId: string): Promise<ITenantResourceUsageEntity | null>;
  getTenantAuditHistory(
    shopId: string,
    page?: number,
    limit?: number
  ): Promise<AuditLogResponseDTO>;
}

export interface IPlatformMetricsRepository {
  getLatestSystemSnapshot(): Promise<IPlatformMetricSnapshotEntity>;
  getHistoricalMetricSnapshots(
    timeframe: "1h" | "24h" | "7d" | "30d"
  ): Promise<IPlatformMetricSnapshotEntity[]>;
}

export interface ISystemAuditAdminRepository {
  queryAuditLogs(query: AuditLogQueryDTO): Promise<AuditLogResponseDTO>;
  recordAdminAudit(record: Omit<ISystemAuditRecordEntity, "auditId" | "timestamp">): Promise<void>;
}

export interface IPlatformConfigRepository {
  getPlatformConfig(): Promise<IPlatformConfigEntity>;
  updatePlatformConfig(
    partialConfig: Partial<IPlatformConfigEntity>,
    actorEmail: string
  ): Promise<IPlatformConfigEntity>;
}

export interface IDashboardRepository {
  getAggregatedDashboardMetrics(
    timeframe?: "1h" | "24h" | "7d" | "30d"
  ): Promise<IOperationsDashboardEntity>;
}

export interface IMonitoringAdminRepository {
  getSystemDiagnostics(): Promise<ISystemDiagnosticsEntity>;
  findIncidents(query: IncidentQueryDTO): Promise<IncidentListResponseDTO>;
  getIncidentById(incidentId: string): Promise<IPlatformIncidentEntity | null>;
  createIncident(dto: CreateIncidentDTO, actorEmail: string): Promise<IPlatformIncidentEntity>;
  updateIncident(incidentId: string, dto: UpdateIncidentDTO, actorEmail: string): Promise<IPlatformIncidentEntity>;
  findAlerts(query: AlertQueryDTO): Promise<AlertListResponseDTO>;
  acknowledgeAlert(alertId: string, actorEmail: string): Promise<ISystemAlertEntity>;
  listMaintenanceWindows(): Promise<IMaintenanceWindowEntity[]>;
  createMaintenanceWindow(dto: CreateMaintenanceWindowDTO, actorEmail: string): Promise<IMaintenanceWindowEntity>;
  updateMaintenanceStatus(maintenanceId: string, status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED", actorEmail: string): Promise<IMaintenanceWindowEntity>;
}

export interface ISecurityAdminRepository {
  findActiveSessions(query: SessionQueryDTO): Promise<SessionListResponseDTO>;
  revokeSession(sessionId: string, actorEmail: string): Promise<IUserSessionEntity>;
  revokeAllUserSessions(userEmail: string, actorEmail: string, reason?: string): Promise<number>;
  findLoginHistory(query: LoginHistoryQueryDTO): Promise<LoginHistoryResponseDTO>;
  getFailedLoginAnalytics(): Promise<IFAILEDLoginAnalyticsEntity>;
  findSuspiciousActivities(query: SuspiciousActivityQueryDTO): Promise<SuspiciousActivityResponseDTO>;
  updateSuspiciousActivity(activityId: string, dto: UpdateSuspiciousActivityDTO, actorEmail: string): Promise<ISuspiciousActivityEntity>;
  findDeviceInventory(query: DeviceInventoryQueryDTO): Promise<DeviceInventoryResponseDTO>;
  updateDeviceStatus(deviceId: string, dto: UpdateDeviceStatusDTO, actorEmail: string): Promise<IDeviceInventoryEntity>;
  listRoleAssignments(): Promise<IRoleAssignmentEntity[]>;
  updateRoleAssignment(adminId: string, dto: UpdateRoleAssignmentDTO, actorEmail: string): Promise<IRoleAssignmentEntity>;
  getPermissionAuditSummary(): Promise<IPermissionAuditSummaryEntity>;
  listApiKeys(): Promise<IApiKeyEntity[]>;
  createApiKey(dto: CreateApiKeyDTO, actorEmail: string): Promise<IApiKeyEntity>;
  revokeApiKey(keyId: string, actorEmail: string): Promise<IApiKeyEntity>;
  listSecretRotationStatus(): Promise<ISecretRotationTrackingEntity[]>;
  triggerSecretRotation(secretId: string, actorEmail: string): Promise<ISecretRotationTrackingEntity>;
}


