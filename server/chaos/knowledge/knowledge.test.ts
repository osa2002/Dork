import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { KnowledgeEngine, CompletedExecutionInput } from "./KnowledgeEngine";
import { KnowledgeRepository } from "./KnowledgeRepository";
import { KnowledgeIndex } from "./KnowledgeIndex";
import { AutonomousDecision } from "../autonomous/AutonomousDecision";
import { RecoveryResult } from "../recovery/RecoveryResult";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

// Helper to construct a mock AutonomousDecision
function createMockDecision(overrides: Partial<AutonomousDecision> = {}): AutonomousDecision {
  return {
    id: "dec-mock-123",
    timestamp: new Date().toISOString(),
    decision: "ROLLBACK",
    confidence: 95,
    reasoning: "Test reasoning for knowledge normalization.",
    evidence: ["Latency breached 500ms on Firestore get operations."],
    context: {
      timestamp: new Date().toISOString(),
      health: {
        status: "DEGRADED",
        impactScore: 55,
        reason: "Slow queries detected.",
        activeScenarios: [],
        latencyAddedMs: 0,
        injectionProbability: 0,
      },
      chaosStatus: {
        isEnabled: true,
        activeScenarios: [],
        probability: 0.25,
        globalLatency: 100,
      },
      slo: {
        failureBudgetPercentageConsumed: 12.5,
        meanTimeToRecoveryMs: 1500,
        avgRollbackDurationMs: 800,
        recoveryCount: 4,
        latencyDistribution: {
          under500ms: 12,
          under2s: 3,
          under5s: 1,
          over5s: 0,
        },
        recentRecoveries: [],
      },
      standardSlo: {
        availability: {
          target: 99.0,
          actual: 98.5,
          errorBudgetRemaining: 2.5,
          totalRequests: 1000,
          failedRequests: 15,
        },
        latency: {
          targetMs: 100,
          actualP95Ms: 120,
        },
        apiResponseTime: {
          targetMs: 200,
          actualP95Ms: 150,
        },
        queueProcessingTime: {
          targetSeconds: 60,
          actualSeconds: 15,
        },
        ticketCreationTime: {
          targetMs: 100,
          actualMs: 80,
        },
        aiResponseTime: {
          targetMs: 3000,
          actualMs: 2500,
        },
        paymentLatency: {
          targetMs: 1500,
          actualMs: 1200,
        },
      },
      coverage: {
        overallCoveragePercentage: 25,
        subsystems: [],
        untestedSubsystems: [],
        testedSubsystemsCount: 1,
      },
      dependencyGraph: {
        nodes: [
          { id: "ExpressServer", name: "Express Web Gateway", type: "service", status: "HEALTHY", lastActive: new Date().toISOString() },
          { id: "Firestore", name: "Google Cloud Firestore", type: "database", status: "HEALTHY", lastActive: new Date().toISOString() },
        ],
        edges: [],
      },
      enterpriseScores: {
        reliabilityScore: 90,
        resilienceScore: 85,
        recoverabilityScore: 88,
        observabilityScore: 92,
        operationalReadiness: 90,
        overallEnterpriseScore: 89,
        letterGrade: "B",
      },
      trends: {
        mttrTrend: "stable",
        blastRadiusTrend: "stable",
        errorBudgetTrend: "stable",
        recoveryTrend: "stable",
        recentDataPoints: [],
        summary: "Stable trends",
      },
      regressionReport: {
        isRegressed: false,
        scoreImpact: 0,
        anomalies: [],
        analysisTimestamp: new Date().toISOString(),
      },
      auditLogs: [],
      events: [],
      incidents: [
        {
          id: "inc-101",
          title: "Slow queries",
          description: "Database is slow",
          severity: "HIGH",
          status: "INVESTIGATING",
          affectedServices: ["ExpressServer"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          timeline: [],
        }
      ],
    },
    ...overrides,
  };
}

// Helper to construct a mock RecoveryResult
function createMockRecovery(overrides: Partial<RecoveryResult> = {}): RecoveryResult {
  return {
    recoveryId: "rec-mock-456",
    decisionId: "dec-mock-123",
    timestamp: new Date().toISOString(),
    workflowName: "Rollback Workflow",
    status: "SUCCESS",
    durationMs: 1200,
    rollbackDurationMs: 450,
    attempts: 1,
    logs: ["Test recovery step 1 executed."],
    timeline: [
      { timestamp: new Date().toISOString(), message: "[ROLLBACK_INIT] Initiating global chaos rollback." },
      { timestamp: new Date().toISOString(), message: "[INCIDENT_COMPLETE] Incident spawned with ID: inc-101" }
    ],
    evidence: ["Restored standard service status.", "Incident spawned with ID: inc-101"],
    policyApplied: {
      isProductionSafetyEnabled: true,
      isChaosModeSafetyEnabled: true,
      minConfidenceRequired: 70,
      maxRetryAttempts: 3,
      retryDelayMs: 100,
      workflowTimeouts: {},
      requireManualApprovalForHighRisk: true,
      highRiskThresholdScore: 50,
      maxAllowedBlastRadius: "High",
      maxAllowedIncidents: 5,
      sloAvailabilityThreshold: 95.0,
    },
    ...overrides,
  };
}

describe("Enterprise Operational Knowledge Layer", () => {
  beforeEach(() => {
    KnowledgeRepository.clear();
    KnowledgeRepository.setCapacityLimit(100);
    EnterpriseEventBus.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    KnowledgeRepository.clear();
  });

  describe("Normalization & Generation", () => {
    it("should successfully normalize complete execution input into a detailed immutable KnowledgeRecord", () => {
      const decision = createMockDecision();
      const recovery = createMockRecovery();
      const input: CompletedExecutionInput = {
        experimentId: "exp-firestore-delay",
        experimentName: "Firestore Slow Injector",
        decision,
        recovery,
        correlationId: "corr-test-workflow-999",
        tags: ["custom-tag-abc"],
        metadata: { operator: "sre-automaton", environment: "staging" },
      };

      const record = KnowledgeEngine.receiveCompletedExecution(input);

      expect(record.id).toContain("knw-");
      expect(record.experimentId).toBe("exp-firestore-delay");
      expect(record.experimentName).toBe("Firestore Slow Injector");
      expect(record.workflow).toBe("Rollback Workflow");
      expect(record.decision).toBe("ROLLBACK");
      expect(record.correlationId).toBe("corr-test-workflow-999");
      
      // Verified values from decision context
      expect(record.health.impactScore).toBe(55);
      expect(record.impact).toBe(55);
      expect(record.blastRadius).toBe("Medium"); // classified based on 55 threshold
      expect(record.MTTR).toBe(1500); // from decision context MTTR
      expect(record.rollback.occurred).toBe(true);
      expect(record.rollback.durationMs).toBe(450);
      expect(record.rollback.success).toBe(true);
      expect(record.incidentId).toBe("inc-101");
      expect(record.enterpriseScore.overallEnterpriseScore).toBe(89);
      expect(record.dependencyGraphSnapshot.nodes.length).toBe(2);

      // Verify immutable tags
      expect(record.tags).toContain("custom-tag-abc");
      expect(record.tags).toContain("exp-firestore-delay");
      expect(record.tags).toContain("medium");
      expect(record.tags).toContain("success");
      expect(record.tags).toContain("rollback");
      expect(record.tags).toContain("incident-linked");

      expect(record.metadata.operator).toBe("sre-automaton");
    });

    it("should fallback gracefully to platform defaults when decision or recovery is absent", () => {
      const input: CompletedExecutionInput = {
        experimentId: "exp-simple-latency",
        experimentName: "Simple Latency",
        status: "SUCCESS",
      };

      const record = KnowledgeEngine.receiveCompletedExecution(input);

      expect(record.workflow).toBe("No Action");
      expect(record.decision).toBe("NO_ACTION");
      expect(record.impact).toBe(0);
      expect(record.blastRadius).toBe("Minimal");
      expect(record.MTTR).toBe(0);
      expect(record.rollback.occurred).toBe(false);
      expect(record.incidentId).toBeNull();
      expect(record.enterpriseScore).toBeDefined();
      expect(record.dependencyGraphSnapshot).toBeDefined();
    });
  });

  describe("In-Memory Repository & Bounded Capacity", () => {
    it("should store records in memory and support retrieval by id and matching", () => {
      const input1: CompletedExecutionInput = {
        experimentId: "exp-1",
        experimentName: "Exp 1",
      };
      const input2: CompletedExecutionInput = {
        experimentId: "exp-2",
        experimentName: "Exp 2",
      };

      const rec1 = KnowledgeEngine.receiveCompletedExecution(input1);
      const rec2 = KnowledgeEngine.receiveCompletedExecution(input2);

      const all = KnowledgeRepository.getAll();
      expect(all.length).toBe(2);
      expect(all[0].id).toBe(rec2.id); // LIFO ordering (newest first)
      expect(all[1].id).toBe(rec1.id);

      const retrieved = KnowledgeRepository.getById(rec1.id);
      expect(retrieved?.experimentId).toBe("exp-1");
    });

    it("should automatically truncate oldest records when configurable bounded capacity is breached", () => {
      KnowledgeRepository.setCapacityLimit(3);

      for (let i = 1; i <= 5; i++) {
        KnowledgeEngine.receiveCompletedExecution({
          experimentId: `exp-${i}`,
          experimentName: `Exp ${i}`,
        });
      }

      const all = KnowledgeRepository.getAll();
      expect(all.length).toBe(3);
      // Newest records (5, 4, 3) must remain
      expect(all[0].experimentId).toBe("exp-5");
      expect(all[1].experimentId).toBe("exp-4");
      expect(all[2].experimentId).toBe("exp-3");
    });
  });

  describe("Dynamic Lightweight Search Indexes", () => {
    it("should dynamically index records across experiment, service, dependency, workflow, incident, status and tags", () => {
      const decision = createMockDecision();
      const recovery = createMockRecovery();
      const input: CompletedExecutionInput = {
        experimentId: "exp-tw-timeout",
        experimentName: "Twilio Timeout Injector",
        decision,
        recovery,
        tags: ["sre-run"],
      };

      const record = KnowledgeEngine.receiveCompletedExecution(input);

      // Verify KnowledgeIndex Keys
      expect(KnowledgeIndex.getExperimentIndexKeys()).toContain("exp-tw-timeout");
      expect(KnowledgeIndex.getServiceIndexKeys()).toContain("ExpressServer"); // from dependencyGraph nodes
      expect(KnowledgeIndex.getDependencyIndexKeys()).toContain("Firestore"); // from dependencyGraph nodes (database node type)
      expect(KnowledgeIndex.getWorkflowIndexKeys()).toContain("Rollback Workflow");
      expect(KnowledgeIndex.getIncidentIndexKeys()).toContain("inc-101");
      expect(KnowledgeIndex.getStatusIndexKeys()).toContain("SUCCESS");
      expect(KnowledgeIndex.getTagIndexKeys()).toContain("sre-run");

      // Verify Lookup Resolvers
      const recordsByExp = KnowledgeIndex.getByExperiment("exp-tw-timeout", KnowledgeRepository.getAll());
      expect(recordsByExp.length).toBe(1);
      expect(recordsByExp[0].id).toBe(record.id);

      const recordsByService = KnowledgeIndex.getByService("ExpressServer", KnowledgeRepository.getAll());
      expect(recordsByService[0].id).toBe(record.id);

      const recordsByDep = KnowledgeIndex.getByDependency("Firestore", KnowledgeRepository.getAll());
      expect(recordsByDep[0].id).toBe(record.id);

      const recordsByWorkflow = KnowledgeIndex.getByWorkflow("Rollback Workflow", KnowledgeRepository.getAll());
      expect(recordsByWorkflow[0].id).toBe(record.id);

      const recordsByIncident = KnowledgeIndex.getByIncident("inc-101", KnowledgeRepository.getAll());
      expect(recordsByIncident[0].id).toBe(record.id);

      const recordsByStatus = KnowledgeIndex.getByStatus("SUCCESS", KnowledgeRepository.getAll());
      expect(recordsByStatus[0].id).toBe(record.id);

      const recordsByTag = KnowledgeIndex.getByTag("sre-run", KnowledgeRepository.getAll());
      expect(recordsByTag[0].id).toBe(record.id);
    });

    it("should keep indexes in perfect sync when repository items are cleared or truncated", () => {
      KnowledgeRepository.setCapacityLimit(2);

      const rec1 = KnowledgeEngine.receiveCompletedExecution({ experimentId: "exp-a", experimentName: "Exp A" });
      const rec2 = KnowledgeEngine.receiveCompletedExecution({ experimentId: "exp-b", experimentName: "Exp B" });

      expect(KnowledgeIndex.getExperimentIndexKeys()).toContain("exp-a");
      expect(KnowledgeIndex.getExperimentIndexKeys()).toContain("exp-b");

      // Exceed capacity limit to trigger truncation of rec1 (oldest)
      KnowledgeEngine.receiveCompletedExecution({ experimentId: "exp-c", experimentName: "Exp C" });

      expect(KnowledgeIndex.getExperimentIndexKeys()).not.toContain("exp-a");
      expect(KnowledgeIndex.getExperimentIndexKeys()).toContain("exp-b");
      expect(KnowledgeIndex.getExperimentIndexKeys()).toContain("exp-c");

      // Clear all
      KnowledgeRepository.clear();
      expect(KnowledgeIndex.getExperimentIndexKeys().length).toBe(0);
    });
  });

  describe("Enterprise Event Bus Integration", () => {
    it("should publish a KnowledgeCreated event on the Event Bus when a record is successfully normalized", async () => {
      let receivedEvent: any = null;
      
      // Subscribe to the wildcard or specific Event type
      EnterpriseEventBus.subscribe("SRE Knowledge Consumer", "KnowledgeCreated", (event) => {
        receivedEvent = event;
      });

      const input: CompletedExecutionInput = {
        experimentId: "exp-bus-integration",
        experimentName: "Bus Integration Test",
        correlationId: "corr-event-bus-test",
      };

      const record = KnowledgeEngine.receiveCompletedExecution(input);

      // Event bus execution is async via setTimeout, wait a split second
      await new Promise<void>((resolve) => setTimeout(resolve, 10));

      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent.type).toBe("KnowledgeCreated");
      expect(receivedEvent.correlationId).toBe("corr-event-bus-test");
      expect(receivedEvent.payload.id).toBe(record.id);
      expect(receivedEvent.payload.experimentId).toBe("exp-bus-integration");
    });
  });
});
