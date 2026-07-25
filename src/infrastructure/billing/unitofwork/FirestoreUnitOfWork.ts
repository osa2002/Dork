import { Firestore, Transaction } from "firebase-admin/firestore";
import { getAdminFirestoreDb } from "../db/FirestoreClient";
import { OutboxService } from "../outbox/OutboxService";
import { DomainEventPublisher } from "../events/DomainEventPublisher";
import { FirestoreAuditTrail } from "../audit/FirestoreAuditTrail";
import { OptimisticConcurrencyHandler } from "../concurrency/OptimisticConcurrencyHandler";
import { BillingAccount } from "../../../billing/aggregates/BillingAccount";
import { Subscription } from "../../../billing/aggregates/Subscription";
import { Invoice } from "../../../billing/aggregates/Invoice";
import { PaymentIntent } from "../../../billing/aggregates/PaymentIntent";
import { Refund } from "../../../billing/aggregates/Refund";
import { BillingAccountMapper } from "../mappers/BillingAccountMapper";
import { SubscriptionMapper } from "../mappers/SubscriptionMapper";
import { InvoiceMapper } from "../mappers/InvoiceMapper";
import { PaymentIntentMapper } from "../mappers/PaymentIntentMapper";
import { RefundMapper } from "../mappers/RefundMapper";
import { DomainEvent } from "../../../billing/domain-events/DomainEvent";

type AggregateType = BillingAccount | Subscription | Invoice | PaymentIntent | Refund;

export class FirestoreUnitOfWork {
  private readonly db: Firestore;
  private readonly outboxService: OutboxService;
  private readonly auditTrail: FirestoreAuditTrail;
  private readonly eventPublisher: DomainEventPublisher;

  private newAggregates: Set<AggregateType> = new Set();
  private dirtyAggregates: Set<AggregateType> = new Set();
  private deletedAggregates: Set<AggregateType> = new Set();

  constructor(
    db?: Firestore,
    outboxService?: OutboxService,
    auditTrail?: FirestoreAuditTrail,
    eventPublisher?: DomainEventPublisher
  ) {
    this.db = db || getAdminFirestoreDb();
    this.outboxService = outboxService || new OutboxService(this.db);
    this.auditTrail = auditTrail || new FirestoreAuditTrail(this.db);
    this.eventPublisher = eventPublisher || DomainEventPublisher.getInstance();
  }

  public registerNew(aggregate: AggregateType): void {
    this.newAggregates.add(aggregate);
  }

  public registerDirty(aggregate: AggregateType): void {
    this.dirtyAggregates.add(aggregate);
  }

  public registerDeleted(aggregate: AggregateType): void {
    this.deletedAggregates.add(aggregate);
  }

  /**
   * Commits all registered changes atomically inside a single Firestore native transaction.
   */
  public async commit(): Promise<void> {
    const collectedEvents: DomainEvent[] = [];

    await this.db.runTransaction(async (transaction: Transaction) => {
      // 1. Process New Aggregates
      for (const agg of this.newAggregates) {
        const { docRef, payload, name } = this.resolveMapperAndRef(agg);
        transaction.set(docRef, payload, { merge: true });
        collectedEvents.push(...agg.clearDomainEvents());
      }

      // 2. Process Dirty Aggregates (with Optimistic Concurrency check)
      for (const agg of this.dirtyAggregates) {
        const { docRef, payload } = this.resolveMapperAndRef(agg);
        await OptimisticConcurrencyHandler.validateAndStageWrite(transaction, docRef, payload);
        collectedEvents.push(...agg.clearDomainEvents());
      }

      // 3. Process Deleted Aggregates
      for (const agg of this.deletedAggregates) {
        const { docRef } = this.resolveMapperAndRef(agg);
        transaction.delete(docRef);
        collectedEvents.push(...agg.clearDomainEvents());
      }

      // 4. Enqueue Domain Events into Outbox inside same transaction
      if (collectedEvents.length > 0) {
        this.outboxService.enqueueEventsInTransaction(transaction, collectedEvents);
      }
    });

    // 5. Post-commit: Publish events & clear staged state
    await this.eventPublisher.publishAll(collectedEvents);
    this.clearState();
  }

  public clearState(): void {
    this.newAggregates.clear();
    this.dirtyAggregates.clear();
    this.deletedAggregates.clear();
  }

  private resolveMapperAndRef(agg: AggregateType): { docRef: any; payload: any; name: string } {
    if (agg instanceof BillingAccount) {
      const payload = BillingAccountMapper.toPersistence(agg);
      const docRef = this.db.collection("billing_accounts").doc(`${agg.tenantId.value}__${agg.id.value}`);
      return { docRef, payload, name: "BillingAccount" };
    }
    if (agg instanceof Subscription) {
      const payload = SubscriptionMapper.toPersistence(agg);
      const docRef = this.db.collection("subscriptions").doc(`${agg.tenantId.value}__${agg.id.value}`);
      return { docRef, payload, name: "Subscription" };
    }
    if (agg instanceof Invoice) {
      const payload = InvoiceMapper.toPersistence(agg);
      const docRef = this.db.collection("invoices").doc(`${agg.tenantId.value}__${agg.id.value}`);
      return { docRef, payload, name: "Invoice" };
    }
    if (agg instanceof PaymentIntent) {
      const payload = PaymentIntentMapper.toPersistence(agg);
      const docRef = this.db.collection("payment_intents").doc(`${agg.tenantId.value}__${agg.id.value}`);
      return { docRef, payload, name: "PaymentIntent" };
    }
    if (agg instanceof Refund) {
      const payload = RefundMapper.toPersistence(agg);
      const docRef = this.db.collection("refunds").doc(`${agg.tenantId.value}__${agg.id.value}`);
      return { docRef, payload, name: "Refund" };
    }
    throw new Error("Unknown aggregate type registered in UnitOfWork.");
  }
}
