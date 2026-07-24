import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RecoveryEngine } from "./RecoveryEngine";
import { RecoveryPolicy } from "./RecoveryPolicy";
import { RecoveryHistory } from "./RecoveryHistory";
import { RecoveryReporter } from "./RecoveryReporter";
import { AutonomousDecision } from "../autonomous/AutonomousDecision";
import { ChaosState } from "../ChaosState";
import { IncidentService } from "../../../src/services/IncidentService";
import { ChaosHealthContributor } from "../intelligence/ChaosHealthContributor";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

// Helper to construct a mock AutonomousDecision
function createMockDecision(overrides: Partial<AutonomousDecision> = {}): AutonomousDecision {
  return {
    id: "dec-mock-123",
    timestamp: new Date().toISOString(),
    decision: "ROLLBACK",
    confidence: 95,
    reasoning: "Test reasoning for rollback trigger.",
    evidence: ["Latency breached 500ms on Firestore get operations."],
    context: {
      timestamp: new Date().toISOString(),
      health: {
        status: "DEGRADED",
        impactScore: 50,
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
        nodes: [],
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
      incidents: [],
    },
    ...overrides,
  };
}

describe("Enterprise Autonomous Recovery Engine", () => {
  beforeEach(() => {
    process.env.CHAOS_MODE = "true";
    RecoveryPolicy.resetToDefault();
    RecoveryHistory.clear();
    ChaosState.setEnabled(true);
    ChaosState.clearActiveScenarios();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should execute a Rollback Workflow successfully when a valid ROLLBACK decision is provided", async () => {
    vi.spyOn(ChaosState, "getActiveScenarios").mockReturnValue(["TwilioTimeoutExperiment"]);
    const deactivateSpy = vi.spyOn(ChaosState, "deactivateScenario");
    const setEnabledSpy = vi.spyOn(ChaosState, "setEnabled");

    const decision = createMockDecision({ decision: "ROLLBACK" });
    const result = await RecoveryEngine.handleDecision(decision);

    expect(result.status).toBe("SUCCESS");
    expect(result.workflowName).toBe("Rollback Workflow");
    expect(setEnabledSpy).toHaveBeenCalledWith(false);
    expect(deactivateSpy).toHaveBeenCalledWith("TwilioTimeoutExperiment");
  });

  it("should abort execution if NODE_ENV is production and productionSafety is active", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const decision = createMockDecision();
    const result = await RecoveryEngine.handleDecision(decision);

    expect(result.status).toBe("FAILED");
    expect(result.workflowName).toBe("No Action");
    expect(result.evidence[0]).toContain("Production environments");
  });

  it("should bypass execution if CHAOS_MODE is disabled in process environments", async () => {
    vi.stubEnv("CHAOS_MODE", "false");

    const decision = createMockDecision();
    const result = await RecoveryEngine.handleDecision(decision);

    expect(result.status).toBe("SKIPPED");
    expect(result.evidence[0]).toContain("CHAOS_MODE is disabled");
  });

  it("should bypass execution if the autonomous decision has confidence below policy thresholds", async () => {
    const decision = createMockDecision({ confidence: 50 }); // policy default is 70
    const result = await RecoveryEngine.handleDecision(decision);

    expect(result.status).toBe("SKIPPED");
    expect(result.evidence[0]).toContain("Confidence score");
  });

  it("should intercept high-risk profiles and reroute to PENDING_APPROVAL status", async () => {
    const decision = createMockDecision({
      context: {
        ...createMockDecision().context,
        enterpriseScores: {
          reliabilityScore: 40,
          resilienceScore: 35,
          recoverabilityScore: 38,
          observabilityScore: 42,
          operationalReadiness: 40,
          overallEnterpriseScore: 39, // below default highRiskThresholdScore of 50
          letterGrade: "F",
        },
      },
    });

    const result = await RecoveryEngine.handleDecision(decision);

    expect(result.status).toBe("PENDING_APPROVAL");
    expect(result.workflowName).toBe("Rollback Workflow");
  });

  it("should redirect to Escalation Workflow when incident overload occurs", async () => {
    vi.spyOn(IncidentService, "getIncidents").mockReturnValue([
      {
        id: "inc-1",
        title: "Active Outage",
        description: "Network degradation",
        severity: "HIGH",
        status: "INVESTIGATING",
        affectedServices: ["SRE Core"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeline: [],
      },
      {
        id: "inc-2",
        title: "Active Outage 2",
        description: "Stripe error loops",
        severity: "CRITICAL",
        status: "IDENTIFIED",
        affectedServices: ["StripeAPI"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeline: [],
      },
    ]);

    // Set max incidents policy to 2
    RecoveryPolicy.updatePolicy({ maxAllowedIncidents: 2 });

    const decision = createMockDecision({ decision: "ROLLBACK" });
    const result = await RecoveryEngine.handleDecision(decision);

    // Should redirect to "Escalate" workflow because active incidents count (2) is >= maxAllowedIncidents (2)
    expect(result.workflowName).toBe("Escalate");
  });

  it("should enforce bounded memory restrictions on recovery history list", async () => {
    RecoveryHistory.setMaxHistorySize(3);

    const resultTemplate = (id: string): any => ({
      recoveryId: id,
      decisionId: "dec-1",
      timestamp: new Date().toISOString(),
      workflowName: "No Action",
      status: "SUCCESS" as const,
      durationMs: 10,
      rollbackDurationMs: 0,
      attempts: 1,
      logs: [],
      timeline: [],
      evidence: [],
      policyApplied: RecoveryPolicy.getPolicy(),
    });

    RecoveryHistory.addResult(resultTemplate("rec-1"));
    RecoveryHistory.addResult(resultTemplate("rec-2"));
    RecoveryHistory.addResult(resultTemplate("rec-3"));
    RecoveryHistory.addResult(resultTemplate("rec-4"));

    const history = RecoveryHistory.getHistory();
    expect(history.length).toBe(3);
    expect(history[0].recoveryId).toBe("rec-4");
    expect(history[2].recoveryId).toBe("rec-2");
  });

  it("should support timeout limits on slow workflows, triggering rollbacks", async () => {
    const slowWorkflow = {
      name: "Slow Workflow",
      description: "Deliberately slow execution",
      execute: async () => {
        await new Promise((res) => setTimeout(res, 500));
      },
      rollback: async (context: any) => {
        context.log("Rollback completed successfully.");
      },
    };

    // Configure tight timeout for this slow workflow
    RecoveryPolicy.updatePolicy({
      workflowTimeouts: {
        "Slow Workflow": 50,
      },
    });

    const decision = createMockDecision();
    const context = new (await import("./RecoveryContext")).RecoveryContext(
      decision.id,
      "corr-test-timeout",
      RecoveryPolicy.getPolicy()
    );

    const executor = await import("./RecoveryExecutor");
    const result = await executor.RecoveryExecutor.executeWorkflow(slowWorkflow, context, decision);

    expect(result.status).toBe("ROLLED_BACK");
    expect(result.error).toContain("timeout");
  });

  it("should generate beautiful markdown and JSON report datasets", async () => {
    const decision = createMockDecision({ decision: "PAUSE_EXPERIMENTS" });
    const result = await RecoveryEngine.handleDecision(decision);

    const markdown = RecoveryReporter.generateMarkdown(result);
    const json = RecoveryReporter.generateJson(result);

    expect(markdown).toContain("# 🛠️ Autonomous Recovery Execution Report");
    expect(markdown).toContain("Execution Metadata");
    expect(markdown).toContain("Complete SRE Exec Console Logs");

    const parsedJson = JSON.parse(json);
    expect(parsedJson.reportType).toBe("AutonomousRecoveryResult");
    expect(parsedJson.workflowSelected).toBe("Pause Experiments");
    expect(parsedJson.outcome).toBe("SUCCESS");
  });
});
