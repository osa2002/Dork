import { describe, it, expect, vi } from "vitest";
import { WebhookDefinition } from "./WebhookDefinition";
import { WebhookContext } from "./WebhookContext";
import { WebhookPolicy, DEFAULT_WEBHOOK_POLICY_CONFIG } from "./WebhookPolicy";
import { WebhookEngine } from "./WebhookEngine";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

describe("Enterprise Webhook Platform - Core Module", () => {
  describe("WebhookDefinition", () => {
    it("should create an immutable, frozen WebhookDefinition with defaults", () => {
      const def = WebhookDefinition.create({
        name: "Test Endpoint",
        url: "https://api.example.com/v1/webhooks",
      });

      expect(def.id).toBeDefined();
      expect(def.name).toBe("Test Endpoint");
      expect(def.url).toBe("https://api.example.com/v1/webhooks");
      expect(def.method).toBe("POST");
      expect(def.status).toBe("ACTIVE");
      expect(def.deliveryMode).toBe("ASYNC");
      expect(def.version).toBe("1.0.0");
      expect(def.events).toContain("ticket.created");
      expect(Object.isFrozen(def)).toBe(true);
      expect(Object.isFrozen(def.events)).toBe(true);
    });

    it("should validate valid and invalid webhook definitions", () => {
      const validDef = WebhookDefinition.create({
        name: "Order Processing Webhook",
        url: "https://webhooks.partner.com/events",
      });
      const validRes = WebhookDefinition.validate(validDef);
      expect(validRes.valid).toBe(true);
      expect(validRes.errors.length).toBe(0);

      const invalidDef = WebhookDefinition.create({
        name: "",
        url: "ftp://invalid-protocol.com",
        events: [],
      });
      const invalidRes = WebhookDefinition.validate(invalidDef);
      expect(invalidRes.valid).toBe(false);
      expect(invalidRes.errors.length).toBeGreaterThan(0);
    });
  });

  describe("WebhookContext", () => {
    it("should aggregate read-only platform state into an immutable context snapshot", () => {
      const ctx = WebhookContext.compile("production", "corr-test-wh-100");

      expect(ctx.environment).toBe("production");
      expect(ctx.correlationId).toBe("corr-test-wh-100");
      expect(ctx.operationsState).toBeDefined();
      expect(ctx.observability).toBeDefined();
      expect(ctx.governance).toBeDefined();
      expect(ctx.security).toBeDefined();
      expect(ctx.deployment).toBeDefined();
      expect(ctx.release).toBeDefined();
      expect(ctx.change).toBeDefined();
      expect(ctx.platformKernel).toBeDefined();

      expect(Object.isFrozen(ctx)).toBe(true);
      expect(Object.isFrozen(ctx.security)).toBe(true);
    });
  });

  describe("WebhookPolicy", () => {
    it("should enforce HTTPS requirement in production environment", () => {
      const ctx = WebhookContext.compile("production");

      const httpDef = WebhookDefinition.create({
        name: "Insecure Production Endpoint",
        url: "http://api.example.com/webhook",
      });

      const res = WebhookPolicy.evaluate(httpDef, ctx);
      expect(res.compliant).toBe(false);
      expect(res.violationsCount).toBeGreaterThan(0);

      const httpsDef = WebhookDefinition.create({
        name: "Secure Production Endpoint",
        url: "https://api.example.com/webhook",
        secret: "super-secret-enterprise-key-12345",
      });

      const secureRes = WebhookPolicy.evaluate(httpsDef, ctx);
      expect(secureRes.compliant).toBe(true);
      expect(secureRes.score).toBe(100);
    });

    it("should reject forbidden loopback and metadata IPs in production", () => {
      const ctx = WebhookContext.compile("production");

      const loopbackDef = WebhookDefinition.create({
        name: "Loopback Attack Endpoint",
        url: "https://127.0.0.1/webhook",
        secret: "super-secret-enterprise-key-12345",
      });

      const res = WebhookPolicy.evaluate(loopbackDef, ctx);
      expect(res.compliant).toBe(false);
      const loopbackViolation = res.results.find((r) => r.ruleId === "WH-POL-002");
      expect(loopbackViolation?.passed).toBe(false);
    });
  });

  describe("WebhookEngine", () => {
    it("should perform pure, stateless evaluation of a webhook definition", () => {
      const def = WebhookDefinition.create({
        name: "Enterprise Ticket Webhook",
        url: "https://hooks.slack.com/services/T00/B00/X00",
        secret: "secret-key-enterprise-9999",
        events: ["ticket_called", "new_ticket"],
      });

      const report = WebhookEngine.evaluateWebhook(def);

      expect(report.definitionId).toBe(def.id);
      expect(report.url).toBe(def.url);
      expect(report.isValidDefinition).toBe(true);
      expect(report.policyCompliance.compliant).toBe(true);
      expect(report.readyForDispatch).toBe(true);
      expect(report.samplePayload).toBeDefined();
      expect(report.signaturePreview).toBeDefined();
      expect(report.signaturePreview?.length).toBe(64); // SHA-256 hex string length
    });

    it("should generate deterministic HMAC SHA-256 signatures", () => {
      const payload = JSON.stringify({ event: "test.event", id: "123" });
      const secret = "test-secret-key-123";

      const sig1 = WebhookEngine.calculateHmacSignature(payload, secret);
      const sig2 = WebhookEngine.calculateHmacSignature(payload, secret);

      expect(sig1).toBe(sig2);
      expect(sig1.length).toBe(64);
    });

    it("should integrate read-only with EnterpriseEventBus without side effects", async () => {
      const observer = vi.fn();
      const unsubscribe = WebhookEngine.subscribeToEventBus(observer);

      EnterpriseEventBus.publish(
        "SystemStateChanged",
        { state: "HEALTHY" }
      );

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(observer).toHaveBeenCalledTimes(1);

      unsubscribe();

      EnterpriseEventBus.publish(
        "SystemStateChanged",
        { state: "DEGRADED" }
      );

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(observer).toHaveBeenCalledTimes(1);
    });
  });
});
