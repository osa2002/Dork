import { Subscription } from "../aggregates/Subscription";
import { SubscriptionId } from "../value-objects/SubscriptionId";
import { TenantId } from "../value-objects/TenantId";
import { BillingAccountId } from "../value-objects/BillingAccountId";

export interface ISubscriptionRepository {
  findById(id: SubscriptionId, tenantId: TenantId): Promise<Subscription | null>;
  findActiveByBillingAccountId(billingAccountId: BillingAccountId, tenantId: TenantId): Promise<Subscription | null>;
  findAllByTenantId(tenantId: TenantId): Promise<Subscription[]>;
  save(subscription: Subscription): Promise<void>;
  delete(id: SubscriptionId, tenantId: TenantId): Promise<void>;
}
