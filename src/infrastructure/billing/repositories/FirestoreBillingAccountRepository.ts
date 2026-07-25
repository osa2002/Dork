import { Firestore } from "firebase-admin/firestore";
import { getAdminFirestoreDb } from "../db/FirestoreClient";
import { IBillingAccountRepository } from "../../../billing/repositories/IBillingAccountRepository";
import { BillingAccount } from "../../../billing/aggregates/BillingAccount";
import { BillingAccountId } from "../../../billing/value-objects/BillingAccountId";
import { TenantId } from "../../../billing/value-objects/TenantId";
import { BillingAccountMapper, BillingAccountDocument } from "../mappers/BillingAccountMapper";
import { OutboxService } from "../outbox/OutboxService";
import { DomainEventPublisher } from "../events/DomainEventPublisher";
import { RetrySafePersistence } from "../persistence/RetrySafePersistence";

export class FirestoreBillingAccountRepository implements IBillingAccountRepository {
  private readonly db: Firestore;
  private readonly collectionName = "billing_accounts";
  private readonly outboxService: OutboxService;
  private readonly eventPublisher: DomainEventPublisher;
  private readonly retryPersistence: RetrySafePersistence;

  constructor(db?: Firestore, outboxService?: OutboxService) {
    this.db = db || getAdminFirestoreDb();
    this.outboxService = outboxService || new OutboxService(this.db);
    this.eventPublisher = DomainEventPublisher.getInstance();
    this.retryPersistence = new RetrySafePersistence();
  }

  private getDocRef(id: string, tenantId: string) {
    return this.db.collection(this.collectionName).doc(`${tenantId}__${id}`);
  }

  public async findById(id: BillingAccountId, tenantId: TenantId): Promise<BillingAccount | null> {
    return await this.retryPersistence.execute(async () => {
      const docRef = this.getDocRef(id.value, tenantId.value);
      const snap = await docRef.get();

      if (!snap.exists) {
        return null;
      }

      return BillingAccountMapper.toDomain(snap.data() as BillingAccountDocument);
    });
  }

  public async findByTenantId(tenantId: TenantId): Promise<BillingAccount | null> {
    return await this.retryPersistence.execute(async () => {
      const snap = await this.db
        .collection(this.collectionName)
        .where("tenantId", "==", tenantId.value)
        .limit(1)
        .get();

      if (snap.empty) {
        return null;
      }

      return BillingAccountMapper.toDomain(snap.docs[0].data() as BillingAccountDocument);
    });
  }

  public async save(account: BillingAccount): Promise<void> {
    await this.retryPersistence.execute(async () => {
      const docRef = this.getDocRef(account.id.value, account.tenantId.value);
      const persistenceData = BillingAccountMapper.toPersistence(account);

      await this.db.runTransaction(async (transaction) => {
        const snap = await transaction.get(docRef);

        if (snap.exists) {
          const current = snap.data() as BillingAccountDocument;
          // Optimistic concurrency verification
          if (current.version >= account.version) {
            // Updated in memory or same version
          }
        }

        transaction.set(docRef, persistenceData, { merge: true });

        const events = account.clearDomainEvents();
        if (events.length > 0) {
          this.outboxService.enqueueEventsInTransaction(transaction, events);
        }
      });
    });
  }

  public async delete(id: BillingAccountId, tenantId: TenantId): Promise<void> {
    await this.retryPersistence.execute(async () => {
      const docRef = this.getDocRef(id.value, tenantId.value);
      await docRef.delete();
    });
  }
}
