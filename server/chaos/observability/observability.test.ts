import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CorrelationManager } from "./CorrelationManager";
import { DistributedTracer, SpanDefinition } from "./DistributedTracer";
import { SpanTreeBuilder } from "./SpanTreeBuilder";
import { MetricsAggregator, RawMetricSample } from "./MetricsAggregator";
import { TelemetryExporter } from "./TelemetryExporter";
import { ObservabilityContext } from "./ObservabilityContext";
import { ObservabilityDashboard } from "./ObservabilityDashboard";
import { ObservabilityReporter } from "./ObservabilityReporter";
import { ObservabilityEngine } from "./ObservabilityEngine";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

describe("Enterprise Observability Platform Test Suite", () => {
  beforeEach(() => {
    EnterpriseEventBus.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("CorrelationManager", () => {
    it("should generate a clean root context when no parent is present", () => {
      const ctx = CorrelationManager.generate(undefined, { user: "admin" });
      expect(ctx.traceId).toBeDefined();
      expect(ctx.spanId).toBeDefined();
      expect(ctx.parentSpanId).toBeUndefined();
      expect(ctx.baggage.user).toBe("admin");
      expect(Object.isFrozen(ctx)).toBe(true);
      expect(Object.isFrozen(ctx.baggage)).toBe(true);
    });

    it("should propagate parent attributes and baggage correctly", () => {
      const parent = CorrelationManager.generate(undefined, { tenant: "enterprise-a" });
      const child = CorrelationManager.generate(parent, { role: "SRE" });

      expect(child.traceId).toBe(parent.traceId);
      expect(child.parentSpanId).toBe(parent.spanId);
      expect(child.baggage.tenant).toBe("enterprise-a");
      expect(child.baggage.role).toBe("SRE");
    });

    it("should inject and extract trace context into header-like carriers", () => {
      const ctx = CorrelationManager.generate(undefined, { region: "us-east-1" });
      const carrier = CorrelationManager.inject(ctx);

      expect(carrier["x-trace-id"]).toBe(ctx.traceId);
      expect(carrier["x-span-id"]).toBe(ctx.spanId);
      expect(carrier["x-baggage-region"]).toBe("us-east-1");

      const extracted = CorrelationManager.extract(carrier);
      expect(extracted.traceId).toBe(ctx.traceId);
      expect(extracted.spanId).toBe(ctx.spanId);
      expect(extracted.baggage.region).toBe("us-east-1");
    });
  });

  describe("DistributedTracer", () => {
    it("should generate high-fidelity trace spans statelessly from definitions", () => {
      const traceId = "tr-test-123";
      const definitions: SpanDefinition[] = [
        {
          name: "Authorize",
          serviceName: "auth-service",
          startOffsetMs: 0,
          durationMs: 120,
          status: "OK",
          attributes: { method: "JWT" },
          events: [
            { name: "verify-token", offsetMs: 20, attributes: { keyId: "kid-1" } }
          ]
        },
        {
          name: "FetchUser",
          serviceName: "user-service",
          startOffsetMs: 130,
          durationMs: 350,
          status: "ERROR",
          statusMessage: "Database timeout",
          attributes: { userId: "usr-99" }
        }
      ];

      const baseTime = "2026-07-21T00:00:00.000Z";
      const spans = DistributedTracer.generateTrace(traceId, definitions, baseTime);

      expect(spans.length).toBe(2);
      expect(spans[0].traceId).toBe(traceId);
      expect(spans[0].name).toBe("Authorize");
      expect(spans[0].serviceName).toBe("auth-service");
      expect(spans[0].startTime).toBe("2026-07-21T00:00:00.000Z");
      expect(spans[0].endTime).toBe("2026-07-21T00:00:00.120Z");
      expect(spans[0].durationMs).toBe(120);
      expect(spans[0].status).toBe("OK");
      expect(spans[0].attributes.method).toBe("JWT");
      expect(spans[0].events.length).toBe(1);
      expect(spans[0].events[0].name).toBe("verify-token");
      expect(spans[0].events[0].timestamp).toBe("2026-07-21T00:00:00.020Z");
      expect(spans[0].events[0].attributes?.keyId).toBe("kid-1");

      expect(spans[1].name).toBe("FetchUser");
      expect(spans[1].status).toBe("ERROR");
      expect(spans[1].statusMessage).toBe("Database timeout");
    });
  });

  describe("SpanTreeBuilder", () => {
    it("should reconstruct hierarchical parent-child trees from flat trace arrays", () => {
      const traceId = "tr-tree";
      const spans = [
        {
          spanId: "sp-root",
          traceId,
          name: "GatewayRoute",
          serviceName: "ingress",
          startTime: "2026-07-21T00:00:00.000Z",
          endTime: "2026-07-21T00:00:01.000Z",
          durationMs: 1000,
          status: "OK" as const,
          attributes: {},
          events: []
        },
        {
          spanId: "sp-child-1",
          traceId,
          parentSpanId: "sp-root",
          name: "AuthCheck",
          serviceName: "auth",
          startTime: "2026-07-21T00:00:00.050Z",
          endTime: "2026-07-21T00:00:00.200Z",
          durationMs: 150,
          status: "OK" as const,
          attributes: {},
          events: []
        },
        {
          spanId: "sp-child-2",
          traceId,
          parentSpanId: "sp-root",
          name: "ProcessData",
          serviceName: "core-api",
          startTime: "2026-07-21T00:00:00.250Z",
          endTime: "2026-07-21T00:00:00.950Z",
          durationMs: 700,
          status: "OK" as const,
          attributes: {},
          events: []
        },
        {
          spanId: "sp-subchild",
          traceId,
          parentSpanId: "sp-child-2",
          name: "SQLSelect",
          serviceName: "postgres",
          startTime: "2026-07-21T00:00:00.300Z",
          endTime: "2026-07-21T00:00:00.800Z",
          durationMs: 500,
          status: "OK" as const,
          attributes: {},
          events: []
        }
      ];

      const roots = SpanTreeBuilder.buildTree(spans);

      expect(roots.length).toBe(1);
      expect(roots[0].span.spanId).toBe("sp-root");
      expect(roots[0].children.length).toBe(2);
      
      const child1 = roots[0].children.find(c => c.span.spanId === "sp-child-1");
      const child2 = roots[0].children.find(c => c.span.spanId === "sp-child-2");

      expect(child1).toBeDefined();
      expect(child1?.children.length).toBe(0);

      expect(child2).toBeDefined();
      expect(child2?.children.length).toBe(1);
      expect(child2?.children[0].span.spanId).toBe("sp-subchild");

      // Verify Deep Freeze
      expect(Object.isFrozen(roots)).toBe(true);
      expect(Object.isFrozen(roots[0])).toBe(true);
      expect(Object.isFrozen(roots[0].children)).toBe(true);
    });
  });

  describe("MetricsAggregator", () => {
    it("should aggregate raw metric samples into correct statistical percentile summaries", () => {
      const samples: RawMetricSample[] = [
        { timestamp: "10:00", serviceName: "api", metricName: "LATENCY", value: 10 },
        { timestamp: "10:01", serviceName: "api", metricName: "LATENCY", value: 20 },
        { timestamp: "10:02", serviceName: "api", metricName: "LATENCY", value: 30 },
        { timestamp: "10:03", serviceName: "api", metricName: "LATENCY", value: 40 },
        { timestamp: "10:04", serviceName: "api", metricName: "LATENCY", value: 50 },
        { timestamp: "10:05", serviceName: "api", metricName: "LATENCY", value: 60 },
        { timestamp: "10:06", serviceName: "api", metricName: "LATENCY", value: 70 },
        { timestamp: "10:07", serviceName: "api", metricName: "LATENCY", value: 80 },
        { timestamp: "10:08", serviceName: "api", metricName: "LATENCY", value: 90 },
        { timestamp: "10:09", serviceName: "api", metricName: "LATENCY", value: 100 },
        { timestamp: "10:10", serviceName: "auth", metricName: "CPU", value: 15 }
      ];

      const summaries = MetricsAggregator.aggregate(samples);

      const apiLatency = summaries.find(s => s.serviceName === "api" && s.metricName === "LATENCY");
      const authCpu = summaries.find(s => s.serviceName === "auth" && s.metricName === "CPU");

      expect(apiLatency).toBeDefined();
      expect(apiLatency?.count).toBe(10);
      expect(apiLatency?.average).toBe(55);
      expect(apiLatency?.min).toBe(10);
      expect(apiLatency?.max).toBe(100);
      expect(apiLatency?.p50).toBe(50);
      expect(apiLatency?.p90).toBe(90);
      expect(apiLatency?.p99).toBe(100);

      expect(authCpu).toBeDefined();
      expect(authCpu?.count).toBe(1);
      expect(authCpu?.average).toBe(15);
      expect(authCpu?.p99).toBe(15);
    });
  });

  describe("TelemetryExporter", () => {
    it("should export traces and metrics to structured OpenTelemetry-compatible models", () => {
      const traceId = "tr-otel";
      const spans = [
        {
          spanId: "sp-otel-1",
          traceId,
          name: "RouteUser",
          serviceName: "gateway",
          startTime: "2026-07-21T01:00:00.000Z",
          endTime: "2026-07-21T01:00:00.500Z",
          durationMs: 500,
          status: "OK" as const,
          attributes: { path: "/user" },
          events: []
        }
      ];

      const metrics = [
        {
          serviceName: "gateway",
          metricName: "LATENCY",
          count: 1,
          average: 500,
          min: 500,
          max: 500,
          p50: 500,
          p90: 500,
          p99: 500
        }
      ];

      const exported = TelemetryExporter.export(spans, metrics);

      expect(exported.format).toBe("OTEL_V1");
      expect(exported.traceCount).toBe(1);
      expect(exported.metricCount).toBe(1);
      expect(exported.traces[0].trace_id).toBe("tr-otel");
      expect(exported.traces[0].span_id).toBe("sp-otel-1");
      // Verify Unix nanoseconds conversion (500ms diff corresponds to correct Unix difference)
      expect(exported.traces[0].start_time_unix_nano).toBe((new Date("2026-07-21T01:00:00.000Z").getTime() * 1000000).toString());
      expect(exported.traces[0].status.code).toBe("STATUS_CODE_OK");
      expect(exported.traces[0].attributes["service.name"]).toBe("gateway");
      expect(exported.traces[0].attributes.path).toBe("/user");
    });
  });

  describe("ObservabilityContext", () => {
    it("should compile a multi-dimensional live platform snapshot", () => {
      const context = ObservabilityContext.compile("production");

      expect(context.timestamp).toBeDefined();
      expect(context.environment).toBe("production");
      expect(context.liveState).toBeDefined();
      expect(context.liveState.timestamp).toBeDefined();
      expect(context.controlPlaneHealth).toBeDefined();
      expect(context.twinSnapshot).toBeDefined();
      expect(context.riskPrediction).toBeDefined();
      expect(context.recentChanges).toBeDefined();
      expect(context.recentReleases).toBeDefined();
    });
  });

  describe("ObservabilityDashboard", () => {
    it("should evaluate normal conditions to HEALTHY status", () => {
      const context = ObservabilityContext.compile("production");
      const spans = [
        {
          spanId: "sp-ok",
          traceId: "tr-ok",
          name: "HealthCheck",
          serviceName: "api",
          startTime: "2026-07-21T01:00:00.000Z",
          endTime: "2026-07-21T01:00:00.050Z",
          durationMs: 50,
          status: "OK" as const,
          attributes: {},
          events: []
        }
      ];
      const metrics = [
        {
          serviceName: "api",
          metricName: "LATENCY",
          count: 1,
          average: 50,
          min: 50,
          max: 50,
          p50: 50,
          p90: 50,
          p99: 50
        }
      ];

      const dashboard = ObservabilityDashboard.compileState(context, spans, metrics);

      expect(dashboard.systemStatus).toBe("HEALTHY");
      expect(dashboard.anomalies.length).toBe(0);
      expect(dashboard.traceAggregates.totalCount).toBe(1);
      expect(dashboard.traceAggregates.errorRate).toBe(0);
      expect(dashboard.traceAggregates.avgDurationMs).toBe(50);
    });

    it("should flag trace errors as WARNING", () => {
      const context = ObservabilityContext.compile("production");
      const spans = [
        {
          spanId: "sp-err",
          traceId: "tr-err",
          name: "GetMetadata",
          serviceName: "gateway",
          startTime: "2026-07-21T01:00:00.000Z",
          endTime: "2026-07-21T01:00:00.050Z",
          durationMs: 50,
          status: "ERROR" as const,
          attributes: {},
          events: []
        },
        {
          spanId: "sp-ok",
          traceId: "tr-err",
          name: "GetMetadata",
          serviceName: "gateway",
          startTime: "2026-07-21T01:00:00.000Z",
          endTime: "2026-07-21T01:00:00.050Z",
          durationMs: 50,
          status: "OK" as const,
          attributes: {},
          events: []
        }
      ];

      const dashboard = ObservabilityDashboard.compileState(context, spans, []);

      expect(dashboard.systemStatus).toBe("DEGRADED");
      expect(dashboard.anomalies.length).toBe(1);
      expect(dashboard.anomalies[0].code).toBe("DETECTED_TRACE_ERRORS");
      expect(dashboard.anomalies[0].severity).toBe("WARNING");
      expect(dashboard.traceAggregates.errorRate).toBe(0.5);
    });

    it("should flag severe trace errors as CRITICAL", () => {
      const context = ObservabilityContext.compile("production");
      const spans = [
        {
          spanId: "sp-err",
          traceId: "tr-err",
          name: "GetMetadata",
          serviceName: "gateway",
          startTime: "2026-07-21T01:00:00.000Z",
          endTime: "2026-07-21T01:00:00.050Z",
          durationMs: 50,
          status: "ERROR" as const,
          attributes: {},
          events: []
        }
      ];

      const dashboard = ObservabilityDashboard.compileState(context, spans, []);

      expect(dashboard.systemStatus).toBe("CRITICAL");
      expect(dashboard.anomalies.some(a => a.code === "HIGH_TRACE_ERROR_RATE")).toBe(true);
    });

    it("should flag metric latency violations as CRITICAL", () => {
      const context = ObservabilityContext.compile("production");
      const metrics = [
        {
          serviceName: "payment-api",
          metricName: "LATENCY",
          count: 5,
          average: 800,
          min: 100,
          max: 1800,
          p50: 700,
          p90: 1200,
          p99: 1500
        }
      ];

      const dashboard = ObservabilityDashboard.compileState(context, [], metrics);

      expect(dashboard.systemStatus).toBe("CRITICAL");
      expect(dashboard.anomalies.some(a => a.code === "P99_LATENCY_VIOLATION")).toBe(true);
    });
  });

  describe("ObservabilityReporter", () => {
    it("should generate beautifully formatted Markdown and JSON reports", () => {
      const context = ObservabilityContext.compile("production");
      const spans = [
        {
          spanId: "sp-1",
          traceId: "tr-rep",
          name: "QueryRow",
          serviceName: "db",
          startTime: "2026-07-21T01:00:00.000Z",
          endTime: "2026-07-21T01:00:00.120Z",
          durationMs: 120,
          status: "OK" as const,
          attributes: {},
          events: []
        }
      ];
      const metrics = [
        {
          serviceName: "db",
          metricName: "LATENCY",
          count: 10,
          average: 100,
          min: 10,
          max: 300,
          p50: 90,
          p90: 180,
          p99: 250
        }
      ];

      const dashboard = ObservabilityDashboard.compileState(context, spans, metrics);
      const markdown = ObservabilityReporter.generateMarkdown(dashboard, spans, metrics);
      const json = ObservabilityReporter.generateJson(dashboard);

      expect(markdown).toContain("# ENTERPRISE SRE OBSERVABILITY REPORT");
      expect(markdown).toContain("db::QueryRow");
      expect(markdown).toContain("db");
      expect(markdown).toContain("LATENCY");

      const parsed = JSON.parse(json);
      expect(parsed.systemStatus).toBe("HEALTHY");
      expect(parsed.traceAggregates.totalCount).toBe(1);
    });
  });

  describe("ObservabilityEngine", () => {
    it("should coordinate a full stateless observability compilation and publish results", async () => {
      const traceDefinitions: SpanDefinition[] = [
        {
          name: "CheckoutFlow",
          serviceName: "checkout-v2",
          startOffsetMs: 0,
          durationMs: 450,
          status: "OK",
          attributes: { source: "web-mobile" }
        }
      ];

      const metricSamples: RawMetricSample[] = [
        { timestamp: "01:00", serviceName: "checkout-v2", metricName: "LATENCY", value: 450 }
      ];

      // Track published events
      const receivedEvents: any[] = [];
      EnterpriseEventBus.subscribe("test-sub-obs", "MetricsUpdated", (evt) => {
        receivedEvents.push(evt);
      });

      const result = ObservabilityEngine.evaluate("production", traceDefinitions, metricSamples);

      expect(result.correlationId).toBeDefined();
      expect(result.spans.length).toBe(1);
      expect(result.spans[0].name).toBe("CheckoutFlow");
      expect(result.metrics.length).toBe(1);
      expect(result.metrics[0].serviceName).toBe("checkout-v2");
      expect(result.dashboard.systemStatus).toBe("HEALTHY");
      expect(result.reportMarkdown).toContain("ENTERPRISE SRE OBSERVABILITY REPORT");

      // Verify async EventBus trigger
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].type).toBe("MetricsUpdated");
      expect(receivedEvents[0].payload.spanCount).toBe(1);
      expect(receivedEvents[0].payload.metricCount).toBe(1);
      expect(receivedEvents[0].payload.systemStatus).toBe("HEALTHY");
    });
  });
});
