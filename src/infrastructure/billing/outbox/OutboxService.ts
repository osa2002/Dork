import { Firestore, Transaction } from "firebase-admin/firestore";
import { getAdminFirestoreDb } from "../db/FirestoreClient";
import { DomainEvent } from "../../../billing/domain-events/DomainEvent";
import { DomainEventPublisher } from "../events/DomainEventPublisher";
import { RetrySafePersistence } from "../persistence/RetrySafePersistence";

export interface OutboxEventRecord {
  eventId: string;
  eventName: string;
  aggregateId: string;
  aggregateType: string;
  tenantId: string;
  payload: Record<string, any>;
  occurredOn: string;
  status: "PENDING" | "PROCESSING" | "PROCESSED" | "FAILED";
  retryCount: number;
  lastError?: string;
  createdAt: string;
  processedAt?: string;
}

export class OutboxService {
  private readonly db: Firestore;
  private readonly collectionName = "outbox_events";
  private readonly retryPersistence = new RetrySafePersistence();

  constructor(db?: Firestore) {
    this.db = db || getAdminFirestoreDb();
  }

  /**
   * Enqueues domain events into the Firestore outbox inside an existing transaction.
   */
  public enqueueEventsInTransaction(transaction: Transaction, events: DomainEvent[]): void {
    for (const event of events) {
      const docRef = this.db.collection(this.collectionName).doc(event.eventId);
      const record: OutboxEventRecord = {
        eventId: event.eventId,
        eventName: event.eventName,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        tenantId: event.tenantId,
        payload: {
          ...event,
          occurredOn: event.occurredOn.toISOString()
        },
        occurredOn: event.occurredOn.toISOString(),
        status: "PENDING",
        retryCount: 0,
        createdAt: new Date().toISOString()
      };
      transaction.set(docRef, record);
    }
  }

  /**
   * Enqueues events directly (outside transaction).
   */
  public async enqueueEvents(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;
    await this.retryPersistence.execute(async () => {
      const batch = this.db.batch();
      for (const event of events) {
        const docRef = this.db.collection(this.collectionName).doc(event.eventId);
        const record: OutboxEventRecord = {
          eventId: event.eventId,
          eventName: event.eventName,
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          tenantId: event.tenantId,
          payload: {
            ...event,
            occurredOn: event.occurredOn.toISOString()
          },
          occurredOn: event.occurredOn.toISOString(),
          status: "PENDING",
          retryCount: 0,
          createdAt: new Date().toISOString()
        };
        batch.set(docRef, record);
      }
      await batch.commit();
    });
  }

  /**
   * Processes pending outbox events asynchronously with zero duplication.
   */
  public async processPendingEvents(batchSize: number = 20): Promise<{ processed: number; failed: number }> {
    const publisher = DomainEventPublisher.getInstance();
    let processed = 0;
    let failed = 0;

    const snap = await this.db
      .collection(this.collectionName)
      .where("status", "in", ["PENDING", "FAILED"])
      .limit(batchSize)
      .get();

    if (snap.empty) {
      return { processed: 0, failed: 0 };
    }

    for (const doc of snap.docs) {
      const record = doc.data() as OutboxEventRecord;
      if (record.retryCount >= 5) continue; // max retries exceeded

      try {
        // Atomic status transition to PROCESSING
        await this.db.runTransaction(async (transaction) => {
          const freshSnap = await transaction.get(doc.ref);
          if (!freshSnap.exists) return;
          const current = freshSnap.data() as OutboxEventRecord;
          if (current.status === "PROCESSED" || current.status === "PROCESSING") {
            throw new Error("ALREADY_PROCESSING_OR_DONE");
          }
          transaction.update(doc.ref, {
            status: "PROCESSING",
            updatedAt: new Date().toISOString()
          });
        });

        // Reconstruct event date & dispatch
        const event: DomainEvent = {
          ...record.payload,
          occurredOn: new Date(record.occurredOn)
        } as DomainEvent;

        await publisher.publish(event);

        // Mark PROCESSED
        await doc.ref.update({
          status: "PROCESSED",
          processedAt: new Date().toISOString()
        });
        processed++;
      } catch (err: any) {
        if (err.message === "ALREADY_PROCESSING_OR_DONE") continue;

        failed++;
        await doc.ref.update({
          status: "FAILED",
          retryCount: (record.retryCount || 0) + 1,
          lastError: err.message || String(err)
        });
      }
    }

    return { processed, failed };
  }
}
