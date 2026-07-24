import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";
import { ChaosState } from "../ChaosState";

export class GeminiTimeoutExperiment implements IChaosExperiment {
  public name = "Gemini API Timeout Simulation";
  public description = "Simulates high latency or request timeouts connecting to the Google GenAI backend service";
  public riskLevel = "Medium" as const;
  public blastRadius = "Low" as const;
  public automaticRollback = true;
  public manualRollback = "Deactivate DependencyFailureScenario and clear targets.";
  public expectedMetrics = ["chaos_events_total", "chaos_events_failed"];
  public expectedTelemetry = ["chaos:injection", "scenario:DependencyFailureScenario"];
  public expectedRecovery = "Graceful degradation, fallback responses or direct standard user alerts.";
  public estimatedExecutionDuration = 3000;

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
    // We will simulate gemini_timeout failure type in the scenario by enabling it
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
