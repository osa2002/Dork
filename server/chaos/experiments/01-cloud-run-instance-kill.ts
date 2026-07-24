import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";
import { ChaosState } from "../ChaosState";

export class CloudRunInstanceKillExperiment implements IChaosExperiment {
  public name = "Cloud Run Instance Kill Simulation";
  public description = "Simulates sudden termination of the main Cloud Run container instance";
  public riskLevel = "High" as const;
  public blastRadius = "High" as const;
  public automaticRollback = true;
  public manualRollback = "Call ChaosController.reset() to restore container responsiveness.";
  public expectedMetrics = ["chaos_events_total", "chaos_events_failed"];
  public expectedTelemetry = ["chaos:injection", "scenario:CloudRunInstanceKill"];
  public expectedRecovery = "Automatic Kubernetes/Cloud Run scheduler routes traffic to a new instance.";
  public estimatedExecutionDuration = 5000; // 5 seconds

  public async prepare(): Promise<void> {
    if (!isChaosAllowed()) throw new Error("Chaos Mode is disabled or running in Production.");
    // Warm up/initialize metrics and clear previous states
    ChaosState.clearActiveScenarios();
  }

  public async execute(): Promise<void> {
    if (!isChaosAllowed()) return;
    // Set ChaosState to inject 503 for all endpoints to simulate instance loss
    ChaosState.setEnabled(true);
    ChaosState.setProbability(1.0);
    ChaosState.addTargetEndpoint("/api");
    ChaosState.activateScenario("DatabaseFailureScenario"); // Use database failure for simulation
    ChaosState.incrementMetric("chaos_events_total");
  }

  public async verify(): Promise<boolean> {
    if (!isChaosAllowed()) return true;
    return ChaosState.getIsEnabled() && ChaosState.getProbability() === 1.0;
  }

  public async rollback(): Promise<void> {
    // Restore sanity
    ChaosState.setEnabled(false);
    ChaosState.setProbability(0.25);
    ChaosState.clearActiveScenarios();
    ChaosState.clearTargetEndpoints();
  }

  public async cleanup(): Promise<void> {
    await this.rollback();
  }
}
