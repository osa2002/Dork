import { Subscription } from "../../../billing/aggregates/Subscription";
import { SubscriptionId } from "../../../billing/value-objects/SubscriptionId";
import { TenantId } from "../../../billing/value-objects/TenantId";
import { BillingAccountId } from "../../../billing/value-objects/BillingAccountId";
import { SubscriptionStatus } from "../../../billing/value-objects/SubscriptionStatus";
import { BillingPeriod } from "../../../billing/value-objects/BillingPeriod";
import { Money } from "../../../billing/value-objects/Money";
import { Currency } from "../../../billing/value-objects/Currency";
import { Discount } from "../../../billing/entities/Discount";

export interface SubscriptionDocument {
  id: string;
  tenantId: string;
  billingAccountId: string;
  planId: string;
  status: string;
  currentPeriod: {
    startDate: string;
    endDate: string;
  };
  quantity: number;
  unitPrice: {
    amountInCents: number;
    currencyCode: string;
  };
  discount?: {
    id: string;
    code: string;
    percentageOff?: number;
    amountOff?: {
      amountInCents: number;
      currencyCode: string;
    };
    expiresAt?: string;
    isActive: boolean;
  };
  trialEndsAt?: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export class SubscriptionMapper {
  public static toPersistence(subscription: Subscription): SubscriptionDocument {
    return {
      id: subscription.id.value,
      tenantId: subscription.tenantId.value,
      billingAccountId: subscription.billingAccountId.value,
      planId: subscription.planId,
      status: subscription.status.value,
      currentPeriod: {
        startDate: subscription.currentPeriod.startDate.toISOString(),
        endDate: subscription.currentPeriod.endDate.toISOString()
      },
      quantity: subscription.quantity,
      unitPrice: {
        amountInCents: subscription.unitPrice.amountInCents,
        currencyCode: subscription.unitPrice.currency.code
      },
      discount: subscription.discount
        ? {
            id: subscription.discount.id,
            code: subscription.discount.code,
            percentageOff: subscription.discount.percentageOff,
            amountOff: subscription.discount.amountOff
              ? {
                  amountInCents: subscription.discount.amountOff.amountInCents,
                  currencyCode: subscription.discount.amountOff.currency.code
                }
              : undefined,
            expiresAt: subscription.discount.expiresAt?.toISOString(),
            isActive: subscription.discount.isActive
          }
        : undefined,
      trialEndsAt: subscription.trialEndsAt?.toISOString(),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      canceledAt: subscription.canceledAt?.toISOString(),
      version: subscription.version,
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString()
    };
  }

  public static toDomain(doc: SubscriptionDocument): Subscription {
    let discount: Discount | undefined;
    if (doc.discount) {
      discount = new Discount({
        id: doc.discount.id,
        code: doc.discount.code,
        percentageOff: doc.discount.percentageOff,
        amountOff: doc.discount.amountOff
          ? new Money(doc.discount.amountOff.amountInCents, Currency.fromCode(doc.discount.amountOff.currencyCode))
          : undefined,
        expiresAt: doc.discount.expiresAt ? new Date(doc.discount.expiresAt) : undefined,
        isActive: doc.discount.isActive
      });
    }

    return new Subscription({
      id: new SubscriptionId(doc.id),
      tenantId: new TenantId(doc.tenantId),
      billingAccountId: new BillingAccountId(doc.billingAccountId),
      planId: doc.planId,
      status: new SubscriptionStatus(doc.status as any),
      currentPeriod: new BillingPeriod(new Date(doc.currentPeriod.startDate), new Date(doc.currentPeriod.endDate)),
      quantity: doc.quantity,
      unitPrice: new Money(doc.unitPrice.amountInCents, Currency.fromCode(doc.unitPrice.currencyCode)),
      discount,
      trialEndsAt: doc.trialEndsAt ? new Date(doc.trialEndsAt) : undefined,
      cancelAtPeriodEnd: doc.cancelAtPeriodEnd,
      canceledAt: doc.canceledAt ? new Date(doc.canceledAt) : undefined,
      version: doc.version,
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt)
    });
  }
}
