import { getAdminFirestoreDb } from "../../infrastructure/billing/db/FirestoreClient";
import { FinancialPeriod } from "../period/PeriodClosingEngine";

export class FirestorePeriodRepository {
  private readonly db = getAdminFirestoreDb();

  public async savePeriod(period: FinancialPeriod): Promise<void> {
    const docRef = this.db.collection("tenants").doc(period.tenantId).collection("financial_periods").doc(period.periodId);
    await docRef.set(period, { merge: true });
  }

  public async getPeriod(tenantId: string, periodId: string): Promise<FinancialPeriod | null> {
    const doc = await this.db.collection("tenants").doc(tenantId).collection("financial_periods").doc(periodId).get();
    if (!doc.exists) return null;
    return doc.data() as FinancialPeriod;
  }
}
