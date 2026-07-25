import { Span } from "../tracing/DistributedTracer";
import { CloudMetricsCollector } from "../metrics/CloudMetricsCollector";

export interface OTLPSpanPayload {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Array<{ key: string; value: { stringValue?: string; intValue?: number; doubleValue?: number; boolValue?: boolean } }>;
  status: { code: number; message?: string };
}

export class OpenTelemetryExporter {
  private static instance: OpenTelemetryExporter;
  private spanQueue: OTLPSpanPayload[] = [];
  private readonly maxQueueSize = 1000;

  public static getInstance(): OpenTelemetryExporter {
    if (!OpenTelemetryExporter.instance) {
      OpenTelemetryExporter.instance = new OpenTelemetryExporter();
    }
    return OpenTelemetryExporter.instance;
  }

  public exportSpan(span: Span): void {
    if (!span.endTimeMs) return;

    const attributesArray = Array.from(span.attributes.entries()).map(([k, v]) => {
      if (typeof v === "number") {
        return { key: k, value: Number.isInteger(v) ? { intValue: v } : { doubleValue: v } };
      }
      if (typeof v === "boolean") {
        return { key: k, value: { boolValue: v } };
      }
      return { key: k, value: { stringValue: String(v) } };
    });

    const otlpSpan: OTLPSpanPayload = {
      traceId: span.context.traceId,
      spanId: span.context.spanId,
      parentSpanId: span.context.parentSpanId,
      name: span.name,
      startTimeUnixNano: (BigInt(span.startTimeMs) * BigInt(1000000)).toString(),
      endTimeUnixNano: (BigInt(span.endTimeMs) * BigInt(1000000)).toString(),
      attributes: attributesArray,
      status: { code: span.status.code, message: span.status.message }
    };

    this.spanQueue.push(otlpSpan);
    if (this.spanQueue.length > this.maxQueueSize) {
      this.spanQueue.shift();
    }
  }

  public generateOTLPTracePayload(): Record<string, any> {
    return {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: "service.name", value: { stringValue: "billing-platform" } },
              { key: "service.namespace", value: { stringValue: "ppal-core" } },
              { key: "cloud.provider", value: { stringValue: "gcp" } },
              { key: "cloud.platform", value: { stringValue: "cloud_run" } }
            ]
          },
          scopeSpans: [
            {
              scope: { name: "ppal-tracer", version: "1.0.0" },
              spans: [...this.spanQueue]
            }
          ]
        }
      ]
    };
  }

  public generateOTLPMetricsPayload(): Record<string, any> {
    const metricsCollector = CloudMetricsCollector.getInstance();
    const snapshot = metricsCollector.snapshotAllMetrics();

    return {
      resourceMetrics: [
        {
          resource: {
            attributes: [{ key: "service.name", value: { stringValue: "billing-platform" } }]
          },
          scopeMetrics: [
            {
              scope: { name: "ppal-metrics-collector", version: "1.0.0" },
              metrics: [
                ...snapshot.counters.map(c => ({
                  name: c.name,
                  sum: {
                    dataPoints: [{ value: c.value, attributes: c.labels }]
                  }
                })),
                ...snapshot.gauges.map(g => ({
                  name: g.name,
                  gauge: {
                    dataPoints: [{ value: g.value, attributes: g.labels }]
                  }
                }))
              ]
            }
          ]
        }
      ]
    };
  }

  public flush(): void {
    this.spanQueue = [];
  }
}
