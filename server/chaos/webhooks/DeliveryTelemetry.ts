import { DeliveryOutcomeData } from "./DeliveryOutcome";
import { WebhookEnvelopeData } from "./WebhookEnvelope";

export interface TelemetryEventPayload {
  readonly telemetryId: string;
  readonly eventType: "WEBHOOK_DISPATCH_TELEMETRY";
  readonly deliveryId: string;
  readonly envelopeId: string;
  readonly correlationId: string;
  readonly traceId: string;
  readonly destination: string;
  readonly status: string;
  readonly responseCode: number;
  readonly latencyMs: number;
  readonly payloadSizeBytes: number;
  readonly isRetryable: boolean;
  readonly timestamp: string;
  readonly attributes: Readonly<Record<string, unknown>>;
}

export class DeliveryTelemetry {
  /**
   * Constructs an immutable, standardized telemetry record for an executed dispatch outcome.
   */
  public static buildTelemetry(
    envelope: WebhookEnvelopeData,
    outcome: DeliveryOutcomeData
  ): TelemetryEventPayload {
    const payloadString = JSON.stringify(envelope.payload);
    const payloadSizeBytes = Buffer.byteLength(payloadString, "utf8");

    const telemetry: TelemetryEventPayload = {
      telemetryId: `tel-${Math.random().toString(36).substring(2, 9)}`,
      eventType: "WEBHOOK_DISPATCH_TELEMETRY",
      deliveryId: envelope.deliveryId,
      envelopeId: envelope.envelopeId,
      correlationId: outcome.correlationId || envelope.correlationId,
      traceId: outcome.traceId || envelope.traceId,
      destination: envelope.destination,
      status: outcome.status,
      responseCode: outcome.responseCode,
      latencyMs: outcome.latencyMs,
      payloadSizeBytes,
      isRetryable: outcome.isRetryable,
      timestamp: new Date().toISOString(),
      attributes: Object.freeze({
        eventName: envelope.eventName,
        eventVersion: envelope.eventVersion,
        schemaVersion: envelope.schemaVersion,
        outcomeMessage: outcome.message,
      }),
    };

    return Object.freeze(telemetry);
  }
}
