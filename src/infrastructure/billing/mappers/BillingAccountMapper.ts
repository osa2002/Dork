import { BillingAccount, BillingAccountStatus } from "../../../billing/aggregates/BillingAccount";
import { BillingAccountId } from "../../../billing/value-objects/BillingAccountId";
import { TenantId } from "../../../billing/value-objects/TenantId";
import { TaxIdentifier, TaxIdentifierType } from "../../../billing/value-objects/TaxIdentifier";
import { PaymentMethod, PaymentMethodType } from "../../../billing/entities/PaymentMethod";
import { PaymentMethodId } from "../../../billing/value-objects/PaymentMethodId";

export interface BillingAccountDocument {
  id: string;
  tenantId: string;
  companyName: string;
  billingEmail: string;
  status: BillingAccountStatus;
  taxIdentifier?: {
    type: TaxIdentifierType;
    number: string;
    countryCode: string;
  };
  paymentMethods: Array<{
    id: string;
    type: PaymentMethodType;
    isDefault: boolean;
    last4: string;
    brand: string;
    expiryMonth?: number;
    expiryYear?: number;
    billingDetails: {
      name: string;
      email: string;
      addressLine1?: string;
      city?: string;
      country: string;
      postalCode?: string;
    };
    providerReferenceId: string;
    createdAt: string;
  }>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export class BillingAccountMapper {
  public static toPersistence(account: BillingAccount): BillingAccountDocument {
    return {
      id: account.id.value,
      tenantId: account.tenantId.value,
      companyName: account.companyName,
      billingEmail: account.billingEmail,
      status: account.status,
      taxIdentifier: account.taxIdentifier
        ? {
            type: account.taxIdentifier.type,
            number: account.taxIdentifier.value,
            countryCode: account.taxIdentifier.countryCode
          }
        : undefined,
      paymentMethods: account.paymentMethods.map(pm => ({
        id: pm.id.value,
        type: pm.type,
        isDefault: pm.isDefault,
        last4: pm.last4,
        brand: pm.brand,
        expiryMonth: pm.expiryMonth,
        expiryYear: pm.expiryYear,
        billingDetails: pm.billingDetails,
        providerReferenceId: pm.providerReferenceId,
        createdAt: pm.createdAt.toISOString()
      })),
      version: account.version,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString()
    };
  }

  public static toDomain(doc: BillingAccountDocument): BillingAccount {
    const paymentMethods = (doc.paymentMethods || []).map(
      pm =>
        new PaymentMethod({
          id: new PaymentMethodId(pm.id),
          type: pm.type,
          isDefault: pm.isDefault,
          last4: pm.last4,
          brand: pm.brand,
          expiryMonth: pm.expiryMonth,
          expiryYear: pm.expiryYear,
          billingDetails: pm.billingDetails,
          providerReferenceId: pm.providerReferenceId,
          createdAt: new Date(pm.createdAt)
        })
    );

    let taxIdentifier: TaxIdentifier | undefined;
    if (doc.taxIdentifier) {
      taxIdentifier = new TaxIdentifier(
        doc.taxIdentifier.type,
        doc.taxIdentifier.number,
        doc.taxIdentifier.countryCode
      );
    }

    return new BillingAccount({
      id: new BillingAccountId(doc.id),
      tenantId: new TenantId(doc.tenantId),
      companyName: doc.companyName,
      billingEmail: doc.billingEmail,
      status: doc.status,
      taxIdentifier,
      paymentMethods,
      version: doc.version,
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt)
    });
  }
}
