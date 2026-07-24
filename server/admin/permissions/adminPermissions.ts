/**
 * Enterprise Platform Administration - RBAC & Permissions Matrix
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

export enum AdminRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  PLATFORM_OPERATOR = "PLATFORM_OPERATOR",
  COMPLIANCE_OFFICER = "COMPLIANCE_OFFICER",
  SUPPORT_ENGINEER = "SUPPORT_ENGINEER",
  FINANCE_AUDITOR = "FINANCE_AUDITOR"
}

export enum AdminPermission {
  // Tenant Operations
  TENANT_READ = "tenant:read",
  TENANT_SUSPEND = "tenant:suspend",
  TENANT_MIGRATE_TIER = "tenant:migrate_tier",
  TENANT_DELETE = "tenant:delete",

  // Telemetry & Metrics
  METRICS_READ_SYSTEM = "metrics:read_system",
  METRICS_READ_BUSINESS = "metrics:read_business",

  // Platform Configuration
  CONFIG_READ = "config:read",
  CONFIG_WRITE = "config:write",
  CONFIG_EMERGENCY_SHUTDOWN = "config:emergency_shutdown",

  // Governance & Audit
  AUDIT_READ = "audit:read",
  AUDIT_EXPORT = "audit:export",

  // Incidents & Operations Monitoring
  INCIDENT_READ = "incident:read",
  INCIDENT_MANAGE = "incident:manage",
  MAINTENANCE_MANAGE = "maintenance:manage",

  // Security & Identity
  SECURITY_READ = "security:read",
  SECURITY_REVOKE_SESSIONS = "security:revoke_sessions",
  SECURITY_MANAGE_ROLES = "security:manage_roles",
  SECURITY_MANAGE_KEYS = "security:manage_keys"
}

export const ROLE_PERMISSIONS_MATRIX: Record<AdminRole, AdminPermission[]> = {
  [AdminRole.SUPER_ADMIN]: Object.values(AdminPermission),

  [AdminRole.PLATFORM_OPERATOR]: [
    AdminPermission.TENANT_READ,
    AdminPermission.TENANT_SUSPEND,
    AdminPermission.TENANT_MIGRATE_TIER,
    AdminPermission.METRICS_READ_SYSTEM,
    AdminPermission.METRICS_READ_BUSINESS,
    AdminPermission.CONFIG_READ,
    AdminPermission.CONFIG_WRITE,
    AdminPermission.AUDIT_READ,
    AdminPermission.INCIDENT_READ,
    AdminPermission.INCIDENT_MANAGE,
    AdminPermission.MAINTENANCE_MANAGE,
    AdminPermission.SECURITY_READ
  ],

  [AdminRole.COMPLIANCE_OFFICER]: [
    AdminPermission.TENANT_READ,
    AdminPermission.METRICS_READ_SYSTEM,
    AdminPermission.CONFIG_READ,
    AdminPermission.AUDIT_READ,
    AdminPermission.AUDIT_EXPORT,
    AdminPermission.SECURITY_READ,
    AdminPermission.SECURITY_REVOKE_SESSIONS,
    AdminPermission.SECURITY_MANAGE_KEYS,
    AdminPermission.INCIDENT_READ
  ],

  [AdminRole.SUPPORT_ENGINEER]: [
    AdminPermission.TENANT_READ,
    AdminPermission.METRICS_READ_SYSTEM,
    AdminPermission.CONFIG_READ,
    AdminPermission.AUDIT_READ,
    AdminPermission.INCIDENT_READ,
    AdminPermission.INCIDENT_MANAGE
  ],

  [AdminRole.FINANCE_AUDITOR]: [
    AdminPermission.TENANT_READ,
    AdminPermission.METRICS_READ_BUSINESS,
    AdminPermission.AUDIT_READ,
    AdminPermission.AUDIT_EXPORT
  ]
};

export interface IAdminIdentity {
  adminId: string;
  email: string;
  role: AdminRole;
  permissions: AdminPermission[];
  mfaVerified: boolean;
  issuedAt: string;
}

export function evaluateAdminPermission(
  identity: IAdminIdentity,
  requiredPermission: AdminPermission
): boolean {
  if (!identity || !identity.mfaVerified) {
    return false;
  }
  const granted = ROLE_PERMISSIONS_MATRIX[identity.role] || [];
  return granted.includes(requiredPermission) || identity.permissions.includes(requiredPermission);
}
