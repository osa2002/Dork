/**
 * Enterprise Platform Administration - Data Transfer Objects (DTOs)
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import { AdminRole, AdminPermission } from "../permissions/adminPermissions";
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

export interface TenantListQueryDTO {
  page?: number;
  limit?: number;
  status?: "ACTIVE" | "SUSPENDED" | "DELETED" | "PROVISIONING";
  planType?: "free" | "pro" | "enterprise";
  region?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: "createdAt" | "dailyTicketCount" | "businessName" | "quotaUsagePercent";
  sortOrder?: "asc" | "desc";
}

export interface TenantListResponseDTO {
  tenants: ITenantOverviewEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpdateTenantStatusDTO {
  status: "ACTIVE" | "SUSPENDED";
  reason: string;
}

export interface UpdateTenantPlanDTO {
  planType: "free" | "pro" | "enterprise";
  customQuotaOverride?: number;
  reason: string;
}

export interface SoftDeleteTenantDTO {
  reason: string;
}

export interface TenantAuditHistoryQueryDTO {
  page?: number;
  limit?: number;
}

export interface AuditLogQueryDTO {
  page?: number;
  limit?: number;
  actorEmail?: string;
  targetResourceId?: string;
  action?: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  startDate?: string;
  endDate?: string;
}

export interface AuditLogResponseDTO {
  records: ISystemAuditRecordEntity[];
  total: number;
  page: number;
  limit: number;
}

export interface UpdatePlatformConfigDTO {
  globalMaintenanceMode?: boolean;
  maxTicketsPerTenantPerDay?: Record<string, number>;
  rateLimitingTierLimits?: Record<string, number>;
  enabledGlobalFeatureFlags?: Record<string, boolean>;
  reason: string;
}

export interface AdminUserResponseDTO {
  adminId: string;
  email: string;
  role: AdminRole;
  permissions: AdminPermission[];
  mfaVerified: boolean;
}

export interface OperationsDashboardQueryDTO {
  timeframe?: "1h" | "24h" | "7d" | "30d";
  bypassCache?: boolean;
}

export interface OperationsDashboardResponseDTO {
  data: IOperationsDashboardEntity;
  timeframe: "1h" | "24h" | "7d" | "30d";
  cached: boolean;
  generatedAt: string;
}

export interface IncidentQueryDTO {
  status?: string;
  severity?: string;
  service?: string;
  page?: number;
  limit?: number;
}

export interface IncidentListResponseDTO {
  incidents: IPlatformIncidentEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateIncidentDTO {
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  affectedService: string;
  affectedTenantsCount?: number;
  summary: string;
}

export interface UpdateIncidentDTO {
  status?: "INVESTIGATING" | "IDENTIFIED" | "MONITORING" | "RESOLVED";
  summary?: string;
  rootCause?: string;
  updateMessage?: string;
}

export interface AlertQueryDTO {
  status?: string;
  severity?: string;
  page?: number;
  limit?: number;
}

export interface AlertListResponseDTO {
  alerts: ISystemAlertEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateMaintenanceWindowDTO {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  affectedServices: string[];
}

export interface UpdateMaintenanceStatusDTO {
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
}

export interface SessionQueryDTO {
  status?: string;
  userEmail?: string;
  page?: number;
  limit?: number;
}

export interface SessionListResponseDTO {
  sessions: IUserSessionEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RevokeUserSessionsDTO {
  userEmail: string;
  reason?: string;
}

export interface LoginHistoryQueryDTO {
  userEmail?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface LoginHistoryResponseDTO {
  history: ILoginHistoryEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SuspiciousActivityQueryDTO {
  status?: string;
  severity?: string;
  page?: number;
  limit?: number;
}

export interface SuspiciousActivityResponseDTO {
  activities: ISuspiciousActivityEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpdateSuspiciousActivityDTO {
  status: "OPEN" | "INVESTIGATING" | "RESOLVED" | "DISMISSED";
  resolutionNotes?: string;
}

export interface DeviceInventoryQueryDTO {
  userEmail?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface DeviceInventoryResponseDTO {
  devices: IDeviceInventoryEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpdateDeviceStatusDTO {
  status: "APPROVED" | "PENDING" | "BLOCKED";
  isTrusted?: boolean;
}

export interface UpdateRoleAssignmentDTO {
  role: "SUPER_ADMIN" | "PLATFORM_OPERATOR" | "COMPLIANCE_OFFICER" | "SUPPORT_ENGINEER" | "FINANCE_AUDITOR";
  customPermissions?: string[];
  mfaEnforced?: boolean;
}

export interface CreateApiKeyDTO {
  name: string;
  scopes: string[];
  expiresInDays?: number;
}

export interface ApiKeyListResponseDTO {
  keys: IApiKeyEntity[];
  total: number;
}

export interface TriggerSecretRotationDTO {
  secretId: string;
}


