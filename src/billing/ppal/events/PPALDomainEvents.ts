import { DomainEvent } from "../../domain-events/DomainEvent";

export class PaymentRoutedEvent implements DomainEvent {
  readonly eventName = "PaymentRouted";
  readonly aggregateType = "PaymentRouting";

  constructor(
    readonly aggregateId: string,
    readonly tenantId: string,
    readonly selectedProviderId: string,
    readonly currency: string,
    readonly amountCents: number,
    readonly occurredOn: Date = new Date(),
    readonly eventId: string = crypto.randomUUID()
  ) {}
}

export class CircuitBreakerTrippedEvent implements DomainEvent {
  readonly eventName = "CircuitBreakerTripped";
  readonly aggregateType = "CircuitBreaker";

  constructor(
    readonly aggregateId: string,
    readonly tenantId: string,
    readonly providerId: string,
    readonly failureCount: number,
    readonly occurredOn: Date = new Date(),
    readonly eventId: string = crypto.randomUUID()
  ) {}
}

export class WebhookNormalizedEvent implements DomainEvent {
  readonly eventName = "WebhookNormalized";
  readonly aggregateType = "Webhook";

  constructor(
    readonly aggregateId: string,
    readonly tenantId: string,
    readonly providerId: string,
    readonly normalizedEventType: string,
    readonly occurredOn: Date = new Date(),
    readonly eventId: string = crypto.randomUUID()
  ) {}
}

export class PaymentGatewayExecutionFailedEvent implements DomainEvent {
  readonly eventName = "PaymentGatewayExecutionFailed";
  readonly aggregateType = "PaymentGatewayAdapter";

  constructor(
    readonly aggregateId: string,
    readonly tenantId: string,
    readonly providerId: string,
    readonly reason: string,
    readonly occurredOn: Date = new Date(),
    readonly eventId: string = crypto.randomUUID()
  ) {}
}
