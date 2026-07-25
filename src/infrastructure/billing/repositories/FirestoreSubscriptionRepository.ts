import { Firestore } from "firebase-admin/firestore";
import { getAdminFirestoreDb } from "../db/FirestoreClient";
import { ISubscriptionRepository } from "../../../billing/repositories/ISubscriptionRepository";
import { Subscription } from "../../../billing/aggregates/Subscription";
import { SubscriptionId } from "../../../billing/value-objects/SubscriptionId";
import { TenantId } from "../../../billing/value-objects/TenantId";
import { BillingAccountId } from "../../../billing/value-objects/BillingAccountId";
import { SubscriptionMapper, SubscriptionDocument } from "../mappers/SubscriptionMapper";
import { OutboxService } from "../outbox/OutboxService";
import { RetrySafePersistence } from "../persistence/RetrySafePersistence";

export class FirestoreSubscriptionRepository implements ISubscriptionRepository {
  private readonly db: Firestore;
  private readonly collectionName = "subscriptions";
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

  public async findById(id: SubscriptionId, tenantId: TenantId): Promise<Subscription | null> {
    return await this.retryPersistence.execute(async () => {
      const docRef = this.getDocRef(id.value, tenantId.value);
      const snap = await docRef.get();

      if (!snap.exists) {
        return null;
      }

      return SubscriptionMapper.toDomain(snap.data() as SubscriptionDocument);
    });
  }

  public async findActiveByBillingAccountId(
    billingAccountId: BillingAccountId,
    tenantId: TenantId
  ): Promise<Subscription | null> {
    return await this.retryPersistence.execute(async () => {
      const snap = await this.db
        .collection(this.collectionName)
        .where("tenantId", "==", tenantId.value)
        .where("billingAccountId", "==", billingAccountId.value)
        .where("status", "==", "ACTIVE")
        .limit(1)
        .get();

      if (snap.empty) {
        return null;
      }

      return SubscriptionMapper.toDomain(snap.docs[0].data() as SubscriptionDocument);
    });
  }

  public async findAllByTenantId(tenantId: TenantId): Promise<Subscription[]> {
    return await this.retryPersistence.execute(async () => {
      const snap = await this.db
        .collection(this.collectionName)
        .where("tenantId", "==", tenantId.value)
        .get();

      return snap.docs.map(doc => SubscriptionMapper.toDomain(doc.data() as SubscriptionDocument));
    });
  }

  public async save(subscription: Subscription): Promise<void> {
    await this.retryPersistence.execute(async () => {
      const docRef = this.getDocRef(subscription.id.value, subscription.tenantId.value);
      const persistenceData = SubscriptionMapper.toPersistence(subscription);

      await this.db.runTransaction(async (transaction) => {
        transaction.set(docRef, persistenceData, { merge: true });

        const events = subscription.clearDomainEvents();
        if (events.length > 0) {
          this.outboxService.enqueueEventsInTransaction(transaction, events);
        }
      });
    });
  }

  public async delete(id: SubscriptionId, tenantId: TenantId): Promise<void> {
    await this.retryPersistence.execute(async () => {
      const docRef = this.getDocRef(id.value, tenantId.value);
      await docRef.delete();
    });
  }
}
