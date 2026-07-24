import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";
import { ChaosState } from "../ChaosState";

export class SSEDisconnectExperiment implements IChaosExperiment {
  public name = "SSE Disconnect Simulation";
  public description = "Simulates abrupt dropouts on real-time Server-Sent Events / Event Streams";
  public riskLevel = "Medium" as const;
  public blastRadius = "Medium" as const;
  public automaticRollback = true;
  public manualRollback = "Clear endpoints and restore stable streaming middleware settings.";
  public expectedMetrics = ["chaos_events_total", "chaos_events_failed"];
  public expectedTelemetry = ["chaos:injection", "scenario:RateLimitScenario"];
  public expectedRecovery = "Web App clients automatically detect disconnected streams and establish reconnect backoffs.";
  public estimatedExecutionDuration = 4000;

  public async prepare(): Promise<void> {
    if (!isChaosAllowed()) throw new Error("Chaos Mode is disabled.");
    ChaosState.clearActiveScenarios();
  }

  public async execute(): Promise<void> {
    if (!isChaosAllowed()) return;
    ChaosState.setEnabled(true);
    ChaosState.setProbability(1.0);
    ChaosState.addTargetEndpoint("/api/messaging/stream");
    ChaosState.activateScenario("RateLimitScenario"); // Inject 429 to break connection establishment
  }

  public async verify(): Promise<boolean> {
    if (!isChaosAllowed()) return true;
    return ChaosState.getIsEnabled() && ChaosState.getTargetEndpoints().includes("/api/messaging/stream");
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
