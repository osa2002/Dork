export type BackoffStrategy = "FIXED" | "LINEAR" | "EXPONENTIAL" | "EXPONENTIAL_JITTER";

export interface RetryScheduleParams {
  readonly maxRetries: number;
  readonly initialIntervalMs: number;
  readonly maxIntervalMs: number;
  readonly backoffMultiplier: number;
  readonly strategy: BackoffStrategy;
  readonly maxDeliveryAgeMs: number;
}

export interface RetryScheduleItem {
  readonly attemptNumber: number;
  readonly delayMs: number;
  readonly cumulativeDelayMs: number;
  readonly scheduledAtIso: string;
  readonly isFinalAttempt: boolean;
  readonly exceedsMaxAge: boolean;
}

export interface RetryScheduleResult {
  readonly deliveryId: string;
  readonly strategy: BackoffStrategy;
  readonly totalAttemptsScheduled: number;
  readonly maxDeliveryAgeMs: number;
  readonly isExpired: boolean;
  readonly schedule: readonly RetryScheduleItem[];
  readonly computedAtIso: string;
}

export const DEFAULT_RETRY_PARAMS: RetryScheduleParams = Object.freeze({
  maxRetries: 5,
  initialIntervalMs: 1000,
  maxIntervalMs: 60000,
  backoffMultiplier: 2,
  strategy: "EXPONENTIAL_JITTER",
  maxDeliveryAgeMs: 86400000, // 24 hours
});

export class RetryEngine {
  /**
   * Pure calculation of delay in milliseconds for a specific attempt number (1-based index).
   */
  public static calculateDelayMs(
    attemptNumber: number,
    params: Partial<RetryScheduleParams> = {}
  ): number {
    const config: RetryScheduleParams = {
      ...DEFAULT_RETRY_PARAMS,
      ...params,
    };

    if (attemptNumber <= 0) return 0;

    let rawDelay = config.initialIntervalMs;

    switch (config.strategy) {
      case "FIXED":
        rawDelay = config.initialIntervalMs;
        break;

      case "LINEAR":
        rawDelay = config.initialIntervalMs * attemptNumber;
        break;

      case "EXPONENTIAL":
        rawDelay = config.initialIntervalMs * Math.pow(config.backoffMultiplier, attemptNumber - 1);
        break;

      case "EXPONENTIAL_JITTER": {
        const baseExp = config.initialIntervalMs * Math.pow(config.backoffMultiplier, attemptNumber - 1);
        // Deterministic pseudo-jitter factor (0.8 - 1.2 range based on attempt index) to ensure pure calculation determinism
        const pseudoJitterFactor = 0.8 + ((attemptNumber * 17) % 40) / 100;
        rawDelay = Math.round(baseExp * pseudoJitterFactor);
        break;
      }

      default:
        rawDelay = config.initialIntervalMs;
        break;
    }

    return Math.min(Math.max(rawDelay, 0), config.maxIntervalMs);
  }

  /**
   * Computes a complete deterministic future retry schedule for a delivery attempt sequence.
   */
  public static calculateSchedule(
    deliveryId: string,
    firstAttemptTimeIso: string,
    params: Partial<RetryScheduleParams> = {}
  ): RetryScheduleResult {
    const config: RetryScheduleParams = Object.freeze({
      ...DEFAULT_RETRY_PARAMS,
      ...params,
    });

    const startTime = new Date(firstAttemptTimeIso).getTime();
    const computedAtIso = new Date().toISOString();
    const schedule: RetryScheduleItem[] = [];

    let cumulativeDelay = 0;
    let isExpired = false;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      const delay = this.calculateDelayMs(attempt, config);
      cumulativeDelay += delay;

      const scheduledTime = new Date(startTime + cumulativeDelay).toISOString();
      const exceedsAge = cumulativeDelay > config.maxDeliveryAgeMs;

      if (exceedsAge) {
        isExpired = true;
      }

      schedule.push(
        Object.freeze({
          attemptNumber: attempt,
          delayMs: delay,
          cumulativeDelayMs: cumulativeDelay,
          scheduledAtIso: scheduledTime,
          isFinalAttempt: attempt === config.maxRetries,
          exceedsMaxAge: exceedsAge,
        })
      );
    }

    return Object.freeze({
      deliveryId,
      strategy: config.strategy,
      totalAttemptsScheduled: schedule.length,
      maxDeliveryAgeMs: config.maxDeliveryAgeMs,
      isExpired,
      schedule: Object.freeze(schedule),
      computedAtIso,
    });
  }

  /**
   * Evaluates if a given attempt can proceed given the delivery parameters and elapsed time.
   */
  public static evaluateRetryEligibility(
    currentAttemptNumber: number,
    firstAttemptTimeIso: string,
    params: Partial<RetryScheduleParams> = {}
  ): Readonly<{
    canRetry: boolean;
    reason: string;
    nextDelayMs: number;
    nextScheduledTimeIso?: string;
  }> {
    const config: RetryScheduleParams = {
      ...DEFAULT_RETRY_PARAMS,
      ...params,
    };

    if (currentAttemptNumber >= config.maxRetries) {
      return Object.freeze({
        canRetry: false,
        reason: `Maximum retry attempts (${config.maxRetries}) exhausted.`,
        nextDelayMs: 0,
      });
    }

    const startTime = new Date(firstAttemptTimeIso).getTime();
    const nowTime = new Date().getTime();
    const totalAgeMs = Math.max(0, nowTime - startTime);

    if (totalAgeMs > config.maxDeliveryAgeMs) {
      return Object.freeze({
        canRetry: false,
        reason: `Maximum delivery age (${config.maxDeliveryAgeMs}ms) exceeded.`,
        nextDelayMs: 0,
      });
    }

    const nextAttempt = currentAttemptNumber + 1;
    const nextDelayMs = this.calculateDelayMs(nextAttempt, config);
    const nextScheduledTimeIso = new Date(nowTime + nextDelayMs).toISOString();

    return Object.freeze({
      canRetry: true,
      reason: `Eligible for retry attempt #${nextAttempt}.`,
      nextDelayMs,
      nextScheduledTimeIso,
    });
  }
}
