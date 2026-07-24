export type BackoffStrategy = "EXPONENTIAL" | "LINEAR" | "FIXED" | "NO_BACKOFF";

export interface TransactionPolicyOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  timeoutMs?: number;
  jitter?: boolean;
  backoffStrategy?: BackoffStrategy;
  retryableErrorCodes?: string[];
  requireIdempotencyKey?: boolean;
  maxPayloadSizeBytes?: number;
}

export class TransactionPolicy {
  public readonly maxAttempts: number;
  public readonly initialDelayMs: number;
  public readonly maxDelayMs: number;
  public readonly backoffFactor: number;
  public readonly timeoutMs: number;
  public readonly jitter: boolean;
  public readonly backoffStrategy: BackoffStrategy;
  public readonly retryableErrorCodes: string[];
  public readonly requireIdempotencyKey: boolean;
  public readonly maxPayloadSizeBytes: number;

  constructor(options: TransactionPolicyOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.initialDelayMs = options.initialDelayMs ?? 100;
    this.maxDelayMs = options.maxDelayMs ?? 3000;
    this.backoffFactor = options.backoffFactor ?? 2;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.jitter = options.jitter ?? true;
    this.backoffStrategy = options.backoffStrategy ?? "EXPONENTIAL";
    this.retryableErrorCodes = options.retryableErrorCodes ?? [
      "FAILED_PRECONDITION",
      "ABORTED",
      "RESOURCE_EXHAUSTED",
      "UNAVAILABLE",
      "CONCURRENCY_CONFLICT",
      "DEADLOCK_DETECTED",
      "409",
      "429",
      "503"
    ];
    this.requireIdempotencyKey = options.requireIdempotencyKey ?? false;
    this.maxPayloadSizeBytes = options.maxPayloadSizeBytes ?? 1024 * 1024; // 1MB default
  }

  public calculateBackoffDelay(attemptNumber: number): number {
    if (attemptNumber <= 1 || this.backoffStrategy === "NO_BACKOFF") {
      return 0;
    }

    let delay = 0;
    switch (this.backoffStrategy) {
      case "EXPONENTIAL":
        delay = this.initialDelayMs * Math.pow(this.backoffFactor, attemptNumber - 2);
        break;
      case "LINEAR":
        delay = this.initialDelayMs * (attemptNumber - 1);
        break;
      case "FIXED":
        delay = this.initialDelayMs;
        break;
      default:
        delay = this.initialDelayMs;
    }

    delay = Math.min(delay, this.maxDelayMs);

    if (this.jitter) {
      // Apply 0.8x to 1.2x jitter to prevent retry storms
      const jitterFactor = 0.8 + Math.random() * 0.4;
      delay = Math.round(delay * jitterFactor);
    }

    return delay;
  }

  public isRetryableError(error: any): boolean {
    if (!error) return false;
    
    // Explicit non-retryable marker
    if (error.isFatal || error.nonRetryable) {
      return false;
    }

    const errCode = error.code || error.status || error.name || "";
    const errMsg = String(error.message || "").toUpperCase();

    if (this.retryableErrorCodes.some((code) => String(errCode).toUpperCase() === code.toUpperCase() || errMsg.includes(code.toUpperCase()))) {
      return true;
    }

    // Default heuristics for typical transient or concurrency issues
    if (errMsg.includes("CONCURRENCY") || errMsg.includes("ABORTED") || errMsg.includes("LOCK") || errMsg.includes("DEADLOCK")) {
      return true;
    }

    return false;
  }

  public isRetryBudgetExhausted(currentAttempt: number): boolean {
    return currentAttempt >= this.maxAttempts;
  }

  public static readonly DEFAULT_POLICY = new TransactionPolicy();

  public static readonly HIGH_CONCURRENCY_POLICY = new TransactionPolicy({
    maxAttempts: 5,
    initialDelayMs: 150,
    maxDelayMs: 5000,
    backoffFactor: 2,
    timeoutMs: 10000,
    jitter: true,
    backoffStrategy: "EXPONENTIAL",
  });

  public static readonly STRICT_IDEMPOTENT_POLICY = new TransactionPolicy({
    maxAttempts: 3,
    initialDelayMs: 100,
    timeoutMs: 3000,
    requireIdempotencyKey: true,
  });

  public static readonly NO_RETRY_POLICY = new TransactionPolicy({
    maxAttempts: 1,
    initialDelayMs: 0,
    timeoutMs: 2000,
    backoffStrategy: "NO_BACKOFF",
  });
}
