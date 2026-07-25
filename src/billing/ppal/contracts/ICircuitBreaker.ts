export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface ICircuitBreaker {
  readonly providerId: string;
  readonly state: CircuitState;
  execute<T>(action: () => Promise<T>): Promise<T>;
  recordSuccess(): void;
  recordFailure(error?: unknown): void;
  reset(): void;
}
