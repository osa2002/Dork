import { Firestore } from "firebase-admin/firestore";
import { getAdminFirestoreDb } from "../db/FirestoreClient";

export interface DeadLetterEntry {
  id: string;
  source: string; // e.g., "webhook_pipeline", "outbox_processor", "payment_orchestrator"
  eventType: string;
  payload: Record<string, any>;
  errorReason: string;
  stackTrace?: string;
  tenantId?: string;
  attemptsMade: number;
  failedAt: string;
  status: "UNRESOLVED" | "REPROCESSED" | "DISCARDED";
  resolvedAt?: string;
  resolvedBy?: string;
}

export class FirestoreDeadLetterQueue {
  private readonly db: Firestore;
  private readonly collectionName = "dead_letter_queue";

  constructor(db?: Firestore) {
    this.db = db || getAdminFirestoreDb();
  }

  /**
   * Enqueues a permanently failed message or job into DLQ.
   */
  public async push(entry: Omit<DeadLetterEntry, "id" | "failedAt" | "status">): Promise<string> {
    const id = `dlq_${crypto.randomUUID()}`;
    const docRef = this.db.collection(this.collectionName).doc(id);

    const record: DeadLetterEntry = {
      ...entry,
      id,
      failedAt: new Date().toISOString(),
      status: "UNRESOLVED"
    };

    await docRef.set(record);
    return id;
  }

  /**
   * Fetches unresolved DLQ entries for tenant or system inspection.
   */
  public async getUnresolvedEntries(tenantId?: string, limit: number = 50): Promise<DeadLetterEntry[]> {
    let query: any = this.db.collection(this.collectionName).where("status", "==", "UNRESOLVED");

    if (tenantId) {
      query = query.where("tenantId", "==", tenantId);
    }

    const snap = await query.limit(limit).get();
    return snap.docs.map((d: any) => d.data() as DeadLetterEntry);
  }

  /**
   * Marks a DLQ item as reprocessed or discarded.
   */
  public async resolve(id: string, resolution: "REPROCESSED" | "DISCARDED", resolvedBy: string = "system"): Promise<void> {
    const docRef = this.db.collection(this.collectionName).doc(id);
    await docRef.update({
      status: resolution,
      resolvedAt: new Date().toISOString(),
      resolvedBy
    });
  }
}
