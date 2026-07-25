import { Invoice } from "../aggregates/Invoice";
import { InvoiceStatusEnum } from "../value-objects/InvoiceStatus";

export class IsInvoiceOverdueSpecification {
  public isSatisfiedBy(invoice: Invoice, currentDate: Date = new Date()): boolean {
    if (invoice.status.value !== InvoiceStatusEnum.OPEN) {
      return false;
    }
    return currentDate > invoice.dueDate;
  }
}
