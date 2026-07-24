import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";
import { ChaosState } from "../ChaosState";

export class RetryExhaustionExperiment implements IChaosExperiment {
  public name = "Retry Exhaustion Simulation";
  public description = "Simulates continuous transaction abort failures to exhaust application retry limits";
  public riskLevel = "High" as const;
  public blastRadius = "Medium" as const;
  public automaticRollback = true;
  public manualRollback = "Clear active transaction scenarios and restore standard concurrency.";
  public expectedMetrics = ["chaos_events_total", "chaos_events_failed"];
  public expectedTelemetry = ["chaos:injection", "scenario:TransactionFailureScenario"];
  public expectedRecovery = "Express routes gracefully fail and return 409 conflict states after maximum retry limit hits.";
  public estimatedExecutionDuration = 5000;

  public async prepare(): Promise<void> {
    if (!isChaosAllowed()) throw new Error("Chaos Mode is disabled.");
    ChaosState.clearActiveScenarios();
  }

  public async execute(): Promise<void> {
    if (!isChaosAllowed()) return;
    ChaosState.setEnabled(true);
    ChaosState.setProbability(1.0); // 100% fail probability to guarantee exhaustion
    ChaosState.addTargetEndpoint("/api");
    ChaosState.activateScenario("TransactionFailureScenario");
  }

  public async verify(): Promise<boolean> {
    if (!isChaosAllowed()) return true;
    return ChaosState.getIsEnabled() && ChaosState.getProbability() === 1.0;
  }

  public async rollback(): Promise<void> {
    ChaosState.setEnabled(false);
    ChaosState.clearActiveScenarios();
    ChaosState.clearTargetEndpoints();
  }

  public async cleanup(): Promise<void> {
    await this.rollback();
  }
}
