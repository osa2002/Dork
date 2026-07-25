import { getAdminFirestoreDb } from "../../infrastructure/billing/db/FirestoreClient";
import { RevenueContract, RecognitionScheduleEntry } from "../revenue/RevenueRecognitionEngine";

export class FirestoreRevenueRepository {
  private readonly db = getAdminFirestoreDb();

  public async saveContractAndSchedule(
    contract: RevenueContract,
    schedule: RecognitionScheduleEntry[]
  ): Promise<void> {
    const contractRef = this.db.collection("tenants").doc(contract.tenantId).collection("revenue_contracts").doc(contract.contractId);
    
    const batch = this.db.batch();

    batch.set(contractRef, {
      contractId: contract.contractId,
      tenantId: contract.tenantId,
      customerId: contract.customerId,
      totalTransactionPriceCents: contract.totalTransactionPrice.amountCents,
      currency: contract.currency,
      createdAtIso: contract.createdAtIso,
      obligations: contract.obligations.map(o => ({
        obligationId: o.obligationId,
        description: o.description,
        standalonePriceCents: o.standalonePrice.amountCents,
        allocatedPriceCents: o.allocatedPrice.amountCents,
        method: o.method,
        startDateIso: o.startDateIso,
        endDateIso: o.endDateIso,
        satisfiedPercentage: o.satisfiedPercentage,
        recognizedAmountCents: o.recognizedAmountCents,
        deferredAmountCents: o.deferredAmountCents
      }))
    });

    for (const entry of schedule) {
      const scheduleRef = contractRef.collection("schedules").doc(`${entry.periodId}_${entry.obligationId}`);
      batch.set(scheduleRef, entry);
    }

    await batch.commit();
  }

  public async getContract(tenantId: string, contractId: string): Promise<RevenueContract | null> {
    const doc = await this.db.collection("tenants").doc(tenantId).collection("revenue_contracts").doc(contractId).get();
    if (!doc.exists) return null;
    return doc.data() as RevenueContract;
  }
}
