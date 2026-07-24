export type DeliveryOutcomeStatus =
  | "SUCCESS"
  | "RETRYABLE_FAILURE"
  | "NON_RETRYABLE_FAILURE"
  | "TIMEOUT"
  | "POLICY_BLOCKED"
  | "CIRCUIT_OPEN"
  | "RATE_LIMITED";

export interface DeliveryOutcomeData {
  readonly outcomeId: string;
  readonly deliveryId: string;
  readonly envelopeId: string;
  readonly status: DeliveryOutcomeStatus;
  readonly responseCode: number;
  readonly latencyMs: number;
  readonly isRetryable: boolean;
  readonly message: string;
  readonly timestamp: string;
  readonly responseHeaders?: Readonly<Record<string, string>>;
  readonly responseBodySnippet?: string;
  readonly correlationId: string;
  readonly traceId: string;
}

export class DeliveryOutcome {
  /**
   * Creates an immutable DeliveryOutcome instance.
   */
  public static create(params: {
    deliveryId: string;
    envelopeId: string;
    status: DeliveryOutcomeStatus;
    responseCode: number;
    latencyMs: number;
    message: string;
    correlationId: string;
    traceId: string;
    responseHeaders?: Readonly<Record<string, string>>;
    responseBodySnippet?: string;
  }): DeliveryOutcomeData {
    const isRetryable =
      params.status === "RETRYABLE_FAILURE" ||
      params.status === "TIMEOUT" ||
      params.status === "RATE_LIMITED";

    const outcome: DeliveryOutcomeData = {
      outcomeId: `out-${Math.random().toString(36).substring(2, 9)}`,
      deliveryId: params.deliveryId,
      envelopeId: params.envelopeId,
      status: params.status,
      responseCode: params.responseCode,
      latencyMs: Math.max(0, params.latencyMs),
      isRetryable,
      message: params.message,
      timestamp: new Date().toISOString(),
      responseHeaders: params.responseHeaders
        ? Object.freeze({ ...params.responseHeaders })
        : undefined,
      responseBodySnippet: params.responseBodySnippet,
      correlationId: params.correlationId,
      traceId: params.traceId,
    };

    return Object.freeze(outcome);
  }

  /**
   * Pure classification helper to map HTTP status codes or runtime errors to DeliveryOutcomeStatus.
   */
  public static classifyResponse(
    responseCode: number,
    latencyMs: number,
    errorMessage?: string
  ): DeliveryOutcomeStatus {
    if (errorMessage) {
      const lower = errorMessage.toLowerCase();
      if (lower.includes("timeout") || lower.includes("etimedout")) {
        return "TIMEOUT";
      }
      if (lower.includes("circuit") || lower.includes("open")) {
        return "CIRCUIT_OPEN";
      }
      if (lower.includes("policy") || lower.includes("blocked")) {
        return "POLICY_BLOCKED";
      }
    }

    if (responseCode >= 200 && responseCode < 300) {
      return "SUCCESS";
    }

    if (responseCode === 429) {
      return "RATE_LIMITED";
    }

    if (responseCode === 408 || responseCode === 504) {
      return "TIMEOUT";
    }

    if (responseCode >= 500 && responseCode <= 599) {
      return "RETRYABLE_FAILURE";
    }

    if (responseCode >= 400 && responseCode < 500) {
      return "NON_RETRYABLE_FAILURE";
    }

    return "RETRYABLE_FAILURE";
  }
}
