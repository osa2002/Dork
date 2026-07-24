import { describe, it, expect, vi } from "vitest";
import { WebhookEnvelope } from "./WebhookEnvelope";
import { DeliveryOutcome } from "./DeliveryOutcome";
import { IdempotencyManager } from "./IdempotencyManager";
import { DeliveryTelemetry } from "./DeliveryTelemetry";
import { DeliveryDispatcher } from "./DeliveryDispatcher";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

describe("Enterprise Webhook Platform - Phase 13.4 Step 3 Modules", () => {
  describe("WebhookEnvelope", () => {
    it("should construct an immutable, signed WebhookEnvelope", () => {
      const envelope = WebhookEnvelope.create({
        deliveryId: "del-301",
        eventName: "ticket_called",
        payload: { ticketNumber: "A-101", counter: "Desk 1" },
        destination: "https://partner.api.com/webhooks",
        secret: "super-secret-key-3000",
      });

      expect(envelope.envelopeId).toBeDefined();
      expect(envelope.deliveryId).toBe("del-301");
      expect(envelope.eventName).toBe("ticket_called");
      expect(envelope.destination).toBe("https://partner.api.com/webhooks");
      expect(envelope.signature).toBeDefined();
      expect(envelope.headers["X-Dork-Signature-SHA256"]).toBe(envelope.signature);
      expect(Object.isFrozen(envelope)).toBe(true);
      expect(Object.isFrozen(envelope.headers)).toBe(true);
    });

    it("should verify cryptographic integrity correctly", () => {
      const envelope = WebhookEnvelope.create({
        deliveryId: "del-302",
        eventName: "ticket_called",
        payload: { ticketNumber: "A-102" },
        destination: "https://partner.api.com/webhooks",
        secret: "super-secret-key-3000",
      });

      const verification = WebhookEnvelope.verifyIntegrity(envelope, "super-secret-key-3000");
      expect(verification.valid).toBe(true);

      const invalidVerification = WebhookEnvelope.verifyIntegrity(envelope, "wrong-secret");
      expect(invalidVerification.valid).toBe(false);
    });
  });

  describe("DeliveryOutcome", () => {
    it("should classify HTTP response status codes accurately", () => {
      expect(DeliveryOutcome.classifyResponse(200, 100)).toBe("SUCCESS");
      expect(DeliveryOutcome.classifyResponse(201, 100)).toBe("SUCCESS");
      expect(DeliveryOutcome.classifyResponse(429, 100)).toBe("RATE_LIMITED");
      expect(DeliveryOutcome.classifyResponse(408, 100)).toBe("TIMEOUT");
      expect(DeliveryOutcome.classifyResponse(500, 100)).toBe("RETRYABLE_FAILURE");
      expect(DeliveryOutcome.classifyResponse(503, 100)).toBe("RETRYABLE_FAILURE");
      expect(DeliveryOutcome.classifyResponse(404, 100)).toBe("NON_RETRYABLE_FAILURE");
      expect(DeliveryOutcome.classifyResponse(401, 100)).toBe("NON_RETRYABLE_FAILURE");
    });

    it("should create frozen DeliveryOutcome objects", () => {
      const outcome = DeliveryOutcome.create({
        deliveryId: "del-303",
        envelopeId: "env-303",
        status: "SUCCESS",
        responseCode: 200,
        latencyMs: 120,
        message: "OK",
        correlationId: "corr-303",
        traceId: "trace-303",
      });

      expect(outcome.outcomeId).toBeDefined();
      expect(outcome.status).toBe("SUCCESS");
      expect(outcome.isRetryable).toBe(false);
      expect(Object.isFrozen(outcome)).toBe(true);
    });
  });

  describe("IdempotencyManager", () => {
    it("should generate deterministic keys and detect collisions", () => {
      const key1 = IdempotencyManager.generateKey("env-1", "https://api.test/wh", "hash123");
      const key2 = IdempotencyManager.generateKey("env-1", "https://api.test/wh", "hash123");

      expect(key1).toBe(key2);

      const val1 = IdempotencyManager.validateKey(key1, []);
      expect(val1.isDuplicate).toBe(false);

      const val2 = IdempotencyManager.validateKey(key1, [key1]);
      expect(val2.isDuplicate).toBe(true);
    });
  });

  describe("DeliveryTelemetry", () => {
    it("should build immutable telemetry payload from envelope and outcome", () => {
      const envelope = WebhookEnvelope.create({
        deliveryId: "del-304",
        eventName: "new_ticket",
        payload: { ticketNumber: "B-200" },
        destination: "https://api.test/wh",
      });

      const outcome = DeliveryOutcome.create({
        deliveryId: "del-304",
        envelopeId: envelope.envelopeId,
        status: "SUCCESS",
        responseCode: 200,
        latencyMs: 85,
        message: "OK",
        correlationId: envelope.correlationId,
        traceId: envelope.traceId,
      });

      const telemetry = DeliveryTelemetry.buildTelemetry(envelope, outcome);

      expect(telemetry.telemetryId).toBeDefined();
      expect(telemetry.eventType).toBe("WEBHOOK_DISPATCH_TELEMETRY");
      expect(telemetry.destination).toBe("https://api.test/wh");
      expect(telemetry.latencyMs).toBe(85);
      expect(telemetry.payloadSizeBytes).toBeGreaterThan(0);
      expect(Object.isFrozen(telemetry)).toBe(true);
    });
  });

  describe("DeliveryDispatcher", () => {
    it("should execute synchronous HTTP dispatch using mock response handler", async () => {
      const envelope = WebhookEnvelope.create({
        deliveryId: "del-305",
        eventName: "ticket_called",
        payload: { ticketNumber: "C-300" },
        destination: "https://mock.service/webhook",
        secret: "test-secret-99",
      });

      const report = await DeliveryDispatcher.dispatch(envelope, {
        method: "POST",
        mockResponseHandler: async (url, opts) => {
          return {
            status: 200,
            body: JSON.stringify({ received: true }),
          };
        },
      });

      expect(report.envelope.deliveryId).toBe("del-305");
      expect(report.outcome.status).toBe("SUCCESS");
      expect(report.outcome.responseCode).toBe(200);
      expect(report.isDuplicate).toBe(false);
      expect(report.telemetry).toBeDefined();
      expect(Object.isFrozen(report)).toBe(true);
    });

    it("should block dispatch when idempotency key is duplicate", async () => {
      const envelope = WebhookEnvelope.create({
        deliveryId: "del-306",
        eventName: "ticket_called",
        payload: { ticketNumber: "C-301" },
        destination: "https://mock.service/webhook",
      });

      const idempotencyKey = IdempotencyManager.generateKeyFromEnvelope(envelope);

      const report = await DeliveryDispatcher.dispatch(envelope, {
        processedIdempotencyKeys: [idempotencyKey],
      });

      expect(report.isDuplicate).toBe(true);
      expect(report.outcome.status).toBe("POLICY_BLOCKED");
      expect(report.outcome.responseCode).toBe(409);
    });

    it("should publish telemetry to EnterpriseEventBus upon dispatch completion", async () => {
      const observer = vi.fn();
      const subId = EnterpriseEventBus.subscribe("TestTelemetrySub", "PlatformStateAudited", async (e) => {
        observer(e);
      });

      const envelope = WebhookEnvelope.create({
        deliveryId: "del-307",
        eventName: "ticket_called",
        payload: { ticketNumber: "C-302" },
        destination: "https://mock.service/webhook",
      });

      await DeliveryDispatcher.dispatch(envelope, {
        mockResponseHandler: async () => ({ status: 200, body: "OK" }),
      });

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(observer).toHaveBeenCalledTimes(1);

      EnterpriseEventBus.unsubscribe(subId);
    });
  });
});
