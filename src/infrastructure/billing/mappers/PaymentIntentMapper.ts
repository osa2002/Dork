import { PaymentIntent } from "../../../billing/aggregates/PaymentIntent";
import { PaymentIntentId } from "../../../billing/value-objects/PaymentIntentId";
import { TenantId } from "../../../billing/value-objects/TenantId";
import { BillingAccountId } from "../../../billing/value-objects/BillingAccountId";
import { InvoiceId } from "../../../billing/value-objects/InvoiceId";
import { PaymentMethodId } from "../../../billing/value-objects/PaymentMethodId";
import { PaymentStatus } from "../../../billing/value-objects/PaymentStatus";
import { Money } from "../../../billing/value-objects/Money";
import { Currency } from "../../../billing/value-objects/Currency";

export interface PaymentIntentDocument {
  id: string;
  tenantId: string;
  billingAccountId: string;
  invoiceId?: string;
  amountCents: number;
  currencyCode: string;
  status: string;
  paymentMethodId?: string;
  clientSecretReference: string;
  failureReason?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export class PaymentIntentMapper {
  public static toPersistence(intent: PaymentIntent): PaymentIntentDocument {
    return {
      id: intent.id.value,
      tenantId: intent.tenantId.value,
      billingAccountId: intent.billingAccountId.value,
      invoiceId: intent.invoiceId?.value,
      amountCents: intent.amount.amountInCents,
      currencyCode: intent.amount.currency.code,
      status: intent.status.value,
      paymentMethodId: intent.paymentMethodId?.value,
      clientSecretReference: intent.clientSecretReference,
      failureReason: intent.failureReason,
      version: intent.version,
      createdAt: intent.createdAt.toISOString(),
      updatedAt: intent.updatedAt.toISOString()
    };
  }

  public static toDomain(doc: PaymentIntentDocument): PaymentIntent {
    const currency = Currency.fromCode(doc.currencyCode);

    return new PaymentIntent({
      id: new PaymentIntentId(doc.id),
      tenantId: new TenantId(doc.tenantId),
      billingAccountId: new BillingAccountId(doc.billingAccountId),
      invoiceId: doc.invoiceId ? new InvoiceId(doc.invoiceId) : undefined,
      amount: new Money(doc.amountCents, currency),
      status: new PaymentStatus(doc.status as any),
      paymentMethodId: doc.paymentMethodId ? new PaymentMethodId(doc.paymentMethodId) : undefined,
      clientSecretReference: doc.clientSecretReference,
      failureReason: doc.failureReason,
      version: doc.version,
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt)
    });
  }
}
