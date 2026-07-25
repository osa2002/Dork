import { ICircuitBreaker, CircuitState } from "../contracts/ICircuitBreaker";
import { CircuitBreakerOpenException } from "../exceptions/PPALExceptions";

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
}

export class CircuitBreaker implements ICircuitBreaker {
  public readonly providerId: string;
  private _state: CircuitState = "CLOSED";
  private _failureCount: number = 0;
  private _lastStateChange: Date = new Date();
  private readonly _failureThreshold: number;
  private readonly _resetTimeoutMs: number;

  constructor(providerId: string, options?: Partial<CircuitBreakerOptions>) {
    this.providerId = providerId;
    this._failureThreshold = options?.failureThreshold || 5;
    this._resetTimeoutMs = options?.resetTimeoutMs || 30000;
  }

  public get state(): CircuitState {
    if (this._state === "OPEN") {
      const now = new Date().getTime();
      if (now - this._lastStateChange.getTime() > this._resetTimeoutMs) {
        this._state = "HALF_OPEN";
        this._lastStateChange = new Date();
      }
    }
    return this._state;
  }

  public async execute<T>(action: () => Promise<T>): Promise<T> {
    const currentState = this.state;
    if (currentState === "OPEN") {
      throw new CircuitBreakerOpenException(this.providerId);
    }

    try {
      const result = await action();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }

  public recordSuccess(): void {
    if (this._state === "HALF_OPEN" || this._failureCount > 0) {
      this.reset();
    }
  }

  public recordFailure(_error?: unknown): void {
    this._failureCount += 1;
    if (this._failureCount >= this._failureThreshold && this._state !== "OPEN") {
      this._state = "OPEN";
      this._lastStateChange = new Date();
    }
  }

  public reset(): void {
    this._state = "CLOSED";
    this._failureCount = 0;
    this._lastStateChange = new Date();
  }
}
