import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";
import { ChaosState } from "../ChaosState";

export class FirestoreContentionExperiment implements IChaosExperiment {
  public name = "Firestore Contention Simulation";
  public description = "Simulates high parallel write conflicts causing transaction aborted exceptions (HTTP 409)";
  public riskLevel = "Medium" as const;
  public blastRadius = "Medium" as const;
  public automaticRollback = true;
  public manualRollback = "Deactivate TransactionFailureScenario and clear targets.";
  public expectedMetrics = ["chaos_events_total", "chaos_events_failed"];
  public expectedTelemetry = ["chaos:injection", "scenario:TransactionFailureScenario"];
  public expectedRecovery = "Express server handles conflict by executing localized exponential backoff retry cycles.";
  public estimatedExecutionDuration = 4000;

  public async prepare(): Promise<void> {
    if (!isChaosAllowed()) throw new Error("Chaos Mode is disabled.");
    ChaosState.clearActiveScenarios();
  }

  public async execute(): Promise<void> {
    if (!isChaosAllowed()) return;
    ChaosState.setEnabled(true);
    ChaosState.setProbability(0.75); // 75% contention rate
    ChaosState.addTargetEndpoint("/api");
    ChaosState.activateScenario("TransactionFailureScenario");
  }

  public async verify(): Promise<boolean> {
    if (!isChaosAllowed()) return true;
    return ChaosState.getIsEnabled() && ChaosState.getActiveScenarios().includes("TransactionFailureScenario");
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
