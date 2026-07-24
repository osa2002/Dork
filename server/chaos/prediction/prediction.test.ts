import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PredictionContext } from "./PredictionContext";
import { PredictionEngine } from "./PredictionEngine";
import { KnowledgeRepository } from "../knowledge/KnowledgeRepository";
import { DecisionHistory } from "../autonomous/DecisionHistory";
import { RecoveryHistory } from "../recovery/RecoveryHistory";
import { ChaosHistory } from "../orchestrator/ChaosHistory";
import { RuntimeDependencyGraph } from "../intelligence/RuntimeDependencyGraph";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";
import { KnowledgeRecord } from "../knowledge/KnowledgeRecord";

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

describe("Enterprise Predictive Resilience Engine Layer", () => {
  beforeEach(() => {
    KnowledgeRepository.clear();
    DecisionHistory.clear();
    RecoveryHistory.clear();
    ChaosHistory.clearHistory();
    RuntimeDependencyGraph.resetMetrics();
  });

  afterEach(() => {
    KnowledgeRepository.clear();
    DecisionHistory.clear();
    RecoveryHistory.clear();
    ChaosHistory.clearHistory();
    RuntimeDependencyGraph.resetMetrics();
  });

  describe("PredictionContext", () => {
    it("should compile a complete context containing all system variables", () => {
      const context = PredictionContext.collect();

      expect(context.timestamp).toBeDefined();
      expect(context.records).toBeDefined();
      expect(context.trends).toBeDefined();
      expect(context.enterpriseScores).toBeDefined();
      expect(context.dependencyGraph).toBeDefined();
      expect(context.decisionHistory).toBeDefined();
      expect(context.recoveryHistory).toBeDefined();
      expect(context.chaosHistory).toBeDefined();
    });
  });

  describe("PredictionEngine", () => {
    it("should run deterministic FAILURE_PROBABILITY predictions", () => {
      // Seed failure records to verify risk shifts
      const rec = createMockRecord("rec-1", {
        status: "FAILED",
        impact: 85,
        MTTR: 5000,
      });
      KnowledgeRepository.add(rec);

      const prediction = PredictionEngine.generatePrediction("FAILURE_PROBABILITY");

      expect(prediction.predictionId).toBeDefined();
      expect(prediction.predictionType).toBe("FAILURE_PROBABILITY");
      expect(prediction.confidence).toBe(0.75); // Since 1 record is seeded, it falls back to 0.75 confidence
      expect(prediction.riskScore).toBeGreaterThanOrEqual(5); // Minimum risk
      expect(prediction.supportingEvidence.length).toBeGreaterThan(0);
      expect(prediction.recommendations.length).toBeGreaterThan(0);
    });

    it("should run deterministic RECOVERY_PROBABILITY predictions", () => {
      const prediction = PredictionEngine.generatePrediction("RECOVERY_PROBABILITY");

      expect(prediction.predictionType).toBe("RECOVERY_PROBABILITY");
      expect(prediction.predictedRecovery).toBeDefined();
      expect(prediction.riskScore).toBeDefined();
      expect(prediction.confidence).toBeDefined();
    });

    it("should run deterministic ERROR_BUDGET_CONSUMPTION predictions", () => {
      const prediction = PredictionEngine.generatePrediction("ERROR_BUDGET_CONSUMPTION");

      expect(prediction.predictionType).toBe("ERROR_BUDGET_CONSUMPTION");
      expect(prediction.predictedErrorBudgetConsumption).toBeGreaterThanOrEqual(0);
    });

    it("should run deterministic MTTR_EVOLUTION predictions", () => {
      const prediction = PredictionEngine.generatePrediction("MTTR_EVOLUTION");

      expect(prediction.predictionType).toBe("MTTR_EVOLUTION");
      expect(prediction.predictedMTTR).toBeGreaterThan(0);
    });

    it("should run deterministic BLAST_RADIUS_EVOLUTION predictions", () => {
      const prediction = PredictionEngine.generatePrediction("BLAST_RADIUS_EVOLUTION");

      expect(prediction.predictionType).toBe("BLAST_RADIUS_EVOLUTION");
      expect(["Minimal", "Low", "Medium", "High"]).toContain(prediction.predictedBlastRadius);
    });

    it("should run deterministic SUBSYSTEM_DEGRADATION predictions", () => {
      const prediction = PredictionEngine.generatePrediction("SUBSYSTEM_DEGRADATION");

      expect(prediction.predictionType).toBe("SUBSYSTEM_DEGRADATION");
      expect(prediction.affectedSubsystems.length).toBeGreaterThanOrEqual(0);
    });

    it("should run deterministic DEPENDENCY_INSTABILITY predictions", () => {
      const prediction = PredictionEngine.generatePrediction("DEPENDENCY_INSTABILITY");

      expect(prediction.predictionType).toBe("DEPENDENCY_INSTABILITY");
      expect(prediction.affectedSubsystems.length).toBeGreaterThanOrEqual(0);
    });

    it("should publish a PredictionCreated event on the EnterpriseEventBus", async () => {
      let published = false;
      let payloadReceived: any = null;

      const subId = EnterpriseEventBus.subscribe("PredictionCreated", "PredictionCreated", (evt) => {
        published = true;
        payloadReceived = evt.payload;
      });

      const prediction = PredictionEngine.generatePrediction("FAILURE_PROBABILITY");

      // Flush event bus timeouts
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(published).toBe(true);
      expect(payloadReceived.predictionId).toBe(prediction.predictionId);

      EnterpriseEventBus.unsubscribe(subId);
    });
  });
});
