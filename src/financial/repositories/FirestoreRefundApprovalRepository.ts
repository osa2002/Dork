import { getAdminFirestoreDb } from "../../infrastructure/billing/db/FirestoreClient";
import { RefundRequest } from "../refunds/RefundApprovalEngine";

export class FirestoreRefundApprovalRepository {
  private readonly db = getAdminFirestoreDb();

  public async saveRefundRequest(request: RefundRequest): Promise<void> {
    const docRef = this.db.collection("tenants").doc(request.tenantId).collection("refund_approval_requests").doc(request.requestId);
    await docRef.set({
      requestId: request.requestId,
      tenantId: request.tenantId,
      paymentIntentId: request.paymentIntentId,
      refundAmountCents: request.refundAmount.amountCents,
      currency: request.refundAmount.currency,
      reason: request.reason,
      requestedByUserId: request.requestedByUserId,
      requestedAtIso: request.requestedAtIso,
      customerTenureDays: request.customerTenureDays,
      customerRiskScore: request.customerRiskScore,
      state: request.state,
      approvalHistory: request.approvalHistory
    });
  }

  public async getRefundRequest(tenantId: string, requestId: string): Promise<RefundRequest | null> {
    const doc = await this.db.collection("tenants").doc(tenantId).collection("refund_approval_requests").doc(requestId).get();
    if (!doc.exists) return null;
    const data = doc.data();
    if (!data) return null;

    return {
      requestId: data.requestId,
      tenantId: data.tenantId,
      paymentIntentId: data.paymentIntentId,
      refundAmount: { amountCents: data.refundAmountCents, currency: data.currency } as any,
      reason: data.reason,
      requestedByUserId: data.requestedByUserId,
      requestedAtIso: data.requestedAtIso,
      customerTenureDays: data.customerTenureDays,
      customerRiskScore: data.customerRiskScore,
      state: data.state,
      approvalHistory: data.approvalHistory || []
    };
  }
}
