import { Money } from "../value-objects/Money";

export class RefundPolicy {
  private readonly _maxRefundWindowDays: number;

  constructor(maxRefundWindowDays: number = 90) {
    this._maxRefundWindowDays = maxRefundWindowDays;
  }

  public isWithinRefundWindow(originalPaymentDate: Date, currentDate: Date = new Date()): boolean {
    const diff = currentDate.getTime() - originalPaymentDate.getTime();
    const days = diff / (1000 * 3600 * 24);
    return days <= this._maxRefundWindowDays;
  }

  public validateRefundAmount(
    requestedRefund: Money,
    totalCaptured: Money,
    alreadyRefunded: Money
  ): { isValid: boolean; remainingRefundable: Money; errorReason?: string } {
    if (!requestedRefund.currency.equals(totalCaptured.currency)) {
      return { isValid: false, remainingRefundable: Money.zero(totalCaptured.currency), errorReason: "Currency mismatch." };
    }

    const remaining = totalCaptured.subtract(alreadyRefunded);
    if (remaining.isNegative() || remaining.isZero()) {
      return { isValid: false, remainingRefundable: Money.zero(totalCaptured.currency), errorReason: "Payment has already been fully refunded." };
    }

    if (requestedRefund.isGreaterThan(remaining)) {
      return { isValid: false, remainingRefundable: remaining, errorReason: `Requested refund exceeds remaining refundable amount (${remaining.format()}).` };
    }

    return { isValid: true, remainingRefundable: remaining };
  }
}
