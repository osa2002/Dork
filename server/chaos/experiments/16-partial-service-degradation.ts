import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";
import { ChaosState } from "../ChaosState";

export class PartialServiceDegradationExperiment implements IChaosExperiment {
  public name = "Partial Service Degradation Simulation";
  public description = "Simulates partial service degradation by targeting a single API queue domain with 1.5s latency";
  public riskLevel = "Medium" as const;
  public blastRadius = "Low" as const;
  public automaticRollback = true;
  public manualRollback = "Clear target endpoints and deactivate LatencyScenario.";
  public expectedMetrics = ["chaos_events_total", "chaos_latency_added"];
  public expectedTelemetry = ["chaos:injection", "scenario:LatencyScenario"];
  public expectedRecovery = "System remains functional; only the designated service domain suffers performance degradation.";
  public estimatedExecutionDuration = 4000;

  public async prepare(): Promise<void> {
    if (!isChaosAllowed()) throw new Error("Chaos Mode is disabled.");
    ChaosState.clearActiveScenarios();
  }

  public async execute(): Promise<void> {
    if (!isChaosAllowed()) return;
    ChaosState.setEnabled(true);
    ChaosState.setProbability(1.0);
    ChaosState.setLatency(1500); // 1.5 seconds latency
    ChaosState.addTargetEndpoint("/api/queues"); // Specific target endpoint!
    ChaosState.activateScenario("LatencyScenario");
  }

  public async verify(): Promise<boolean> {
    if (!isChaosAllowed()) return true;
    return ChaosState.getIsEnabled() && ChaosState.getTargetEndpoints().includes("/api/queues");
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
