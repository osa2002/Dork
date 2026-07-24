import { TraceSpan } from "./TraceSpan";
import { MetricSummary } from "./MetricsAggregator";

export interface OpenTelemetrySpan {
  readonly trace_id: string;
  readonly span_id: string;
  readonly parent_span_id?: string;
  readonly name: string;
  readonly start_time_unix_nano: string;
  readonly end_time_unix_nano: string;
  readonly attributes: Record<string, any>;
  readonly status: {
    readonly code: "STATUS_CODE_OK" | "STATUS_CODE_ERROR";
    readonly message?: string;
  };
}

export interface TelemetryExportPayload {
  readonly exportedAt: string;
  readonly format: "OTEL_V1" | "ENTERPRISE_JSON";
  readonly traceCount: number;
  readonly metricCount: number;
  readonly traces: readonly OpenTelemetrySpan[];
  readonly metrics: readonly MetricSummary[];
}

export class TelemetryExporter {
  /**
   * Statelessly serializes core traces and metrics into an OpenTelemetry compatible payload.
   */
  public static export(
    spans: readonly TraceSpan[],
    metrics: readonly MetricSummary[]
  ): TelemetryExportPayload {
    const otelSpans: OpenTelemetrySpan[] = spans.map((span) => {
      const startUnix = (new Date(span.startTime).getTime() * 1000000).toString();
      const endUnix = (new Date(span.endTime).getTime() * 1000000).toString();

      return Object.freeze({
        trace_id: span.traceId,
        span_id: span.spanId,
        parent_span_id: span.parentSpanId,
        name: span.name,
        start_time_unix_nano: startUnix,
        end_time_unix_nano: endUnix,
        attributes: Object.freeze({
          "service.name": span.serviceName,
          ...span.attributes,
        }),
        status: Object.freeze({
          code: span.status === "OK" ? "STATUS_CODE_OK" : ("STATUS_CODE_ERROR" as const),
          message: span.statusMessage,
        }),
      });
    });

    return Object.freeze({
      exportedAt: new Date().toISOString(),
      format: "OTEL_V1",
      traceCount: spans.length,
      metricCount: metrics.length,
      traces: Object.freeze(otelSpans),
      metrics: Object.freeze(metrics),
    });
  }
}
