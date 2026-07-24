import crypto from "crypto";
import { WebhookDefinitionData } from "./WebhookDefinition";

export interface WebhookEnvelopeData {
  readonly envelopeId: string;
  readonly deliveryId: string;
  readonly correlationId: string;
  readonly traceId: string;
  readonly eventId: string;
  readonly eventName: string;
  readonly eventVersion: string;
  readonly occurredAt: string;
  readonly destination: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly contentType: string;
  readonly payloadHash: string;
  readonly signature?: string;
  readonly schemaVersion: string;
}

export class WebhookEnvelope {
  /**
   * Constructs an immutable, cryptographically signed Webhook Envelope for secure delivery.
   */
  public static create(params: {
    deliveryId: string;
    eventName: string;
    payload: Readonly<Record<string, unknown>>;
    destination: string;
    secret?: string;
    eventVersion?: string;
    correlationId?: string;
    traceId?: string;
    eventId?: string;
    customHeaders?: Readonly<Record<string, string>>;
  }): WebhookEnvelopeData {
    const occurredAt = new Date().toISOString();
    const envelopeId = `env-${Math.random().toString(36).substring(2, 9)}`;
    const eventId = params.eventId || `evt-${Math.random().toString(36).substring(2, 9)}`;
    const correlationId = params.correlationId || `corr-env-${Math.random().toString(36).substring(2, 9)}`;
    const traceId = params.traceId || `trace-env-${Math.random().toString(36).substring(2, 9)}`;
    const eventVersion = params.eventVersion || "1.0.0";
    const contentType = "application/json";

    const payloadString = JSON.stringify(params.payload || {});
    const payloadHash = crypto.createHash("sha256").update(payloadString).digest("hex");

    let signature: string | undefined;
    if (params.secret && params.secret.trim() !== "") {
      signature = crypto.createHmac("sha256", params.secret).update(payloadString).digest("hex");
    }

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "X-Dork-Envelope-Id": envelopeId,
      "X-Dork-Event-Id": eventId,
      "X-Dork-Correlation-Id": correlationId,
      "X-Dork-Trace-Id": traceId,
      "X-Dork-Payload-Hash": payloadHash,
      ...(signature ? { "X-Dork-Signature-SHA256": signature } : {}),
      ...(params.customHeaders || {}),
    };

    const envelope: WebhookEnvelopeData = {
      envelopeId,
      deliveryId: params.deliveryId,
      correlationId,
      traceId,
      eventId,
      eventName: params.eventName,
      eventVersion,
      occurredAt,
      destination: params.destination,
      headers: Object.freeze(headers),
      payload: Object.freeze({ ...params.payload }),
      contentType,
      payloadHash,
      signature,
      schemaVersion: "2026.1-ENTERPRISE",
    };

    return Object.freeze(envelope);
  }

  /**
   * Verifies the cryptographic integrity and payload hash match of an envelope.
   */
  public static verifyIntegrity(
    envelope: WebhookEnvelopeData,
    secret?: string
  ): { readonly valid: boolean; readonly reason: string } {
    const payloadString = JSON.stringify(envelope.payload);
    const computedHash = crypto.createHash("sha256").update(payloadString).digest("hex");

    if (computedHash !== envelope.payloadHash) {
      return Object.freeze({
        valid: false,
        reason: "Payload SHA-256 hash mismatch. Potential tampering detected.",
      });
    }

    if (secret && envelope.signature) {
      const computedSignature = crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
      if (computedSignature !== envelope.signature) {
        return Object.freeze({
          valid: false,
          reason: "HMAC SHA-256 signature verification failed.",
        });
      }
    }

    return Object.freeze({
      valid: true,
      reason: "Cryptographic envelope integrity verified.",
    });
  }
}
