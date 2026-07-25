import { BillingAccount } from "../aggregates/BillingAccount";
import { Subscription } from "../aggregates/Subscription";
import { Invoice } from "../aggregates/Invoice";
import { GracePeriodPolicy } from "../policies/GracePeriodPolicy";
import { RetryPolicy } from "../policies/RetryPolicy";

export class DunningDomainService {
  private readonly _gracePeriodPolicy: GracePeriodPolicy;
  private readonly _retryPolicy: RetryPolicy;

  constructor(
    gracePeriodPolicy: GracePeriodPolicy = new GracePeriodPolicy(14),
    retryPolicy: RetryPolicy = new RetryPolicy([1, 3, 7, 14])
  ) {
    this._gracePeriodPolicy = gracePeriodPolicy;
    this._retryPolicy = retryPolicy;
  }

  public evaluateDunningStatus(
    account: BillingAccount,
    subscription: Subscription,
    overdueInvoice: Invoice,
    firstFailureDate: Date,
    attemptCount: number,
    currentDate: Date = new Date()
  ): {
    shouldRetryPayment: boolean;
    nextRetryDate: Date | null;
    shouldSuspendAccount: boolean;
    recommendedAction: "RETRY" | "SUSPEND" | "WRITE_OFF";
  } {
    const isGraceExceeded = this._gracePeriodPolicy.isGracePeriodExceeded(firstFailureDate, currentDate);
    const isFinalAttempt = this._retryPolicy.isFinalAttemptExceeded(attemptCount);

    if (isGraceExceeded || isFinalAttempt) {
      account.suspend(`Dunning failure after ${attemptCount} attempts and grace period expiration.`);
      subscription.markPastDue();

      return {
        shouldRetryPayment: false,
        nextRetryDate: null,
        shouldSuspendAccount: true,
        recommendedAction: "SUSPEND"
      };
    }

    const nextRetryDate = this._retryPolicy.getNextRetryDate(firstFailureDate, attemptCount + 1);
    account.markDelinquent();
    subscription.markPastDue();

    return {
      shouldRetryPayment: true,
      nextRetryDate,
      shouldSuspendAccount: false,
      recommendedAction: "RETRY"
    };
  }
}
