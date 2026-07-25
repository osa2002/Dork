import { Invoice } from "../../../billing/aggregates/Invoice";
import { InvoiceId } from "../../../billing/value-objects/InvoiceId";
import { TenantId } from "../../../billing/value-objects/TenantId";
import { BillingAccountId } from "../../../billing/value-objects/BillingAccountId";
import { InvoiceNumber } from "../../../billing/value-objects/InvoiceNumber";
import { InvoiceStatus } from "../../../billing/value-objects/InvoiceStatus";
import { Currency } from "../../../billing/value-objects/Currency";
import { Money } from "../../../billing/value-objects/Money";
import { InvoiceItem } from "../../../billing/entities/InvoiceItem";

export interface InvoiceItemDocument {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRatePercent: number;
  category: "SUBSCRIPTION" | "USAGE" | "ONE_TIME" | "TAX" | "CREDIT";
  periodStart?: string;
  periodEnd?: string;
}

export interface InvoiceDocument {
  id: string;
  tenantId: string;
  billingAccountId: string;
  invoiceNumber: string;
  status: string;
  currencyCode: string;
  items: InvoiceItemDocument[];
  dueDate: string;
  paidAt?: string;
  voidedAt?: string;
  amountPaidCents: number;
  paymentAttemptCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export class InvoiceMapper {
  public static toPersistence(invoice: Invoice): InvoiceDocument {
    return {
      id: invoice.id.value,
      tenantId: invoice.tenantId.value,
      billingAccountId: invoice.billingAccountId.value,
      invoiceNumber: invoice.invoiceNumber.formatted,
      status: invoice.status.value,
      currencyCode: invoice.currency.code,
      items: invoice.items.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPrice.amountInCents,
        taxRatePercent: item.taxRatePercent,
        category: item.category as any,
        periodStart: item.periodStart?.toISOString(),
        periodEnd: item.periodEnd?.toISOString()
      })),
      dueDate: invoice.dueDate.toISOString(),
      paidAt: invoice.paidAt?.toISOString(),
      voidedAt: invoice.voidedAt?.toISOString(),
      amountPaidCents: invoice.amountPaid.amountInCents,
      paymentAttemptCount: invoice.paymentAttemptCount,
      version: invoice.version,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString()
    };
  }

  public static toDomain(doc: InvoiceDocument): Invoice {
    const currency = Currency.fromCode(doc.currencyCode);

    const items = (doc.items || []).map(
      itemDoc =>
        new InvoiceItem({
          id: itemDoc.id,
          description: itemDoc.description,
          quantity: itemDoc.quantity,
          unitPrice: new Money(itemDoc.unitPriceCents, currency),
          taxRatePercent: itemDoc.taxRatePercent,
          category: itemDoc.category,
          periodStart: itemDoc.periodStart ? new Date(itemDoc.periodStart) : undefined,
          periodEnd: itemDoc.periodEnd ? new Date(itemDoc.periodEnd) : undefined
        })
    );

    return new Invoice({
      id: new InvoiceId(doc.id),
      tenantId: new TenantId(doc.tenantId),
      billingAccountId: new BillingAccountId(doc.billingAccountId),
      invoiceNumber: InvoiceNumber.parse(doc.invoiceNumber),
      status: new InvoiceStatus(doc.status as any),
      currency,
      items,
      dueDate: new Date(doc.dueDate),
      paidAt: doc.paidAt ? new Date(doc.paidAt) : undefined,
      voidedAt: doc.voidedAt ? new Date(doc.voidedAt) : undefined,
      amountPaid: new Money(doc.amountPaidCents, currency),
      paymentAttemptCount: doc.paymentAttemptCount,
      version: doc.version,
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt)
    });
  }
}
