import { Firestore } from "firebase-admin/firestore";
import { getAdminFirestoreDb } from "../db/FirestoreClient";
import { IRefundRepository } from "../../../billing/repositories/IRefundRepository";
import { Refund } from "../../../billing/aggregates/Refund";
import { RefundId } from "../../../billing/value-objects/RefundId";
import { TenantId } from "../../../billing/value-objects/TenantId";
import { PaymentIntentId } from "../../../billing/value-objects/PaymentIntentId";
import { RefundMapper, RefundDocument } from "../mappers/RefundMapper";
import { OutboxService } from "../outbox/OutboxService";
import { RetrySafePersistence } from "../persistence/RetrySafePersistence";

export class FirestoreRefundRepository implements IRefundRepository {
  private readonly db: Firestore;
  private readonly collectionName = "refunds";
  private readonly outboxService: OutboxService;
  private readonly retryPersistence: RetrySafePersistence;

  constructor(db?: Firestore, outboxService?: OutboxService) {
    this.db = db || getAdminFirestoreDb();
    this.outboxService = outboxService || new OutboxService(this.db);
    this.retryPersistence = new RetrySafePersistence();
  }

  private getDocRef(id: string, tenantId: string) {
    return this.db.collection(this.collectionName).doc(`${tenantId}__${id}`);
  }

  public async findById(id: RefundId, tenantId: TenantId): Promise<Refund | null> {
    return await this.retryPersistence.execute(async () => {
      const docRef = this.getDocRef(id.value, tenantId.value);
      const snap = await docRef.get();

      if (!snap.exists) {
        return null;
      }

      return RefundMapper.toDomain(snap.data() as RefundDocument);
    });
  }

  public async findByPaymentIntentId(paymentIntentId: PaymentIntentId, tenantId: TenantId): Promise<Refund[]> {
    return await this.retryPersistence.execute(async () => {
      const snap = await this.db
        .collection(this.collectionName)
        .where("tenantId", "==", tenantId.value)
        .where("paymentIntentId", "==", paymentIntentId.value)
        .get();

      return snap.docs.map(doc => RefundMapper.toDomain(doc.data() as RefundDocument));
    });
  }

  public async save(refund: Refund): Promise<void> {
    await this.retryPersistence.execute(async () => {
      const docRef = this.getDocRef(refund.id.value, refund.tenantId.value);
      const persistenceData = RefundMapper.toPersistence(refund);

      await this.db.runTransaction(async (transaction) => {
        transaction.set(docRef, persistenceData, { merge: true });

        const events = refund.clearDomainEvents();
        if (events.length > 0) {
          this.outboxService.enqueueEventsInTransaction(transaction, events);
        }
      });
    });
  }
}
