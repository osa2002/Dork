import { describe, it, expect, beforeEach, vi } from "vitest";
import { DecisionContextBuilder } from "./DecisionContext";
import { DecisionPolicy } from "./DecisionPolicy";
import { DecisionEngine } from "./DecisionEngine";
import { DecisionHistory } from "./DecisionHistory";
import { DecisionReporter } from "./DecisionReporter";
import { ChaosState } from "../ChaosState";
import { ChaosHealthContributor } from "../intelligence/ChaosHealthContributor";
import { IncidentService } from "../../../src/services/IncidentService";
import { EnterpriseScoreEngine } from "../governance/EnterpriseScoreEngine";
import { ChaosSLOIntegration } from "../intelligence/ChaosSLOIntegration";
import { RegressionDetector } from "../governance/RegressionDetector";

describe("Enterprise Autonomous Resilience Engine", () => {
  beforeEach(() => {
    DecisionPolicy.resetToDefault();
    DecisionHistory.clear();
    vi.restoreAllMocks();
  });

  it("should compile a full real-time decision context safely", () => {
    const context = DecisionContextBuilder.compileContext();
    expect(context).toBeDefined();
    expect(context.timestamp).toBeDefined();
    expect(context.health).toBeDefined();
    expect(context.chaosStatus).toBeDefined();
    expect(context.slo).toBeDefined();
    expect(context.coverage).toBeDefined();
    expect(context.dependencyGraph).toBeDefined();
    expect(context.enterpriseScores).toBeDefined();
    expect(context.trends).toBeDefined();
    expect(context.regressionReport).toBeDefined();
    expect(context.auditLogs).toBeDefined();
    expect(context.events).toBeDefined();
    expect(context.incidents).toBeDefined();
  });

  it("should recommend RUN_EXPERIMENT on a fully green, stable platform", () => {
    vi.spyOn(ChaosState, "getIsEnabled").mockReturnValue(false);
    vi.spyOn(ChaosHealthContributor, "getHealthStatus").mockReturnValue({
      status: "HEALTHY",
      impactScore: 0,
      reason: "All nodes performing optimally within acceptable latency bounds.",
      activeScenarios: [],
      latencyAddedMs: 0,
      injectionProbability: 0,
    });
    vi.spyOn(IncidentService, "getIncidents").mockReturnValue([]);
    vi.spyOn(EnterpriseScoreEngine, "calculateScores").mockReturnValue({
      reliabilityScore: 95,
      resilienceScore: 92,
      recoverabilityScore: 90,
      observabilityScore: 95,
      operationalReadiness: 94,
      overallEnterpriseScore: 93,
      letterGrade: "A",
    });

    const decision = DecisionEngine.evaluate();

    expect(decision.decision).toBe("RUN_EXPERIMENT");
    expect(decision.confidence).toBeGreaterThanOrEqual(90);
    expect(decision.evidence.some((ev) => ev.includes("HEALTHY"))).toBe(true);
  });

  it("should recommend PAUSE_EXPERIMENTS when unresolved active incidents meet or exceed the safety threshold", () => {
    vi.spyOn(ChaosState, "getIsEnabled").mockReturnValue(true);
    vi.spyOn(IncidentService, "getIncidents").mockReturnValue([
      {
        id: "inc-1",
        title: "Database connection spike",
        description: "Pool starvation on postgres node",
        severity: "HIGH",
        status: "INVESTIGATING",
        affectedServices: ["Database"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeline: [],
      },
    ]);

    // Set max incident limit to 1
    const decision = DecisionEngine.evaluate({ maxIncidentCount: 1 });

    expect(decision.decision).toBe("PAUSE_EXPERIMENTS");
    expect(decision.confidence).toBe(95);
    expect(decision.evidence.some((ev) => ev.includes("Active incidents count"))).toBe(true);
  });

  it("should recommend ROLLBACK when severe health degradation occurs while chaos is actively executing", () => {
    vi.spyOn(ChaosState, "getIsEnabled").mockReturnValue(true);
    vi.spyOn(ChaosState, "getActiveScenarios").mockReturnValue(["NetworkLatencyInjection"]);
    vi.spyOn(ChaosHealthContributor, "getHealthStatus").mockReturnValue({
      status: "PARTIAL_OUTAGE",
      impactScore: 75,
      reason: "Express server experiencing critical connection timeout failures.",
      activeScenarios: ["NetworkLatencyInjection"],
      latencyAddedMs: 100,
      injectionProbability: 0.5,
    });
    vi.spyOn(IncidentService, "getIncidents").mockReturnValue([]);

    const decision = DecisionEngine.evaluate();

    expect(decision.decision).toBe("ROLLBACK");
    expect(decision.confidence).toBe(98);
    expect(decision.evidence.some((ev) => ev.includes("PARTIAL_OUTAGE"))).toBe(true);
  });

  it("should recommend OPEN_INCIDENT when severe health degradation occurs with no active chaos scenarios", () => {
    vi.spyOn(ChaosState, "getIsEnabled").mockReturnValue(false);
    vi.spyOn(ChaosState, "getActiveScenarios").mockReturnValue([]);
    vi.spyOn(ChaosHealthContributor, "getHealthStatus").mockReturnValue({
      status: "UNAVAILABLE",
      impactScore: 100,
      reason: "DNS resolution failed globally.",
      activeScenarios: [],
      latencyAddedMs: 0,
      injectionProbability: 0,
    });
    vi.spyOn(IncidentService, "getIncidents").mockReturnValue([]);

    const decision = DecisionEngine.evaluate();

    expect(decision.decision).toBe("OPEN_INCIDENT");
    expect(decision.confidence).toBe(92);
    expect(decision.evidence.some((ev) => ev.includes("UNAVAILABLE"))).toBe(true);
  });

  it("should recommend REQUEST_APPROVAL when stability scores fall below the required operational threshold", () => {
    vi.spyOn(ChaosState, "getIsEnabled").mockReturnValue(false);
    vi.spyOn(ChaosHealthContributor, "getHealthStatus").mockReturnValue({
      status: "HEALTHY",
      impactScore: 0,
      reason: "Healthy",
      activeScenarios: [],
      latencyAddedMs: 0,
      injectionProbability: 0,
    });
    vi.spyOn(IncidentService, "getIncidents").mockReturnValue([]);
    vi.spyOn(EnterpriseScoreEngine, "calculateScores").mockReturnValue({
      reliabilityScore: 60,
      resilienceScore: 50,
      recoverabilityScore: 55,
      observabilityScore: 50,
      operationalReadiness: 55,
      overallEnterpriseScore: 54,
      letterGrade: "F",
    });

    const decision = DecisionEngine.evaluate();

    expect(decision.decision).toBe("REQUEST_APPROVAL");
    expect(decision.confidence).toBe(80);
    expect(decision.evidence.some((ev) => ev.includes("54/100"))).toBe(true);
  });

  it("should respect custom policy config overrides and evaluate against modified thresholds", () => {
    vi.spyOn(ChaosState, "getIsEnabled").mockReturnValue(false);
    vi.spyOn(ChaosHealthContributor, "getHealthStatus").mockReturnValue({
      status: "DEGRADED",
      impactScore: 20,
      reason: "Healthy",
      activeScenarios: [],
      latencyAddedMs: 0,
      injectionProbability: 0,
    });
    vi.spyOn(IncidentService, "getIncidents").mockReturnValue([]);

    // Standard policy allows DEGRADED health. We override unacceptable health states to include DEGRADED.
    const decision = DecisionEngine.evaluate({
      unacceptableHealthStates: ["DEGRADED", "PARTIAL_OUTAGE", "UNAVAILABLE"],
    });

    // Should now recommend OPEN_INCIDENT instead of falling back
    expect(decision.decision).toBe("OPEN_INCIDENT");
  });

  it("should enforce bounded memory restrictions on decision history", () => {
    const mockDecision = (id: string) => ({
      id,
      timestamp: new Date().toISOString(),
      decision: "NO_ACTION" as const,
      confidence: 100,
      reasoning: "Reasoning",
      context: DecisionContextBuilder.compileContext(),
      evidence: [],
    });

    DecisionPolicy.updatePolicy({ maxHistorySize: 3 });

    DecisionHistory.addDecision(mockDecision("dec-1"));
    DecisionHistory.addDecision(mockDecision("dec-2"));
    DecisionHistory.addDecision(mockDecision("dec-3"));
    DecisionHistory.addDecision(mockDecision("dec-4"));

    const history = DecisionHistory.getHistory();
    expect(history.length).toBe(3);
    expect(history[0].id).toBe("dec-4");
    expect(history[2].id).toBe("dec-2");
  });

  it("should generate beautiful markdown and JSON decision reports with supporting evidence", () => {
    const decision = DecisionEngine.evaluate();

    const markdownReport = DecisionReporter.generateMarkdownReport(decision);
    const jsonReport = DecisionReporter.generateJsonReport(decision);

    expect(markdownReport).toContain("# 🧠 Autonomous Resilience Decision Report");
    expect(markdownReport).toContain("Evaluation Confidence");
    expect(markdownReport).toContain("Supporting Evidence");

    const parsedJson = JSON.parse(jsonReport);
    expect(parsedJson.reportType).toBe("AutonomousResilienceDecision");
    expect(parsedJson.decisionId).toBe(decision.id);
    expect(parsedJson.recommendation).toBe(decision.decision);
    expect(parsedJson.confidence).toBe(decision.confidence);
    expect(parsedJson.keyMetrics).toBeDefined();
  });
});
