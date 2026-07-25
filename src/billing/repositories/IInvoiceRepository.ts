import { Invoice } from "../aggregates/Invoice";
import { InvoiceId } from "../value-objects/InvoiceId";
import { TenantId } from "../value-objects/TenantId";
import { InvoiceNumber } from "../value-objects/InvoiceNumber";
import { InvoiceStatus } from "../value-objects/InvoiceStatus";

export interface IInvoiceRepository {
  findById(id: InvoiceId, tenantId: TenantId): Promise<Invoice | null>;
  findByInvoiceNumber(invoiceNumber: InvoiceNumber, tenantId: TenantId): Promise<Invoice | null>;
  findByTenantId(tenantId: TenantId, status?: InvoiceStatus): Promise<Invoice[]>;
  findOverdueInvoices(asOfDate: Date): Promise<Invoice[]>;
  save(invoice: Invoice): Promise<void>;
  nextInvoiceSequence(prefix: string, year: number): Promise<number>;
}
