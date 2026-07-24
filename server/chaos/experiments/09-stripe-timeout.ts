import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";
import { ChaosState } from "../ChaosState";

export class StripeTimeoutExperiment implements IChaosExperiment {
  public name = "Stripe API Timeout Simulation";
  public description = "Simulates payment gateway outage and API delays during Stripe Checkout execution flows";
  public riskLevel = "Medium" as const;
  public blastRadius = "Medium" as const;
  public automaticRollback = true;
  public manualRollback = "Clear active DependencyFailureScenario and restore standard route execution.";
  public expectedMetrics = ["chaos_events_total", "chaos_events_failed"];
  public expectedTelemetry = ["chaos:injection", "scenario:DependencyFailureScenario"];
  public expectedRecovery = "Transaction status retries or instant payment decline screens with clear developer messages.";
  public estimatedExecutionDuration = 4000;

  public async prepare(): Promise<void> {
    if (!isChaosAllowed()) throw new Error("Chaos Mode is disabled.");
    ChaosState.clearActiveScenarios();
  }

  public async execute(): Promise<void> {
    if (!isChaosAllowed()) return;
    ChaosState.setEnabled(true);
    ChaosState.setProbability(1.0);
    ChaosState.addTargetEndpoint("/api/billing");
    ChaosState.activateScenario("DependencyFailureScenario");
  }

  public async verify(): Promise<boolean> {
    if (!isChaosAllowed()) return true;
    return ChaosState.getIsEnabled() && ChaosState.getTargetEndpoints().includes("/api/billing");
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
