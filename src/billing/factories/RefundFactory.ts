import { Refund, RefundReason } from "../aggregates/Refund";
import { RefundId } from "../value-objects/RefundId";
import { TenantId } from "../value-objects/TenantId";
import { PaymentIntentId } from "../value-objects/PaymentIntentId";
import { InvoiceId } from "../value-objects/InvoiceId";
import { Money } from "../value-objects/Money";
import { Currency } from "../value-objects/Currency";

export interface CreateRefundParams {
  tenantId: string;
  paymentIntentId: string;
  amountCents: number;
  currencyCode?: string;
  reason: RefundReason;
  invoiceId?: string;
}

export class RefundFactory {
  public static create(params: CreateRefundParams): Refund {
    const id = new RefundId(`re_${crypto.randomUUID()}`);
    const tenantId = new TenantId(params.tenantId);
    const paymentIntentId = new PaymentIntentId(params.paymentIntentId);
    const currency = Currency.fromCode(params.currencyCode || "USD");
    const amount = new Money(params.amountCents, currency);
    const invoiceId = params.invoiceId ? new InvoiceId(params.invoiceId) : undefined;

    return new Refund({
      id,
      tenantId,
      paymentIntentId,
      invoiceId,
      amount,
      reason: params.reason
    });
  }
}
