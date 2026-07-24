import { TraceSpan, SpanEvent } from "./TraceSpan";

export interface SpanDefinition {
  readonly name: string;
  readonly serviceName: string;
  readonly parentSpanId?: string;
  readonly startOffsetMs: number;
  readonly durationMs: number;
  readonly status?: "OK" | "ERROR";
  readonly statusMessage?: string;
  readonly attributes?: Record<string, any>;
  readonly events?: readonly { readonly name: string; readonly offsetMs: number; readonly attributes?: Record<string, any> }[];
}

export class DistributedTracer {
  /**
   * Statelessly generates a high-fidelity list of TraceSpan records from a sequence of span definitions,
   * tying them together into a single traceId.
   */
  public static generateTrace(
    traceId: string,
    definitions: readonly SpanDefinition[],
    baseTime: string = new Date().toISOString()
  ): readonly TraceSpan[] {
    const baseTimestamp = new Date(baseTime).getTime();

    const spans = definitions.map((def) => {
      const spanId = `sp-${Math.random().toString(36).substring(2, 9)}`;
      const startTime = new Date(baseTimestamp + def.startOffsetMs).toISOString();
      const endTime = new Date(baseTimestamp + def.startOffsetMs + def.durationMs).toISOString();

      const events: SpanEvent[] = (def.events || []).map((evt) => ({
        name: evt.name,
        timestamp: new Date(baseTimestamp + def.startOffsetMs + evt.offsetMs).toISOString(),
        attributes: evt.attributes ? Object.freeze({ ...evt.attributes }) : undefined,
      }));

      const span: TraceSpan = {
        spanId,
        traceId,
        parentSpanId: def.parentSpanId,
        name: def.name,
        serviceName: def.serviceName,
        startTime,
        endTime,
        durationMs: def.durationMs,
        status: def.status || "OK",
        statusMessage: def.statusMessage,
        attributes: Object.freeze({ ...(def.attributes || {}) }),
        events: Object.freeze(events),
      };

      return Object.freeze(span);
    });

    return Object.freeze(spans);
  }
}
