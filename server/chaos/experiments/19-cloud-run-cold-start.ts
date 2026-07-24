import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";
import { ChaosState } from "../ChaosState";

export class CloudRunColdStartExperiment implements IChaosExperiment {
  public name = "Cloud Run Cold Start Simulation";
  public description = "Simulates high container provision latency (4.5s delay) experienced on first incoming request";
  public riskLevel = "Medium" as const;
  public blastRadius = "Low" as const;
  public automaticRollback = true;
  public manualRollback = "Clear latencies and restore container routing speed.";
  public expectedMetrics = ["chaos_events_total", "chaos_latency_added"];
  public expectedTelemetry = ["chaos:injection", "scenario:LatencyScenario"];
  public expectedRecovery = "Subsequent warm requests scale instantly without cold start provision delays.";
  public estimatedExecutionDuration = 5000;

  public async prepare(): Promise<void> {
    if (!isChaosAllowed()) throw new Error("Chaos Mode is disabled.");
    ChaosState.clearActiveScenarios();
  }

  public async execute(): Promise<void> {
    if (!isChaosAllowed()) return;
    ChaosState.setEnabled(true);
    ChaosState.setProbability(1.0);
    ChaosState.setLatency(4500); // 4.5 seconds cold start delay
    ChaosState.addTargetEndpoint("/api");
    ChaosState.activateScenario("LatencyScenario");
  }

  public async verify(): Promise<boolean> {
    if (!isChaosAllowed()) return true;
    return ChaosState.getIsEnabled() && ChaosState.getLatency() === 4500;
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
