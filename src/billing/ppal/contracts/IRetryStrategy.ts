export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  backoffFactor: number;
  maxDelayMs: number;
}

export interface IRetryStrategy {
  execute<T>(
    action: (attempt: number) => Promise<T>,
    isRetryable?: (error: unknown) => boolean
  ): Promise<T>;
}
