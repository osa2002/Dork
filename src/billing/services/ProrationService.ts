import { Money } from "../value-objects/Money";
import { BillingPeriod } from "../value-objects/BillingPeriod";

export interface ProrationCalculationResult {
  unusedCredit: Money;
  newPlanCost: Money;
  netProratedAmount: Money;
  unusedDays: number;
  totalPeriodDays: number;
}

export class ProrationService {
  public calculateProration(
    currentPeriod: BillingPeriod,
    oldUnitPrice: Money,
    oldQuantity: number,
    newUnitPrice: Money,
    newQuantity: number,
    changeDate: Date = new Date()
  ): ProrationCalculationResult {
    const totalDays = currentPeriod.durationInDays();
    if (totalDays <= 0) {
      throw new Error("Invalid period duration for proration calculation.");
    }

    const remainingTime = currentPeriod.endDate.getTime() - changeDate.getTime();
    const unusedDays = Math.max(0, Math.ceil(remainingTime / (1000 * 3600 * 24)));

    const oldTotalCost = oldUnitPrice.multiply(oldQuantity);
    const unusedCreditCents = Math.round((oldTotalCost.amountInCents * unusedDays) / totalDays);
    const unusedCredit = new Money(unusedCreditCents, oldUnitPrice.currency);

    const newTotalCost = newUnitPrice.multiply(newQuantity);
    const newPlanCostCents = Math.round((newTotalCost.amountInCents * unusedDays) / totalDays);
    const newPlanCost = new Money(newPlanCostCents, newUnitPrice.currency);

    const netCents = newPlanCostCents - unusedCreditCents;
    const netProratedAmount = new Money(netCents, newUnitPrice.currency);

    return {
      unusedCredit,
      newPlanCost,
      netProratedAmount,
      unusedDays,
      totalPeriodDays: totalDays
    };
  }
}
