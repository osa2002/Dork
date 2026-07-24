export interface MetricSample {
  timestamp: string;
  value: number;
  labels?: Record<string, string>;
}

export interface ScalabilitySnapshot {
  instanceId: string;
  timestamp: string;
  queueDepth: {
    pending: number;
    processing: number;
    failed: number;
    deadLetter: number;
    total: number;
  };
  performance: {
    avgLatencyMs: number;
    p95LatencyMs: number;
    throughputPerSec: number;
    retryRatePercent: number;
    dlqGrowthCount: number;
    leaseContentionRatePercent: number;
  };
  totalDispatched: number;
  totalErrors: number;
}

/**
 * Enterprise Observability & Telemetry Engine for Distributed Scalability.
 * Tracks dispatcher latency, queue depth, retry rates, DLQ growth, and throughput.
 */
export class ScalabilityObservability {
  private static instanceId = `inst_${Math.random().toString(36).substring(2, 8)}`;
  private static latenciesMs: number[] = [];
  private static totalDispatched = 0;
  private static totalRetries = 0;
  private static totalDlq = 0;
  private static totalErrors = 0;
  private static leaseAcquisitionsAttempted = 0;
  private static leaseAcquisitionsBlocked = 0;
  private static startTime = Date.now();

  /**
   * Records execution latency for an outbox message dispatch
   */
  public static recordDispatchLatency(durationMs: number, success: boolean): void {
    this.latenciesMs.push(durationMs);
    if (this.latenciesMs.length > 1000) {
      this.latenciesMs.shift();
    }

    if (success) {
      this.totalDispatched++;
    } else {
      this.totalErrors++;
    }
  }

  /**
   * Records a retry event
   */
  public static recordRetry(): void {
    this.totalRetries++;
  }

  /**
   * Records a Dead-Letter-Queue escalation
   */
  public static recordDlqEscalation(): void {
    this.totalDlq++;
  }

  /**
   * Records lease acquisition attempt and outcome
   */
  public static recordLeaseAttempt(acquired: boolean): void {
    this.leaseAcquisitionsAttempted++;
    if (!acquired) {
      this.leaseAcquisitionsBlocked++;
    }
  }

  /**
   * Generates a comprehensive real-time scalability telemetry snapshot
   */
  public static getSnapshot(queueCounts?: {
    pending: number;
    processing: number;
    failed: number;
    deadLetter: number;
  }): ScalabilitySnapshot {
    const counts = queueCounts || { pending: 0, processing: 0, failed: 0, deadLetter: 0 };
    const totalQueue = counts.pending + counts.processing + counts.failed + counts.deadLetter;

    // Calculate latency metrics
    const sorted = [...this.latenciesMs].sort((a, b) => a - b);
    const avgLatencyMs = sorted.length > 0 ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0;
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95LatencyMs = sorted.length > 0 ? sorted[p95Index] || sorted[sorted.length - 1] : 0;

    // Throughput per second
    const elapsedSec = Math.max(1, (Date.now() - this.startTime) / 1000);
    const throughputPerSec = parseFloat((this.totalDispatched / elapsedSec).toFixed(2));

    // Retry Rate %
    const totalAttempts = this.totalDispatched + this.totalRetries;
    const retryRatePercent = totalAttempts > 0 ? parseFloat(((this.totalRetries / totalAttempts) * 100).toFixed(2)) : 0;

    // Lease Contention %
    const leaseContentionRatePercent =
      this.leaseAcquisitionsAttempted > 0
        ? parseFloat(((this.leaseAcquisitionsBlocked / this.leaseAcquisitionsAttempted) * 100).toFixed(2))
        : 0;

    return {
      instanceId: this.instanceId,
      timestamp: new Date().toISOString(),
      queueDepth: {
        pending: counts.pending,
        processing: counts.processing,
        failed: counts.failed,
        deadLetter: counts.deadLetter,
        total: totalQueue,
      },
      performance: {
        avgLatencyMs,
        p95LatencyMs,
        throughputPerSec,
        retryRatePercent,
        dlqGrowthCount: this.totalDlq,
        leaseContentionRatePercent,
      },
      totalDispatched: this.totalDispatched,
      totalErrors: this.totalErrors,
    };
  }

  public static reset(): void {
    this.latenciesMs = [];
    this.totalDispatched = 0;
    this.totalRetries = 0;
    this.totalDlq = 0;
    this.totalErrors = 0;
    this.leaseAcquisitionsAttempted = 0;
    this.leaseAcquisitionsBlocked = 0;
    this.startTime = Date.now();
  }
}
