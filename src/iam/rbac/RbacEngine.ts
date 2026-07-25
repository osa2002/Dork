import { Permission, PermissionAction, PermissionResource, SystemRole } from "../value-objects/IamValueObjects";

export interface RoleDefinition {
  roleId: string;
  tenantId: string; // "GLOBAL" or specific tenantId
  name: string;
  systemRole: SystemRole;
  description: string;
  inheritedRoleIds: string[];
  permissions: Permission[];
  isCustom: boolean;
}

export class RbacEngine {
  private rolesMap: Map<string, RoleDefinition> = new Map();

  constructor() {
    this.seedSystemRoles();
  }

  private seedSystemRoles(): void {
    const superAdminRole: RoleDefinition = {
      roleId: "role_super_admin",
      tenantId: "GLOBAL",
      name: "Global Platform Administrator",
      systemRole: "SUPER_ADMIN",
      description: "Unrestricted global administrative access across all tenants and subsystems.",
      inheritedRoleIds: [],
      permissions: [
        { permissionId: "perm_all", resource: "SYSTEM", action: "ADMINISTER", description: "Full system administration" }
      ],
      isCustom: false
    };

    const financeAdminRole: RoleDefinition = {
      roleId: "role_finance_admin",
      tenantId: "GLOBAL",
      name: "Financial & Revenue Operations Administrator",
      systemRole: "FINANCE_ADMIN",
      description: "Full access to billing, revenue recognition, period closing, tax, and FX engines.",
      inheritedRoleIds: [],
      permissions: [
        { permissionId: "perm_billing_all", resource: "BILLING", action: "ADMINISTER", description: "Manage all billing" },
        { permissionId: "perm_payments_all", resource: "PAYMENTS", action: "ADMINISTER", description: "Manage payment operations" },
        { permissionId: "perm_refunds_approve", resource: "REFUNDS", action: "APPROVE", description: "Approve high-value refunds" },
        { permissionId: "perm_recon_execute", resource: "RECONCILIATION", action: "EXECUTE", description: "Execute financial reconciliation" },
        { permissionId: "perm_revenue_admin", resource: "REVENUE", action: "ADMINISTER", description: "Manage IFRS15 schedules" }
      ],
      isCustom: false
    };

    const auditorRole: RoleDefinition = {
      roleId: "role_auditor",
      tenantId: "GLOBAL",
      name: "Compliance & Security Auditor",
      systemRole: "AUDITOR",
      description: "Read-only access to financial reports, audit trails, and security logs.",
      inheritedRoleIds: [],
      permissions: [
        { permissionId: "perm_audit_read", resource: "AUDIT_LOGS", action: "READ", description: "Read immutable audit trail" },
        { permissionId: "perm_revenue_read", resource: "REVENUE", action: "READ", description: "Read revenue schedules" },
        { permissionId: "perm_billing_read", resource: "BILLING", action: "READ", description: "Read billing state" }
      ],
      isCustom: false
    };

    this.registerRole(superAdminRole);
    this.registerRole(financeAdminRole);
    this.registerRole(auditorRole);
  }

  public registerRole(role: RoleDefinition): void {
    this.rolesMap.set(role.roleId, role);
  }

  public getRole(roleId: string): RoleDefinition | undefined {
    return this.rolesMap.get(roleId);
  }

  public evaluateRbacPermission(
    assignedRoleIds: string[],
    targetResource: PermissionResource,
    targetAction: PermissionAction
  ): boolean {
    for (const roleId of assignedRoleIds) {
      if (this.hasPermissionRecursive(roleId, targetResource, targetAction, new Set())) {
        return true;
      }
    }
    return false;
  }

  private hasPermissionRecursive(
    roleId: string,
    resource: PermissionResource,
    action: PermissionAction,
    visitedRoleIds: Set<string>
  ): boolean {
    if (visitedRoleIds.has(roleId)) return false; // Break inheritance loops
    visitedRoleIds.add(roleId);

    const role = this.rolesMap.get(roleId);
    if (!role) return false;

    // Super Admin wildcard check
    if (role.systemRole === "SUPER_ADMIN") return true;

    // Check direct permissions
    const match = role.permissions.some(
      p =>
        (p.resource === resource || p.resource === "SYSTEM") &&
        (p.action === action || p.action === "ADMINISTER")
    );

    if (match) return true;

    // Check inherited parent roles
    for (const parentRoleId of role.inheritedRoleIds) {
      if (this.hasPermissionRecursive(parentRoleId, resource, action, visitedRoleIds)) {
        return true;
      }
    }

    return false;
  }
}
