import { BillingAccount } from "../aggregates/BillingAccount";
import { BillingAccountId } from "../value-objects/BillingAccountId";
import { TenantId } from "../value-objects/TenantId";

export interface IBillingAccountRepository {
  findById(id: BillingAccountId, tenantId: TenantId): Promise<BillingAccount | null>;
  findByTenantId(tenantId: TenantId): Promise<BillingAccount | null>;
  save(account: BillingAccount): Promise<void>;
  delete(id: BillingAccountId, tenantId: TenantId): Promise<void>;
}
