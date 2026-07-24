import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";
import { ChaosState } from "../ChaosState";

export class SchedulerDelayExperiment implements IChaosExperiment {
  public name = "Scheduler Delay Simulation";
  public description = "Simulates CPU delay or starvation blocks in background task scheduler execution loops";
  public riskLevel = "Medium" as const;
  public blastRadius = "Low" as const;
  public automaticRollback = true;
  public manualRollback = "Clear active SchedulerFailureScenario and flush timer queues.";
  public expectedMetrics = ["chaos_events_total", "chaos_latency_added"];
  public expectedTelemetry = ["chaos:injection", "scenario:SchedulerFailureScenario"];
  public expectedRecovery = "Graceful recovery occurs; task scheduler processes delayed ticks in backlog catchup.";
  public estimatedExecutionDuration = 6000;

  public async prepare(): Promise<void> {
    if (!isChaosAllowed()) throw new Error("Chaos Mode is disabled.");
    ChaosState.clearActiveScenarios();
  }

  public async execute(): Promise<void> {
    if (!isChaosAllowed()) return;
    ChaosState.setEnabled(true);
    ChaosState.setProbability(1.0);
    ChaosState.addTargetEndpoint("/api/cron");
    ChaosState.activateScenario("SchedulerFailureScenario");
  }

  public async verify(): Promise<boolean> {
    if (!isChaosAllowed()) return true;
    return ChaosState.getIsEnabled() && ChaosState.getActiveScenarios().includes("SchedulerFailureScenario");
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
