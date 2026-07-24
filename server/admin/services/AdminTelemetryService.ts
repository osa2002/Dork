/**
 * Enterprise Platform Administration - OpenTelemetry & Telemetry Layer
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Provides execution tracing, latency profiling, and SLA metrics instrumentation for admin actions.
 */

import { AdminStructuredLogger } from "./AdminStructuredLogger";

export interface IAdminSpan {
  name: string;
  startTime: number;
  attributes: Record<string, any>;
  setAttribute: (key: string, value: any) => void;
  recordException: (err: Error | any) => void;
  end: () => void;
}

export class AdminTelemetryService {
  private static activeSpansCount = 0;

  /**
   * Starts a high-precision performance span for a platform administration operation.
   */
  public static startSpan(spanName: string, initialAttributes?: Record<string, any>): IAdminSpan {
    const startTime = Date.now();
    this.activeSpansCount++;
    const attributes: Record<string, any> = {
      "service.name": "dork-enterprise-admin-core",
      "span.kind": "INTERNAL",
      ...initialAttributes
    };

    return {
      name: spanName,
      startTime,
      attributes,
      setAttribute: (key: string, value: any) => {
        attributes[key] = value;
      },
      recordException: (err: Error | any) => {
        attributes["error"] = true;
        attributes["error.type"] = err?.name || "Error";
        attributes["error.message"] = err?.message || String(err);
      },
      end: () => {
        const durationMs = Date.now() - startTime;
        this.activeSpansCount = Math.max(0, this.activeSpansCount - 1);

        AdminStructuredLogger.debug(`[OTEL SPAN END] ${spanName} [${durationMs}ms]`, {
          durationMs,
          attributes
        });
      }
    };
  }

  /**
   * Instruments an async admin execution pipeline with automated span wrapping and error capture.
   */
  public static async traceAsync<T>(
    spanName: string,
    attributes: Record<string, any>,
    fn: (span: IAdminSpan) => Promise<T>
  ): Promise<T> {
    const span = this.startSpan(spanName, attributes);
    try {
      const result = await fn(span);
      span.setAttribute("status.code", "OK");
      return result;
    } catch (err: any) {
      span.recordException(err);
      span.setAttribute("status.code", "ERROR");
      throw err;
    } finally {
      span.end();
    }
  }

  public static getActiveSpansCount(): number {
    return this.activeSpansCount;
  }
}
