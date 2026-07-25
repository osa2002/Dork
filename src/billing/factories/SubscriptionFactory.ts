import { Subscription } from "../aggregates/Subscription";
import { SubscriptionId } from "../value-objects/SubscriptionId";
import { TenantId } from "../value-objects/TenantId";
import { BillingAccountId } from "../value-objects/BillingAccountId";
import { SubscriptionStatus, SubscriptionStatusEnum } from "../value-objects/SubscriptionStatus";
import { BillingPeriod, BillingInterval } from "../value-objects/BillingPeriod";
import { Money } from "../value-objects/Money";
import { Currency } from "../value-objects/Currency";

export interface CreateSubscriptionParams {
  tenantId: string;
  billingAccountId: string;
  planId: string;
  unitPriceCents: number;
  currencyCode?: string;
  quantity?: number;
  interval?: BillingInterval;
  trialDays?: number;
}

export class SubscriptionFactory {
  public static create(params: CreateSubscriptionParams): Subscription {
    const id = new SubscriptionId(`sub_${crypto.randomUUID()}`);
    const tenantId = new TenantId(params.tenantId);
    const billingAccountId = new BillingAccountId(params.billingAccountId);
    const currency = Currency.fromCode(params.currencyCode || "USD");
    const unitPrice = new Money(params.unitPriceCents, currency);

    const now = new Date();
    let trialEndsAt: Date | undefined;
    let periodStartDate = now;

    if (params.trialDays && params.trialDays > 0) {
      trialEndsAt = new Date(now.getTime());
      trialEndsAt.setDate(trialEndsAt.getDate() + params.trialDays);
    }

    const interval = params.interval || "MONTHLY";
    const periodEndDate = new Date(periodStartDate.getTime());
    if (interval === "ANNUALLY") {
      periodEndDate.setFullYear(periodEndDate.getFullYear() + 1);
    } else {
      periodEndDate.setMonth(periodEndDate.getMonth() + 1);
    }

    const currentPeriod = new BillingPeriod(periodStartDate, periodEndDate, interval);
    const status = trialEndsAt
      ? new SubscriptionStatus(SubscriptionStatusEnum.TRIALING)
      : new SubscriptionStatus(SubscriptionStatusEnum.ACTIVE);

    return new Subscription({
      id,
      tenantId,
      billingAccountId,
      planId: params.planId,
      status,
      currentPeriod,
      quantity: params.quantity || 1,
      unitPrice,
      trialEndsAt
    });
  }
}
