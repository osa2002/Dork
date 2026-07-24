import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";
import { ChaosState } from "../ChaosState";

export class ExpressEventLoopDelayExperiment implements IChaosExperiment {
  public name = "Express Event Loop Delay Simulation";
  public description = "Simulates CPU block and event loop starvation by running controlled synchronous work";
  public riskLevel = "High" as const;
  public blastRadius = "High" as const;
  public automaticRollback = true;
  public manualRollback = "Wait for execution loop to terminate; clear latency scenarios.";
  public expectedMetrics = ["chaos_events_total", "chaos_latency_added"];
  public expectedTelemetry = ["chaos:injection", "scenario:LatencyScenario"];
  public expectedRecovery = "Event loop resumes normal polling cycles as soon as synchronous block finishes.";
  public estimatedExecutionDuration = 5000;

  public async prepare(): Promise<void> {
    if (!isChaosAllowed()) throw new Error("Chaos Mode is disabled.");
  }

  public async execute(): Promise<void> {
    if (!isChaosAllowed()) return;
    
    // Simulate event loop delay safely (e.g., block thread for 200ms)
    const start = Date.now();
    while (Date.now() - start < 200) {
      // safe short busy-wait to simulate event loop delay/CPU block
    }

    // Set up LatencyScenario as a persistent middleware simulation
    ChaosState.setEnabled(true);
    ChaosState.setProbability(1.0);
    ChaosState.setLatency(500); // 500ms delay
    ChaosState.activateScenario("LatencyScenario");
  }

  public async verify(): Promise<boolean> {
    if (!isChaosAllowed()) return true;
    return ChaosState.getIsEnabled() && ChaosState.getLatency() === 500;
  }

  public async rollback(): Promise<void> {
    ChaosState.setEnabled(false);
    ChaosState.setLatency(0);
    ChaosState.clearActiveScenarios();
  }

  public async cleanup(): Promise<void> {
    await this.rollback();
  }
}
