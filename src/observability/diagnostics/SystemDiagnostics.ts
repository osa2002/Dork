import { CloudMetricsCollector } from "../metrics/CloudMetricsCollector";
import { HealthCheckRegistry } from "../health/HealthCheckRegistry";
import { ErrorAggregator } from "../monitoring/ErrorAggregator";

export interface DiagnosticSnapshot {
  timestamp: string;
  environment: string;
  uptimeSeconds: number;
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
    externalMB: number;
  };
  health: any;
  aggregatedTopErrors: any[];
  metricsSummary: {
    totalCounters: number;
    totalGauges: number;
    totalHistograms: number;
  };
}

export class SystemDiagnostics {
  public static async captureSnapshot(): Promise<DiagnosticSnapshot> {
    const mem = process.memoryUsage();
    const healthRegistry = HealthCheckRegistry.getInstance();
    const healthReport = await healthRegistry.evaluateHealth();
    const errorAggregator = ErrorAggregator.getInstance();
    const metricsCollector = CloudMetricsCollector.getInstance();
    const metricsSnapshot = metricsCollector.snapshotAllMetrics();

    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "production",
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
        externalMB: Math.round(mem.external / 1024 / 1024)
      },
      health: healthReport,
      aggregatedTopErrors: errorAggregator.getAggregatedErrors().slice(0, 5),
      metricsSummary: {
        totalCounters: metricsSnapshot.counters.length,
        totalGauges: metricsSnapshot.gauges.length,
        totalHistograms: metricsSnapshot.histograms.length
      }
    };
  }
}
