import { BillingDomainException } from "./BillingDomainException";

export class InsufficientFundsException extends BillingDomainException {
  constructor(message: string = "Insufficient funds for billing transaction", details?: Record<string, any>) {
    super(message, "INSUFFICIENT_FUNDS", details);
  }
}

export class InvalidSubscriptionStateTransitionException extends BillingDomainException {
  constructor(fromState: string, toState: string, reason?: string) {
    const msg = `Invalid subscription state transition from '${fromState}' to '${toState}'.${reason ? ` Reason: ${reason}` : ""}`;
    super(msg, "INVALID_SUBSCRIPTION_STATE_TRANSITION", { fromState, toState, reason });
  }
}

export class InvoiceAlreadyPaidException extends BillingDomainException {
  constructor(invoiceId: string) {
    super(`Invoice '${invoiceId}' is already paid and cannot be modified or re-collected.`, "INVOICE_ALREADY_PAID", { invoiceId });
  }
}

export class PaymentMethodRequiredException extends BillingDomainException {
  constructor(tenantId: string) {
    super(`A valid default payment method is required for tenant '${tenantId}' to perform this action.`, "PAYMENT_METHOD_REQUIRED", { tenantId });
  }
}

export class InvalidMoneyOperationException extends BillingDomainException {
  constructor(message: string, details?: Record<string, any>) {
    super(message, "INVALID_MONEY_OPERATION", details);
  }
}

export class DuplicatePaymentIntentException extends BillingDomainException {
  constructor(intentId: string) {
    super(`A payment intent with ID '${intentId}' already exists.`, "DUPLICATE_PAYMENT_INTENT", { intentId });
  }
}

export class RefundLimitExceededException extends BillingDomainException {
  constructor(requestedAmountCents: number, remainingRefundableCents: number) {
    super(
      `Requested refund amount (${requestedAmountCents} cents) exceeds refundable limit (${remainingRefundableCents} cents).`,
      "REFUND_LIMIT_EXCEEDED",
      { requestedAmountCents, remainingRefundableCents }
    );
  }
}
