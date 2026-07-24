import { describe, it, expect, beforeEach } from "vitest";
import { DigitalTwinEngine } from "./DigitalTwinEngine";
import { TwinState } from "./TwinState";
import { TwinSimulation } from "./TwinSimulation";
import { TwinScenarioRunner } from "./TwinScenarioRunner";
import { TwinComparison } from "./TwinComparison";
import { TwinReporter } from "./TwinReporter";
import { RuntimeDependencyGraph } from "../intelligence/RuntimeDependencyGraph";
import { KnowledgeRepository } from "../knowledge/KnowledgeRepository";

describe("Phase 10.17 - Enterprise Digital Twin Engine", () => {
  beforeEach(() => {
    RuntimeDependencyGraph.resetMetrics();
    KnowledgeRepository.clear();
  });

  it("should capture immutable, deep-cloned snapshots of the production platform state", () => {
    const twin = DigitalTwinEngine.createTwinFromProduction();
    const data = twin.getData();

    expect(data).toBeDefined();
    expect(data.timestamp).toBeDefined();
    expect(data.health).toBeDefined();
    expect(data.dependencyGraph).toBeDefined();
    expect(data.metrics).toBeDefined();
    expect(data.prediction).toBeDefined();
    expect(data.governance).toBeDefined();

    // Verify immutability
    expect(Object.isFrozen(data)).toBe(true);
    expect(() => {
      (data as any).timestamp = "mutated";
    }).toThrow();
  });

  it("should preserve stateless execution with zero changes to production state", () => {
    const initialGraph = RuntimeDependencyGraph.getGraph();
    const beforeState = DigitalTwinEngine.createTwinFromProduction();

    // Run cascade failure simulation inside the twin
    const afterState = TwinSimulation.simulateCascadeFailure(beforeState);

    // Verify virtual states differ
    expect(afterState.getData().health.status).toBe("UNAVAILABLE");
    expect(afterState.getData().slo.availability.actual).toBeLessThan(90);

    // Verify real state remains untouched
    const realGraph = RuntimeDependencyGraph.getGraph();
    expect(realGraph.nodes.every(n => n.status === "HEALTHY")).toBe(true);
    expect(initialGraph.nodes.every(n => n.status === "HEALTHY")).toBe(true);
  });

  it("should reuse RuntimeDependencyGraph structure for virtual simulations", () => {
    const twin = DigitalTwinEngine.createTwinFromProduction();
    const graph = twin.getData().dependencyGraph;

    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.nodes.some(n => n.id === "Firestore")).toBe(true);
    expect(graph.nodes.some(n => n.id === "StripeAPI")).toBe(true);
  });

  it("should compute precise delta reports between twin states", () => {
    const beforeState = DigitalTwinEngine.createTwinFromProduction();
    const afterState = TwinSimulation.simulateFirestoreFailure(beforeState);

    const delta = TwinComparison.compare(beforeState, afterState);
    expect(delta).toBeDefined();
    expect(delta.availabilityDelta.deltaPercent).toBeLessThan(0);
    expect(delta.latencyDelta.deltaMs).toBeGreaterThan(0);
    expect(delta.enterpriseScoreDelta.deltaScore).toBeLessThan(0);
    expect(delta.riskDelta.isRiskIncreased).toBe(true);
  });

  it("should execute multi-scenario pathways (Sequential, Canary, Parallel, Prediction, Knowledge)", async () => {
    const startState = DigitalTwinEngine.createTwinFromProduction();

    // 1. Sequential Run
    const seqState = TwinScenarioRunner.runSequential(startState, [
      TwinSimulation.simulateMemoryPressure,
      TwinSimulation.simulateCpuSaturation,
    ]);
    expect(seqState.getData().metrics.system.memory.freePercent).toBe(2);
    expect(seqState.getData().metrics.system.cpu.loadAvg[0]).toBe(8.5);

    // 2. Parallel Run
    const parallelResults = TwinScenarioRunner.runParallel(startState, [
      { name: "stripe", sim: TwinSimulation.simulateStripeFailure },
      { name: "gemini", sim: TwinSimulation.simulateGeminiTimeout },
    ]);
    expect(parallelResults.length).toBe(2);
    expect(parallelResults[0].finalState.getData().health.activeScenarios).toContain("TransactionFailureScenario");
    expect(parallelResults[1].finalState.getData().health.status).toBe("PARTIALLY_DEGRADED");

    // 3. Canary Run
    const canaryState = TwinScenarioRunner.runCanary(startState, TwinSimulation.simulateFirestoreFailure, 0.2);
    expect(canaryState.getData().health.impactScore).toBeLessThan(40); // muted impact

    // 4. Prediction driven
    const predResult = TwinScenarioRunner.runPredictionDriven(startState);
    expect(predResult.finalState).toBeDefined();

    // 5. Knowledge driven
    const knowResult = TwinScenarioRunner.runKnowledgeDriven(startState);
    expect(knowResult.finalState).toBeDefined();
  });

  it("should generate beautiful and compliant SRE Markdown and JSON reports", async () => {
    const report = await DigitalTwinEngine.runTwinSimulation("cascade_failure");

    expect(report.reportId).toBeDefined();
    expect(report.markdown).toContain("# 🔮 ENTERPRISE DIGITAL TWIN ENGINE REPORT");
    expect(report.markdown).toContain("Simulation Scenario:");
    expect(report.markdown).toContain("Virtual Cascading Infrastructure Meltdown Scenario");
    expect(report.markdown).toContain("Estimated Failover Mitigation Window");
    expect(report.enterpriseReadinessScore).toBeLessThan(50); // Melt down drops readiness drastically
  });
});
