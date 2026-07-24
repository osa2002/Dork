import { ObservabilityContextPayload } from "./ObservabilityContext";
import { TraceSpan } from "./TraceSpan";
import { MetricSummary } from "./MetricsAggregator";

export interface ObservabilityAnomalies {
  readonly code: string;
  readonly severity: "CRITICAL" | "WARNING" | "INFO";
  readonly message: string;
  readonly affectedService: string;
}

export interface ObservabilityDashboardState {
  readonly timestamp: string;
  readonly systemStatus: "HEALTHY" | "DEGRADED" | "CRITICAL";
  readonly context: ObservabilityContextPayload;
  readonly anomalies: readonly ObservabilityAnomalies[];
  readonly traceAggregates: {
    readonly totalCount: number;
    readonly errorRate: number;
    readonly avgDurationMs: number;
  };
}

export class ObservabilityDashboard {
  /**
   * Evaluates traces and the context to compile a high-level observability console dashboard statelessly.
   */
  public static compileState(
    context: ObservabilityContextPayload,
    spans: readonly TraceSpan[],
    metrics: readonly MetricSummary[]
  ): ObservabilityDashboardState {
    const anomalies: ObservabilityAnomalies[] = [];

    // Analyze errors in traces
    const errorSpans = spans.filter((s) => s.status === "ERROR");
    const errorRate = spans.length > 0 ? errorSpans.length / spans.length : 0;
    const avgDurationMs =
      spans.length > 0 ? spans.reduce((acc, s) => acc + s.durationMs, 0) / spans.length : 0;

    if (errorRate >= 0.8) {
      anomalies.push({
        code: "HIGH_TRACE_ERROR_RATE",
        severity: "CRITICAL",
        message: `Trace error rate is extremely elevated: ${(errorRate * 100).toFixed(1)}%`,
        affectedService: "Ingress Gateway",
      });
    } else if (errorRate > 0.0) {
      anomalies.push({
        code: "DETECTED_TRACE_ERRORS",
        severity: "WARNING",
        message: `Detected traces containing error signals: ${errorSpans.length} failed spans.`,
        affectedService: errorSpans[0]?.serviceName || "Unknown",
      });
    }

    // Evaluate latencies in metrics
    metrics.forEach((metric) => {
      if (metric.metricName === "LATENCY" && metric.p99 > 1000) {
        anomalies.push({
          code: "P99_LATENCY_VIOLATION",
          severity: "CRITICAL",
          message: `Service "${metric.serviceName}" has a high P99 latency: ${metric.p99}ms (threshold: 1000ms)`,
          affectedService: metric.serviceName,
        });
      }
    });

    // Determine system Status
    let systemStatus: "HEALTHY" | "DEGRADED" | "CRITICAL" = "HEALTHY";
    if (anomalies.some((a) => a.severity === "CRITICAL")) {
      systemStatus = "CRITICAL";
    } else if (anomalies.some((a) => a.severity === "WARNING")) {
      systemStatus = "DEGRADED";
    }

    return Object.freeze({
      timestamp: new Date().toISOString(),
      systemStatus,
      context,
      anomalies: Object.freeze(anomalies),
      traceAggregates: Object.freeze({
        totalCount: spans.length,
        errorRate,
        avgDurationMs,
      }),
    });
  }
}
