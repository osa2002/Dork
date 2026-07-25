import crypto from "crypto";
import { IWebhookNormalizer, WebhookRawPayload } from "../../ppal/contracts/IWebhookNormalizer";
import { NormalizedWebhookEvent, NormalizedWebhookType } from "../../ppal/webhooks/NormalizedWebhookEvent";

export class StripeWebhookNormalizer implements IWebhookNormalizer {
  public readonly providerId: string = "stripe";

  public verifySignature(rawPayload: WebhookRawPayload, secretKey: string): boolean {
    if (!secretKey) return false;
    const signatureHeader = rawPayload.signatureHeader || rawPayload.headers["stripe-signature"];
    if (!signatureHeader) return false;

    try {
      const items = signatureHeader.split(",");
      let timestamp = "";
      let signature = "";

      for (const item of items) {
        const [key, value] = item.trim().split("=");
        if (key === "t") timestamp = value;
        if (key === "v1") signature = value;
      }

      if (!timestamp || !signature) return false;

      const body = typeof rawPayload.body === "string" ? rawPayload.body : JSON.stringify(rawPayload.body);
      const signedPayload = `${timestamp}.${body}`;
      
      const expectedSignature = crypto
        .createHmac("sha256", secretKey)
        .update(signedPayload, "utf8")
        .digest("hex");

      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch (_err) {
      return false;
    }
  }

  public normalize(rawPayload: WebhookRawPayload): NormalizedWebhookEvent {
    const data = typeof rawPayload.body === "string" ? JSON.parse(rawPayload.body) : rawPayload.body;
    const object = data?.data?.object || {};
    const rawEventType = data?.type || "unknown";

    const eventType = this.mapEventType(rawEventType);
    const amountInCents = object.amount || object.amount_captured || object.amount_refunded || 0;
    const currencyCode = (object.currency || "USD").toUpperCase();

    return new NormalizedWebhookEvent({
      eventId: data.id || `evt_stripe_${crypto.randomUUID()}`,
      providerId: this.providerId,
      eventType,
      rawEventType,
      providerTransactionId: object.id || object.payment_intent,
      providerCustomerId: object.customer,
      amount: {
        amountInCents,
        currencyCode
      },
      payload: data,
      verified: true,
      occurredAt: data.created ? new Date(data.created * 1000) : new Date()
    });
  }

  private mapEventType(rawType: string): NormalizedWebhookType {
    switch (rawType) {
      case "payment_intent.succeeded":
      case "charge.succeeded":
        return "PAYMENT_SUCCEEDED";
      case "payment_intent.payment_failed":
      case "charge.failed":
        return "PAYMENT_FAILED";
      case "payment_intent.requires_action":
        return "PAYMENT_REQUIRES_ACTION";
      case "charge.refunded":
      case "refund.created":
      case "refund.updated":
        return "REFUND_SUCCEEDED";
      case "customer.subscription.created":
      case "customer.subscription.updated":
        return "SUBSCRIPTION_UPDATED";
      case "customer.subscription.deleted":
        return "SUBSCRIPTION_CANCELED";
      case "charge.dispute.created":
        return "DISPUTE_CREATED";
      default:
        return "UNKNOWN";
    }
  }
}
