import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { KnowledgeClassifier } from "./KnowledgeClassifier";
import { KnowledgeCorrelation } from "./KnowledgeCorrelation";
import { KnowledgeSearch } from "./KnowledgeSearch";
import { KnowledgeInsights } from "./KnowledgeInsights";
import { KnowledgeReporter } from "./KnowledgeReporter";
import { KnowledgeRecord } from "./KnowledgeRecord";
import { KnowledgeRepository } from "./KnowledgeRepository";

// Helper to build a comprehensive mock record
function createMockRecord(id: string, overrides: Partial<KnowledgeRecord> = {}): KnowledgeRecord {
  return {
    id,
    timestamp: overrides.timestamp || new Date().toISOString(),
    experimentId: overrides.experimentId || "exp-latency-sim",
    experimentName: overrides.experimentName || "Latency Simulation Experiment",
    workflow: overrides.workflow || "Rollback Workflow",
    decision: overrides.decision || "ROLLBACK",
    recovery: overrides.recovery !== undefined ? overrides.recovery : null,
    health: overrides.health || {
      status: "DEGRADED",
      impactScore: overrides.impact ?? 30,
      reason: "Slow queries",
      activeScenarios: [],
      latencyAddedMs: 250,
      injectionProbability: 0.1,
    },
    impact: overrides.impact ?? 30,
    blastRadius: overrides.blastRadius || "Low",
    SLO: overrides.SLO || {
      availability: { target: 99.9, actual: 99.5, errorBudgetRemaining: 5.0, totalRequests: 1000, failedRequests: 5 },
      latency: { targetMs: 200, actualP95Ms: 220 },
      apiResponseTime: { targetMs: 300, actualP95Ms: 290 },
      queueProcessingTime: { targetSeconds: 10, actualSeconds: 8 },
      ticketCreationTime: { targetMs: 100, actualMs: 90 },
      aiResponseTime: { targetMs: 2000, actualMs: 1800 },
      paymentLatency: { targetMs: 1000, actualMs: 950 },
    },
    MTTR: overrides.MTTR ?? 1500,
    rollback: overrides.rollback || { occurred: true, durationMs: 400, success: true },
    incidentId: overrides.incidentId !== undefined ? overrides.incidentId : "inc-abc-123",
    enterpriseScore: overrides.enterpriseScore || {
      reliabilityScore: 92,
      resilienceScore: 88,
      recoverabilityScore: 90,
      observabilityScore: 94,
      operationalReadiness: 91,
      overallEnterpriseScore: 91,
      letterGrade: "A",
    },
    dependencyGraphSnapshot: overrides.dependencyGraphSnapshot || {
      nodes: [
        { id: "Svc-A", name: "Service A", type: "service", status: "HEALTHY", lastActive: new Date().toISOString() },
        { id: "Db-X", name: "Database X", type: "database", status: "DEGRADED", lastActive: new Date().toISOString() },
      ],
      edges: [],
    },
    correlationId: overrides.correlationId || "corr-999",
    status: overrides.status || "SUCCESS",
    tags: overrides.tags || ["slow"],
    metadata: overrides.metadata || {},
  };
}

describe("Enterprise Knowledge Intelligence Layer", () => {
  beforeEach(() => {
    KnowledgeRepository.clear();
    KnowledgeRepository.setCapacityLimit(100);
  });

  afterEach(() => {
    KnowledgeRepository.clear();
  });

  describe("KnowledgeClassifier", () => {
    it("should classify a latency database experiment correctly", () => {
      const rec = createMockRecord("rec-1", {
        experimentId: "exp-firestore-delay",
        experimentName: "Firestore Slow Injector",
        tags: ["database", "latency"],
      });

      const classification = KnowledgeClassifier.classify(rec);
      expect(classification.failureType).toBe("Latency Injection");
      expect(classification.recoveryPattern).toBe("Rollback");
      expect(classification.dependencyType).toBe("Database");
      expect(classification.infrastructure).toBe("Database");
      expect(classification.pillar).toBe("Performance");
    });

    it("should classify an API disconnect experiment correctly", () => {
      const rec = createMockRecord("rec-2", {
        experimentId: "exp-twilio-failure",
        experimentName: "Twilio HTTP Connection API Outage",
        workflow: "Escalate Workflow",
        tags: ["api", "network"],
        rollback: { occurred: false, durationMs: 0, success: false },
        health: {
          status: "UNAVAILABLE",
          impactScore: 100,
          reason: "Connection reset",
          activeScenarios: [],
          latencyAddedMs: 0,
          injectionProbability: 1.0,
        },
      });

      const classification = KnowledgeClassifier.classify(rec);
      expect(classification.failureType).toBe("API Outage");
      expect(classification.recoveryPattern).toBe("Escalation");
      expect(classification.dependencyType).toBe("External API");
      expect(classification.infrastructure).toBe("External API");
      expect(classification.pillar).toBe("Reliability");
    });
  });

  describe("KnowledgeCorrelation", () => {
    it("should analyze and aggregate repeated items, rollback stats, and incident chains correctly", () => {
      const rec1 = createMockRecord("rec-1", {
        experimentId: "exp-db",
        incidentId: "inc-1",
        status: "SUCCESS",
        MTTR: 1000,
        timestamp: "2026-07-20T10:00:00Z",
      });
      const rec2 = createMockRecord("rec-2", {
        experimentId: "exp-db",
        incidentId: "inc-1",
        status: "FAILED",
        MTTR: 2000,
        timestamp: "2026-07-20T11:00:00Z",
      });
      const rec3 = createMockRecord("rec-3", {
        experimentId: "exp-network",
        incidentId: "inc-2",
        status: "DEGRADED",
        MTTR: 3000,
        timestamp: "2026-07-20T12:00:00Z",
      });

      const report = KnowledgeCorrelation.analyze([rec1, rec2, rec3]);

      // Repeated Failures
      const expDb = report.repeatedFailures.find((f) => f.experimentId === "exp-db");
      expect(expDb?.count).toBe(2);
      expect(expDb?.statusList).toContain("SUCCESS");
      expect(expDb?.statusList).toContain("FAILED");

      // Repeated Dependencies
      const dbX = report.repeatedDependencies.find((d) => d.nodeId === "Db-X");
      expect(dbX?.count).toBe(3);

      // Workflow counts
      const rollbackWf = report.repeatedWorkflows.find((w) => w.workflow === "Rollback Workflow");
      expect(rollbackWf?.count).toBe(3);

      // MTTR trend (sequence: 1000 -> 2000 -> 3000 -> rising)
      expect(report.mttrTrend).toBe("degrading");

      // Incident chains
      const inc1 = report.incidentChains.find((c) => c.incidentId === "inc-1");
      expect(inc1?.experimentIds).toContain("exp-db");
    });

    it("should report improving MTTR trend when MTTR drops over chronological progression", () => {
      const rec1 = createMockRecord("rec-1", { MTTR: 5000, timestamp: "2026-07-20T10:00:00Z" });
      const rec2 = createMockRecord("rec-2", { MTTR: 3000, timestamp: "2026-07-20T11:00:00Z" });
      const rec3 = createMockRecord("rec-3", { MTTR: 1000, timestamp: "2026-07-20T12:00:00Z" });

      const report = KnowledgeCorrelation.analyze([rec1, rec2, rec3]);
      expect(report.mttrTrend).toBe("improving");
    });
  });

  describe("KnowledgeSearch", () => {
    beforeEach(() => {
      // Seed KnowledgeRepository for search queries
      const rec1 = createMockRecord("knw-test-1", {
        experimentId: "exp-latency",
        workflow: "Rollback Workflow",
        status: "SUCCESS",
        correlationId: "corr-1",
        tags: ["slow", "db"],
        timestamp: "2026-07-20T08:00:00Z",
      });
      const rec2 = createMockRecord("knw-test-2", {
        experimentId: "exp-network",
        workflow: "Pause Experiments",
        status: "FAILED",
        correlationId: "corr-2",
        tags: ["network", "dns"],
        timestamp: "2026-07-20T09:00:00Z",
      });
      const rec3 = createMockRecord("knw-test-3", {
        experimentId: "exp-latency",
        workflow: "No Action",
        status: "DEGRADED",
        correlationId: "corr-3",
        tags: ["slow", "api"],
        timestamp: "2026-07-20T10:00:00Z",
      });

      KnowledgeRepository.add(rec1);
      KnowledgeRepository.add(rec2);
      KnowledgeRepository.add(rec3);
    });

    it("should search successfully by experimentId", () => {
      const results = KnowledgeSearch.search({ experimentId: "exp-latency" });
      expect(results.length).toBe(2);
      expect(results.some((r) => r.id === "knw-test-1")).toBe(true);
      expect(results.some((r) => r.id === "knw-test-3")).toBe(true);
    });

    it("should search successfully by status and tags", () => {
      const results = KnowledgeSearch.search({ status: "SUCCESS", tag: "slow" });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("knw-test-1");
    });

    it("should search successfully within a date range", () => {
      const results = KnowledgeSearch.search({
        startDate: "2026-07-20T08:30:00Z",
        endDate: "2026-07-20T09:30:00Z",
      });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("knw-test-2");
    });

    it("should return empty array when no records match filters", () => {
      const results = KnowledgeSearch.search({ correlationId: "non-existent" });
      expect(results.length).toBe(0);
    });
  });

  describe("KnowledgeInsights", () => {
    it("should compute system insights and recommendations based on historical record metrics", () => {
      const rec1 = createMockRecord("rec-1", {
        experimentId: "exp-slow",
        experimentName: "Inject Slowness",
        status: "FAILED",
        impact: 80,
        blastRadius: "High",
        MTTR: 6000,
      });
      const rec2 = createMockRecord("rec-2", {
        experimentId: "exp-slow",
        experimentName: "Inject Slowness",
        status: "SUCCESS",
        impact: 20,
        blastRadius: "Low",
        MTTR: 100,
      });

      const insights = KnowledgeInsights.generate([rec1, rec2]);

      expect(insights.mostCommonFailureType).toBe("Latency Injection");
      expect(insights.highestMTTRMs).toBe(6000);
      expect(insights.highestMTTRExperimentId).toBe("exp-slow");
      expect(insights.highestBlastRadiusSeen).toBe("High");
      expect(insights.leastReliableExperiment?.experimentId).toBe("exp-slow");
      expect(insights.leastReliableExperiment?.failureRate).toBe(50); // 1 out of 2 failed
      expect(insights.leastReliableExperiment?.averageImpact).toBe(50); // (80 + 20) / 2

      // Actionable SRE recommendations check
      expect(insights.recommendations.length).toBeGreaterThan(0);
      expect(insights.recommendations.some((r) => r.includes("High MTTR spike detected"))).toBe(true);
      expect(insights.recommendations.some((r) => r.includes("circuit breakers"))).toBe(true);
    });
  });

  describe("KnowledgeReporter", () => {
    it("should generate a complete structured report dataset and executive markdown", () => {
      const rec = createMockRecord("rec-1", {
        experimentId: "exp-reporters-test",
        status: "SUCCESS",
        impact: 10,
        MTTR: 200,
      });

      const report = KnowledgeReporter.generateReport([rec]);

      expect(report.timestamp).toBeDefined();
      expect(report.json).toBeDefined();
      expect(report.json.summary.totalExecutions).toBe(1);
      expect(report.json.summary.successRatePercentage).toBe(100);

      // Markdown formatting checks
      expect(report.markdown).toContain("# SRE Operational Knowledge Report");
      expect(report.markdown).toContain("Executive Summary");
      expect(report.markdown).toContain("Trend Summary");
      expect(report.markdown).toContain("Operational Recommendations");
      expect(report.markdown).toContain("exp-reporters-test");
    });
  });
});
