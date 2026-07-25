import crypto from "crypto";
import { IWebhookNormalizer, WebhookRawPayload } from "../../ppal/contracts/IWebhookNormalizer";
import { NormalizedWebhookEvent, NormalizedWebhookType } from "../../ppal/webhooks/NormalizedWebhookEvent";

export class CheckoutComWebhookNormalizer implements IWebhookNormalizer {
  public readonly providerId: string = "checkout_com";

  public verifySignature(rawPayload: WebhookRawPayload, secretKey: string): boolean {
    if (!secretKey) return false;
    const signatureHeader = rawPayload.signatureHeader || rawPayload.headers["cko-signature"] || rawPayload.headers["CKO-SIGNATURE"];
    if (!signatureHeader) return false;

    try {
      const body = typeof rawPayload.body === "string" ? rawPayload.body : JSON.stringify(rawPayload.body);
      const expectedSignature = crypto
        .createHmac("sha256", secretKey)
        .update(body, "utf8")
        .digest("hex");

      return crypto.timingSafeEqual(Buffer.from(signatureHeader.toLowerCase()), Buffer.from(expectedSignature.toLowerCase()));
    } catch (_err) {
      return false;
    }
  }

  public normalize(rawPayload: WebhookRawPayload): NormalizedWebhookEvent {
    const data = typeof rawPayload.body === "string" ? JSON.parse(rawPayload.body) : rawPayload.body;
    const rawEventType = data?.type || "unknown";
    const dataObj = data?.data || {};

    const eventType = this.mapEventType(rawEventType);
    const amountInCents = Number(dataObj.amount || 0);
    const currencyCode = (dataObj.currency || "USD").toUpperCase();

    return new NormalizedWebhookEvent({
      eventId: data.id || `evt_cko_${crypto.randomUUID()}`,
      providerId: this.providerId,
      eventType,
      rawEventType,
      providerTransactionId: dataObj.id || dataObj.payment_id,
      providerCustomerId: dataObj.customer?.id,
      amount: {
        amountInCents,
        currencyCode
      },
      payload: data,
      verified: true,
      occurredAt: data.created_on ? new Date(data.created_on) : new Date()
    });
  }

  private mapEventType(rawType: string): NormalizedWebhookType {
    switch (rawType) {
      case "payment_approved":
      case "payment_captured":
        return "PAYMENT_SUCCEEDED";
      case "payment_declined":
      case "payment_expired":
        return "PAYMENT_FAILED";
      case "payment_pending":
        return "PAYMENT_REQUIRES_ACTION";
      case "payment_refunded":
      case "payment_voided":
        return "REFUND_SUCCEEDED";
      case "dispute_received":
      case "dispute_evidence_required":
        return "DISPUTE_CREATED";
      default:
        return "UNKNOWN";
    }
  }
}
