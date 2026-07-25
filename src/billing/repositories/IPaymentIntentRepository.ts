import { PaymentIntent } from "../aggregates/PaymentIntent";
import { PaymentIntentId } from "../value-objects/PaymentIntentId";
import { TenantId } from "../value-objects/TenantId";
import { InvoiceId } from "../value-objects/InvoiceId";

export interface IPaymentIntentRepository {
  findById(id: PaymentIntentId, tenantId: TenantId): Promise<PaymentIntent | null>;
  findByInvoiceId(invoiceId: InvoiceId, tenantId: TenantId): Promise<PaymentIntent[]>;
  save(paymentIntent: PaymentIntent): Promise<void>;
}
