export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  maxDelayMs?: number;
}

export class RetrySafePersistence {
  private readonly maxAttempts: number;
  private readonly initialDelayMs: number;
  private readonly backoffFactor: number;
  private readonly maxDelayMs: number;

  constructor(options: RetryOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.initialDelayMs = options.initialDelayMs ?? 100;
    this.backoffFactor = options.backoffFactor ?? 2;
    this.maxDelayMs = options.maxDelayMs ?? 3000;
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: any;
    let delay = this.initialDelayMs;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (err: any) {
        lastError = err;

        const isTransient = this.isTransientError(err);
        if (!isTransient || attempt === this.maxAttempts) {
          throw err;
        }

        await this.sleep(delay);
        delay = Math.min(delay * this.backoffFactor, this.maxDelayMs);
      }
    }

    throw lastError;
  }

  private isTransientError(err: any): boolean {
    if (!err) return false;
    const msg = String(err.message || err.code || "").toUpperCase();
    return (
      msg.includes("UNAVAILABLE") ||
      msg.includes("DEADLINE_EXCEEDED") ||
      msg.includes("ABORTED") ||
      msg.includes("RESOURCE_EXHAUSTED") ||
      msg.includes("INTERNAL") ||
      msg.includes("ETIMEDOUT") ||
      msg.includes("ECONNRESET")
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
