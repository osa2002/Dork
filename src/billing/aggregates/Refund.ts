import { RefundId } from "../value-objects/RefundId";
import { TenantId } from "../value-objects/TenantId";
import { PaymentIntentId } from "../value-objects/PaymentIntentId";
import { InvoiceId } from "../value-objects/InvoiceId";
import { Money } from "../value-objects/Money";
import { DomainEvent } from "../domain-events/DomainEvent";
import { RefundIssuedEvent } from "../domain-events/BillingEvents";

export type RefundReason = "DUPLICATE" | "FRAUDULENT" | "REQUESTED_BY_CUSTOMER" | "SYSTEM_ERROR";
export type RefundStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELED";

export interface RefundProps {
  id: RefundId;
  tenantId: TenantId;
  paymentIntentId: PaymentIntentId;
  invoiceId?: InvoiceId;
  amount: Money;
  reason: RefundReason;
  status?: RefundStatus;
  requestedAt?: Date;
  processedAt?: Date;
  failureReason?: string;
  version?: number;
}

export class Refund {
  private readonly _id: RefundId;
  private readonly _tenantId: TenantId;
  private readonly _paymentIntentId: PaymentIntentId;
  private readonly _invoiceId?: InvoiceId;
  private readonly _amount: Money;
  private readonly _reason: RefundReason;
  private _status: RefundStatus;
  private readonly _requestedAt: Date;
  private _processedAt?: Date;
  private _failureReason?: string;
  private _version: number;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: RefundProps) {
    if (!props.id) throw new Error("RefundId is required.");
    if (!props.tenantId) throw new Error("TenantId is required.");
    if (!props.paymentIntentId) throw new Error("PaymentIntentId is required.");
    if (!props.amount || !props.amount.isPositive()) {
      throw new Error("Refund amount must be positive.");
    }

    this._id = props.id;
    this._tenantId = props.tenantId;
    this._paymentIntentId = props.paymentIntentId;
    this._invoiceId = props.invoiceId;
    this._amount = props.amount;
    this._reason = props.reason;
    this._status = props.status || "PENDING";
    this._requestedAt = props.requestedAt || new Date();
    this._processedAt = props.processedAt;
    this._failureReason = props.failureReason;
    this._version = props.version || 1;
  }

  public get id(): RefundId { return this._id; }
  public get tenantId(): TenantId { return this._tenantId; }
  public get paymentIntentId(): PaymentIntentId { return this._paymentIntentId; }
  public get invoiceId(): InvoiceId | undefined { return this._invoiceId; }
  public get amount(): Money { return this._amount; }
  public get reason(): RefundReason { return this._reason; }
  public get status(): RefundStatus { return this._status; }
  public get requestedAt(): Date { return this._requestedAt; }
  public get processedAt(): Date | undefined { return this._processedAt; }
  public get failureReason(): string | undefined { return this._failureReason; }
  public get version(): number { return this._version; }

  public get domainEvents(): ReadonlyArray<DomainEvent> {
    return [...this._domainEvents];
  }

  public clearDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  public markSucceeded(): void {
    if (this._status === "SUCCEEDED") return;
    if (this._status === "CANCELED") {
      throw new Error("Cannot process a canceled refund.");
    }

    this._status = "SUCCEEDED";
    this._processedAt = new Date();
    this._version += 1;

    this._domainEvents.push(
      new RefundIssuedEvent(
        this._id.value,
        this._tenantId.value,
        this._paymentIntentId.value,
        this._amount.amountInCents,
        this._amount.currency.code,
        this._reason
      )
    );
  }

  public markFailed(reason: string): void {
    if (this._status === "SUCCEEDED") {
      throw new Error("Cannot mark a succeeded refund as failed.");
    }
    this._status = "FAILED";
    this._failureReason = reason;
    this._version += 1;
  }
}
