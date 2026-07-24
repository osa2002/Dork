import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ChaosOrchestrator } from "./ChaosOrchestrator";
import { ChaosExecutionPlan } from "./ChaosExecutionPlan";
import { ChaosPolicy } from "./ChaosPolicy";
import { ChaosHistory } from "./ChaosHistory";
import { ChaosReporter } from "./ChaosReporter";
import { ChaosScheduler } from "./ChaosScheduler";
import { IChaosExperiment } from "../experiments/IChaosExperiment";

class MockExperiment implements IChaosExperiment {
  public name = "Mock Experiment A";
  public description = "A safe mock experiment";
  public riskLevel = "Low" as const;
  public blastRadius = "Low" as const;
  public automaticRollback = true;
  public manualRollback = "None";
  public expectedMetrics = [];
  public expectedTelemetry = [];
  public expectedRecovery = "Instant recovery";
  public estimatedExecutionDuration = 100;

  public prepareCalled = 0;
  public executeCalled = 0;
  public verifyCalled = 0;
  public rollbackCalled = 0;
  public cleanupCalled = 0;

  public async prepare() { this.prepareCalled++; }
  public async execute() { this.executeCalled++; }
  public async verify() { this.verifyCalled++; return true; }
  public async rollback() { this.rollbackCalled++; }
  public async cleanup() { this.cleanupCalled++; }
}

describe("ChaosOrchestrator & Lifecycle System", () => {
  beforeEach(() => {
    process.env.CHAOS_MODE = "true";
    process.env.NODE_ENV = "test";
    ChaosHistory.clearHistory();
    ChaosScheduler.clearAllJobs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should block orchestration if CHAOS_MODE is not true", async () => {
    process.env.CHAOS_MODE = "false";
    const plan = new ChaosExecutionPlan();
    const exp = new MockExperiment();
    plan.addExperiment(exp);

    await expect(ChaosOrchestrator.executePlan(plan)).rejects.toThrow();
  });

  it("should run sequential plans executing all experiment lifecycle hooks", async () => {
    const plan = new ChaosExecutionPlan();
    const exp = new MockExperiment();
    plan.addExperiment(exp);

    const { context, result } = await ChaosOrchestrator.executePlan(plan);

    expect(result.overallStatus).toBe("success");
    expect(result.successRatio).toBe(100);
    expect(exp.prepareCalled).toBe(1);
    expect(exp.executeCalled).toBe(1);
    expect(exp.verifyCalled).toBe(1);
    expect(exp.cleanupCalled).toBe(1);
    expect(exp.rollbackCalled).toBe(0); // Only called on failure
  });

  it("should execute automatic rollback if verify fails", async () => {
    const plan = new ChaosExecutionPlan();
    const exp = new MockExperiment();
    exp.verify = async () => false; // Trigger verification failure
    plan.addExperiment(exp);

    const { result } = await ChaosOrchestrator.executePlan(plan);

    expect(result.overallStatus).toBe("failed");
    expect(result.successRatio).toBe(0);
    expect(exp.rollbackCalled).toBe(1);
    expect(exp.cleanupCalled).toBe(1);
  });

  it("should respect execution policies and skip high-risk experiments when restricted", async () => {
    const plan = new ChaosExecutionPlan();
    const exp = new MockExperiment();
    exp.name = "High Risk Experiment";
    (exp as any).riskLevel = "Critical";
    plan.addExperiment(exp);

    const restrictedPolicy = {
      ...ChaosPolicy.DEFAULT_POLICY,
      allowedRiskLevels: ["Low" as const],
    };

    const { result } = await ChaosOrchestrator.executePlan(plan, restrictedPolicy);
    expect(result.runs[0].status).toBe("skipped");
  });

  it("should resolve topological ordering for dependent steps", () => {
    const plan = new ChaosExecutionPlan();
    const expA = new MockExperiment();
    expA.name = "A";
    const expB = new MockExperiment();
    expB.name = "B";

    plan.addExperiment(expB, ["A"]);
    plan.addExperiment(expA, []);

    const resolved = plan.resolveExecutionOrder();
    expect(resolved[0].experiment.name).toBe("A");
    expect(resolved[1].experiment.name).toBe("B");
  });

  it("should generate beautiful markdown and JSON reports", async () => {
    const plan = new ChaosExecutionPlan();
    const exp = new MockExperiment();
    plan.addExperiment(exp);

    const { context, result } = await ChaosOrchestrator.executePlan(plan);
    const md = ChaosReporter.generateMarkdownReport(context, result);
    const json = ChaosReporter.generateJSONReport(context, result);

    expect(md).toContain("Dork Enterprise Chaos Experimentation Report");
    expect(json.successRatio).toBe(100);
    expect(json.runs.length).toBe(1);
  });

  it("should support scheduling orchestration intervals", async () => {
    let triggered = 0;
    const callback = async () => { triggered++; };
    
    const jobId = ChaosScheduler.schedule("scheduled", 100, callback);
    expect(jobId).toBeDefined();
    expect(ChaosScheduler.getActiveJobs().length).toBe(1);

    ChaosScheduler.unschedule(jobId);
    expect(ChaosScheduler.getActiveJobs().length).toBe(0);
  });
});
