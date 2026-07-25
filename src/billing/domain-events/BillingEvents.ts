import { DomainEvent } from "./DomainEvent";

export class InvoiceGeneratedEvent implements DomainEvent {
  readonly eventName = "InvoiceGenerated";
  readonly aggregateType = "Invoice";

  constructor(
    readonly aggregateId: string,
    readonly tenantId: string,
    readonly invoiceNumber: string,
    readonly totalAmountCents: number,
    readonly currency: string,
    readonly dueDate: Date,
    readonly occurredOn: Date = new Date(),
    readonly eventId: string = crypto.randomUUID()
  ) {}
}

export class InvoicePaidEvent implements DomainEvent {
  readonly eventName = "InvoicePaid";
  readonly aggregateType = "Invoice";

  constructor(
    readonly aggregateId: string,
    readonly tenantId: string,
    readonly invoiceNumber: string,
    readonly amountPaidCents: number,
    readonly currency: string,
    readonly paymentIntentId: string,
    readonly occurredOn: Date = new Date(),
    readonly eventId: string = crypto.randomUUID()
  ) {}
}

export class PaymentCapturedEvent implements DomainEvent {
  readonly eventName = "PaymentCaptured";
  readonly aggregateType = "PaymentIntent";

  constructor(
    readonly aggregateId: string,
    readonly tenantId: string,
    readonly amountCents: number,
    readonly currency: string,
    readonly billingAccountId: string,
    readonly occurredOn: Date = new Date(),
    readonly eventId: string = crypto.randomUUID()
  ) {}
}

export class RefundIssuedEvent implements DomainEvent {
  readonly eventName = "RefundIssued";
  readonly aggregateType = "Refund";

  constructor(
    readonly aggregateId: string,
    readonly tenantId: string,
    readonly paymentIntentId: string,
    readonly refundAmountCents: number,
    readonly currency: string,
    readonly reason: string,
    readonly occurredOn: Date = new Date(),
    readonly eventId: string = crypto.randomUUID()
  ) {}
}

export class SubscriptionActivatedEvent implements DomainEvent {
  readonly eventName = "SubscriptionActivated";
  readonly aggregateType = "Subscription";

  constructor(
    readonly aggregateId: string,
    readonly tenantId: string,
    readonly planId: string,
    readonly periodStart: Date,
    readonly periodEnd: Date,
    readonly occurredOn: Date = new Date(),
    readonly eventId: string = crypto.randomUUID()
  ) {}
}

export class SubscriptionCanceledEvent implements DomainEvent {
  readonly eventName = "SubscriptionCanceled";
  readonly aggregateType = "Subscription";

  constructor(
    readonly aggregateId: string,
    readonly tenantId: string,
    readonly reason: string,
    readonly cancelAtPeriodEnd: boolean,
    readonly occurredOn: Date = new Date(),
    readonly eventId: string = crypto.randomUUID()
  ) {}
}

export class BillingAccountSuspendedEvent implements DomainEvent {
  readonly eventName = "BillingAccountSuspended";
  readonly aggregateType = "BillingAccount";

  constructor(
    readonly aggregateId: string,
    readonly tenantId: string,
    readonly reason: string,
    readonly occurredOn: Date = new Date(),
    readonly eventId: string = crypto.randomUUID()
  ) {}
}

export class BillingAccountRestoredEvent implements DomainEvent {
  readonly eventName = "BillingAccountRestored";
  readonly aggregateType = "BillingAccount";

  constructor(
    readonly aggregateId: string,
    readonly tenantId: string,
    readonly occurredOn: Date = new Date(),
    readonly eventId: string = crypto.randomUUID()
  ) {}
}

export class InvoicePaymentFailedEvent implements DomainEvent {
  readonly eventName = "InvoicePaymentFailed";
  readonly aggregateType = "Invoice";

  constructor(
    readonly aggregateId: string,
    readonly tenantId: string,
    readonly invoiceNumber: string,
    readonly failureReason: string,
    readonly attemptCount: number,
    readonly occurredOn: Date = new Date(),
    readonly eventId: string = crypto.randomUUID()
  ) {}
}
