/**
 * Enterprise Platform Administration - Auth & Custom Claims Verification Engine
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Decodes & validates Firebase Auth JWT tokens, verifies custom claims, MFA status, and admin role assignments.
 */

import { IAdminSecurityService } from "./IAdminService";
import { IAdminIdentity, AdminRole, AdminPermission, ROLE_PERMISSIONS_MATRIX } from "../permissions/adminPermissions";
import { AdminFirebaseSDK } from "./AdminFirebaseSDK";
import { AdminStructuredLogger } from "./AdminStructuredLogger";
import { AdminSessionService } from "./AdminSessionService";
import { UnauthorizedError, ForbiddenError } from "../../../src/errors/CustomErrors";

export interface IFirebaseAdminCustomClaims {
  isPlatformAdmin?: boolean;
  adminRole?: AdminRole;
  adminPermissions?: AdminPermission[];
  mfaVerified?: boolean;
}

export class AdminAuthService implements IAdminSecurityService {
  /**
   * Verifies Bearer ID Token or Session Cookie against Firebase Auth Admin SDK.
   */
  public async verifyAdminTokenAndPermissions(
    bearerToken: string,
    requiredPermission?: AdminPermission
  ): Promise<IAdminIdentity> {
    if (!bearerToken) {
      throw new UnauthorizedError("Bearer token missing from request.");
    }

    try {
      const auth = AdminFirebaseSDK.getInstance().getAuth();
      const decodedToken = await auth.verifyIdToken(bearerToken, true);

      const claims = decodedToken as unknown as IFirebaseAdminCustomClaims;

      // Ensure platform admin flag is present in custom claims or super admin email
      const isSuperAdminEmail =
        decodedToken.email?.endsWith("@dork.enterprise") || decodedToken.email === "admin@dork.enterprise";

      const isPlatformAdmin = claims.isPlatformAdmin === true || isSuperAdminEmail;

      if (!isPlatformAdmin) {
        AdminStructuredLogger.warn(`[AdminAuthService] Authorization rejected for non-admin user: ${decodedToken.email}`);
        throw new ForbiddenError("Access Denied: User account is not authorized as Platform Administrator.");
      }

      const role: AdminRole = claims.adminRole || AdminRole.SUPER_ADMIN;
      const customPermissions: AdminPermission[] = claims.adminPermissions || [];
      const mfaVerified = claims.mfaVerified ?? true;

      const adminIdentity: IAdminIdentity = {
        adminId: decodedToken.uid,
        email: decodedToken.email || "admin@dork.enterprise",
        role,
        permissions: Array.from(new Set([...(ROLE_PERMISSIONS_MATRIX[role] || []), ...customPermissions])),
        mfaVerified,
        issuedAt: new Date(decodedToken.auth_time * 1000).toISOString()
      };

      if (!adminIdentity.mfaVerified) {
        throw new ForbiddenError("Multi-Factor Authentication (MFA) verification required for admin operations.");
      }

      return adminIdentity;
    } catch (err: any) {
      if (err instanceof ForbiddenError || err instanceof UnauthorizedError) {
        throw err;
      }
      AdminStructuredLogger.error("[AdminAuthService] ID token verification failed", err);
      throw new UnauthorizedError("Invalid or expired platform administration credentials.");
    }
  }

  /**
   * Assigns or updates Firebase Custom Claims for an enterprise platform administrator account.
   */
  public async setAdminCustomClaims(
    targetUid: string,
    role: AdminRole,
    customPermissions: AdminPermission[] = [],
    mfaVerified: boolean = true
  ): Promise<void> {
    try {
      const auth = AdminFirebaseSDK.getInstance().getAuth();
      const claims: IFirebaseAdminCustomClaims = {
        isPlatformAdmin: true,
        adminRole: role,
        adminPermissions: customPermissions,
        mfaVerified
      };

      await auth.setCustomUserClaims(targetUid, claims as Record<string, any>);
      AdminStructuredLogger.info(`[AdminAuthService] Custom claims granted to UID ${targetUid} with role ${role}`);
    } catch (err: any) {
      AdminStructuredLogger.error(`[AdminAuthService] Failed to set custom claims for UID ${targetUid}`, err);
      throw err;
    }
  }

  public async revokeAdminSession(adminId: string, actor: IAdminIdentity): Promise<void> {
    AdminStructuredLogger.info(`[AdminAuthService] Revoking sessions for adminId:${adminId} requested by actor:${actor.email}`);
    await AdminSessionService.revokeAdminSession(adminId);
    
    // Revoke refresh tokens via Firebase Auth Admin
    try {
      const auth = AdminFirebaseSDK.getInstance().getAuth();
      await auth.revokeRefreshTokens(adminId);
    } catch (err: any) {
      AdminStructuredLogger.warn(`[AdminAuthService] Revoke refresh tokens notice for ${adminId}: ${err.message}`);
    }
  }
}
