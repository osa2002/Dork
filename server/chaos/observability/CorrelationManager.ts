import { TraceContext } from "./TraceContext";

export class CorrelationManager {
  /**
   * Generates a new unique trace context.
   */
  public static generate(
    parentContext?: TraceContext,
    baggage: Record<string, string> = {}
  ): TraceContext {
    const traceId = parentContext?.traceId || `tr-${Math.random().toString(36).substring(2, 9)}`;
    const spanId = `sp-${Math.random().toString(36).substring(2, 9)}`;
    return Object.freeze({
      traceId,
      spanId,
      parentSpanId: parentContext?.spanId,
      baggage: Object.freeze({
        ...(parentContext?.baggage || {}),
        ...baggage,
      }),
    });
  }

  /**
   * Injects trace context into an external metadata carrier.
   */
  public static inject(context: TraceContext): Record<string, string> {
    const carrier: Record<string, string> = {
      "x-trace-id": context.traceId,
      "x-span-id": context.spanId,
    };
    if (context.parentSpanId) {
      carrier["x-parent-span-id"] = context.parentSpanId;
    }
    Object.entries(context.baggage).forEach(([key, val]) => {
      carrier[`x-baggage-${key}`] = val;
    });
    return Object.freeze(carrier);
  }

  /**
   * Extracts trace context from an external carrier.
   */
  public static extract(carrier: Record<string, string>): TraceContext {
    const traceId = carrier["x-trace-id"] || `tr-${Math.random().toString(36).substring(2, 9)}`;
    const spanId = carrier["x-span-id"] || `sp-${Math.random().toString(36).substring(2, 9)}`;
    const parentSpanId = carrier["x-parent-span-id"] || undefined;
    
    const baggage: Record<string, string> = {};
    Object.entries(carrier).forEach(([key, val]) => {
      if (key.startsWith("x-baggage-")) {
        const baggageKey = key.replace("x-baggage-", "");
        baggage[baggageKey] = val;
      }
    });

    return Object.freeze({
      traceId,
      spanId,
      parentSpanId,
      baggage: Object.freeze(baggage),
    });
  }
}
