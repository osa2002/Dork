export class PPALBaseException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class PaymentProviderNotFoundException extends PPALBaseException {
  constructor(providerId: string) {
    super(`Payment provider '${providerId}' is not registered in the system.`);
  }
}

export class ProviderCapabilityMismatchException extends PPALBaseException {
  constructor(providerId: string, reason: string) {
    super(`Payment provider '${providerId}' does not satisfy capabilities: ${reason}`);
  }
}

export class CircuitBreakerOpenException extends PPALBaseException {
  constructor(providerId: string) {
    super(`Circuit breaker is OPEN for provider '${providerId}'. Transactions blocked temporarily.`);
  }
}

export class MaxRetryExceededException extends PPALBaseException {
  constructor(attempts: number, lastError: string) {
    super(`Maximum retry attempts (${attempts}) exceeded. Last error: ${lastError}`);
  }
}

export class WebhookVerificationFailedException extends PPALBaseException {
  constructor(providerId: string, reason: string) {
    super(`Webhook signature verification failed for provider '${providerId}': ${reason}`);
  }
}

export class InvalidStateTransitionException extends PPALBaseException {
  constructor(message: string) {
    super(message);
  }
}

export class PaymentGatewayAdapterException extends PPALBaseException {
  readonly providerId: string;
  readonly originalError?: unknown;

  constructor(providerId: string, message: string, originalError?: unknown) {
    super(`[Adapter Error - ${providerId}]: ${message}`);
    this.providerId = providerId;
    this.originalError = originalError;
  }
}
