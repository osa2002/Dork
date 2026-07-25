import { Firestore } from "firebase-admin/firestore";
import { getAdminFirestoreDb } from "../db/FirestoreClient";
import { IdempotencyConflictException } from "../exceptions/InfrastructureExceptions";

export interface IdempotencyRecord {
  idempotencyKey: string;
  tenantId?: string;
  actionName: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  result?: any;
  error?: string;
  createdAt: string;
  completedAt?: string;
  expiresAt: string;
}

export class FirestoreIdempotencyStore {
  private readonly db: Firestore;
  private readonly collectionName = "idempotency_keys";

  constructor(db?: Firestore) {
    this.db = db || getAdminFirestoreDb();
  }

  /**
   * Executes an operation idempotently using a unique key.
   * If already executed, returns cached result.
   * If currently executing, throws IdempotencyConflictException.
   */
  public async executeIdempotent<T>(
    idempotencyKey: string,
    actionName: string,
    operation: () => Promise<T>,
    tenantId?: string,
    ttlMinutes: number = 1440 // 24 hours default
  ): Promise<T> {
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      return await operation();
    }

    const docRef = this.db.collection(this.collectionName).doc(idempotencyKey);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();

    // 1. Atomic check & lock reservation
    const cachedResult = await this.db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);

      if (snap.exists) {
        const record = snap.data() as IdempotencyRecord;

        if (record.status === "COMPLETED") {
          return { isCached: true, result: record.result };
        }

        if (record.status === "PROCESSING") {
          throw new IdempotencyConflictException(
            idempotencyKey,
            `Operation '${actionName}' with key '${idempotencyKey}' is already processing.`
          );
        }
      }

      // Reserve processing state
      const newRecord: IdempotencyRecord = {
        idempotencyKey,
        tenantId,
        actionName,
        status: "PROCESSING",
        createdAt: now.toISOString(),
        expiresAt
      };

      transaction.set(docRef, newRecord);
      return { isCached: false };
    });

    if (cachedResult.isCached) {
      return cachedResult.result as T;
    }

    // 2. Execute operation
    try {
      const result = await operation();

      // 3. Save completed result
      await docRef.update({
        status: "COMPLETED",
        result: result === undefined ? null : result,
        completedAt: new Date().toISOString()
      });

      return result;
    } catch (err: any) {
      // 4. Record failure
      await docRef.update({
        status: "FAILED",
        error: err.message || String(err)
      });
      throw err;
    }
  }

  /**
   * Direct manual check for an existing idempotency record.
   */
  public async getRecord(idempotencyKey: string): Promise<IdempotencyRecord | null> {
    const docRef = this.db.collection(this.collectionName).doc(idempotencyKey);
    const snap = await docRef.get();
    return snap.exists ? (snap.data() as IdempotencyRecord) : null;
  }
}
