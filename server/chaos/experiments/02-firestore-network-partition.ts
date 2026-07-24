import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";
import { ChaosState } from "../ChaosState";

export class FirestoreNetworkPartitionExperiment implements IChaosExperiment {
  public name = "Firestore Network Partition Simulation";
  public description = "Simulates network split between Cloud Run container and Google Firestore backend";
  public riskLevel = "High" as const;
  public blastRadius = "High" as const;
  public automaticRollback = true;
  public manualRollback = "Deactivate DatabaseFailureScenario and clear targets.";
  public expectedMetrics = ["chaos_events_total", "chaos_events_failed"];
  public expectedTelemetry = ["chaos:injection", "scenario:DatabaseFailureScenario"];
  public expectedRecovery = "Firestore SDK automatically reconnects when the partition heals.";
  public estimatedExecutionDuration = 6000;

  public async prepare(): Promise<void> {
    if (!isChaosAllowed()) throw new Error("Chaos Mode is disabled.");
    ChaosState.clearActiveScenarios();
  }

  public async execute(): Promise<void> {
    if (!isChaosAllowed()) return;
    ChaosState.setEnabled(true);
    ChaosState.setProbability(1.0);
    ChaosState.addTargetEndpoint("/api");
    ChaosState.activateScenario("DatabaseFailureScenario");
  }

  public async verify(): Promise<boolean> {
    if (!isChaosAllowed()) return true;
    return ChaosState.getIsEnabled() && ChaosState.getActiveScenarios().includes("DatabaseFailureScenario");
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
