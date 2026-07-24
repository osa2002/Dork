import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";
import { ChaosState } from "../ChaosState";

export class AuthFailureExperiment implements IChaosExperiment {
  public name = "Authentication Failure Simulation";
  public description = "Simulates expired or corrupted OAuth/Firebase ID token verifications returning HTTP 401";
  public riskLevel = "Medium" as const;
  public blastRadius = "Medium" as const;
  public automaticRollback = true;
  public manualRollback = "Deactivate AuthenticationFailureScenario.";
  public expectedMetrics = ["chaos_events_total", "chaos_events_failed"];
  public expectedTelemetry = ["chaos:injection", "scenario:AuthenticationFailureScenario"];
  public expectedRecovery = "Web App forces redirection to login gate, triggering silent token refresh sequences.";
  public estimatedExecutionDuration = 3000;

  public async prepare(): Promise<void> {
    if (!isChaosAllowed()) throw new Error("Chaos Mode is disabled.");
    ChaosState.clearActiveScenarios();
  }

  public async execute(): Promise<void> {
    if (!isChaosAllowed()) return;
    ChaosState.setEnabled(true);
    ChaosState.setProbability(1.0);
    ChaosState.addTargetEndpoint("/api/auth");
    ChaosState.activateScenario("AuthenticationFailureScenario");
  }

  public async verify(): Promise<boolean> {
    if (!isChaosAllowed()) return true;
    return ChaosState.getIsEnabled() && ChaosState.getActiveScenarios().includes("AuthenticationFailureScenario");
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
