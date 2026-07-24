import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";
import { ChaosState } from "../ChaosState";

export class CleanupJobFailureExperiment implements IChaosExperiment {
  public name = "Cleanup Job Failure Simulation";
  public description = "Simulates transactional or functional failures during background table/collection purges";
  public riskLevel = "Low" as const;
  public blastRadius = "Low" as const;
  public automaticRollback = true;
  public manualRollback = "Clear target endpoints and deactivate CleanupFailureScenario.";
  public expectedMetrics = ["chaos_events_total", "chaos_events_failed"];
  public expectedTelemetry = ["chaos:injection", "scenario:CleanupFailureScenario"];
  public expectedRecovery = "Cron job retries execution upon subsequent execution cycles; alerts reliability teams.";
  public estimatedExecutionDuration = 4000;

  public async prepare(): Promise<void> {
    if (!isChaosAllowed()) throw new Error("Chaos Mode is disabled.");
    ChaosState.clearActiveScenarios();
  }

  public async execute(): Promise<void> {
    if (!isChaosAllowed()) return;
    ChaosState.setEnabled(true);
    ChaosState.setProbability(1.0);
    ChaosState.addTargetEndpoint("/api/cron/cleanup");
    ChaosState.activateScenario("CleanupFailureScenario");
  }

  public async verify(): Promise<boolean> {
    if (!isChaosAllowed()) return true;
    return ChaosState.getIsEnabled() && ChaosState.getActiveScenarios().includes("CleanupFailureScenario");
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
