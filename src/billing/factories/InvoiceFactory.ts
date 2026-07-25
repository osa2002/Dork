import { Invoice } from "../aggregates/Invoice";
import { InvoiceId } from "../value-objects/InvoiceId";
import { TenantId } from "../value-objects/TenantId";
import { BillingAccountId } from "../value-objects/BillingAccountId";
import { InvoiceNumber } from "../value-objects/InvoiceNumber";
import { Currency } from "../value-objects/Currency";
import { InvoiceItem } from "../entities/InvoiceItem";

export interface CreateInvoiceParams {
  tenantId: string;
  billingAccountId: string;
  sequenceNumber: number;
  currencyCode?: string;
  dueDateDays?: number;
  items?: InvoiceItem[];
}

export class InvoiceFactory {
  public static createDraft(params: CreateInvoiceParams): Invoice {
    const id = new InvoiceId(`inv_${crypto.randomUUID()}`);
    const tenantId = new TenantId(params.tenantId);
    const billingAccountId = new BillingAccountId(params.billingAccountId);
    const invoiceNumber = new InvoiceNumber(params.sequenceNumber);
    const currency = Currency.fromCode(params.currencyCode || "USD");

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (params.dueDateDays || 14));

    return new Invoice({
      id,
      tenantId,
      billingAccountId,
      invoiceNumber,
      currency,
      dueDate,
      items: params.items || []
    });
  }
}
