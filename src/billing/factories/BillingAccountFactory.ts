import { BillingAccount } from "../aggregates/BillingAccount";
import { BillingAccountId } from "../value-objects/BillingAccountId";
import { TenantId } from "../value-objects/TenantId";
import { TaxIdentifier, TaxIdentifierType } from "../value-objects/TaxIdentifier";

export interface CreateBillingAccountParams {
  tenantId: string;
  companyName: string;
  billingEmail: string;
  taxNumber?: string;
  taxType?: TaxIdentifierType;
  countryCode?: string;
}

export class BillingAccountFactory {
  public static create(params: CreateBillingAccountParams): BillingAccount {
    const id = new BillingAccountId(`acc_${crypto.randomUUID()}`);
    const tenantId = new TenantId(params.tenantId);

    let taxIdentifier: TaxIdentifier | undefined;
    if (params.taxNumber && params.countryCode) {
      taxIdentifier = new TaxIdentifier(
        params.taxType || "VAT",
        params.taxNumber,
        params.countryCode
      );
    }

    return new BillingAccount({
      id,
      tenantId,
      companyName: params.companyName,
      billingEmail: params.billingEmail,
      taxIdentifier,
      status: "ACTIVE"
    });
  }
}
