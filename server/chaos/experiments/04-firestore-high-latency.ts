import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";
import { ChaosState } from "../ChaosState";

export class FirestoreHighLatencyExperiment implements IChaosExperiment {
  public name = "Firestore High Latency Simulation";
  public description = "Simulates slow Firestore RPC replies by introducing custom latency overheads";
  public riskLevel = "Medium" as const;
  public blastRadius = "Medium" as const;
  public automaticRollback = true;
  public manualRollback = "Clear ChaosState latency value and deactivate LatencyScenario.";
  public expectedMetrics = ["chaos_events_total", "chaos_latency_added"];
  public expectedTelemetry = ["chaos:injection", "scenario:LatencyScenario"];
  public expectedRecovery = "System continues servicing requests slower; clients see slight response delays.";
  public estimatedExecutionDuration = 10000;

  public async prepare(): Promise<void> {
    if (!isChaosAllowed()) throw new Error("Chaos Mode is disabled.");
    ChaosState.clearActiveScenarios();
  }

  public async execute(): Promise<void> {
    if (!isChaosAllowed()) return;
    ChaosState.setEnabled(true);
    ChaosState.setProbability(1.0);
    ChaosState.setLatency(3000); // Injected 3 seconds delay
    ChaosState.addTargetEndpoint("/api");
    ChaosState.activateScenario("LatencyScenario");
  }

  public async verify(): Promise<boolean> {
    if (!isChaosAllowed()) return true;
    return ChaosState.getLatency() === 3000 && ChaosState.getIsEnabled();
  }

  public async rollback(): Promise<void> {
    ChaosState.setEnabled(false);
    ChaosState.setLatency(0);
    ChaosState.clearActiveScenarios();
    ChaosState.clearTargetEndpoints();
  }

  public async cleanup(): Promise<void> {
    await this.rollback();
  }
}
