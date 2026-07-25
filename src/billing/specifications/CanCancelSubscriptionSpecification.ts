import { Subscription } from "../aggregates/Subscription";
import { SubscriptionStatusEnum } from "../value-objects/SubscriptionStatus";

export class CanCancelSubscriptionSpecification {
  public isSatisfiedBy(subscription: Subscription): boolean {
    const currentStatus = subscription.status.value;
    return currentStatus !== SubscriptionStatusEnum.CANCELED;
  }
}
