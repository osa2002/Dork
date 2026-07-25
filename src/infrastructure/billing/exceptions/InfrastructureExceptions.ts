export class InfrastructureBaseException extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(message: string, code: string = "INFRASTRUCTURE_ERROR", details?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

export class OptimisticLockException extends InfrastructureBaseException {
  constructor(aggregateType: string, aggregateId: string, expectedVersion: number, actualVersion: number) {
    super(
      `Optimistic lock failure for ${aggregateType} '${aggregateId}'. Expected version ${expectedVersion}, but found ${actualVersion}.`,
      "OPTIMISTIC_LOCK_FAILURE",
      { aggregateType, aggregateId, expectedVersion, actualVersion }
    );
  }
}

export class DistributedLockException extends InfrastructureBaseException {
  constructor(lockKey: string, reason: string) {
    super(
      `Failed to acquire or maintain distributed lock on '${lockKey}': ${reason}`,
      "DISTRIBUTED_LOCK_FAILURE",
      { lockKey, reason }
    );
  }
}

export class IdempotencyConflictException extends InfrastructureBaseException {
  constructor(idempotencyKey: string, reason: string = "Request with this idempotency key is currently processing or completed.") {
    super(
      `Idempotency conflict for key '${idempotencyKey}': ${reason}`,
      "IDEMPOTENCY_CONFLICT",
      { idempotencyKey, reason }
    );
  }
}

export class TransactionException extends InfrastructureBaseException {
  constructor(message: string, originalError?: any) {
    super(message, "TRANSACTION_FAILURE", { originalError: originalError?.message || String(originalError) });
  }
}

export class WebhookProcessingException extends InfrastructureBaseException {
  constructor(providerId: string, eventId: string, reason: string) {
    super(
      `Webhook processing failed for provider '${providerId}', event '${eventId}': ${reason}`,
      "WEBHOOK_PROCESSING_FAILURE",
      { providerId, eventId, reason }
    );
  }
}
