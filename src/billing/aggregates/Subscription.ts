import { SubscriptionId } from "../value-objects/SubscriptionId";
import { TenantId } from "../value-objects/TenantId";
import { BillingAccountId } from "../value-objects/BillingAccountId";
import { SubscriptionStatus, SubscriptionStatusEnum } from "../value-objects/SubscriptionStatus";
import { BillingPeriod } from "../value-objects/BillingPeriod";
import { Money } from "../value-objects/Money";
import { Discount } from "../entities/Discount";
import { DomainEvent } from "../domain-events/DomainEvent";
import { SubscriptionActivatedEvent, SubscriptionCanceledEvent } from "../domain-events/BillingEvents";
import { InvalidSubscriptionStateTransitionException } from "../exceptions/DomainExceptions";

export interface SubscriptionProps {
  id: SubscriptionId;
  tenantId: TenantId;
  billingAccountId: BillingAccountId;
  planId: string;
  status: SubscriptionStatus;
  currentPeriod: BillingPeriod;
  quantity: number;
  unitPrice: Money;
  discount?: Discount;
  trialEndsAt?: Date;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Subscription {
  private readonly _id: SubscriptionId;
  private readonly _tenantId: TenantId;
  private readonly _billingAccountId: BillingAccountId;
  private _planId: string;
  private _status: SubscriptionStatus;
  private _currentPeriod: BillingPeriod;
  private _quantity: number;
  private _unitPrice: Money;
  private _discount?: Discount;
  private _trialEndsAt?: Date;
  private _cancelAtPeriodEnd: boolean;
  private _canceledAt?: Date;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: SubscriptionProps) {
    if (!props.id) throw new Error("SubscriptionId is required.");
    if (!props.tenantId) throw new Error("TenantId is required.");
    if (!props.billingAccountId) throw new Error("BillingAccountId is required.");
    if (!props.planId || props.planId.trim().length === 0) {
      throw new Error("PlanId cannot be empty.");
    }
    if (props.quantity <= 0) {
      throw new Error("Subscription quantity must be greater than zero.");
    }

    this._id = props.id;
    this._tenantId = props.tenantId;
    this._billingAccountId = props.billingAccountId;
    this._planId = props.planId.trim();
    this._status = props.status;
    this._currentPeriod = props.currentPeriod;
    this._quantity = props.quantity;
    this._unitPrice = props.unitPrice;
    this._discount = props.discount;
    this._trialEndsAt = props.trialEndsAt;
    this._cancelAtPeriodEnd = props.cancelAtPeriodEnd || false;
    this._canceledAt = props.canceledAt;
    this._version = props.version || 1;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  public get id(): SubscriptionId { return this._id; }
  public get tenantId(): TenantId { return this._tenantId; }
  public get billingAccountId(): BillingAccountId { return this._billingAccountId; }
  public get planId(): string { return this._planId; }
  public get status(): SubscriptionStatus { return this._status; }
  public get currentPeriod(): BillingPeriod { return this._currentPeriod; }
  public get quantity(): number { return this._quantity; }
  public get unitPrice(): Money { return this._unitPrice; }
  public get discount(): Discount | undefined { return this._discount; }
  public get trialEndsAt(): Date | undefined { return this._trialEndsAt; }
  public get cancelAtPeriodEnd(): boolean { return this._cancelAtPeriodEnd; }
  public get canceledAt(): Date | undefined { return this._canceledAt; }
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

  public get rawSubtotal(): Money {
    return this._unitPrice.multiply(this._quantity);
  }

  public get recurringTotal(): Money {
    const subtotal = this.rawSubtotal;
    if (!this._discount) return subtotal;
    const discountAmount = this._discount.calculateDiscountAmount(subtotal);
    return subtotal.subtract(discountAmount);
  }

  public activate(): void {
    if (this._status.value === SubscriptionStatusEnum.CANCELED) {
      throw new InvalidSubscriptionStateTransitionException(
        this._status.value,
        SubscriptionStatusEnum.ACTIVE,
        "Cannot activate a canceled subscription. Create a new subscription instead."
      );
    }

    this._status = new SubscriptionStatus(SubscriptionStatusEnum.ACTIVE);
    this.touch();
    this._domainEvents.push(
      new SubscriptionActivatedEvent(
        this._id.value,
        this._tenantId.value,
        this._planId,
        this._currentPeriod.startDate,
        this._currentPeriod.endDate
      )
    );
  }

  public markPastDue(): void {
    if (this._status.value === SubscriptionStatusEnum.CANCELED) return;
    this._status = new SubscriptionStatus(SubscriptionStatusEnum.PAST_DUE);
    this.touch();
  }

  public pause(): void {
    if (this._status.value === SubscriptionStatusEnum.CANCELED) {
      throw new InvalidSubscriptionStateTransitionException(
        this._status.value,
        SubscriptionStatusEnum.PAUSED,
        "Cannot pause a canceled subscription."
      );
    }
    this._status = new SubscriptionStatus(SubscriptionStatusEnum.PAUSED);
    this.touch();
  }

  public resume(): void {
    if (this._status.value !== SubscriptionStatusEnum.PAUSED) {
      throw new InvalidSubscriptionStateTransitionException(
        this._status.value,
        SubscriptionStatusEnum.ACTIVE,
        "Subscription is not paused."
      );
    }
    this._status = new SubscriptionStatus(SubscriptionStatusEnum.ACTIVE);
    this.touch();
  }

  public requestCancelAtPeriodEnd(reason: string = "User requested cancellation"): void {
    if (this._status.value === SubscriptionStatusEnum.CANCELED) return;
    this._cancelAtPeriodEnd = true;
    this.touch();
    this._domainEvents.push(
      new SubscriptionCanceledEvent(this._id.value, this._tenantId.value, reason, true)
    );
  }

  public cancelImmediately(reason: string = "Immediate cancellation requested"): void {
    this._status = new SubscriptionStatus(SubscriptionStatusEnum.CANCELED);
    this._canceledAt = new Date();
    this._cancelAtPeriodEnd = false;
    this.touch();
    this._domainEvents.push(
      new SubscriptionCanceledEvent(this._id.value, this._tenantId.value, reason, false)
    );
  }

  public changePlan(newPlanId: string, newUnitPrice: Money): void {
    if (this._status.value === SubscriptionStatusEnum.CANCELED) {
      throw new Error("Cannot change plan on a canceled subscription.");
    }
    if (!newPlanId || newPlanId.trim().length === 0) {
      throw new Error("New planId cannot be empty.");
    }
    this._planId = newPlanId.trim();
    this._unitPrice = newUnitPrice;
    this.touch();
  }

  public updateQuantity(newQuantity: number): void {
    if (newQuantity <= 0) {
      throw new Error("Subscription quantity must be greater than zero.");
    }
    this._quantity = newQuantity;
    this.touch();
  }

  public applyDiscount(discount: Discount): void {
    this._discount = discount;
    this.touch();
  }

  public renewForNextPeriod(nextPeriod: BillingPeriod): void {
    if (this._status.value === SubscriptionStatusEnum.CANCELED) {
      throw new Error("Cannot renew a canceled subscription.");
    }
    if (this._cancelAtPeriodEnd) {
      this.cancelImmediately("Subscription reached period end with cancellation pending.");
      return;
    }

    this._currentPeriod = nextPeriod;
    this._status = new SubscriptionStatus(SubscriptionStatusEnum.ACTIVE);
    this.touch();
  }

  private touch(): void {
    this._updatedAt = new Date();
    this._version += 1;
  }
}
