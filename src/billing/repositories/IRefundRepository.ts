import { Refund } from "../aggregates/Refund";
import { RefundId } from "../value-objects/RefundId";
import { TenantId } from "../value-objects/TenantId";
import { PaymentIntentId } from "../value-objects/PaymentIntentId";

export interface IRefundRepository {
  findById(id: RefundId, tenantId: TenantId): Promise<Refund | null>;
  findByPaymentIntentId(paymentIntentId: PaymentIntentId, tenantId: TenantId): Promise<Refund[]>;
  save(refund: Refund): Promise<void>;
}
