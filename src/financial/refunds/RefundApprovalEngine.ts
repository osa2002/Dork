import { CurrencyAmount } from "../value-objects/FinancialValueObjects";

export type RefundApprovalState = "AUTO_APPROVED" | "PENDING_MANAGER_APPROVAL" | "PENDING_EXECUTIVE_APPROVAL" | "APPROVED" | "REJECTED";

export interface RefundRequest {
  requestId: string;
  tenantId: string;
  paymentIntentId: string;
  refundAmount: CurrencyAmount;
  reason: string;
  requestedByUserId: string;
  requestedAtIso: string;
  customerTenureDays: number;
  customerRiskScore: number; // 0-100
  state: RefundApprovalState;
  approvalHistory: Array<{
    approvedByUserId: string;
    approvedAtIso: string;
    role: "MANAGER" | "EXECUTIVE";
    comments?: string;
  }>;
}

export class RefundApprovalEngine {
  private static readonly AUTO_APPROVE_THRESHOLD_CENTS = 10000; // $100.00
  private static readonly EXECUTIVE_APPROVE_THRESHOLD_CENTS = 100000; // $1,000.00

  public evaluateRequest(
    tenantId: string,
    paymentIntentId: string,
    refundAmount: CurrencyAmount,
    reason: string,
    requestedByUserId: string,
    customerTenureDays: number,
    customerRiskScore: number
  ): RefundRequest {
    let initialState: RefundApprovalState = "AUTO_APPROVED";

    if (customerRiskScore >= 75 || refundAmount.amountCents >= RefundApprovalEngine.EXECUTIVE_APPROVE_THRESHOLD_CENTS) {
      initialState = "PENDING_EXECUTIVE_APPROVAL";
    } else if (refundAmount.amountCents > RefundApprovalEngine.AUTO_APPROVE_THRESHOLD_CENTS) {
      initialState = "PENDING_MANAGER_APPROVAL";
    }

    return {
      requestId: `ref_req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tenantId,
      paymentIntentId,
      refundAmount,
      reason,
      requestedByUserId,
      requestedAtIso: new Date().toISOString(),
      customerTenureDays,
      customerRiskScore,
      state: initialState,
      approvalHistory: []
    };
  }

  public approveRequest(
    request: RefundRequest,
    approverUserId: string,
    approverRole: "MANAGER" | "EXECUTIVE",
    comments?: string
  ): RefundRequest {
    if (request.state === "APPROVED" || request.state === "AUTO_APPROVED") {
      throw new Error(`Refund request ${request.requestId} is already approved.`);
    }

    if (request.state === "REJECTED") {
      throw new Error(`Cannot approve previously rejected refund request ${request.requestId}.`);
    }

    if (request.state === "PENDING_EXECUTIVE_APPROVAL" && approverRole !== "EXECUTIVE") {
      throw new Error("Executive authorization required for high-value or high-risk refund approval.");
    }

    const updatedHistory = [
      ...request.approvalHistory,
      {
        approvedByUserId: approverUserId,
        approvedAtIso: new Date().toISOString(),
        role: approverRole,
        comments
      }
    ];

    return {
      ...request,
      state: "APPROVED",
      approvalHistory: updatedHistory
    };
  }

  public rejectRequest(request: RefundRequest, approverUserId: string, comments: string): RefundRequest {
    return {
      ...request,
      state: "REJECTED",
      approvalHistory: [
        ...request.approvalHistory,
        {
          approvedByUserId: approverUserId,
          approvedAtIso: new Date().toISOString(),
          role: "MANAGER",
          comments: `REJECTED: ${comments}`
        }
      ]
    };
  }
}
