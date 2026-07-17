import { logContextStorage } from "../lib/serverLogger";
import { MetricsService } from "./MetricsService";

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export interface Span {
  context: SpanContext;
  name: string;
  startTime: number;
  attributes: Record<string, any>;
  end(): void;
  setAttribute(key: string, value: any): void;
}

export class TelemetryService {
  private static slowThresholds: Record<string, number> = {
    "firestore": 500,        // 500ms
    "gemini": 3000,         // 3s
    "stripe": 2000,         // 2s
    "smtp": 1500,           // 1.5s
    "twilio": 1500,         // 1.5s
    "express-request": 1000 // 1s
  };

  /**
   * Generates a random W3C trace ID (32 hex characters)
   */
  public static generateTraceId(): string {
    return Array.from({ length: 16 }, () => 
      Math.floor(Math.random() * 256).toString(16).padStart(2, "0")
    ).join("");
  }

  /**
   * Generates a random W3C span ID (16 hex characters)
   */
  public static generateSpanId(): string {
    return Array.from({ length: 8 }, () => 
      Math.floor(Math.random() * 256).toString(16).padStart(2, "0")
    ).join("");
  }

  /**
   * Start a new Telemetry Span
   */
  public static startSpan(name: string, parentContext?: SpanContext): Span {
    const store = logContextStorage.getStore();
    
    // Trace ID propagation flow:
    // 1. Explicitly provided parent trace ID
    // 2. Existing correlation ID (cleaned to match hex regex if needed, or hashed)
    // 3. Brand new trace ID
    let traceId = parentContext?.traceId;
    if (!traceId) {
      if (store?.correlationId) {
        // Use correlationId as base; clean up or fallback to guarantee a valid 32-char hex string
        const cleaned = store.correlationId.replace(/[^a-f0-9]/g, "");
        traceId = cleaned.length >= 32 ? cleaned.substring(0, 32) : cleaned.padEnd(32, "0");
      } else {
        traceId = this.generateTraceId();
      }
    }

    const spanId = this.generateSpanId();
    const parentSpanId = parentContext?.spanId;

    const attributes: Record<string, any> = {};
    const startTime = Date.now();

    const span: Span = {
      context: { traceId, spanId, parentSpanId },
      name,
      startTime,
      attributes,
      setAttribute(key: string, value: any) {
        attributes[key] = value;
      },
      end: () => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Record metrics under MetricsService
        this.logSpanOutcome(name, duration, attributes);

        // Slow Operation Detection (Phase 6.6)
        this.detectSlowOperation(name, duration, attributes);

        // Build Google Cloud Platform compatible structured trace JSON
        const isProduction = process.env.NODE_ENV === "production";
        const projectId = process.env.GOOGLE_CLOUD_PROJECT || "dorkq-prod";

        const traceEntry = {
          timestamp: new Date().toISOString(),
          level: "INFO",
          message: `[Trace Span] ${name} completed in ${duration}ms`,
          durationMs: duration,
          name,
          attributes,
          // Native GCP trace fields for log-to-trace correlation
          "logging.googleapis.com/trace": `projects/${projectId}/traces/${traceId}`,
          "logging.googleapis.com/spanId": spanId,
          "logging.googleapis.com/trace_sampled": true,
          parentSpanId,
          correlationId: store?.correlationId,
          shopId: store?.shopId,
        };

        if (isProduction) {
          process.stdout.write(JSON.stringify(traceEntry) + "\n");
        } else {
          // Pretty print in development
          console.log(
            `\x1b[2m[TRACE]\x1b[0m \x1b[35m${name}\x1b[0m \x1b[32m${duration}ms\x1b[0m \x1b[2m(TraceID: ${traceId.substring(0, 8)}, SpanID: ${spanId})\x1b[0m`
          );
        }
      }
    };

    return span;
  }

  /**
   * Helper to map span names to metric updates
   */
  private static logSpanOutcome(name: string, durationMs: number, attributes: Record<string, any>) {
    const success = attributes.error ? false : true;

    if (name.startsWith("express-request")) {
      MetricsService.recordApiRequest(durationMs, success);
    } else if (name.startsWith("firestore")) {
      if (name.includes("read") || name.includes("get")) {
        MetricsService.recordFirestoreRead(attributes.count || 1);
      } else {
        MetricsService.recordFirestoreWrite(attributes.count || 1);
      }
    } else if (name.startsWith("stripe")) {
      MetricsService.recordStripeRequest(attributes.amountCents || 0);
    } else if (name.startsWith("gemini")) {
      MetricsService.recordAiRequest();
    } else if (name.startsWith("smtp")) {
      MetricsService.recordEmailRequest();
    } else if (name.startsWith("twilio")) {
      MetricsService.recordSmsRequest();
    }
  }

  /**
   * Identifies slow transactions and raises descriptive logs
   */
  private static detectSlowOperation(name: string, durationMs: number, attributes: Record<string, any>) {
    let category = "other";
    if (name.startsWith("firestore")) category = "firestore";
    else if (name.startsWith("gemini")) category = "gemini";
    else if (name.startsWith("stripe")) category = "stripe";
    else if (name.startsWith("smtp")) category = "smtp";
    else if (name.startsWith("twilio")) category = "twilio";
    else if (name.startsWith("express-request")) category = "express-request";

    const threshold = this.slowThresholds[category] || 1000;

    if (durationMs > threshold) {
      const warningMessage = `[Performance Warning] Slow operation detected on '${name}'. Completed in ${durationMs}ms (Threshold: ${threshold}ms)`;
      const warningEntry = {
        timestamp: new Date().toISOString(),
        level: "WARNING",
        message: warningMessage,
        category,
        durationMs,
        thresholdMs: threshold,
        attributes,
        correlationId: logContextStorage.getStore()?.correlationId,
      };

      if (process.env.NODE_ENV === "production") {
        process.stdout.write(JSON.stringify(warningEntry) + "\n");
      } else {
        console.warn(`\x1b[33m[PERF WARN]\x1b[0m ${warningMessage}`);
      }
    }
  }
}
