import { Firestore } from "firebase-admin/firestore";
import { getAdminFirestoreDb } from "../db/FirestoreClient";
import { IInvoiceRepository } from "../../../billing/repositories/IInvoiceRepository";
import { Invoice } from "../../../billing/aggregates/Invoice";
import { InvoiceId } from "../../../billing/value-objects/InvoiceId";
import { TenantId } from "../../../billing/value-objects/TenantId";
import { InvoiceNumber } from "../../../billing/value-objects/InvoiceNumber";
import { InvoiceStatus } from "../../../billing/value-objects/InvoiceStatus";
import { InvoiceMapper, InvoiceDocument } from "../mappers/InvoiceMapper";
import { OutboxService } from "../outbox/OutboxService";
import { RetrySafePersistence } from "../persistence/RetrySafePersistence";

export class FirestoreInvoiceRepository implements IInvoiceRepository {
  private readonly db: Firestore;
  private readonly collectionName = "invoices";
  private readonly sequenceCollection = "invoice_sequences";
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

  public async findById(id: InvoiceId, tenantId: TenantId): Promise<Invoice | null> {
    return await this.retryPersistence.execute(async () => {
      const docRef = this.getDocRef(id.value, tenantId.value);
      const snap = await docRef.get();

      if (!snap.exists) {
        return null;
      }

      return InvoiceMapper.toDomain(snap.data() as InvoiceDocument);
    });
  }

  public async findByInvoiceNumber(invoiceNumber: InvoiceNumber, tenantId: TenantId): Promise<Invoice | null> {
    return await this.retryPersistence.execute(async () => {
      const snap = await this.db
        .collection(this.collectionName)
        .where("tenantId", "==", tenantId.value)
        .where("invoiceNumber", "==", invoiceNumber.formatted)
        .limit(1)
        .get();

      if (snap.empty) {
        return null;
      }

      return InvoiceMapper.toDomain(snap.docs[0].data() as InvoiceDocument);
    });
  }

  public async findByTenantId(tenantId: TenantId, status?: InvoiceStatus): Promise<Invoice[]> {
    return await this.retryPersistence.execute(async () => {
      let query: any = this.db.collection(this.collectionName).where("tenantId", "==", tenantId.value);

      if (status) {
        query = query.where("status", "==", status.value);
      }

      const snap = await query.get();
      return snap.docs.map((doc: any) => InvoiceMapper.toDomain(doc.data() as InvoiceDocument));
    });
  }

  public async findOverdueInvoices(asOfDate: Date): Promise<Invoice[]> {
    return await this.retryPersistence.execute(async () => {
      const snap = await this.db
        .collection(this.collectionName)
        .where("status", "==", "OPEN")
        .where("dueDate", "<", asOfDate.toISOString())
        .get();

      return snap.docs.map(doc => InvoiceMapper.toDomain(doc.data() as InvoiceDocument));
    });
  }

  public async save(invoice: Invoice): Promise<void> {
    await this.retryPersistence.execute(async () => {
      const docRef = this.getDocRef(invoice.id.value, invoice.tenantId.value);
      const persistenceData = InvoiceMapper.toPersistence(invoice);

      await this.db.runTransaction(async (transaction) => {
        transaction.set(docRef, persistenceData, { merge: true });

        const events = invoice.clearDomainEvents();
        if (events.length > 0) {
          this.outboxService.enqueueEventsInTransaction(transaction, events);
        }
      });
    });
  }

  public async nextInvoiceSequence(prefix: string, year: number): Promise<number> {
    const seqDocRef = this.db.collection(this.sequenceCollection).doc(`${prefix}_${year}`);

    return await this.db.runTransaction(async (transaction) => {
      const snap = await transaction.get(seqDocRef);
      let nextSeq = 1;

      if (snap.exists) {
        nextSeq = (snap.data()?.currentSequence || 0) + 1;
      }

      transaction.set(seqDocRef, { prefix, year, currentSequence: nextSeq, updatedAt: new Date().toISOString() });
      return nextSeq;
    });
  }
}
