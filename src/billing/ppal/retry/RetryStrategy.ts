import { IRetryStrategy, RetryConfig } from "../contracts/IRetryStrategy";
import { MaxRetryExceededException } from "../exceptions/PPALExceptions";

export class RetryStrategy implements IRetryStrategy {
  private readonly _config: RetryConfig;

  constructor(config?: Partial<RetryConfig>) {
    this._config = {
      maxAttempts: config?.maxAttempts || 3,
      initialDelayMs: config?.initialDelayMs || 200,
      backoffFactor: config?.backoffFactor || 2,
      maxDelayMs: config?.maxDelayMs || 3000
    };
  }

  public async execute<T>(
    action: (attempt: number) => Promise<T>,
    isRetryable: (error: unknown) => boolean = () => true
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this._config.maxAttempts; attempt++) {
      try {
        return await action(attempt);
      } catch (error) {
        lastError = error;
        if (attempt >= this._config.maxAttempts || !isRetryable(error)) {
          break;
        }

        const delay = this.calculateDelay(attempt);
        await this.delayMs(delay);
      }
    }

    const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new MaxRetryExceededException(this._config.maxAttempts, errorMsg);
  }

  private calculateDelay(attempt: number): number {
    const rawDelay = this._config.initialDelayMs * Math.pow(this._config.backoffFactor, attempt - 1);
    const jitter = Math.random() * 0.2 * rawDelay;
    return Math.min(rawDelay + jitter, this._config.maxDelayMs);
  }

  private delayMs(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
