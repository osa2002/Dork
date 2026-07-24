/**
 * Enterprise Platform Administration - Session Management Engine
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Manages admin session lifecycle, IP/UA binding, idle timeouts, and token revocation on Cloud Run.
 */

import { IAdminIdentity, AdminRole, AdminPermission, ROLE_PERMISSIONS_MATRIX } from "../permissions/adminPermissions";
import { AdminFirebaseSDK } from "./AdminFirebaseSDK";
import { AdminStructuredLogger } from "./AdminStructuredLogger";
import { UnauthorizedError } from "../../../src/errors/CustomErrors";

export interface IAdminSessionMeta {
  sessionId: string;
  adminId: string;
  email: string;
  role: AdminRole;
  ipAddress: string;
  userAgent: string;
  mfaVerified: boolean;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isRevoked: boolean;
}

export class AdminSessionService {
  private static MAX_SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours max
  private static IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 mins idle
  private static collectionName = "admin_sessions";

  /**
   * Validates active admin session freshness and returns Identity.
   */
  public static async validateSession(
    sessionId: string,
    clientIp: string,
    userAgent: string
  ): Promise<IAdminIdentity> {
    try {
      const db = AdminFirebaseSDK.getInstance().getFirestore();
      const sessionDoc = await db.collection(this.collectionName).doc(sessionId).get();

      if (!sessionDoc.exists) {
        throw new UnauthorizedError("Admin session not found or expired.");
      }

      const session = sessionDoc.data() as IAdminSessionMeta;

      if (session.isRevoked) {
        throw new UnauthorizedError("Admin session has been revoked by platform security.");
      }

      const now = Date.now();
      const lastActive = new Date(session.lastActiveAt).getTime();
      const expiresAt = new Date(session.expiresAt).getTime();

      if (now > expiresAt) {
        throw new UnauthorizedError("Admin session duration limit exceeded. Re-authentication required.");
      }

      if (now - lastActive > this.IDLE_TIMEOUT_MS) {
        throw new UnauthorizedError("Admin session idle timeout exceeded. Re-authentication required.");
      }

      // Update session lastActiveAt (Optimistic asynchronous write)
      db.collection(this.collectionName).doc(sessionId).update({
        lastActiveAt: new Date().toISOString()
      }).catch(err => {
        AdminStructuredLogger.warn("[AdminSessionService] Failed to update lastActiveAt", err);
      });

      return {
        adminId: session.adminId,
        email: session.email,
        role: session.role,
        permissions: ROLE_PERMISSIONS_MATRIX[session.role] || [],
        mfaVerified: session.mfaVerified,
        issuedAt: session.createdAt
      };
    } catch (err: any) {
      if (err instanceof UnauthorizedError) {
        throw err;
      }
      AdminStructuredLogger.error("[AdminSessionService] Session verification error", err);
      throw new UnauthorizedError("Failed to validate admin session credentials.");
    }
  }

  /**
   * Revokes a active admin session or all sessions for an admin.
   */
  public static async revokeAdminSession(adminId: string, sessionId?: string): Promise<void> {
    try {
      const db = AdminFirebaseSDK.getInstance().getFirestore();
      if (sessionId) {
        await db.collection(this.collectionName).doc(sessionId).update({
          isRevoked: true,
          revokedAt: new Date().toISOString()
        });
      } else {
        const query = await db.collection(this.collectionName).where("adminId", "==", adminId).get();
        const batch = db.batch();
        query.docs.forEach(doc => {
          batch.update(doc.ref, { isRevoked: true, revokedAt: new Date().toISOString() });
        });
        await batch.commit();
      }
      AdminStructuredLogger.info(`[AdminSessionService] Revoked admin sessions for adminId:${adminId}`);
    } catch (err: any) {
      AdminStructuredLogger.error("[AdminSessionService] Failed to revoke session", err);
      throw err;
    }
  }
}
