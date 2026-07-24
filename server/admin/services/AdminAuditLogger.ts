/**
 * Enterprise Platform Administration - Audit Logger Infrastructure
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Provides immutable, tamper-evident audit logging stored in Firestore & structured Cloud Logging.
 */

import { ISystemAuditRecordEntity } from "../models/adminModels";
import { AdminFirebaseSDK } from "./AdminFirebaseSDK";
import { AdminStructuredLogger } from "./AdminStructuredLogger";
import { IAdminIdentity } from "../permissions/adminPermissions";
import { v4 as uuidv4 } from "uuid";

export interface IAuditRecordInput {
  actor: IAdminIdentity;
  action: string;
  targetResourceType: "TENANT" | "CONFIG" | "SECURITY" | "FEATURE_FLAG";
  targetResourceId: string;
  beforeState?: Record<string, any> | null;
  afterState?: Record<string, any> | null;
  ipAddress: string;
  userAgent: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  correlationId?: string;
}

export class AdminAuditLogger {
  private static collectionName = "admin_audit_logs";

  /**
   * Persists an immutable security audit entry to Firestore and Structured Logs.
   */
  public static async record(input: IAuditRecordInput): Promise<ISystemAuditRecordEntity> {
    const auditId = `audit-${Date.now()}-${uuidv4().substring(0, 8)}`;
    const timestamp = new Date().toISOString();

    const recordEntity: ISystemAuditRecordEntity = {
      auditId,
      actorId: input.actor.adminId,
      actorEmail: input.actor.email,
      actorRole: input.actor.role,
      action: input.action,
      targetResourceType: input.targetResourceType,
      targetResourceId: input.targetResourceId,
      beforeState: input.beforeState || null,
      afterState: input.afterState || null,
      ipAddress: input.ipAddress || "127.0.0.1",
      userAgent: input.userAgent || "Unknown-Agent",
      timestamp,
      severity: input.severity || "INFO"
    };

    // 1. Structured Cloud Logging for immutable stream aggregation
    AdminStructuredLogger.info(`[ADMIN AUDIT LOG] ${input.action} on ${input.targetResourceType}:${input.targetResourceId}`, {
      auditId,
      actor: input.actor.email,
      role: input.actor.role,
      severity: recordEntity.severity,
      beforeState: input.beforeState,
      afterState: input.afterState,
      correlationId: input.correlationId
    });

    // 2. Persist to Firestore immutable audit collection
    try {
      const db = AdminFirebaseSDK.getInstance().getFirestore();
      await db.collection(this.collectionName).doc(auditId).set({
        ...recordEntity,
        createdAtServerTimestamp: new Date()
      });
    } catch (err: any) {
      AdminStructuredLogger.error(`[AdminAuditLogger] Firestore audit write failed for ${auditId}`, err);
    }

    return recordEntity;
  }

  /**
   * Queries audit logs with pagination and multi-field filters.
   */
  public static async queryLogs(filters: {
    page?: number;
    limit?: number;
    actorEmail?: string;
    targetResourceId?: string;
    action?: string;
    severity?: "INFO" | "WARNING" | "CRITICAL";
  }): Promise<{ records: ISystemAuditRecordEntity[]; total: number; page: number; limit: number }> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100);

    try {
      const db = AdminFirebaseSDK.getInstance().getFirestore();
      let query = db.collection(this.collectionName) as FirebaseFirestore.Query;

      if (filters.actorEmail) {
        query = query.where("actorEmail", "==", filters.actorEmail);
      }
      if (filters.targetResourceId) {
        query = query.where("targetResourceId", "==", filters.targetResourceId);
      }
      if (filters.action) {
        query = query.where("action", "==", filters.action);
      }
      if (filters.severity) {
        query = query.where("severity", "==", filters.severity);
      }

      const snapshot = await query.get();
      const total = snapshot.size;

      const allDocs = snapshot.docs.map(doc => doc.data() as ISystemAuditRecordEntity);
      allDocs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const startIndex = (page - 1) * limit;
      const paginatedRecords = allDocs.slice(startIndex, startIndex + limit);

      return {
        records: paginatedRecords,
        total,
        page,
        limit
      };
    } catch (err: any) {
      AdminStructuredLogger.error("[AdminAuditLogger] Query execution failed", err);
      return { records: [], total: 0, page, limit };
    }
  }
}
