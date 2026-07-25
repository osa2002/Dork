import { Firestore } from "firebase-admin/firestore";
import { getAdminFirestoreDb } from "../db/FirestoreClient";
import { IPaymentIntentRepository } from "../../../billing/repositories/IPaymentIntentRepository";
import { PaymentIntent } from "../../../billing/aggregates/PaymentIntent";
import { PaymentIntentId } from "../../../billing/value-objects/PaymentIntentId";
import { TenantId } from "../../../billing/value-objects/TenantId";
import { InvoiceId } from "../../../billing/value-objects/InvoiceId";
import { PaymentIntentMapper, PaymentIntentDocument } from "../mappers/PaymentIntentMapper";
import { OutboxService } from "../outbox/OutboxService";
import { RetrySafePersistence } from "../persistence/RetrySafePersistence";

export class FirestorePaymentIntentRepository implements IPaymentIntentRepository {
  private readonly db: Firestore;
  private readonly collectionName = "payment_intents";
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

  public async findById(id: PaymentIntentId, tenantId: TenantId): Promise<PaymentIntent | null> {
    return await this.retryPersistence.execute(async () => {
      const docRef = this.getDocRef(id.value, tenantId.value);
      const snap = await docRef.get();

      if (!snap.exists) {
        return null;
      }

      return PaymentIntentMapper.toDomain(snap.data() as PaymentIntentDocument);
    });
  }

  public async findByInvoiceId(invoiceId: InvoiceId, tenantId: TenantId): Promise<PaymentIntent[]> {
    return await this.retryPersistence.execute(async () => {
      const snap = await this.db
        .collection(this.collectionName)
        .where("tenantId", "==", tenantId.value)
        .where("invoiceId", "==", invoiceId.value)
        .get();

      return snap.docs.map(doc => PaymentIntentMapper.toDomain(doc.data() as PaymentIntentDocument));
    });
  }

  public async save(paymentIntent: PaymentIntent): Promise<void> {
    await this.retryPersistence.execute(async () => {
      const docRef = this.getDocRef(paymentIntent.id.value, paymentIntent.tenantId.value);
      const persistenceData = PaymentIntentMapper.toPersistence(paymentIntent);

      await this.db.runTransaction(async (transaction) => {
        transaction.set(docRef, persistenceData, { merge: true });

        const events = paymentIntent.clearDomainEvents();
        if (events.length > 0) {
          this.outboxService.enqueueEventsInTransaction(transaction, events);
        }
      });
    });
  }
}
