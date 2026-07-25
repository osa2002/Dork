import { FirestoreIdempotencyStore } from "../idempotency/FirestoreIdempotencyStore";
import { FirestoreDeadLetterQueue } from "../dlq/FirestoreDeadLetterQueue";
import { DomainEventPublisher } from "../events/DomainEventPublisher";
import { WebhookProcessingException } from "../exceptions/InfrastructureExceptions";

export interface WebhookEventPayload {
  providerId: string;
  eventId: string;
  eventType: string;
  signature?: string;
  rawPayload: Record<string, any>;
  tenantId?: string;
}

export interface WebhookHandler {
  providerId: string;
  verifySignature?: (rawPayload: any, signature?: string) => Promise<boolean> | boolean;
  handleEvent: (event: WebhookEventPayload) => Promise<void>;
}

export class WebhookProcessingPipeline {
  private readonly idempotencyStore: FirestoreIdempotencyStore;
  private readonly dlq: FirestoreDeadLetterQueue;
  private readonly eventPublisher: DomainEventPublisher;
  private readonly handlers: Map<string, WebhookHandler> = new Map();

  constructor(
    idempotencyStore?: FirestoreIdempotencyStore,
    dlq?: FirestoreDeadLetterQueue,
    eventPublisher?: DomainEventPublisher
  ) {
    this.idempotencyStore = idempotencyStore || new FirestoreIdempotencyStore();
    this.dlq = dlq || new FirestoreDeadLetterQueue();
    this.eventPublisher = eventPublisher || DomainEventPublisher.getInstance();
  }

  public registerHandler(handler: WebhookHandler): void {
    this.handlers.set(handler.providerId, handler);
  }

  public async processWebhook(webhook: WebhookEventPayload): Promise<{ success: boolean; idempotencyStatus: string }> {
    const handler = this.handlers.get(webhook.providerId);

    // 1. Signature Verification
    if (handler?.verifySignature) {
      const isValid = await handler.verifySignature(webhook.rawPayload, webhook.signature);
      if (!isValid) {
        throw new WebhookProcessingException(
          webhook.providerId,
          webhook.eventId,
          "Webhook signature verification failed."
        );
      }
    }

    const idempotencyKey = `webhook_${webhook.providerId}_${webhook.eventId}`;

    try {
      // 2. Idempotent Execution
      await this.idempotencyStore.executeIdempotent(
        idempotencyKey,
        `webhook_${webhook.eventType}`,
        async () => {
          if (handler) {
            await handler.handleEvent(webhook);
          } else {
            console.log(`[WebhookPipeline] No explicit handler registered for '${webhook.providerId}', event published directly.`);
          }
        },
        webhook.tenantId
      );

      return { success: true, idempotencyStatus: "PROCESSED" };
    } catch (err: any) {
      // 3. Route unhandled failures to Dead Letter Queue
      await this.dlq.push({
        source: `webhook_${webhook.providerId}`,
        eventType: webhook.eventType,
        payload: webhook.rawPayload,
        errorReason: err.message || String(err),
        stackTrace: err.stack,
        tenantId: webhook.tenantId,
        attemptsMade: 1
      });

      throw new WebhookProcessingException(webhook.providerId, webhook.eventId, err.message || String(err));
    }
  }
}
