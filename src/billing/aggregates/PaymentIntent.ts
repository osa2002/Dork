import { PaymentIntentId } from "../value-objects/PaymentIntentId";
import { TenantId } from "../value-objects/TenantId";
import { BillingAccountId } from "../value-objects/BillingAccountId";
import { InvoiceId } from "../value-objects/InvoiceId";
import { PaymentMethodId } from "../value-objects/PaymentMethodId";
import { Money } from "../value-objects/Money";
import { PaymentStatus, PaymentStatusEnum } from "../value-objects/PaymentStatus";
import { DomainEvent } from "../domain-events/DomainEvent";
import { PaymentCapturedEvent } from "../domain-events/BillingEvents";

export interface PaymentIntentProps {
  id: PaymentIntentId;
  tenantId: TenantId;
  billingAccountId: BillingAccountId;
  invoiceId?: InvoiceId;
  amount: Money;
  status?: PaymentStatus;
  paymentMethodId?: PaymentMethodId;
  clientSecretReference?: string;
  failureReason?: string;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PaymentIntent {
  private readonly _id: PaymentIntentId;
  private readonly _tenantId: TenantId;
  private readonly _billingAccountId: BillingAccountId;
  private readonly _invoiceId?: InvoiceId;
  private readonly _amount: Money;
  private _status: PaymentStatus;
  private _paymentMethodId?: PaymentMethodId;
  private readonly _clientSecretReference: string;
  private _failureReason?: string;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: PaymentIntentProps) {
    if (!props.id) throw new Error("PaymentIntentId is required.");
    if (!props.tenantId) throw new Error("TenantId is required.");
    if (!props.billingAccountId) throw new Error("BillingAccountId is required.");
    if (!props.amount || !props.amount.isPositive()) {
      throw new Error("PaymentIntent amount must be positive.");
    }

    this._id = props.id;
    this._tenantId = props.tenantId;
    this._billingAccountId = props.billingAccountId;
    this._invoiceId = props.invoiceId;
    this._amount = props.amount;
    this._status = props.status || new PaymentStatus(PaymentStatusEnum.REQUIRES_PAYMENT_METHOD);
    this._paymentMethodId = props.paymentMethodId;
    this._clientSecretReference = props.clientSecretReference || `pi_sec_${crypto.randomUUID()}`;
    this._failureReason = props.failureReason;
    this._version = props.version || 1;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  public get id(): PaymentIntentId { return this._id; }
  public get tenantId(): TenantId { return this._tenantId; }
  public get billingAccountId(): BillingAccountId { return this._billingAccountId; }
  public get invoiceId(): InvoiceId | undefined { return this._invoiceId; }
  public get amount(): Money { return this._amount; }
  public get status(): PaymentStatus { return this._status; }
  public get paymentMethodId(): PaymentMethodId | undefined { return this._paymentMethodId; }
  public get clientSecretReference(): string { return this._clientSecretReference; }
  public get failureReason(): string | undefined { return this._failureReason; }
  public get version(): number { return this._version; }
  public get createdAt(): Date { return this._createdAt; }
  public get updatedAt(): Date { return this._updatedAt; }

  public get domainEvents(): ReadonlyArray<DomainEvent> {
    return [...this._domainEvents];
  }

  public clearDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  public attachPaymentMethod(paymentMethodId: PaymentMethodId): void {
    if (this._status.isTerminal()) {
      throw new Error(`Cannot attach payment method to a terminal PaymentIntent (status: ${this._status.value}).`);
    }
    this._paymentMethodId = paymentMethodId;
    this._status = new PaymentStatus(PaymentStatusEnum.REQUIRES_CONFIRMATION);
    this.touch();
  }

  public markProcessing(): void {
    if (this._status.isTerminal()) {
      throw new Error(`Cannot set processing on terminal PaymentIntent (status: ${this._status.value}).`);
    }
    this._status = new PaymentStatus(PaymentStatusEnum.PROCESSING);
    this.touch();
  }

  public captureSuccess(): void {
    if (this._status.value === PaymentStatusEnum.SUCCEEDED) return;
    if (this._status.value === PaymentStatusEnum.CANCELED) {
      throw new Error("Cannot capture a canceled PaymentIntent.");
    }

    this._status = new PaymentStatus(PaymentStatusEnum.SUCCEEDED);
    this.touch();

    this._domainEvents.push(
      new PaymentCapturedEvent(
        this._id.value,
        this._tenantId.value,
        this._amount.amountInCents,
        this._amount.currency.code,
        this._billingAccountId.value
      )
    );
  }

  public markFailed(reason: string): void {
    if (this._status.value === PaymentStatusEnum.SUCCEEDED) {
      throw new Error("Cannot fail a succeeded PaymentIntent.");
    }
    this._status = new PaymentStatus(PaymentStatusEnum.FAILED);
    this._failureReason = reason;
    this.touch();
  }

  public cancel(reason: string = "User or system canceled"): void {
    if (this._status.value === PaymentStatusEnum.SUCCEEDED) {
      throw new Error("Cannot cancel a succeeded PaymentIntent.");
    }
    this._status = new PaymentStatus(PaymentStatusEnum.CANCELED);
    this._failureReason = reason;
    this.touch();
  }

  private touch(): void {
    this._updatedAt = new Date();
    this._version += 1;
  }
}
