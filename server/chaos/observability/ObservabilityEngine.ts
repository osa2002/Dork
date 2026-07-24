import { ObservabilityContext } from "./ObservabilityContext";
import { DistributedTracer, SpanDefinition } from "./DistributedTracer";
import { MetricsAggregator, RawMetricSample } from "./MetricsAggregator";
import { TelemetryExporter } from "./TelemetryExporter";
import { ObservabilityDashboard } from "./ObservabilityDashboard";
import { ObservabilityReporter } from "./ObservabilityReporter";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

export class ObservabilityEngine {
  /**
   * Orchestrates the stateless execution of a distributed tracing and metrics telemetry compile session.
   * Leverages real platform metrics and simulates transaction flow traces.
   */
  public static evaluate(
    environment: "production" | "staging" | "development" = "production",
    traceDefinitions: readonly SpanDefinition[] = [],
    metricSamples: readonly RawMetricSample[] = []
  ) {
    const correlationId = `corr-obs-${Math.random().toString(36).substring(2, 9)}`;

    // 1. Compile live context across SRE databases
    const context = ObservabilityContext.compile(environment);

    // 2. Generate Trace Spans
    const traceId = `tr-${Math.random().toString(36).substring(2, 9)}`;
    const spans = DistributedTracer.generateTrace(traceId, traceDefinitions);

    // 3. Aggregate Metrics
    const metrics = MetricsAggregator.aggregate(metricSamples);

    // 4. Export OpenTelemetry standard payload
    const otelPayload = TelemetryExporter.export(spans, metrics);

    // 5. Compile Dashboard console
    const dashboard = ObservabilityDashboard.compileState(context, spans, metrics);

    // 6. Generate beautiful structural reports
    const reportMarkdown = ObservabilityReporter.generateMarkdown(dashboard, spans, metrics);
    const reportJson = ObservabilityReporter.generateJson(dashboard);

    // 7. Publish Event to Event Bus
    try {
      EnterpriseEventBus.publish(
        "MetricsUpdated",
        {
          timestamp: new Date().toISOString(),
          traceId,
          spanCount: spans.length,
          metricCount: metrics.length,
          systemStatus: dashboard.systemStatus,
          errorRate: dashboard.traceAggregates.errorRate,
          avgDurationMs: dashboard.traceAggregates.avgDurationMs,
        },
        correlationId
      );
    } catch (e) {
      console.warn("EventBus publish failed in ObservabilityEngine:", e);
    }

    return Object.freeze({
      correlationId,
      context,
      spans,
      metrics,
      otelPayload,
      dashboard,
      reportMarkdown,
      reportJson,
    });
  }
}
