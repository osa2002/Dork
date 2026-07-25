import { Firestore } from "firebase-admin/firestore";
import { getAdminFirestoreDb } from "../db/FirestoreClient";

export type LedgerEntryType = "AUTHORIZATION" | "CAPTURE" | "REFUND" | "ADJUSTMENT" | "FEE" | "CHARGEBACK";

export interface LedgerEntry {
  ledgerId: string;
  tenantId: string;
  billingAccountId: string;
  transactionId: string;
  type: LedgerEntryType;
  amountCents: number;
  currencyCode: string;
  runningBalanceCents: number;
  providerId: string;
  description: string;
  timestamp: string;
}

export class FirestorePaymentLedger {
  private readonly db: Firestore;
  private readonly collectionName = "payment_ledger";

  constructor(db?: Firestore) {
    this.db = db || getAdminFirestoreDb();
  }

  /**
   * Records a ledger transaction atomically and calculates updated running balance for account.
   */
  public async recordTransaction(entry: Omit<LedgerEntry, "ledgerId" | "runningBalanceCents" | "timestamp">): Promise<LedgerEntry> {
    const ledgerId = `ledg_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const createdEntry = await this.db.runTransaction(async (transaction) => {
      // Fetch latest ledger entry to compute running balance
      const query = this.db
        .collection(this.collectionName)
        .where("billingAccountId", "==", entry.billingAccountId)
        .limit(10); // get recent entries to pick latest timestamp

      const snap = await transaction.get(query);

      let previousBalance = 0;
      if (!snap.empty) {
        const sorted = snap.docs.map(d => d.data() as LedgerEntry).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        previousBalance = sorted[0].runningBalanceCents || 0;
      }

      // Calculate balance delta
      let delta = 0;
      if (entry.type === "CAPTURE" || entry.type === "AUTHORIZATION") {
        delta = entry.amountCents;
      } else if (entry.type === "REFUND" || entry.type === "CHARGEBACK" || entry.type === "FEE") {
        delta = -Math.abs(entry.amountCents);
      } else if (entry.type === "ADJUSTMENT") {
        delta = entry.amountCents;
      }

      const newBalance = previousBalance + delta;

      const record: LedgerEntry = {
        ...entry,
        ledgerId,
        runningBalanceCents: newBalance,
        timestamp: now
      };

      const docRef = this.db.collection(this.collectionName).doc(ledgerId);
      transaction.set(docRef, record);

      return record;
    });

    return createdEntry;
  }

  /**
   * Retrieves ledger history for a billing account.
   */
  public async getAccountLedger(billingAccountId: string, limit: number = 50): Promise<LedgerEntry[]> {
    const snap = await this.db
      .collection(this.collectionName)
      .where("billingAccountId", "==", billingAccountId)
      .limit(limit)
      .get();

    return snap.docs
      .map(d => d.data() as LedgerEntry)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}
