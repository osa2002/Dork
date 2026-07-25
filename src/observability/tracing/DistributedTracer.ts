export interface SpanAttributeValue {
  [key: string]: string | number | boolean | string[] | number[];
}

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceFlags: number;
}

export enum SpanStatusCode {
  UNSET = 0,
  OK = 1,
  ERROR = 2
}

export interface SpanStatus {
  code: SpanStatusCode;
  message?: string;
}

export interface SpanEvent {
  name: string;
  timestampMs: number;
  attributes?: Record<string, any>;
}

export class Span {
  public readonly context: SpanContext;
  public readonly name: string;
  public readonly startTimeMs: number;
  public endTimeMs?: number;
  public status: SpanStatus = { code: SpanStatusCode.UNSET };
  public readonly attributes: Map<string, any> = new Map();
  public readonly events: SpanEvent[] = [];

  constructor(name: string, parentContext?: SpanContext) {
    this.name = name;
    this.startTimeMs = Date.now();

    const traceId = parentContext ? parentContext.traceId : Span.generateHex(32);
    const spanId = Span.generateHex(16);

    this.context = {
      traceId,
      spanId,
      parentSpanId: parentContext?.spanId,
      traceFlags: 1
    };
  }

  public setAttribute(key: string, value: any): this {
    this.attributes.set(key, value);
    return this;
  }

  public setAttributes(attrs: Record<string, any>): this {
    for (const [k, v] of Object.entries(attrs)) {
      this.attributes.set(k, v);
    }
    return this;
  }

  public addEvent(name: string, attributes?: Record<string, any>): this {
    this.events.push({
      name,
      timestampMs: Date.now(),
      attributes
    });
    return this;
  }

  public setStatus(code: SpanStatusCode, message?: string): this {
    this.status = { code, message };
    return this;
  }

  public end(): void {
    if (!this.endTimeMs) {
      this.endTimeMs = Date.now();
    }
  }

  public get durationMs(): number {
    return (this.endTimeMs || Date.now()) - this.startTimeMs;
  }

  public toTraceparent(): string {
    return `00-${this.context.traceId}-${this.context.spanId}-01`;
  }

  private static generateHex(length: number): string {
    let result = "";
    const hexChars = "0123456789abcdef";
    for (let i = 0; i < length; i++) {
      result += hexChars[Math.floor(Math.random() * 16)];
    }
    return result;
  }
}

export class DistributedTracer {
  private static instance: DistributedTracer;
  private readonly activeSpans: Span[] = [];

  public static getInstance(): DistributedTracer {
    if (!DistributedTracer.instance) {
      DistributedTracer.instance = new DistributedTracer();
    }
    return DistributedTracer.instance;
  }

  public startSpan(name: string, parentContext?: SpanContext | string): Span {
    let parent: SpanContext | undefined;

    if (typeof parentContext === "string") {
      parent = DistributedTracer.parseTraceparent(parentContext);
    } else if (parentContext) {
      parent = parentContext;
    }

    const span = new Span(name, parent);
    this.activeSpans.push(span);
    return span;
  }

  public async traceAsync<T>(
    name: string,
    operation: (span: Span) => Promise<T>,
    parentContext?: SpanContext | string
  ): Promise<T> {
    const span = this.startSpan(name, parentContext);
    try {
      const result = await operation(span);
      span.setStatus(SpanStatusCode.OK);
      return result;
    } catch (err: any) {
      span.setStatus(SpanStatusCode.ERROR, err.message || String(err));
      span.addEvent("exception", { message: err.message, stack: err.stack });
      throw err;
    } finally {
      span.end();
    }
  }

  public static parseTraceparent(traceparent: string): SpanContext | undefined {
    if (!traceparent) return undefined;
    const parts = traceparent.split("-");
    if (parts.length < 4) return undefined;

    return {
      traceId: parts[1],
      spanId: parts[2],
      traceFlags: parseInt(parts[3], 16) || 1
    };
  }
}
