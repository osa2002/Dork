/**
 * Enterprise Platform Administration - Auth & Permission Hooks Contract
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 */

import { IAdminUserProfile, AdminPermissionType } from "../types/adminTypes";

export interface IUseAdminAuthReturn {
  user: IAdminUserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mfaVerified: boolean;
  hasPermission: (permission: AdminPermissionType) => boolean;
  logout: () => Promise<void>;
  verifyMfaToken: (mfaCode: string) => Promise<boolean>;
}

export interface IUseAdminPermissionsReturn {
  canAccessTenants: boolean;
  canSuspendTenants: boolean;
  canMigrateTiers: boolean;
  canViewAuditLogs: boolean;
  canEditConfig: boolean;
  canEmergencyShutdown: boolean;
}
