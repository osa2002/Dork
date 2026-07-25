import { BillingAccountId } from "../value-objects/BillingAccountId";
import { TenantId } from "../value-objects/TenantId";
import { PaymentMethod } from "../entities/PaymentMethod";
import { PaymentMethodId } from "../value-objects/PaymentMethodId";
import { TaxIdentifier } from "../value-objects/TaxIdentifier";
import { DomainEvent } from "../domain-events/DomainEvent";
import { BillingAccountSuspendedEvent, BillingAccountRestoredEvent } from "../domain-events/BillingEvents";
import { PaymentMethodRequiredException } from "../exceptions/DomainExceptions";

export type BillingAccountStatus = "ACTIVE" | "SUSPENDED" | "DELINQUENT" | "CLOSED";

export interface BillingAccountProps {
  id: BillingAccountId;
  tenantId: TenantId;
  companyName: string;
  billingEmail: string;
  status?: BillingAccountStatus;
  taxIdentifier?: TaxIdentifier;
  paymentMethods?: PaymentMethod[];
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class BillingAccount {
  private readonly _id: BillingAccountId;
  private readonly _tenantId: TenantId;
  private _companyName: string;
  private _billingEmail: string;
  private _status: BillingAccountStatus;
  private _taxIdentifier?: TaxIdentifier;
  private _paymentMethods: Map<string, PaymentMethod> = new Map();
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: BillingAccountProps) {
    if (!props.id) throw new Error("BillingAccountId is required.");
    if (!props.tenantId) throw new Error("TenantId is required.");
    if (!props.companyName || props.companyName.trim().length === 0) {
      throw new Error("Company name cannot be empty.");
    }
    if (!props.billingEmail || !props.billingEmail.includes("@")) {
      throw new Error("A valid billing email is required.");
    }

    this._id = props.id;
    this._tenantId = props.tenantId;
    this._companyName = props.companyName.trim();
    this._billingEmail = props.billingEmail.trim();
    this._status = props.status || "ACTIVE";
    this._taxIdentifier = props.taxIdentifier;
    this._version = props.version || 1;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();

    if (props.paymentMethods) {
      for (const pm of props.paymentMethods) {
        this._paymentMethods.set(pm.id.value, pm);
      }
    }
  }

  public get id(): BillingAccountId { return this._id; }
  public get tenantId(): TenantId { return this._tenantId; }
  public get companyName(): string { return this._companyName; }
  public get billingEmail(): string { return this._billingEmail; }
  public get status(): BillingAccountStatus { return this._status; }
  public get taxIdentifier(): TaxIdentifier | undefined { return this._taxIdentifier; }
  public get version(): number { return this._version; }
  public get createdAt(): Date { return this._createdAt; }
  public get updatedAt(): Date { return this._updatedAt; }

  public get paymentMethods(): PaymentMethod[] {
    return Array.from(this._paymentMethods.values());
  }

  public get defaultPaymentMethod(): PaymentMethod | undefined {
    return Array.from(this._paymentMethods.values()).find(pm => pm.isDefault);
  }

  public get domainEvents(): ReadonlyArray<DomainEvent> {
    return [...this._domainEvents];
  }

  public clearDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  public addPaymentMethod(paymentMethod: PaymentMethod): void {
    if (this._paymentMethods.size === 0) {
      paymentMethod.setDefault(true);
    } else if (paymentMethod.isDefault) {
      this.unsetAllDefaultPaymentMethods();
    }

    this._paymentMethods.set(paymentMethod.id.value, paymentMethod);
    this.touch();
  }

  public setDefaultPaymentMethod(paymentMethodId: PaymentMethodId): void {
    const target = this._paymentMethods.get(paymentMethodId.value);
    if (!target) {
      throw new Error(`Payment method '${paymentMethodId.value}' not found in billing account.`);
    }

    this.unsetAllDefaultPaymentMethods();
    target.setDefault(true);
    this.touch();
  }

  public removePaymentMethod(paymentMethodId: PaymentMethodId): void {
    const target = this._paymentMethods.get(paymentMethodId.value);
    if (!target) return;

    const wasDefault = target.isDefault;
    this._paymentMethods.delete(paymentMethodId.value);

    if (wasDefault && this._paymentMethods.size > 0) {
      const firstRemaining = this._paymentMethods.values().next().value;
      if (firstRemaining) {
        firstRemaining.setDefault(true);
      }
    }
    this.touch();
  }

  public updateBillingContact(companyName: string, billingEmail: string, taxIdentifier?: TaxIdentifier): void {
    if (!companyName || companyName.trim().length === 0) {
      throw new Error("Company name cannot be empty.");
    }
    if (!billingEmail || !billingEmail.includes("@")) {
      throw new Error("Valid billing email required.");
    }
    this._companyName = companyName.trim();
    this._billingEmail = billingEmail.trim();
    this._taxIdentifier = taxIdentifier;
    this.touch();
  }

  public suspend(reason: string): void {
    if (this._status === "SUSPENDED") return;
    this._status = "SUSPENDED";
    this.touch();
    this._domainEvents.push(
      new BillingAccountSuspendedEvent(this._id.value, this._tenantId.value, reason)
    );
  }

  public markDelinquent(): void {
    if (this._status === "CLOSED") return;
    this._status = "DELINQUENT";
    this.touch();
  }

  public restore(): void {
    if (this._status === "ACTIVE") return;
    if (this._status === "CLOSED") {
      throw new Error("Cannot restore a closed billing account.");
    }
    this._status = "ACTIVE";
    this.touch();
    this._domainEvents.push(
      new BillingAccountRestoredEvent(this._id.value, this._tenantId.value)
    );
  }

  public close(): void {
    this._status = "CLOSED";
    this.touch();
  }

  public assertCanBeBilled(): void {
    if (this._status === "CLOSED" || this._status === "SUSPENDED") {
      throw new Error(`Billing account is in '${this._status}' status and cannot process charges.`);
    }
    if (!this.defaultPaymentMethod) {
      throw new PaymentMethodRequiredException(this._tenantId.value);
    }
  }

  private unsetAllDefaultPaymentMethods(): void {
    for (const pm of this._paymentMethods.values()) {
      pm.setDefault(false);
    }
  }

  private touch(): void {
    this._updatedAt = new Date();
    this._version += 1;
  }
}
