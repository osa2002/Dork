/**
 * Enterprise Platform Administration - Frontend UI Types
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

export type AdminRoleType =
  | "SUPER_ADMIN"
  | "PLATFORM_OPERATOR"
  | "COMPLIANCE_OFFICER"
  | "SUPPORT_ENGINEER"
  | "FINANCE_AUDITOR";

export type AdminPermissionType =
  | "tenant:read"
  | "tenant:suspend"
  | "tenant:migrate_tier"
  | "tenant:delete"
  | "metrics:read_system"
  | "metrics:read_business"
  | "config:read"
  | "config:write"
  | "config:emergency_shutdown"
  | "audit:read"
  | "audit:export"
  | "security:read"
  | "security:revoke_sessions"
  | "security:manage_roles"
  | "security:manage_keys"
  | "incident:read"
  | "incident:manage"
  | "maintenance:manage";

export interface IAdminUserProfile {
  adminId: string;
  email: string;
  displayName: string;
  role: AdminRoleType;
  permissions: AdminPermissionType[];
  mfaActive: boolean;
  sessionExpiresAt: string;
}

export interface ITenantSummaryUI {
  shopId: string;
  businessName: string;
  category: string;
  planType: "free" | "pro" | "enterprise";
  status: "ACTIVE" | "SUSPENDED" | "DELETED" | "PROVISIONING";
  createdAt: string;
  dailyTicketCount: number;
  activeQueueLength: number;
  quotaUsagePercent: number;
  ownerEmail: string;
  region?: string;
}

export interface IPlatformHealthMetricsUI {
  timestamp: string;
  activeTenantsCount: number;
  totalQueuedCustomers: number;
  systemThroughputRps: number;
  errorRate5xx: number;
  latencyP95Ms: number;
  cloudRunInstanceCount: number;
  firestoreOpsPerSec?: number;
  uptimePercentage?: number;
}

export interface IAuditLogEntryUI {
  auditId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetResourceType: "TENANT" | "CONFIG" | "SECURITY" | "FEATURE_FLAG" | "MONITORING";
  targetResourceId: string;
  ipAddress: string;
  timestamp: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  details?: Record<string, any>;
}

export interface IAdminNavigationItem {
  id: string;
  label: string;
  path: string;
  iconName: string;
  requiredPermission?: AdminPermissionType;
  badgeCount?: number;
}

export interface IDiagnosticsUI {
  cloudRunHealth: "HEALTHY" | "DEGRADED" | "CRITICAL";
  firestoreLatencyMs: number;
  apiLatencyP99Ms: number;
  activeWorkerNodes: number;
  cpuUtilizationPercent: number;
  memoryUtilizationPercent: number;
}

export interface IIncidentUI {
  incidentId: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "INVESTIGATING" | "MITIGATED" | "RESOLVED";
  affectedServices: string[];
  declaredBy: string;
  declaredAt: string;
  updatedAt: string;
  description: string;
  rootCause?: string;
  mitigationSteps?: string[];
}

export interface IAlertUI {
  alertId: string;
  ruleName: string;
  severity: "WARNING" | "CRITICAL";
  service: string;
  triggeredAt: string;
  metricValue: string;
  thresholdValue: string;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  acknowledgedBy?: string;
}

export interface IMaintenanceWindowUI {
  maintenanceId: string;
  title: string;
  service: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  createdBY: string;
  impactLevel: "NONE" | "PARTIAL" | "FULL";
}

export interface IUserSessionUI {
  sessionId: string;
  adminId: string;
  userEmail: string;
  ipAddress: string;
  userAgent: string;
  deviceType: "DESKTOP" | "MOBILE" | "TABLET" | "UNKNOWN";
  location: string;
  createdTimestamp: string;
  lastActiveTimestamp: string;
  expiresAt: string;
  mfaVerified: boolean;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  revokedAt?: string;
  revokedBy?: string;
}

export interface ILoginHistoryUI {
  loginId: string;
  userEmail: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  location: string;
  status: "SUCCESS" | "FAILED_PASSWORD" | "FAILED_MFA" | "BLOCKED_IP";
  failureReason?: string;
  mfaUsed: boolean;
}

export interface IFailedLoginAnalyticsUI {
  totalFailedAttempts24h: number;
  failureRatePercentage: number;
  topTargetedAccounts: Array<{ email: string; attempts: number }>;
  topOriginIps: Array<{ ipAddress: string; attempts: number; location: string }>;
  failureReasonsBreakdown: Record<string, number>;
  timeframe: string;
}

export interface ISuspiciousActivityUI {
  activityId: string;
  type: "IMPOSSIBLE_TRAVEL" | "BRUTE_FORCE_ATTEMPT" | "UNUSUAL_LOCATION" | "PRIVILEGE_ESCALATION_ATTEMPT" | "MULTIPLE_FAILED_MFA";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  userEmail?: string;
  ipAddress: string;
  location: string;
  detectedAt: string;
  description: string;
  status: "OPEN" | "INVESTIGATING" | "RESOLVED" | "DISMISSED";
  resolutionNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface IDeviceInventoryUI {
  deviceId: string;
  adminId: string;
  userEmail: string;
  deviceName: string;
  os: string;
  browser: string;
  lastIpAddress: string;
  location: string;
  isTrusted: boolean;
  status: "APPROVED" | "PENDING" | "BLOCKED";
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface IRoleAssignmentUI {
  adminId: string;
  userEmail: string;
  role: AdminRoleType;
  customPermissions: string[];
  mfaEnforced: boolean;
  mfaEnabled: boolean;
  assignedBy: string;
  assignedAt: string;
  lastLoginAt: string;
}

export interface IApiKeyUI {
  keyId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  revokedBy?: string;
  revokedAt?: string;
}

export interface ISecretRotationUI {
  secretId: string;
  secretName: string;
  service: string;
  lastRotatedAt: string;
  nextRotationDueAt: string;
  rotationIntervalDays: number;
  status: "HEALTHY" | "DUE_SOON" | "OVERDUE";
  lastRotatedBy: string;
}

export interface IFeatureFlagUI {
  flagKey: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetRoles: AdminRoleType[];
  updatedAt: string;
  updatedBy: string;
}
