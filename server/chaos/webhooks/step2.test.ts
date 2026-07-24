import { describe, it, expect } from "vitest";
import { DeliveryQueue } from "./DeliveryQueue";
import { RetryEngine } from "./RetryEngine";
import { DeadLetterQueue } from "./DeadLetterQueue";
import { DeliveryHistory } from "./DeliveryHistory";

describe("Enterprise Webhook Platform - Phase 13.4 Step 2 Modules", () => {
  describe("DeliveryQueue", () => {
    it("should create an immutable, frozen delivery plan", () => {
      const plan = DeliveryQueue.createPlan({
        webhookId: "wh-101",
        eventType: "ticket.called",
        payload: { ticketId: "tkt-555", status: "CALLED" },
        destinationUrl: "https://example.com/webhook",
        maxAttempts: 3,
      });

      expect(plan.deliveryId).toBeDefined();
      expect(plan.webhookId).toBe("wh-101");
      expect(plan.eventType).toBe("ticket.called");
      expect(plan.status).toBe("READY");
      expect(plan.currentAttempt).toBe(0);
      expect(plan.maxAttempts).toBe(3);
      expect(Object.isFrozen(plan)).toBe(true);
      expect(Object.isFrozen(plan.payload)).toBe(true);
    });

    it("should transition status immutably without mutating original plan", () => {
      const originalPlan = DeliveryQueue.createPlan({
        webhookId: "wh-101",
        eventType: "ticket.called",
        payload: { ticketId: "tkt-555" },
        destinationUrl: "https://example.com/webhook",
      });

      const processingPlan = DeliveryQueue.transitionStatus(originalPlan, "PROCESSING", "Dispatch starting", true);

      expect(originalPlan.status).toBe("READY");
      expect(originalPlan.currentAttempt).toBe(0);

      expect(processingPlan.status).toBe("PROCESSING");
      expect(processingPlan.currentAttempt).toBe(1);
      expect(processingPlan.lastStatusReason).toBe("Dispatch starting");
      expect(Object.isFrozen(processingPlan)).toBe(true);
    });

    it("should evaluate queue batch and identify expired plans", () => {
      const activePlan = DeliveryQueue.createPlan({
        webhookId: "wh-101",
        eventType: "ticket.created",
        payload: {},
        destinationUrl: "https://example.com/wh1",
        ttlMs: 3600000,
      });

      const expiredPlan = DeliveryQueue.createPlan({
        webhookId: "wh-102",
        eventType: "ticket.created",
        payload: {},
        destinationUrl: "https://example.com/wh2",
        ttlMs: -1000, // already expired
      });

      const evalRes = DeliveryQueue.evaluateQueueBatch([activePlan, expiredPlan]);

      expect(evalRes.totalPlans).toBe(2);
      expect(evalRes.statusBreakdown.READY).toBe(1);
      expect(evalRes.statusBreakdown.EXPIRED).toBe(1);
      expect(evalRes.activePlans.length).toBe(1);
      expect(evalRes.expiredPlans.length).toBe(1);
    });
  });

  describe("RetryEngine", () => {
    it("should calculate pure backoff delays for various strategies", () => {
      const fixedDelay = RetryEngine.calculateDelayMs(2, { strategy: "FIXED", initialIntervalMs: 1000 });
      expect(fixedDelay).toBe(1000);

      const linearDelay = RetryEngine.calculateDelayMs(3, { strategy: "LINEAR", initialIntervalMs: 1000 });
      expect(linearDelay).toBe(3000);

      const expDelay = RetryEngine.calculateDelayMs(3, { strategy: "EXPONENTIAL", initialIntervalMs: 1000, backoffMultiplier: 2 });
      expect(expDelay).toBe(4000); // 1000 * 2^(3-1) = 4000
    });

    it("should compute complete schedule without sleep or timers", () => {
      const nowIso = new Date().toISOString();
      const schedule = RetryEngine.calculateSchedule("del-999", nowIso, {
        maxRetries: 4,
        strategy: "EXPONENTIAL",
        initialIntervalMs: 500,
      });

      expect(schedule.deliveryId).toBe("del-999");
      expect(schedule.totalAttemptsScheduled).toBe(4);
      expect(schedule.schedule.length).toBe(4);
      expect(schedule.schedule[3].isFinalAttempt).toBe(true);
      expect(Object.isFrozen(schedule)).toBe(true);
    });

    it("should evaluate retry eligibility cleanly", () => {
      const nowIso = new Date().toISOString();
      const eligibility = RetryEngine.evaluateRetryEligibility(2, nowIso, { maxRetries: 5 });

      expect(eligibility.canRetry).toBe(true);
      expect(eligibility.nextDelayMs).toBeGreaterThan(0);

      const exhausted = RetryEngine.evaluateRetryEligibility(5, nowIso, { maxRetries: 5 });
      expect(exhausted.canRetry).toBe(false);
      expect(exhausted.reason).toContain("exhausted");
    });
  });

  describe("DeadLetterQueue", () => {
    it("should create frozen dead-letter records and analyze batches", () => {
      const rec1 = DeadLetterQueue.createRecord({
        deliveryId: "del-101",
        webhookId: "wh-1",
        destinationUrl: "https://api.test/wh",
        eventType: "new_ticket",
        failureCategory: "NETWORK_TIMEOUT",
        reason: "Connection timed out after 5000ms",
        lastError: "ETIMEDOUT",
        failureCount: 5,
      });

      const rec2 = DeadLetterQueue.createRecord({
        deliveryId: "del-102",
        webhookId: "wh-2",
        destinationUrl: "https://api.test/wh2",
        eventType: "ticket_called",
        failureCategory: "HTTP_5XX_SERVER_ERROR",
        reason: "Internal Server Error 503",
        lastError: "503 Service Unavailable",
        failureCount: 5,
      });

      expect(Object.isFrozen(rec1)).toBe(true);

      const analysis = DeadLetterQueue.analyzeBatch([rec1, rec2]);
      expect(analysis.totalRecords).toBe(2);
      expect(analysis.categoryCounts.NETWORK_TIMEOUT).toBe(1);
      expect(analysis.categoryCounts.HTTP_5XX_SERVER_ERROR).toBe(1);
      expect(Object.isFrozen(analysis)).toBe(true);
    });
  });

  describe("DeliveryHistory", () => {
    it("should record attempt and summarize delivery audit statistics", () => {
      const r1 = DeliveryHistory.recordAttempt({
        deliveryId: "del-1",
        webhookId: "wh-1",
        attempt: 1,
        status: "DELIVERED",
        responseCode: 200,
        latencyMs: 150,
      });

      const r2 = DeliveryHistory.recordAttempt({
        deliveryId: "del-2",
        webhookId: "wh-1",
        attempt: 1,
        status: "FAILED",
        responseCode: 500,
        latencyMs: 400,
        errorMessage: "Server crash",
      });

      expect(Object.isFrozen(r1)).toBe(true);

      const summary = DeliveryHistory.summarize([r1, r2]);
      expect(summary.totalAuditRecords).toBe(2);
      expect(summary.successCount).toBe(1);
      expect(summary.failureCount).toBe(1);
      expect(summary.successRatePercent).toBe(50);
      expect(summary.avgLatencyMs).toBe(275);
      expect(summary.httpStatusBreakdown[200]).toBe(1);
      expect(summary.httpStatusBreakdown[500]).toBe(1);
    });
  });
});
