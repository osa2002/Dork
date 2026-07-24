import crypto from "crypto";
import { WebhookEnvelopeData } from "./WebhookEnvelope";

export interface IdempotencyValidationResult {
  readonly idempotencyKey: string;
  readonly isDuplicate: boolean;
  readonly reason: string;
  readonly computedAtIso: string;
}

export class IdempotencyManager {
  /**
   * Generates a deterministic, pure SHA-256 idempotency key for a delivery attempt.
   */
  public static generateKey(
    envelopeId: string,
    destinationUrl: string,
    payloadHash: string
  ): string {
    const rawString = `${envelopeId}:${destinationUrl.toLowerCase()}:${payloadHash}`;
    return crypto.createHash("sha256").update(rawString).digest("hex");
  }

  /**
   * Generates idempotency key directly from a Webhook Envelope.
   */
  public static generateKeyFromEnvelope(envelope: WebhookEnvelopeData): string {
    return this.generateKey(envelope.envelopeId, envelope.destination, envelope.payloadHash);
  }

  /**
   * Statelessly evaluates whether a key exists within a provided set of processed keys.
   */
  public static validateKey(
    idempotencyKey: string,
    processedKeysSet: ReadonlySet<string> | readonly string[]
  ): IdempotencyValidationResult {
    const keysArray = Array.isArray(processedKeysSet)
      ? processedKeysSet
      : Array.from(processedKeysSet);

    const isDuplicate = keysArray.includes(idempotencyKey);

    return Object.freeze({
      idempotencyKey,
      isDuplicate,
      reason: isDuplicate
        ? "Idempotency collision detected. Payload dispatch already processed."
        : "Idempotency key unique. Dispatch approved.",
      computedAtIso: new Date().toISOString(),
    });
  }
}
