import { PaymentIntent } from "../aggregates/PaymentIntent";
import { PaymentIntentId } from "../value-objects/PaymentIntentId";
import { TenantId } from "../value-objects/TenantId";
import { BillingAccountId } from "../value-objects/BillingAccountId";
import { InvoiceId } from "../value-objects/InvoiceId";
import { PaymentMethodId } from "../value-objects/PaymentMethodId";
import { Money } from "../value-objects/Money";
import { Currency } from "../value-objects/Currency";

export interface CreatePaymentIntentParams {
  tenantId: string;
  billingAccountId: string;
  amountCents: number;
  currencyCode?: string;
  invoiceId?: string;
  paymentMethodId?: string;
}

export class PaymentIntentFactory {
  public static create(params: CreatePaymentIntentParams): PaymentIntent {
    const id = new PaymentIntentId(`pi_${crypto.randomUUID()}`);
    const tenantId = new TenantId(params.tenantId);
    const billingAccountId = new BillingAccountId(params.billingAccountId);
    const currency = Currency.fromCode(params.currencyCode || "USD");
    const amount = new Money(params.amountCents, currency);

    const invoiceId = params.invoiceId ? new InvoiceId(params.invoiceId) : undefined;
    const paymentMethodId = params.paymentMethodId ? new PaymentMethodId(params.paymentMethodId) : undefined;

    return new PaymentIntent({
      id,
      tenantId,
      billingAccountId,
      invoiceId,
      amount,
      paymentMethodId
    });
  }
}
