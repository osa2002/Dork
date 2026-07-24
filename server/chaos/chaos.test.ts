import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChaosState } from "./ChaosState";
import { ChaosConfig } from "./ChaosConfig";
import { ChaosRegistry } from "./ChaosRegistry";
import { chaosMiddleware } from "./ChaosMiddleware";
import { ChaosController } from "./ChaosController";
import { LatencyScenario, DatabaseFailureScenario, DependencyFailureScenario, IChaosScenario } from "./ChaosScenarios";
import { TelemetryService } from "../../src/services/TelemetryService";
import { MetricsService } from "../../src/services/MetricsService";

// Mock TelemetryService & MetricsService
vi.mock("../../src/services/TelemetryService", () => {
  const mockSpan = {
    setAttribute: vi.fn(),
    end: vi.fn(),
  };
  return {
    TelemetryService: {
      startSpan: vi.fn(() => mockSpan),
    },
  };
});

describe("Chaos Engineering Suite", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      path: "/api/tickets",
      headers: {
        "x-chaos-auth": "dork-chaos-secret-2026",
      },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();

    // Reset Chaos state before each test
    ChaosState.initialize({
      enabled: true,
      probability: 1.0, // force trigger by default in tests
      latency: 0,
      targetEndpoints: [],
      seed: 123456789,
    });
    ChaosState.resetMetrics();
    ChaosState.clearActiveScenarios();
    ChaosState.clearTargetEndpoints();

    // Ensure gate conditions are true for sandbox testing
    process.env.CHAOS_MODE = "true";
    process.env.NODE_ENV = "development";
    process.env.CHAOS_AUTH_TOKEN = "dork-chaos-secret-2026";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("ChaosConfig and Feature Flags Gate Protection", () => {
    it("should authorize when the correct token is provided", () => {
      expect(ChaosConfig.isAuthorized(req.headers)).toBe(true);
    });

    it("should authorize with Bearer token format", () => {
      const headers = { authorization: "Bearer dork-chaos-secret-2026" };
      expect(ChaosConfig.isAuthorized(headers)).toBe(true);
    });

    it("should reject unauthorized requests", () => {
      const headers = { "x-chaos-auth": "wrong-token" };
      expect(ChaosConfig.isAuthorized(headers)).toBe(false);
    });

    it("should enforce environment gates correctly", () => {
      process.env.NODE_ENV = "production";
      expect(ChaosConfig.isGateApproved()).toBe(false);

      process.env.NODE_ENV = "development";
      process.env.CHAOS_MODE = "false";
      expect(ChaosConfig.isGateApproved()).toBe(false);

      process.env.CHAOS_MODE = "true";
      expect(ChaosConfig.isGateApproved()).toBe(true);
    });
  });

  describe("Seeded Deterministic Probability Engine", () => {
    it("should return false for 0% probability and true for 100% probability", () => {
      ChaosState.setProbability(0);
      expect(ChaosState.evaluateProbability()).toBe(false);

      ChaosState.setProbability(1.0);
      expect(ChaosState.evaluateProbability()).toBe(true);
    });

    it("should generate deterministic seeded random sequence", () => {
      ChaosState.setSeed(42);
      const val1 = ChaosState.seededRandom();
      const val2 = ChaosState.seededRandom();

      ChaosState.resetSeed();
      const val1_repeat = ChaosState.seededRandom();
      const val2_repeat = ChaosState.seededRandom();

      expect(val1).toBe(val1_repeat);
      expect(val2).toBe(val2_repeat);
    });

    it("should evaluate target probability correctly and deterministically", () => {
      ChaosState.setSeed(100);
      ChaosState.setProbability(0.5);

      // Multiple rolls should remain consistent given the seed reset
      const results: boolean[] = [];
      for (let i = 0; i < 5; i++) {
        results.push(ChaosState.evaluateProbability());
      }

      ChaosState.resetSeed();
      const results2: boolean[] = [];
      for (let i = 0; i < 5; i++) {
        results2.push(ChaosState.evaluateProbability());
      }

      expect(results).toEqual(results2);
    });
  });

  describe("Scenario Registry", () => {
    it("should retrieve standard scenarios successfully", () => {
      const latency = ChaosRegistry.get("LatencyScenario");
      expect(latency).toBeDefined();
      expect(latency).toBeInstanceOf(LatencyScenario);

      const dbFail = ChaosRegistry.get("DatabaseFailureScenario");
      expect(dbFail).toBeDefined();
      expect(dbFail).toBeInstanceOf(DatabaseFailureScenario);
    });

    it("should allow registering custom scenarios", () => {
      const customScenario: IChaosScenario = {
        name: "CustomMockScenario",
        description: "Mock for testing",
        run: async () => {},
      };
      ChaosRegistry.register(customScenario);
      expect(ChaosRegistry.get("CustomMockScenario")).toBe(customScenario);
    });
  });

  describe("Chaos Middleware Integration", () => {
    it("should be a no-op if gate is not approved", async () => {
      process.env.CHAOS_MODE = "false";
      await chaosMiddleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(ChaosState.getMetric("chaos_events_total")).toBe(0);
    });

    it("should be a no-op if request is unauthorized", async () => {
      req.headers["x-chaos-auth"] = "unauthorized";
      await chaosMiddleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(ChaosState.getMetric("chaos_events_total")).toBe(0);
    });

    it("should bypass if path does not match target endpoints", async () => {
      ChaosState.addTargetEndpoint("/api/queues"); // target only queues
      req.path = "/api/tickets"; // request is to tickets
      await chaosMiddleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(ChaosState.getMetric("chaos_events_total")).toBe(1);
      expect(ChaosState.getMetric("chaos_events_success")).toBe(1);
    });

    it("should inject latency if LatencyScenario is triggered", async () => {
      req.headers["x-chaos-failure"] = "latency";
      req.headers["x-chaos-latency"] = "10"; // 10ms to keep tests fast

      await chaosMiddleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(ChaosState.getMetric("chaos_events_total")).toBe(1);
      expect(ChaosState.getMetric("chaos_latency_added")).toBe(10);
    });

    it("should inject database failure if DatabaseFailureScenario is triggered via headers", async () => {
      req.headers["x-chaos-failure"] = "firestore_timeout";

      await chaosMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeDefined();
      expect(err.status).toBe(503);
      expect(err.message).toContain("Simulated Chaos");

      expect(ChaosState.getMetric("chaos_events_total")).toBe(1);
      expect(ChaosState.getMetric("chaos_events_failed")).toBe(1);
    });

    it("should inject dependency failure if DependencyFailureScenario is triggered via headers", async () => {
      req.headers["x-chaos-failure"] = "stripe_timeout";

      await chaosMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeDefined();
      expect(err.status).toBe(504);
      expect(err.message).toContain("Simulated Chaos");
    });
  });

  describe("ChaosController Control Plane Endpoints", () => {
    it("should block non-authorized requests on GET", () => {
      req.headers["x-chaos-auth"] = "unauthorized";
      ChaosController.getState(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should retrieve chaos configuration and metrics", () => {
      ChaosController.getState(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        enabled: true,
        probability: 1.0,
      }));
    });

    it("should update configuration on POST", () => {
      req.body = {
        enabled: false,
        probability: 0.5,
        latencyMs: 500,
        targetEndpoints: ["/api/queues"],
      };
      ChaosController.configure(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(ChaosState.getIsEnabled()).toBe(false);
      expect(ChaosState.getProbability()).toBe(0.5);
      expect(ChaosState.getLatency()).toBe(500);
      expect(ChaosState.getTargetEndpoints()).toContain("/api/queues");
    });

    it("should reset configuration on reset POST", () => {
      ChaosController.reset(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(ChaosState.getIsEnabled()).toBe(false);
      expect(ChaosState.getProbability()).toBe(0.25);
      expect(ChaosState.getLatency()).toBe(0);
    });
  });
});
