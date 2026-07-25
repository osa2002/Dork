import { NormalizedWebhookEvent } from "../webhooks/NormalizedWebhookEvent";

export interface WebhookRawPayload {
  body: string | Record<string, unknown>;
  headers: Record<string, string>;
  signatureHeader?: string;
}

export interface IWebhookNormalizer {
  readonly providerId: string;
  verifySignature(rawPayload: WebhookRawPayload, secretKey: string): boolean;
  normalize(rawPayload: WebhookRawPayload): NormalizedWebhookEvent;
}
