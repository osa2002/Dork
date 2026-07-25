import { Refund, RefundReason, RefundStatus } from "../../../billing/aggregates/Refund";
import { RefundId } from "../../../billing/value-objects/RefundId";
import { TenantId } from "../../../billing/value-objects/TenantId";
import { PaymentIntentId } from "../../../billing/value-objects/PaymentIntentId";
import { InvoiceId } from "../../../billing/value-objects/InvoiceId";
import { Money } from "../../../billing/value-objects/Money";
import { Currency } from "../../../billing/value-objects/Currency";

export interface RefundDocument {
  id: string;
  tenantId: string;
  paymentIntentId: string;
  invoiceId?: string;
  amountCents: number;
  currencyCode: string;
  reason: RefundReason;
  status: RefundStatus;
  requestedAt: string;
  processedAt?: string;
  failureReason?: string;
  version: number;
}

export class RefundMapper {
  public static toPersistence(refund: Refund): RefundDocument {
    return {
      id: refund.id.value,
      tenantId: refund.tenantId.value,
      paymentIntentId: refund.paymentIntentId.value,
      invoiceId: refund.invoiceId?.value,
      amountCents: refund.amount.amountInCents,
      currencyCode: refund.amount.currency.code,
      reason: refund.reason,
      status: refund.status,
      requestedAt: refund.requestedAt.toISOString(),
      processedAt: refund.processedAt?.toISOString(),
      failureReason: refund.failureReason,
      version: refund.version
    };
  }

  public static toDomain(doc: RefundDocument): Refund {
    const currency = Currency.fromCode(doc.currencyCode);

    return new Refund({
      id: new RefundId(doc.id),
      tenantId: new TenantId(doc.tenantId),
      paymentIntentId: new PaymentIntentId(doc.paymentIntentId),
      invoiceId: doc.invoiceId ? new InvoiceId(doc.invoiceId) : undefined,
      amount: new Money(doc.amountCents, currency),
      reason: doc.reason,
      status: doc.status,
      requestedAt: new Date(doc.requestedAt),
      processedAt: doc.processedAt ? new Date(doc.processedAt) : undefined,
      failureReason: doc.failureReason,
      version: doc.version
    });
  }
}
