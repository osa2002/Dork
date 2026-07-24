import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";
import { ChaosState } from "../ChaosState";

export class RandomFailureExperiment implements IChaosExperiment {
  public name = "Seeded Random Failure Simulation";
  public description = "Uses the LCG seeded random engine to inject unexpected, intermittent 500 errors across APIs";
  public riskLevel = "Medium" as const;
  public blastRadius = "Medium" as const;
  public automaticRollback = true;
  public manualRollback = "Clear endpoints, disable chaos mode, and reset LCG random seed.";
  public expectedMetrics = ["chaos_events_total", "chaos_probability_hits"];
  public expectedTelemetry = ["chaos:injection", "scenario:DatabaseFailureScenario"];
  public expectedRecovery = "Robust clients automatically transparently retry on transient intermittent errors.";
  public estimatedExecutionDuration = 6000;

  public async prepare(): Promise<void> {
    if (!isChaosAllowed()) throw new Error("Chaos Mode is disabled.");
    ChaosState.clearActiveScenarios();
    ChaosState.setSeed(987654321); // Specific repeatable seed
  }

  public async execute(): Promise<void> {
    if (!isChaosAllowed()) return;
    ChaosState.setEnabled(true);
    ChaosState.setProbability(0.3); // 30% chance
    ChaosState.addTargetEndpoint("/api");
    ChaosState.activateScenario("DatabaseFailureScenario");
  }

  public async verify(): Promise<boolean> {
    if (!isChaosAllowed()) return true;
    return ChaosState.getIsEnabled() && ChaosState.getProbability() === 0.3;
  }

  public async rollback(): Promise<void> {
    ChaosState.setEnabled(false);
    ChaosState.resetSeed();
    ChaosState.clearActiveScenarios();
    ChaosState.clearTargetEndpoints();
  }

  public async cleanup(): Promise<void> {
    await this.rollback();
  }
}
