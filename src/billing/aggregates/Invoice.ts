import { InvoiceId } from "../value-objects/InvoiceId";
import { TenantId } from "../value-objects/TenantId";
import { BillingAccountId } from "../value-objects/BillingAccountId";
import { InvoiceNumber } from "../value-objects/InvoiceNumber";
import { InvoiceStatus, InvoiceStatusEnum } from "../value-objects/InvoiceStatus";
import { Currency } from "../value-objects/Currency";
import { Money } from "../value-objects/Money";
import { InvoiceItem } from "../entities/InvoiceItem";
import { DomainEvent } from "../domain-events/DomainEvent";
import { InvoiceGeneratedEvent, InvoicePaidEvent, InvoicePaymentFailedEvent } from "../domain-events/BillingEvents";
import { InvoiceAlreadyPaidException } from "../exceptions/DomainExceptions";

export interface InvoiceProps {
  id: InvoiceId;
  tenantId: TenantId;
  billingAccountId: BillingAccountId;
  invoiceNumber: InvoiceNumber;
  status?: InvoiceStatus;
  currency: Currency;
  items?: InvoiceItem[];
  dueDate: Date;
  paidAt?: Date;
  voidedAt?: Date;
  amountPaid?: Money;
  paymentAttemptCount?: number;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Invoice {
  private readonly _id: InvoiceId;
  private readonly _tenantId: TenantId;
  private readonly _billingAccountId: BillingAccountId;
  private readonly _invoiceNumber: InvoiceNumber;
  private _status: InvoiceStatus;
  private readonly _currency: Currency;
  private _items: Map<string, InvoiceItem> = new Map();
  private _dueDate: Date;
  private _paidAt?: Date;
  private _voidedAt?: Date;
  private _amountPaid: Money;
  private _paymentAttemptCount: number;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: InvoiceProps) {
    if (!props.id) throw new Error("InvoiceId is required.");
    if (!props.tenantId) throw new Error("TenantId is required.");
    if (!props.billingAccountId) throw new Error("BillingAccountId is required.");
    if (!props.invoiceNumber) throw new Error("InvoiceNumber is required.");
    if (!props.currency) throw new Error("Currency is required.");

    this._id = props.id;
    this._tenantId = props.tenantId;
    this._billingAccountId = props.billingAccountId;
    this._invoiceNumber = props.invoiceNumber;
    this._status = props.status || new InvoiceStatus(InvoiceStatusEnum.DRAFT);
    this._currency = props.currency;
    this._dueDate = props.dueDate;
    this._paidAt = props.paidAt;
    this._voidedAt = props.voidedAt;
    this._amountPaid = props.amountPaid || Money.zero(this._currency);
    this._paymentAttemptCount = props.paymentAttemptCount || 0;
    this._version = props.version || 1;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();

    if (props.items) {
      for (const item of props.items) {
        this._items.set(item.id, item);
      }
    }
  }

  public get id(): InvoiceId { return this._id; }
  public get tenantId(): TenantId { return this._tenantId; }
  public get billingAccountId(): BillingAccountId { return this._billingAccountId; }
  public get invoiceNumber(): InvoiceNumber { return this._invoiceNumber; }
  public get status(): InvoiceStatus { return this._status; }
  public get currency(): Currency { return this._currency; }
  public get dueDate(): Date { return this._dueDate; }
  public get paidAt(): Date | undefined { return this._paidAt; }
  public get voidedAt(): Date | undefined { return this._voidedAt; }
  public get amountPaid(): Money { return this._amountPaid; }
  public get paymentAttemptCount(): number { return this._paymentAttemptCount; }
  public get version(): number { return this._version; }
  public get createdAt(): Date { return this._createdAt; }
  public get updatedAt(): Date { return this._updatedAt; }

  public get items(): InvoiceItem[] {
    return Array.from(this._items.values());
  }

  public get domainEvents(): ReadonlyArray<DomainEvent> {
    return [...this._domainEvents];
  }

  public clearDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  public get subtotal(): Money {
    let cents = 0;
    for (const item of this._items.values()) {
      cents += item.subtotal.amountInCents;
    }
    return new Money(cents, this._currency);
  }

  public get taxTotal(): Money {
    let cents = 0;
    for (const item of this._items.values()) {
      cents += item.taxAmount.amountInCents;
    }
    return new Money(cents, this._currency);
  }

  public get total(): Money {
    return this.subtotal.add(this.taxTotal);
  }

  public get amountRemaining(): Money {
    const rem = this.total.subtract(this._amountPaid);
    return rem.isNegative() ? Money.zero(this._currency) : rem;
  }

  public addItem(item: InvoiceItem): void {
    if (this._status.value !== InvoiceStatusEnum.DRAFT) {
      throw new Error("Cannot modify invoice items after invoice is finalized.");
    }
    if (!item.unitPrice.currency.equals(this._currency)) {
      throw new Error(`Item currency (${item.unitPrice.currency.code}) does not match invoice currency (${this._currency.code}).`);
    }
    this._items.set(item.id, item);
    this.touch();
  }

  public removeItem(itemId: string): void {
    if (this._status.value !== InvoiceStatusEnum.DRAFT) {
      throw new Error("Cannot modify invoice items after invoice is finalized.");
    }
    this._items.delete(itemId);
    this.touch();
  }

  public finalizeDraft(): void {
    if (this._status.value !== InvoiceStatusEnum.DRAFT) {
      throw new Error("Invoice is already finalized.");
    }
    if (this._items.size === 0) {
      throw new Error("Cannot finalize an invoice with no items.");
    }

    this._status = new InvoiceStatus(InvoiceStatusEnum.OPEN);
    this.touch();

    this._domainEvents.push(
      new InvoiceGeneratedEvent(
        this._id.value,
        this._tenantId.value,
        this._invoiceNumber.formatted,
        this.total.amountInCents,
        this._currency.code,
        this._dueDate
      )
    );
  }

  public markPaid(paymentIntentId: string, paidAmount?: Money): void {
    if (this._status.value === InvoiceStatusEnum.PAID) {
      throw new InvoiceAlreadyPaidException(this._id.value);
    }
    if (this._status.value === InvoiceStatusEnum.VOID) {
      throw new Error("Cannot mark a voided invoice as paid.");
    }

    const payment = paidAmount || this.total;
    this._amountPaid = this._amountPaid.add(payment);
    this._paidAt = new Date();
    this._status = new InvoiceStatus(InvoiceStatusEnum.PAID);
    this.touch();

    this._domainEvents.push(
      new InvoicePaidEvent(
        this._id.value,
        this._tenantId.value,
        this._invoiceNumber.formatted,
        this._amountPaid.amountInCents,
        this._currency.code,
        paymentIntentId
      )
    );
  }

  public recordPaymentFailure(reason: string): void {
    this._paymentAttemptCount += 1;
    this.touch();
    this._domainEvents.push(
      new InvoicePaymentFailedEvent(
        this._id.value,
        this._tenantId.value,
        this._invoiceNumber.formatted,
        reason,
        this._paymentAttemptCount
      )
    );
  }

  public voidInvoice(): void {
    if (this._status.value === InvoiceStatusEnum.PAID) {
      throw new Error("Cannot void a paid invoice.");
    }
    this._status = new InvoiceStatus(InvoiceStatusEnum.VOID);
    this._voidedAt = new Date();
    this.touch();
  }

  public markUncollectible(): void {
    if (this._status.value === InvoiceStatusEnum.PAID) {
      throw new Error("Cannot mark paid invoice as uncollectible.");
    }
    this._status = new InvoiceStatus(InvoiceStatusEnum.UNCOLLECTIBLE);
    this.touch();
  }

  private touch(): void {
    this._updatedAt = new Date();
    this._version += 1;
  }
}
