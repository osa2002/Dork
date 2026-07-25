import { getAdminFirestoreDb } from "../../infrastructure/billing/db/FirestoreClient";
import { ReconciliationResult } from "../reconciliation/ReconciliationMatchingEngine";

export class FirestoreReconciliationRepository {
  private readonly db = getAdminFirestoreDb();

  public async saveReconciliationResult(result: ReconciliationResult): Promise<void> {
    const docRef = this.db.collection("tenants").doc(result.tenantId).collection("reconciliation_sessions").doc(result.reconciliationId);
    await docRef.set({
      reconciliationId: result.reconciliationId,
      tenantId: result.tenantId,
      providerId: result.providerId,
      totalGrossInternalCents: result.totalGrossInternalCents,
      totalGrossProviderCents: result.totalGrossProviderCents,
      matchedCount: result.matchedCount,
      unmatchedInternalCount: result.unmatchedInternalCount,
      unmatchedProviderCount: result.unmatchedProviderCount,
      discrepanciesCount: result.discrepanciesCount,
      matches: result.matches,
      savedAtIso: new Date().toISOString()
    });
  }

  public async getReconciliationResult(tenantId: string, reconciliationId: string): Promise<ReconciliationResult | null> {
    const doc = await this.db.collection("tenants").doc(tenantId).collection("reconciliation_sessions").doc(reconciliationId).get();
    if (!doc.exists) return null;
    return doc.data() as ReconciliationResult;
  }
}
