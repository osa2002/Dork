import { collection, doc, setDoc, getDoc, updateDoc, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { OutboxRecord, OutboxStatus } from "../types";

// In-memory fallback map for unit testing or when Firestore is offline
const memoryOutbox = new Map<string, OutboxRecord>();

export const outboxRepository = {
  /**
   * Enqueues a durable outbox record to Firestore (outbox collection).
   */
  async enqueue(record: OutboxRecord): Promise<OutboxRecord> {
    try {
      const docRef = doc(db, "outbox", record.id);
      await setDoc(docRef, record);
      memoryOutbox.set(record.id, record);
      return record;
    } catch (err) {
      console.warn("[outboxRepository] Firestore write warning, using memory fallback:", err);
      memoryOutbox.set(record.id, record);
      return record;
    }
  },

  async saveOutboxRecord(record: OutboxRecord): Promise<OutboxRecord> {
    return this.enqueue(record);
  },

  /**
   * Queries pending outbox records ready for processing.
   */
  async getPendingRecords(limitCount: number = 50): Promise<OutboxRecord[]> {
    const nowIso = new Date().toISOString();
    const results: OutboxRecord[] = [];

    try {
      const q = query(
        collection(db, "outbox"),
        where("status", "==", "PENDING"),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const item = docSnap.data() as OutboxRecord;
        if (!item.nextAttemptAt || item.nextAttemptAt <= nowIso) {
          results.push(item);
        }
      });
    } catch (err) {
      // Memory fallback scan
      memoryOutbox.forEach((item) => {
        if (item.status === "PENDING" && (!item.nextAttemptAt || item.nextAttemptAt <= nowIso)) {
          results.push(item);
        }
      });
    }

    return results.slice(0, limitCount);
  },

  /**
   * Updates an outbox record status, retry metrics, or errors.
   */
  async updateStatus(
    id: string,
    updates: Partial<OutboxRecord>
  ): Promise<void> {
    const updatedFields = {
      ...updates,
      processedAt: updates.status === "DISPATCHED" ? new Date().toISOString() : updates.processedAt
    };

    const memItem = memoryOutbox.get(id);
    if (memItem) {
      memoryOutbox.set(id, { ...memItem, ...updatedFields });
    }

    try {
      const docRef = doc(db, "outbox", id);
      await updateDoc(docRef, updatedFields);
    } catch (err) {
      // Non-fatal if offline/mocked
    }
  },

  async updateOutboxRecord(id: string, updates: Partial<OutboxRecord>): Promise<void> {
    return this.updateStatus(id, updates);
  },


  /**
   * Retrieves records filtered by status.
   */
  async getRecordsByStatus(status: OutboxStatus, limitCount: number = 50): Promise<OutboxRecord[]> {
    const results: OutboxRecord[] = [];
    try {
      const q = query(
        collection(db, "outbox"),
        where("status", "==", status),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        results.push(docSnap.data() as OutboxRecord);
      });
    } catch (err) {
      memoryOutbox.forEach((item) => {
        if (item.status === status) {
          results.push(item);
        }
      });
    }
    return results.slice(0, limitCount);
  },

  /**
   * Helper to update status with optional error message.
   */
  async updateRecordStatus(id: string, status: OutboxStatus, error?: string): Promise<void> {
    const updates: Partial<OutboxRecord> = { status };
    if (error) updates.error = error;
    if (status === "DISPATCHED") updates.processedAt = new Date().toISOString();
    return this.updateStatus(id, updates);
  },

  /**
   * Retrieves a record by ID.
   */
  async getRecord(id: string): Promise<OutboxRecord | null> {
    try {
      const docRef = doc(db, "outbox", id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data() as OutboxRecord;
      }
    } catch (e) {
      // Ignore
    }
    return memoryOutbox.get(id) || null;
  },

  /**
   * Clears in-memory cache for test resets.
   */
  clearMemoryCache(): void {
    memoryOutbox.clear();
  }
};
