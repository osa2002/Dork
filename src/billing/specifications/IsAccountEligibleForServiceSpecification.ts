import { BillingAccount } from "../aggregates/BillingAccount";
import { Subscription } from "../aggregates/Subscription";

export class IsAccountEligibleForServiceSpecification {
  public isSatisfiedBy(account: BillingAccount, subscription?: Subscription | null): boolean {
    if (account.status !== "ACTIVE" && account.status !== "DELINQUENT") {
      return false;
    }

    if (!subscription) {
      return false;
    }

    return subscription.status.isCanAccessServices();
  }
}
