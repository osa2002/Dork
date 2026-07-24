import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";
import { ChaosState } from "../ChaosState";

export class TwilioTimeoutExperiment implements IChaosExperiment {
  public name = "Twilio SMS Timeout Simulation";
  public description = "Simulates SMS gateways failure and delays on notification alerts";
  public riskLevel = "Low" as const;
  public blastRadius = "Low" as const;
  public automaticRollback = true;
  public manualRollback = "Clear Twilio targets and reset active scenarios.";
  public expectedMetrics = ["chaos_events_total", "chaos_events_failed"];
  public expectedTelemetry = ["chaos:injection", "scenario:DependencyFailureScenario"];
  public expectedRecovery = "Asynchronous task queue handles retrying notification dispatch in the background.";
  public estimatedExecutionDuration = 3000;

  public async prepare(): Promise<void> {
    if (!isChaosAllowed()) throw new Error("Chaos Mode is disabled.");
    ChaosState.clearActiveScenarios();
  }

  public async execute(): Promise<void> {
    if (!isChaosAllowed()) return;
    ChaosState.setEnabled(true);
    ChaosState.setProbability(1.0);
    ChaosState.addTargetEndpoint("/api/notifications");
    ChaosState.activateScenario("DependencyFailureScenario");
  }

  public async verify(): Promise<boolean> {
    if (!isChaosAllowed()) return true;
    return ChaosState.getIsEnabled() && ChaosState.getTargetEndpoints().includes("/api/notifications");
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
