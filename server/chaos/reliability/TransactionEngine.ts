import { TransactionContext, TransactionStatus, TransactionIsolationLevel } from "./TransactionContext";
import { TransactionPolicy } from "./TransactionPolicy";
import { AtomicOperation, OperationExecutionResult } from "./AtomicOperation";
import { TransactionCoordinator, TransactionStoreAdapter } from "./TransactionCoordinator";
export type { TransactionStoreAdapter };

export interface TransactionReport {
  transactionId: string;
  correlationId: string;
  tenantId: string;
  status: TransactionStatus;
  committed: boolean;
  attemptsCount: number;
  durationMs: number;
  operationsExecuted: number;
  results: OperationExecutionResult[];
  error?: string;
  policyName: string;
  timestamp: string;
}

export interface RunTransactionOptions {
  correlationId?: string;
  tenantId?: string;
  isolationLevel?: TransactionIsolationLevel;
  policy?: TransactionPolicy;
  metadata?: Record<string, any>;
  storeAdapter?: TransactionStoreAdapter;
}

export class InMemoryStoreAdapter implements TransactionStoreAdapter {
  private data = new Map<string, any>();

  constructor(initialData: Record<string, any> = {}) {
    Object.entries(initialData).forEach(([k, v]) => {
      this.data.set(k, v ? JSON.parse(JSON.stringify(v)) : v);
    });
  }

  public async get<T = any>(path: string): Promise<T> {
    const val = this.data.get(path);
    return val !== undefined ? JSON.parse(JSON.stringify(val)) : null;
  }

  public async set(path: string, data: any): Promise<void> {
    this.data.set(path, JSON.parse(JSON.stringify(data)));
  }

  public async update(path: string, data: any): Promise<void> {
    const current = this.data.get(path) || {};
    const updated = typeof data === "object" && data !== null && typeof current === "object" && current !== null
      ? { ...current, ...data }
      : data;
    this.data.set(path, JSON.parse(JSON.stringify(updated)));
  }

  public async delete(path: string): Promise<void> {
    this.data.delete(path);
  }

  public dump(): Record<string, any> {
    const res: Record<string, any> = {};
    this.data.forEach((v, k) => {
      res[k] = v;
    });
    return res;
  }
}

export class TransactionEngine {
  /**
   * Executes a set of atomic operations or transactional function under policy-driven retries and controls.
   */
  public static async runTransaction(
    operationsOrFn: AtomicOperation[] | ((ctx: TransactionContext, store: TransactionStoreAdapter) => Promise<AtomicOperation[]>),
    options: RunTransactionOptions = {}
  ): Promise<TransactionReport> {
    const policy = options.policy || TransactionPolicy.DEFAULT_POLICY;
    const store = options.storeAdapter || new InMemoryStoreAdapter();
    const context = new TransactionContext({
      correlationId: options.correlationId,
      tenantId: options.tenantId,
      isolationLevel: options.isolationLevel,
      metadata: options.metadata,
    });

    context.setStatus("EXECUTING");

    let lastError: any = null;
    let finalResults: OperationExecutionResult[] = [];
    let isCommitted = false;

    const startTime = Date.now();

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      const attemptStartTime = Date.now();

      // Check transaction global timeout
      if (Date.now() - startTime >= policy.timeoutMs) {
        context.setStatus("TIMED_OUT");
        lastError = new Error(`Transaction ${context.transactionId} timed out after ${policy.timeoutMs}ms`);
        break;
      }

      // Apply backoff delay if retry attempt
      if (attempt > 1) {
        const backoffMs = policy.calculateBackoffDelay(attempt);
        if (backoffMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }

      try {
        // Resolve operations list if supplier function passed
        const ops = typeof operationsOrFn === "function" ? await operationsOrFn(context, store) : operationsOrFn;

        const result = await TransactionCoordinator.executeBatch(ops, context, policy, store);

        const attemptDuration = Date.now() - attemptStartTime;

        if (result.success) {
          context.recordAttempt({
            attemptNumber: attempt,
            timestamp: new Date().toISOString(),
            durationMs: attemptDuration,
            status: "SUCCESS",
            operationsCount: ops.length,
          });

          context.setStatus("COMMITTED");
          finalResults = result.results;
          isCommitted = true;
          break;
        } else {
          lastError = result.error;

          context.recordAttempt({
            attemptNumber: attempt,
            timestamp: new Date().toISOString(),
            durationMs: attemptDuration,
            status: "FAILED",
            error: lastError?.message || String(lastError),
            operationsCount: ops.length,
          });

          // Check if error is non-retryable or if budget exhausted
          if (!policy.isRetryableError(lastError) || policy.isRetryBudgetExhausted(attempt)) {
            context.setStatus("FAILED");
            break;
          }
        }
      } catch (unhandledErr: any) {
        const attemptDuration = Date.now() - attemptStartTime;
        lastError = unhandledErr;

        context.recordAttempt({
          attemptNumber: attempt,
          timestamp: new Date().toISOString(),
          durationMs: attemptDuration,
          status: "FAILED",
          error: unhandledErr?.message || String(unhandledErr),
          operationsCount: 0,
        });

        if (!policy.isRetryableError(unhandledErr) || policy.isRetryBudgetExhausted(attempt)) {
          context.setStatus("FAILED");
          break;
        }
      }
    }

    if (!isCommitted && context.status === "EXECUTING") {
      context.setStatus("FAILED");
    }

    return Object.freeze({
      transactionId: context.transactionId,
      correlationId: context.correlationId,
      tenantId: context.tenantId,
      status: context.status,
      committed: isCommitted,
      attemptsCount: context.currentAttemptCount,
      durationMs: context.durationMs,
      operationsExecuted: context.operationsExecuted.length,
      results: finalResults,
      error: lastError ? lastError.message || String(lastError) : undefined,
      policyName: policy.requireIdempotencyKey ? "STRICT_IDEMPOTENT" : policy.maxAttempts === 1 ? "NO_RETRY" : "DEFAULT",
      timestamp: new Date().toISOString(),
    });
  }
}
