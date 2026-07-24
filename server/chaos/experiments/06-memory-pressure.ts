import { IChaosExperiment, isChaosAllowed } from "./IChaosExperiment";

export class MemoryPressureExperiment implements IChaosExperiment {
  public name = "Memory Pressure Simulation";
  public description = "Safely allocates heap memory to simulate garbage collector pressure and high heap utilization";
  public riskLevel = "High" as const;
  public blastRadius = "Medium" as const;
  public automaticRollback = true;
  public manualRollback = "Clear memory references; garbage collector will automatically deallocate.";
  public expectedMetrics = [];
  public expectedTelemetry = ["scenario:MemoryPressure"];
  public expectedRecovery = "Node.js V8 garbage collector reclaims freed memory objects.";
  public estimatedExecutionDuration = 4000;

  private allocatedBuffers: Buffer[] = [];

  public async prepare(): Promise<void> {
    if (!isChaosAllowed()) throw new Error("Chaos Mode is disabled.");
    this.allocatedBuffers = [];
  }

  public async execute(): Promise<void> {
    if (!isChaosAllowed()) return;

    // Allocate ~50MB of memory buffer safely to trigger mild memory overhead without crashing the container
    for (let i = 0; i < 5; i++) {
      this.allocatedBuffers.push(Buffer.alloc(10 * 1024 * 1024)); // 10MB chunk
    }
  }

  public async verify(): Promise<boolean> {
    return this.allocatedBuffers.length > 0;
  }

  public async rollback(): Promise<void> {
    // Clear references to allow immediate Garbage Collection
    this.allocatedBuffers = [];
  }

  public async cleanup(): Promise<void> {
    await this.rollback();
  }
}
