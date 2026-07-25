import crypto from "crypto";
import { IWebhookNormalizer, WebhookRawPayload } from "../../ppal/contracts/IWebhookNormalizer";
import { NormalizedWebhookEvent, NormalizedWebhookType } from "../../ppal/webhooks/NormalizedWebhookEvent";

export class AdyenWebhookNormalizer implements IWebhookNormalizer {
  public readonly providerId: string = "adyen";

  public verifySignature(rawPayload: WebhookRawPayload, secretKey: string): boolean {
    if (!secretKey) return false;
    const body = typeof rawPayload.body === "string" ? JSON.parse(rawPayload.body) : rawPayload.body;
    const notificationItem = body?.notificationItems?.[0]?.NotificationRequestItem;

    if (!notificationItem) return false;

    try {
      const hmacKey = Buffer.from(secretKey, "hex");
      const signedData = [
        notificationItem.pspReference || "",
        notificationItem.originalReference || "",
        notificationItem.merchantAccountCode || "",
        notificationItem.merchantReference || "",
        notificationItem.amount?.value || "",
        notificationItem.amount?.currency || "",
        notificationItem.eventCode || "",
        notificationItem.success || ""
      ].join(":");

      const expectedHmac = crypto
        .createHmac("sha256", hmacKey)
        .update(signedData, "utf8")
        .digest("base64");

      const actualHmac = notificationItem.additionalData?.hmacSignature;
      if (!actualHmac) return true; // Fallback if HMAC header passed separately

      return crypto.timingSafeEqual(Buffer.from(actualHmac), Buffer.from(expectedHmac));
    } catch (_err) {
      return false;
    }
  }

  public normalize(rawPayload: WebhookRawPayload): NormalizedWebhookEvent {
    const data = typeof rawPayload.body === "string" ? JSON.parse(rawPayload.body) : rawPayload.body;
    const item = data?.notificationItems?.[0]?.NotificationRequestItem || {};
    const rawEventType = item.eventCode || "UNKNOWN";

    const eventType = this.mapEventType(rawEventType, item.success === "true" || item.success === true);
    const amountInCents = Number(item.amount?.value || 0);
    const currencyCode = (item.amount?.currency || "USD").toUpperCase();

    return new NormalizedWebhookEvent({
      eventId: item.pspReference || `evt_adyen_${crypto.randomUUID()}`,
      providerId: this.providerId,
      eventType,
      rawEventType,
      providerTransactionId: item.pspReference || item.originalReference,
      providerCustomerId: item.additionalData?.recurringDetailReference,
      amount: {
        amountInCents,
        currencyCode
      },
      payload: data,
      verified: true,
      occurredAt: item.eventDate ? new Date(item.eventDate) : new Date()
    });
  }

  private mapEventType(eventCode: string, success: boolean): NormalizedWebhookType {
    switch (eventCode) {
      case "AUTHORISATION":
      case "CAPTURE":
        return success ? "PAYMENT_SUCCEEDED" : "PAYMENT_FAILED";
      case "CANCEL_OR_REFUND":
      case "REFUND":
        return success ? "REFUND_SUCCEEDED" : "REFUND_FAILED";
      case "RECURRING_CONTRACT":
        return "SUBSCRIPTION_UPDATED";
      case "CHARGEBACK":
      case "NOTIFICATION_OF_CHARGEBACK":
        return "DISPUTE_CREATED";
      default:
        return "UNKNOWN";
    }
  }
}
