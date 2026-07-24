import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";
import { ChaosState } from "../ChaosState";

export class CPUPressureExperiment implements IChaosExperiment {
  public name = "CPU Pressure Simulation";
  public description = "Simulates transient heavy CPU operations on the Node.js main thread";
  public riskLevel = "High" as const;
  public blastRadius = "Medium" as const;
  public automaticRollback = true;
  public manualRollback = "Clear CPU intervals and stop loop computation.";
  public expectedMetrics = ["chaos_events_total"];
  public expectedTelemetry = ["scenario:CPUPressure"];
  public expectedRecovery = "CPU cores return to idle baseline values immediately after the task loop ends.";
  public estimatedExecutionDuration = 3000;

  private timerId?: NodeJS.Timeout;

  public async prepare(): Promise<void> {
    if (!isChaosAllowed()) throw new Error("Chaos Mode is disabled.");
  }

  public async execute(): Promise<void> {
    if (!isChaosAllowed()) return;

    // Run short-burst CPU tasks asynchronously to allow non-blocking events to process
    this.timerId = setInterval(() => {
      const start = Date.now();
      // Run heavy compute for 50ms every 150ms
      while (Date.now() - start < 50) {
        Math.sqrt(Math.random() * 10000);
      }
    }, 150);

    // Register with ChaosState so it shuts down properly if needed
    ChaosState.registerTimer(this.timerId);
  }

  public async verify(): Promise<boolean> {
    return this.timerId !== undefined;
  }

  public async rollback(): Promise<void> {
    if (this.timerId) {
      ChaosState.clearTimer(this.timerId);
      clearInterval(this.timerId);
      this.timerId = undefined;
    }
  }

  public async cleanup(): Promise<void> {
    await this.rollback();
  }
}
