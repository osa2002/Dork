import { webhookRepository } from "../repositories/webhookRepository";
import { WebhookConfig, WebhookEvent } from "../types";

export const webhookDispatcherService = {
  /**
   * Dispatches webhooks for a specific shop event asynchronously.
   */
  async dispatchEvent(
    shopId: string,
    event: WebhookEvent,
    payloadData: any,
    activeWebhooksList?: WebhookConfig[]
  ): Promise<void> {
    if (!shopId) return;

    try {
      let webhooks = activeWebhooksList;

      // If activeWebhooksList not provided, fetch current webhooks for shop
      if (!webhooks) {
        // Query active webhooks from repository
        await new Promise<void>((resolve) => {
          const unsub = webhookRepository.subscribeToWebhooks(shopId, (allWebhooks) => {
            webhooks = allWebhooks;
            unsub();
            resolve();
          });
        });
      }

      if (!webhooks || webhooks.length === 0) return;

      // Filter webhooks that are active and listening for this specific event
      const matchingWebhooks = webhooks.filter(
        (wh) => wh.isActive && Array.isArray(wh.events) && wh.events.includes(event)
      );

      if (matchingWebhooks.length === 0) return;

      // Dispatch asynchronously to all matching webhook endpoints
      matchingWebhooks.forEach(async (wh) => {
        try {
          const response = await fetch("/api/webhooks/dispatch", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: wh.url,
              secret: wh.secret,
              headers: wh.headers,
              event,
              payload: payloadData,
              shopId,
              webhookName: wh.name,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            await webhookRepository.logDelivery({
              webhookId: wh.id,
              webhookName: wh.name,
              shopId,
              event,
              url: wh.url,
              statusCode: result.statusCode || 200,
              success: !!result.success,
              responseSummary: result.responseSummary || "Dispatched successfully",
              payload: payloadData,
              durationMs: result.durationMs || 0,
              createdAt: new Date().toISOString(),
            });
          } else {
            await webhookRepository.logDelivery({
              webhookId: wh.id,
              webhookName: wh.name,
              shopId,
              event,
              url: wh.url,
              statusCode: response.status,
              success: false,
              responseSummary: `HTTP ${response.status} Dispatch error`,
              payload: payloadData,
              durationMs: 0,
              createdAt: new Date().toISOString(),
            });
          }
        } catch (dispatchErr: any) {
          console.error(`Error dispatching webhook ${wh.id} for event ${event}:`, dispatchErr);
          await webhookRepository.logDelivery({
            webhookId: wh.id,
            webhookName: wh.name,
            shopId,
            event,
            url: wh.url,
            statusCode: 0,
            success: false,
            responseSummary: dispatchErr.message || "Network error",
            payload: payloadData,
            durationMs: 0,
            createdAt: new Date().toISOString(),
          });
        }
      });
    } catch (err) {
      console.error(`Webhook dispatcher error for event ${event}:`, err);
    }
  },

  /**
   * Sends a test event payload to a single webhook endpoint configuration.
   */
  async testEndpoint(
    url: string,
    event: WebhookEvent,
    secret?: string,
    headers?: { key: string; value: string }[],
    samplePayload?: any
  ) {
    const response = await fetch("/api/webhooks/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        event,
        secret,
        headers,
        samplePayload,
      }),
    });

    if (!response.ok) {
      throw new Error(`Test request failed with HTTP ${response.status}`);
    }

    return await response.json();
  }
};
