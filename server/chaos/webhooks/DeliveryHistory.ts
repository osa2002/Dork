export interface DeliveryAuditRecord {
  readonly auditId: string;
  readonly deliveryId: string;
  readonly webhookId: string;
  readonly attempt: number;
  readonly status: "DELIVERED" | "FAILED";
  readonly responseCode: number;
  readonly latencyMs: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly errorMessage?: string;
  readonly timestamp: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface DeliveryHistorySummary {
  readonly totalAuditRecords: number;
  readonly totalAttempts: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly successRatePercent: number;
  readonly avgLatencyMs: number;
  readonly p95LatencyMs: number;
  readonly httpStatusBreakdown: Readonly<Record<number, number>>;
  readonly records: readonly DeliveryAuditRecord[];
  readonly compiledAtIso: string;
}

export class DeliveryHistory {
  /**
   * Creates an immutable audit record for an attempted webhook dispatch.
   */
  public static recordAttempt(
    params: {
      deliveryId: string;
      webhookId: string;
      attempt: number;
      status: "DELIVERED" | "FAILED";
      responseCode: number;
      latencyMs: number;
      correlationId?: string;
      traceId?: string;
      errorMessage?: string;
      metadata?: Readonly<Record<string, unknown>>;
    }
  ): DeliveryAuditRecord {
    const timestamp = new Date().toISOString();

    const record: DeliveryAuditRecord = {
      auditId: `aud-${Math.random().toString(36).substring(2, 9)}`,
      deliveryId: params.deliveryId,
      webhookId: params.webhookId,
      attempt: params.attempt,
      status: params.status,
      responseCode: params.responseCode,
      latencyMs: Math.max(0, params.latencyMs),
      correlationId: params.correlationId || `corr-aud-${Math.random().toString(36).substring(2, 9)}`,
      traceId: params.traceId || `trace-aud-${Math.random().toString(36).substring(2, 9)}`,
      errorMessage: params.errorMessage,
      timestamp,
      metadata: params.metadata ? Object.freeze({ ...params.metadata }) : Object.freeze({}),
    };

    return Object.freeze(record);
  }

  /**
   * Pure statistical aggregation of a collection of audit records.
   */
  public static summarize(records: readonly DeliveryAuditRecord[]): DeliveryHistorySummary {
    const compiledAtIso = new Date().toISOString();

    if (!records || records.length === 0) {
      return Object.freeze({
        totalAuditRecords: 0,
        totalAttempts: 0,
        successCount: 0,
        failureCount: 0,
        successRatePercent: 100,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        httpStatusBreakdown: Object.freeze({}),
        records: Object.freeze([]),
        compiledAtIso,
      });
    }

    let successCount = 0;
    let failureCount = 0;
    let totalLatency = 0;
    const latencies: number[] = [];
    const httpStatusBreakdown: Record<number, number> = {};

    for (const rec of records) {
      if (rec.status === "DELIVERED") {
        successCount++;
      } else {
        failureCount++;
      }

      totalLatency += rec.latencyMs;
      latencies.push(rec.latencyMs);

      httpStatusBreakdown[rec.responseCode] = (httpStatusBreakdown[rec.responseCode] || 0) + 1;
    }

    latencies.sort((a, b) => a - b);
    const p95Index = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95));
    const p95LatencyMs = latencies[p95Index] || 0;

    const avgLatencyMs = Math.round(totalLatency / records.length);
    const successRatePercent = Math.round((successCount / records.length) * 10000) / 100;

    return Object.freeze({
      totalAuditRecords: records.length,
      totalAttempts: records.length,
      successCount,
      failureCount,
      successRatePercent,
      avgLatencyMs,
      p95LatencyMs,
      httpStatusBreakdown: Object.freeze(httpStatusBreakdown),
      records: Object.freeze([...records]),
      compiledAtIso,
    });
  }
}
