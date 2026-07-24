import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  TransactionContext,
  TransactionPolicy,
  AtomicOperation,
  TransactionValidator,
  TransactionCoordinator,
  TransactionEngine,
  InMemoryStoreAdapter
} from "./index";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

describe("Phase 14.1 - Enterprise Reliability Platform Test Suite", () => {
  beforeEach(() => {
    EnterpriseEventBus.clear();
  });

  describe("TransactionContext", () => {
    it("should initialize with unique transaction ID and default values", () => {
      const ctx = new TransactionContext({ tenantId: "shop_123" });
      expect(ctx.transactionId).toMatch(/^tx_/);
      expect(ctx.correlationId).toMatch(/^corr_/);
      expect(ctx.tenantId).toBe("shop_123");
      expect(ctx.isolationLevel).toBe("SERIALIZABLE");
      expect(ctx.status).toBe("PENDING");
      expect(ctx.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should correctly record attempts and status updates", () => {
      const ctx = new TransactionContext();
      ctx.setStatus("EXECUTING");

      ctx.recordAttempt({
        attemptNumber: 1,
        timestamp: new Date().toISOString(),
        durationMs: 15,
        status: "FAILED",
        error: "409 CONCURRENCY_CONFLICT",
        operationsCount: 2,
      });

      expect(ctx.currentAttemptCount).toBe(1);
      expect(ctx.attempts[0].status).toBe("FAILED");

      ctx.setStatus("COMMITTED");
      expect(ctx.status).toBe("COMMITTED");

      const json = ctx.toJSON();
      expect(json.status).toBe("COMMITTED");
      expect(json.attemptsCount).toBe(1);
    });
  });

  describe("TransactionPolicy", () => {
    it("should correctly calculate exponential backoff with jitter limits", () => {
      const policy = new TransactionPolicy({
        initialDelayMs: 100,
        backoffFactor: 2,
        maxDelayMs: 1000,
        jitter: false,
        backoffStrategy: "EXPONENTIAL",
      });

      expect(policy.calculateBackoffDelay(1)).toBe(0);
      expect(policy.calculateBackoffDelay(2)).toBe(100);
      expect(policy.calculateBackoffDelay(3)).toBe(200);
      expect(policy.calculateBackoffDelay(4)).toBe(400);
      expect(policy.calculateBackoffDelay(5)).toBe(800);
      expect(policy.calculateBackoffDelay(6)).toBe(1000); // capped at maxDelayMs
    });

    it("should correctly classify retryable errors vs non-retryable errors", () => {
      const policy = TransactionPolicy.DEFAULT_POLICY;

      expect(policy.isRetryableError({ code: "409" })).toBe(true);
      expect(policy.isRetryableError({ message: "Transaction ABORTED due to lock" })).toBe(true);
      expect(policy.isRetryableError({ message: "Syntax error near SELECT", isFatal: true })).toBe(false);
      expect(policy.isRetryableError({ message: "USER_UNAUTHORIZED", nonRetryable: true })).toBe(false);
    });

    it("should support predefined policy presets", () => {
      expect(TransactionPolicy.HIGH_CONCURRENCY_POLICY.maxAttempts).toBe(5);
      expect(TransactionPolicy.STRICT_IDEMPOTENT_POLICY.requireIdempotencyKey).toBe(true);
      expect(TransactionPolicy.NO_RETRY_POLICY.maxAttempts).toBe(1);
    });
  });

  describe("AtomicOperation", () => {
    it("should build operations with valid path specifications", () => {
      const op = AtomicOperation.write("shops/shop_1/tickets/t_1", { status: "WAITING" }, {
        idempotencyKey: "idem_101",
      });

      expect(op.type).toBe("WRITE");
      expect(op.targetPath).toBe("shops/shop_1/tickets/t_1");
      expect(op.payload).toEqual({ status: "WAITING" });
      expect(op.idempotencyKey).toBe("idem_101");
    });

    it("should throw an error when initialized with empty path", () => {
      expect(() => new AtomicOperation({ type: "READ", targetPath: "" })).toThrow("valid non-empty targetPath");
    });
  });

  describe("TransactionValidator", () => {
    it("should validate operations pre-flight and report issues", () => {
      const ctx = new TransactionContext();
      const policy = TransactionPolicy.STRICT_IDEMPOTENT_POLICY; // requires idempotency key
      const ops = [AtomicOperation.write("shops/s1/tickets/t1", { status: "CALLED" })];

      const report = TransactionValidator.validatePreFlight(ops, ctx, policy);
      expect(report.isValid).toBe(false);
      expect(report.issues[0].code).toBe("MISSING_IDEMPOTENCY_KEY");
    });

    it("should evaluate conditions against state map", async () => {
      const ops = [
        AtomicOperation.check("tickets/t1", (data) => data && data.status === "WAITING"),
      ];

      const stateMap = new Map<string, any>();
      stateMap.set("tickets/t1", { status: "CALLED" }); // status mismatch

      const report = await TransactionValidator.evaluateConditions(ops, stateMap);
      expect(report.isValid).toBe(false);
      expect(report.issues[0].code).toBe("CONDITION_FAILED");
    });
  });

  describe("TransactionCoordinator", () => {
    it("should execute batch of atomic operations atomically", async () => {
      const store = new InMemoryStoreAdapter({
        "tickets/t_1": { id: "t_1", number: "A-01", status: "WAITING" },
      });

      const ctx = new TransactionContext({ tenantId: "shop_1" });
      const ops = [
        AtomicOperation.check("tickets/t_1", (doc) => doc.status === "WAITING"),
        AtomicOperation.update("tickets/t_1", { status: "CALLED", counterId: "counter_A" }),
      ];

      const res = await TransactionCoordinator.executeBatch(ops, ctx, TransactionPolicy.DEFAULT_POLICY, store);
      expect(res.success).toBe(true);

      const updated = await store.get("tickets/t_1");
      expect(updated.status).toBe("CALLED");
      expect(updated.counterId).toBe("counter_A");
    });

    it("should trigger rollback and compensating action on condition failure", async () => {
      const store = new InMemoryStoreAdapter({
        "tickets/t_2": { id: "t_2", status: "COMPLETED" },
      });

      const compensatingFn = vi.fn();

      const ctx = new TransactionContext();
      const ops = [
        AtomicOperation.write("tickets/t_2", { status: "CALLED" }, { compensatingAction: compensatingFn }),
        AtomicOperation.check("tickets/t_2", (doc) => doc.status === "WAITING"), // fails
      ];

      const res = await TransactionCoordinator.executeBatch(ops, ctx, TransactionPolicy.DEFAULT_POLICY, store);
      expect(res.success).toBe(false);
      expect(ctx.status).toBe("ROLLED_BACK");
    });
  });

  describe("TransactionEngine", () => {
    it("should run transaction successfully and return immutable report", async () => {
      const store = new InMemoryStoreAdapter();

      const report = await TransactionEngine.runTransaction([
        AtomicOperation.write("counters/c_1", { currentNumber: 1 }),
      ], { storeAdapter: store });

      expect(report.committed).toBe(true);
      expect(report.status).toBe("COMMITTED");
      expect(report.attemptsCount).toBe(1);
      expect(report.operationsExecuted).toBe(1);
      expect(Object.isFrozen(report)).toBe(true);

      const written = await store.get("counters/c_1");
      expect(written.currentNumber).toBe(1);
    });

    it("should retry transient error according to policy and succeed", async () => {
      const store = new InMemoryStoreAdapter();
      let attemptCount = 0;

      const report = await TransactionEngine.runTransaction(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          const err = new Error("409 CONCURRENCY_CONFLICT");
          (err as any).code = "409";
          throw err;
        }
        return [AtomicOperation.write("audit/log_1", { event: "RECOVERED" })];
      }, {
        policy: new TransactionPolicy({ maxAttempts: 3, initialDelayMs: 10, backoffStrategy: "NO_BACKOFF" }),
        storeAdapter: store,
      });

      expect(report.committed).toBe(true);
      expect(report.attemptsCount).toBe(2);
      expect(attemptCount).toBe(2);
    });

    it("should abort immediately on non-retryable fatal error", async () => {
      const store = new InMemoryStoreAdapter();
      let attemptCount = 0;

      const report = await TransactionEngine.runTransaction(async () => {
        attemptCount++;
        const fatalErr = new Error("FATAL_INVALID_SCHEMA");
        (fatalErr as any).isFatal = true;
        throw fatalErr;
      }, {
        policy: new TransactionPolicy({ maxAttempts: 5, initialDelayMs: 10 }),
        storeAdapter: store,
      });

      expect(report.committed).toBe(false);
      expect(report.status).toBe("FAILED");
      expect(report.attemptsCount).toBe(1);
      expect(attemptCount).toBe(1);
    });
  });
});
