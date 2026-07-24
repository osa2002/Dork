import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";
import { ChaosState } from "../ChaosState";

export class FullDependencyBlackoutExperiment implements IChaosExperiment {
  public name = "Full Dependency Blackout Simulation";
  public description = "Simulates total simultaneous outage of Twilio SMS, Stripe Payments, and Google Gemini LLM API systems";
  public riskLevel = "Critical" as const;
  public blastRadius = "High" as const;
  public automaticRollback = true;
  public manualRollback = "Clear active DependencyFailureScenario and restore standard downstream integration state.";
  public expectedMetrics = ["chaos_events_total", "chaos_events_failed"];
  public expectedTelemetry = ["chaos:injection", "scenario:DependencyFailureScenario"];
  public expectedRecovery = "Platform features fall back gracefully; clients are greeted with helpful service-degraded status banners.";
  public estimatedExecutionDuration = 7000;

  public async prepare(): Promise<void> {
    if (!isChaosAllowed()) throw new Error("Chaos Mode is disabled.");
    ChaosState.clearActiveScenarios();
  }

  public async execute(): Promise<void> {
    if (!isChaosAllowed()) return;
    ChaosState.setEnabled(true);
    ChaosState.setProbability(1.0);
    ChaosState.addTargetEndpoint("/api");
    ChaosState.activateScenario("DependencyFailureScenario");
  }

  public async verify(): Promise<boolean> {
    if (!isChaosAllowed()) return true;
    return ChaosState.getIsEnabled() && ChaosState.getActiveScenarios().includes("DependencyFailureScenario");
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
