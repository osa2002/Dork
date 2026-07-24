/**
 * Enterprise Platform Administration - Frontend Route Architecture
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Route Prefix: /admin
 */

import { AdminPermissionType } from "../types/adminTypes";

export interface IAdminRouteDefinition {
  path: string;
  name: string;
  requiredPermission?: AdminPermissionType;
  titleKey: string;
  breadcrumbLabel: string;
  isExact?: boolean;
}

export const ADMIN_ROUTES: Record<string, IAdminRouteDefinition> = {
  DASHBOARD: {
    path: "/admin",
    name: "Platform Overview",
    titleKey: "admin_nav_dashboard",
    breadcrumbLabel: "Overview",
    requiredPermission: "metrics:read_system",
    isExact: true
  },
  TENANTS: {
    path: "/admin/tenants",
    name: "Tenant Directory",
    titleKey: "admin_nav_tenants",
    breadcrumbLabel: "Tenants",
    requiredPermission: "tenant:read"
  },
  TENANT_DETAILS: {
    path: "/admin/tenants/:shopId",
    name: "Tenant Inspector",
    titleKey: "admin_nav_tenant_details",
    breadcrumbLabel: "Tenant Details",
    requiredPermission: "tenant:read"
  },
  AUDIT_LOGS: {
    path: "/admin/audit-logs",
    name: "Security Audit Logs",
    titleKey: "admin_nav_audit",
    breadcrumbLabel: "Audit Logs",
    requiredPermission: "audit:read"
  },
  PLATFORM_CONFIG: {
    path: "/admin/config",
    name: "System Configuration",
    titleKey: "admin_nav_config",
    breadcrumbLabel: "Platform Config",
    requiredPermission: "config:read"
  },
  GOVERNANCE: {
    path: "/admin/governance",
    name: "Identity & Governance",
    titleKey: "admin_nav_governance",
    breadcrumbLabel: "Governance",
    requiredPermission: "security:manage_roles"
  }
};
