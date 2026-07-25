import { Firestore } from "firebase-admin/firestore";
import { getAdminFirestoreDb } from "../db/FirestoreClient";

export interface AuditTrailEntry {
  auditId: string;
  tenantId: string;
  entityType: "BillingAccount" | "Subscription" | "Invoice" | "PaymentIntent" | "Refund" | "System";
  entityId: string;
  action: string;
  actor: {
    userId?: string;
    type: "USER" | "SYSTEM" | "WEBHOOK" | "ADMIN";
    email?: string;
  };
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  metadata?: Record<string, any>;
  timestamp: string;
}

export class FirestoreAuditTrail {
  private readonly db: Firestore;
  private readonly collectionName = "billing_audit_trail";

  constructor(db?: Firestore) {
    this.db = db || getAdminFirestoreDb();
  }

  /**
   * Records an immutable audit log entry.
   */
  public async record(entry: Omit<AuditTrailEntry, "auditId" | "timestamp">): Promise<string> {
    const auditId = `audit_${crypto.randomUUID()}`;
    const docRef = this.db.collection(this.collectionName).doc(auditId);

    const record: AuditTrailEntry = {
      ...entry,
      auditId,
      timestamp: new Date().toISOString()
    };

    await docRef.set(record);
    return auditId;
  }

  /**
   * Retrieves audit trail entries for a specific aggregate or tenant.
   */
  public async getTrail(tenantId: string, entityId?: string, limit: number = 50): Promise<AuditTrailEntry[]> {
    let query: any = this.db.collection(this.collectionName).where("tenantId", "==", tenantId);

    if (entityId) {
      query = query.where("entityId", "==", entityId);
    }

    const snap = await query.limit(limit).get();
    const entries = snap.docs.map((d: any) => d.data() as AuditTrailEntry);
    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}
