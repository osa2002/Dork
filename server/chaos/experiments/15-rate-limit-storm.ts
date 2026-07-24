import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";
import { ChaosState } from "../ChaosState";

export class RateLimitStormExperiment implements IChaosExperiment {
  public name = "Rate Limit Storm Simulation";
  public description = "Simulates high burst traffic causing rate limit filters to kick in, returning HTTP 429";
  public riskLevel = "Medium" as const;
  public blastRadius = "Medium" as const;
  public automaticRollback = true;
  public manualRollback = "Clear target endpoints and deactivate RateLimitScenario.";
  public expectedMetrics = ["chaos_events_total", "chaos_events_failed"];
  public expectedTelemetry = ["chaos:injection", "scenario:RateLimitScenario"];
  public expectedRecovery = "Client-side applications throttle outgoing request rates and display user-friendly warnings.";
  public estimatedExecutionDuration = 5000;

  public async prepare(): Promise<void> {
    if (!isChaosAllowed()) throw new Error("Chaos Mode is disabled.");
    ChaosState.clearActiveScenarios();
  }

  public async execute(): Promise<void> {
    if (!isChaosAllowed()) return;
    ChaosState.setEnabled(true);
    ChaosState.setProbability(0.9); // 90% rate limit failure on targets
    ChaosState.addTargetEndpoint("/api");
    ChaosState.activateScenario("RateLimitScenario");
  }

  public async verify(): Promise<boolean> {
    if (!isChaosAllowed()) return true;
    return ChaosState.getIsEnabled() && ChaosState.getActiveScenarios().includes("RateLimitScenario");
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
