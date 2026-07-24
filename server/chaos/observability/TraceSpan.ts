export interface SpanEvent {
  readonly name: string;
  readonly timestamp: string;
  readonly attributes?: Record<string, any>;
}

export interface TraceSpan {
  readonly spanId: string;
  readonly traceId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly serviceName: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly durationMs: number;
  readonly status: "OK" | "ERROR";
  readonly statusMessage?: string;
  readonly attributes: Record<string, any>;
  readonly events: readonly SpanEvent[];
}
