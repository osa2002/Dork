export type FailureCategory =
  | "NETWORK_TIMEOUT"
  | "HTTP_4XX_CLIENT_ERROR"
  | "HTTP_5XX_SERVER_ERROR"
  | "POLICY_VIOLATION"
  | "CIRCUIT_BROKEN"
  | "MAX_RETRIES_EXCEEDED"
  | "PAYLOAD_TOO_LARGE"
  | "UNKNOWN";

export interface DeadLetterRecord {
  readonly dlqId: string;
  readonly deliveryId: string;
  readonly webhookId: string;
  readonly destinationUrl: string;
  readonly eventType: string;
  readonly failureCategory: FailureCategory;
  readonly reason: string;
  readonly lastError: string;
  readonly failureCount: number;
  readonly correlationId: string;
  readonly traceId: string;
  readonly timestamp: string;
  readonly payloadSnapshot: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface DeadLetterAnalysisReport {
  readonly totalRecords: number;
  readonly categoryCounts: Readonly<Record<FailureCategory, number>>;
  readonly primaryFailureCategory: FailureCategory | "NONE";
  readonly oldestRecordTimestamp?: string;
  readonly newestRecordTimestamp?: string;
  readonly records: readonly DeadLetterRecord[];
  readonly analyzedAtIso: string;
}

export class DeadLetterQueue {
  /**
   * Creates an immutable, frozen dead-letter record for a failed webhook delivery item.
   */
  public static createRecord(
    params: {
      deliveryId: string;
      webhookId: string;
      destinationUrl: string;
      eventType: string;
      failureCategory: FailureCategory;
      reason: string;
      lastError: string;
      failureCount: number;
      correlationId?: string;
      traceId?: string;
      payloadSnapshot?: Readonly<Record<string, unknown>>;
      metadata?: Readonly<Record<string, unknown>>;
    }
  ): DeadLetterRecord {
    const timestamp = new Date().toISOString();

    const record: DeadLetterRecord = {
      dlqId: `dlq-${Math.random().toString(36).substring(2, 9)}`,
      deliveryId: params.deliveryId,
      webhookId: params.webhookId,
      destinationUrl: params.destinationUrl,
      eventType: params.eventType,
      failureCategory: params.failureCategory,
      reason: params.reason,
      lastError: params.lastError,
      failureCount: params.failureCount,
      correlationId: params.correlationId || `corr-dlq-${Math.random().toString(36).substring(2, 9)}`,
      traceId: params.traceId || `trace-dlq-${Math.random().toString(36).substring(2, 9)}`,
      timestamp,
      payloadSnapshot: params.payloadSnapshot ? Object.freeze({ ...params.payloadSnapshot }) : Object.freeze({}),
      metadata: params.metadata ? Object.freeze({ ...params.metadata }) : Object.freeze({}),
    };

    return Object.freeze(record);
  }

  /**
   * Pure analytical evaluation of a dead-letter collection.
   */
  public static analyzeBatch(records: readonly DeadLetterRecord[]): DeadLetterAnalysisReport {
    const analyzedAtIso = new Date().toISOString();

    const categoryCounts: Record<FailureCategory, number> = {
      NETWORK_TIMEOUT: 0,
      HTTP_4XX_CLIENT_ERROR: 0,
      HTTP_5XX_SERVER_ERROR: 0,
      POLICY_VIOLATION: 0,
      CIRCUIT_BROKEN: 0,
      MAX_RETRIES_EXCEEDED: 0,
      PAYLOAD_TOO_LARGE: 0,
      UNKNOWN: 0,
    };

    for (const rec of records) {
      if (categoryCounts[rec.failureCategory] !== undefined) {
        categoryCounts[rec.failureCategory]++;
      } else {
        categoryCounts.UNKNOWN++;
      }
    }

    let primaryCategory: FailureCategory | "NONE" = "NONE";
    let maxCount = 0;

    for (const [cat, count] of Object.entries(categoryCounts)) {
      if (count > maxCount) {
        maxCount = count;
        primaryCategory = cat as FailureCategory;
      }
    }

    const timestamps = records.map((r) => new Date(r.timestamp).getTime()).sort((a, b) => a - b);
    const oldestRecordTimestamp = timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : undefined;
    const newestRecordTimestamp = timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : undefined;

    return Object.freeze({
      totalRecords: records.length,
      categoryCounts: Object.freeze(categoryCounts),
      primaryFailureCategory: primaryCategory,
      oldestRecordTimestamp,
      newestRecordTimestamp,
      records: Object.freeze([...records]),
      analyzedAtIso,
    });
  }
}
