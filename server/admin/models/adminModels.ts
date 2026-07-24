/**
 * Enterprise Platform Administration - Domain Models & Entities
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

export interface ITenantOverviewEntity {
  shopId: string;
  businessName: string;
  category: string;
  planType: "free" | "pro" | "enterprise";
  status: "ACTIVE" | "SUSPENDED" | "DELETED" | "PROVISIONING";
  createdAt: string;
  updatedAt: string;
  ownerEmail: string;
  dailyTicketCount: number;
  totalTicketsIssued: number;
  activeQueueLength: number;
  lastActiveTimestamp: string;
  quotaUsagePercent: number;
  region: string;
  deletionReason?: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface ITenantResourceUsageEntity {
  shopId: string;
  businessName: string;
  planType: "free" | "pro" | "enterprise";
  currentStorageMb: number;
  maxStorageMb: number;
  dailyApiRequests: number;
  maxDailyApiRequests: number;
  activeConcurrentConnections: number;
  firestoreReadsToday: number;
  firestoreWritesToday: number;
  bandwidthUsageGb: number;
  calculatedCostEstUsd: number;
  lastUpdated: string;
}

export interface IPlatformMetricSnapshotEntity {
  timestamp: string;
  activeTenantsCount: number;
  totalQueuedCustomers: number;
  systemThroughputRps: number;
  errorRate5xx: number;
  latencyP95Ms: number;
  cloudRunInstanceCount: number;
  firestoreOperationsCount: number;
}

export interface ISystemAuditRecordEntity {
  auditId: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetResourceType: "TENANT" | "CONFIG" | "SECURITY" | "FEATURE_FLAG";
  targetResourceId: string;
  beforeState: Record<string, any> | null;
  afterState: Record<string, any> | null;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
}

export interface IPlatformConfigEntity {
  configVersion: number;
  globalMaintenanceMode: boolean;
  maxTicketsPerTenantPerDay: Record<string, number>;
  rateLimitingTierLimits: Record<string, number>;
  enabledGlobalFeatureFlags: Record<string, boolean>;
  allowedLoginDomains: string[];
  updatedBy: string;
  updatedAt: string;
}

export interface IOperationsDashboardEntity {
  timestamp: string;
  tenantsOverview: {
    activeTenantsCount: number;
    suspendedTenantsCount: number;
    provisioningTenantsCount: number;
    totalTenantsCount: number;
    tenantGrowth: {
      dailyNewTenants: number;
      weeklyNewTenants: number;
      monthlyNewTenants: number;
      percentageGrowth30d: number;
    };
  };
  queueAndTicketMetrics: {
    activeQueuesCount: number;
    totalQueuedCustomers: number;
    ticketsToday: number;
    averageWaitingTimeMinutes: number;
  };
  databaseAndInfrastructure: {
    firestoreReadsToday: number;
    firestoreWritesToday: number;
    totalFirestoreOpsToday: number;
    cloudRunRequestCount: number;
    throughputRps: number;
  };
  performanceAndReliability: {
    errorRatePercentage: number;
    error5xxCount: number;
    apiLatencyP50Ms: number;
    apiLatencyP95Ms: number;
    apiLatencyP99Ms: number;
  };
  governanceAndFlags: {
    activeFeatureFlagsCount: number;
    flagsSummary: Record<string, boolean>;
  };
  systemHealth: {
    systemHealthStatus: "HEALTHY" | "DEGRADED" | "CRITICAL";
    servicesHealth: {
      firestore: "OPERATIONAL" | "DEGRADED" | "DOWN";
      cloudRun: "OPERATIONAL" | "DEGRADED" | "DOWN";
      authService: "OPERATIONAL" | "DEGRADED" | "DOWN";
      telemetryPipeline: "OPERATIONAL" | "DEGRADED" | "DOWN";
    };
  };
  financialSummary: {
    mrrUsd: number;
    arrUsd: number;
    tierBreakdown: {
      free: number;
      pro: number;
      enterprise: number;
    };
  };
  estimatedInfrastructureCost: {
    totalMonthlyUsd: number;
    cloudRunUsd: number;
    firestoreUsd: number;
    egressUsd: number;
  };
}

export interface ISystemDiagnosticsEntity {
  timestamp: string;
  overallHealth: "HEALTHY" | "DEGRADED" | "CRITICAL";
  cloudRunDiagnostics: {
    activeInstances: number;
    cpuUtilizationPercent: number;
    memoryUtilizationPercent: number;
    coldStartLatencyMs: number;
    status: "OPERATIONAL" | "DEGRADED" | "DOWN";
  };
  firestoreDiagnostics: {
    avgReadLatencyMs: number;
    avgWriteLatencyMs: number;
    readOpsPerSec: number;
    writeOpsPerSec: number;
    status: "OPERATIONAL" | "DEGRADED" | "DOWN";
  };
  apiPerformanceDiagnostics: {
    latencyP50Ms: number;
    latencyP95Ms: number;
    latencyP99Ms: number;
    errorRatePercentage: number;
    requestsPerSecond: number;
  };
  servicesHealth: Array<{
    serviceName: string;
    status: "OPERATIONAL" | "DEGRADED" | "DOWN";
    latencyMs: number;
    uptimePercent: number;
    lastCheckedAt: string;
  }>;
}

export interface IIncidentTimelineUpdate {
  updateId: string;
  timestamp: string;
  authorEmail: string;
  status: "INVESTIGATING" | "IDENTIFIED" | "MONITORING" | "RESOLVED";
  message: string;
}

export interface IPlatformIncidentEntity {
  incidentId: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "INVESTIGATING" | "IDENTIFIED" | "MONITORING" | "RESOLVED";
  affectedService: string;
  affectedTenantsCount: number;
  summary: string;
  rootCause?: string;
  timeline: IIncidentTimelineUpdate[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface ISystemAlertEntity {
  alertId: string;
  title: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  metricName: string;
  thresholdValue: number;
  actualValue: number;
  status: "TRIGGERED" | "ACKNOWLEDGED" | "RESOLVED";
  triggeredAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface IMaintenanceWindowEntity {
  maintenanceId: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  affectedServices: string[];
  scheduledBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface IUserSessionEntity {
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

export interface ILoginHistoryEntity {
  loginId: string;
  adminId?: string;
  userEmail: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  location: string;
  status: "SUCCESS" | "FAILED_PASSWORD" | "FAILED_MFA" | "BLOCKED_IP";
  failureReason?: string;
  mfaUsed: boolean;
}

export interface IFAILEDLoginAnalyticsEntity {
  totalFailedAttempts24h: number;
  failureRatePercentage: number;
  topTargetedAccounts: Array<{ email: string; attempts: number }>;
  topOriginIps: Array<{ ipAddress: string; attempts: number; location: string }>;
  failureReasonsBreakdown: Record<string, number>;
  timeframe: string;
}

export interface ISuspiciousActivityEntity {
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

export interface IDeviceInventoryEntity {
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

export interface IRoleAssignmentEntity {
  adminId: string;
  userEmail: string;
  role: "SUPER_ADMIN" | "PLATFORM_OPERATOR" | "COMPLIANCE_OFFICER" | "SUPPORT_ENGINEER" | "FINANCE_AUDITOR";
  customPermissions: string[];
  mfaEnforced: boolean;
  mfaEnabled: boolean;
  assignedBy: string;
  assignedAt: string;
  lastLoginAt: string;
}

export interface IPermissionAuditSummaryEntity {
  timestamp: string;
  totalAdmins: number;
  mfaCompliancePercentage: number;
  roleDistribution: Record<string, number>;
  overPrivilegedAccountsCount: number;
  permissionChangesHistory: Array<{
    changeId: string;
    targetEmail: string;
    previousRole: string;
    newRole: string;
    changedBy: string;
    changedAt: string;
  }>;
}

export interface IApiKeyEntity {
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

export interface ISecretRotationTrackingEntity {
  secretId: string;
  secretName: string;
  service: string;
  lastRotatedAt: string;
  nextRotationDueAt: string;
  rotationIntervalDays: number;
  status: "HEALTHY" | "DUE_SOON" | "OVERDUE";
  lastRotatedBy: string;
}

