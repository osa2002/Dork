import crypto from "crypto";
import { IWebhookNormalizer, WebhookRawPayload } from "../../ppal/contracts/IWebhookNormalizer";
import { NormalizedWebhookEvent, NormalizedWebhookType } from "../../ppal/webhooks/NormalizedWebhookEvent";

export class IyzicoWebhookNormalizer implements IWebhookNormalizer {
  public readonly providerId: string = "iyzico";

  public verifySignature(rawPayload: WebhookRawPayload, secretKey: string): boolean {
    if (!secretKey) return false;
    const signatureHeader = rawPayload.signatureHeader || rawPayload.headers["x-iyzi-signature"] || rawPayload.headers["iyzi-signature"];
    if (!signatureHeader) return false;

    try {
      const body = typeof rawPayload.body === "string" ? rawPayload.body : JSON.stringify(rawPayload.body);
      const expectedSignature = crypto
        .createHmac("sha256", secretKey)
        .update(body, "utf8")
        .digest("base64");

      return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature));
    } catch (_err) {
      return false;
    }
  }

  public normalize(rawPayload: WebhookRawPayload): NormalizedWebhookEvent {
    const data = typeof rawPayload.body === "string" ? JSON.parse(rawPayload.body) : rawPayload.body;
    const rawEventType = data?.iyziEventType || data?.status || "UNKNOWN";

    const eventType = this.mapEventType(rawEventType);
    const amountInCents = Math.round(Number(data.price || data.paidPrice || 0) * 100);
    const currencyCode = (data.currency || "TRY").toUpperCase();

    return new NormalizedWebhookEvent({
      eventId: data.iyziEventId || `evt_iyz_${crypto.randomUUID()}`,
      providerId: this.providerId,
      eventType,
      rawEventType,
      providerTransactionId: data.paymentId || data.paymentConversationId,
      amount: {
        amountInCents,
        currencyCode
      },
      payload: data,
      verified: true,
      occurredAt: data.eventTime ? new Date(data.eventTime) : new Date()
    });
  }

  private mapEventType(rawType: string): NormalizedWebhookType {
    switch (rawType) {
      case "PAYMENT_SUCCESS":
      case "3DS_PAYMENT_SUCCESS":
      case "success":
        return "PAYMENT_SUCCEEDED";
      case "PAYMENT_FAILURE":
      case "3DS_PAYMENT_FAILURE":
      case "failure":
        return "PAYMENT_FAILED";
      case "REFUND_SUCCESS":
      case "CANCEL_SUCCESS":
        return "REFUND_SUCCEEDED";
      default:
        return "UNKNOWN";
    }
  }
}
