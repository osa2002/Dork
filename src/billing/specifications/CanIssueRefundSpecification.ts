import { PaymentIntent } from "../aggregates/PaymentIntent";
import { Refund } from "../aggregates/Refund";
import { Money } from "../value-objects/Money";
import { PaymentStatusEnum } from "../value-objects/PaymentStatus";

export class CanIssueRefundSpecification {
  public isSatisfiedBy(
    paymentIntent: PaymentIntent,
    requestedRefund: Money,
    existingRefunds: Refund[]
  ): { canRefund: boolean; reason?: string } {
    if (paymentIntent.status.value !== PaymentStatusEnum.SUCCEEDED) {
      return { canRefund: false, reason: "PaymentIntent has not succeeded." };
    }

    let refundedCents = 0;
    for (const ref of existingRefunds) {
      if (ref.status === "SUCCEEDED" || ref.status === "PENDING") {
        refundedCents += ref.amount.amountInCents;
      }
    }

    const totalCaptured = paymentIntent.amount;
    const remainingCents = totalCaptured.amountInCents - refundedCents;

    if (requestedRefund.amountInCents > remainingCents) {
      return {
        canRefund: false,
        reason: `Requested refund amount exceeds remaining refundable balance (${remainingCents} cents).`
      };
    }

    return { canRefund: true };
  }
}
