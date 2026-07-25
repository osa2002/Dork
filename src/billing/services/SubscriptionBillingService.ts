import { Subscription } from "../aggregates/Subscription";
import { BillingAccount } from "../aggregates/BillingAccount";
import { Invoice } from "../aggregates/Invoice";
import { InvoiceId } from "../value-objects/InvoiceId";
import { InvoiceNumber } from "../value-objects/InvoiceNumber";
import { InvoiceItem } from "../entities/InvoiceItem";
import { TaxDomainService } from "./TaxDomainService";

export class SubscriptionBillingService {
  private readonly _taxService: TaxDomainService;

  constructor(taxService: TaxDomainService = new TaxDomainService()) {
    this._taxService = taxService;
  }

  public generateSubscriptionInvoice(
    invoiceId: InvoiceId,
    invoiceNumber: InvoiceNumber,
    subscription: Subscription,
    account: BillingAccount,
    dueDate: Date
  ): Invoice {
    account.assertCanBeBilled();

    const recurringPrice = subscription.unitPrice;
    const country = account.taxIdentifier?.countryCode || "US";
    const taxCalc = this._taxService.calculateTax(subscription.recurringTotal, country, account.taxIdentifier);

    const invoiceItem = new InvoiceItem({
      id: `item_${crypto.randomUUID()}`,
      description: `Subscription Fee - Plan ${subscription.planId} (${subscription.quantity} seat/s)`,
      quantity: subscription.quantity,
      unitPrice: subscription.unitPrice,
      taxRatePercent: taxCalc.taxRatePercent,
      category: "SUBSCRIPTION",
      periodStart: subscription.currentPeriod.startDate,
      periodEnd: subscription.currentPeriod.endDate
    });

    const invoice = new Invoice({
      id: invoiceId,
      tenantId: subscription.tenantId,
      billingAccountId: account.id,
      invoiceNumber: invoiceNumber,
      currency: recurringPrice.currency,
      dueDate: dueDate,
      items: [invoiceItem]
    });

    invoice.finalizeDraft();
    return invoice;
  }
}
