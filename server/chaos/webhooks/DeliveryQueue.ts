import { WebhookContextData } from "./WebhookContext";

export type DeliveryStatus =
  | "READY"
  | "QUEUED"
  | "PROCESSING"
  | "DELIVERED"
  | "FAILED"
  | "DEAD_LETTER"
  | "EXPIRED";

export interface DeliveryPlan {
  readonly deliveryId: string;
  readonly webhookId: string;
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly destinationUrl: string;
  readonly status: DeliveryStatus;
  readonly maxAttempts: number;
  readonly currentAttempt: number;
  readonly scheduledAt: string;
  readonly expiresAt: string;
  readonly correlationId: string;
  readonly traceId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly lastStatusReason?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface QueuePlanEvaluationResult {
  readonly totalPlans: number;
  readonly statusBreakdown: Readonly<Record<DeliveryStatus, number>>;
  readonly activePlans: readonly DeliveryPlan[];
  readonly expiredPlans: readonly DeliveryPlan[];
  readonly evaluatedAt: string;
}

export class DeliveryQueue {
  /**
   * Creates a frozen, immutable delivery plan for a webhook event.
   */
  public static createPlan(
    params: {
      webhookId: string;
      eventType: string;
      payload: Readonly<Record<string, unknown>>;
      destinationUrl: string;
      maxAttempts?: number;
      ttlMs?: number;
      correlationId?: string;
      traceId?: string;
      metadata?: Readonly<Record<string, unknown>>;
    }
  ): DeliveryPlan {
    const now = new Date();
    const createdAt = now.toISOString();
    const ttlMs = params.ttlMs ?? 86400000; // 24 hours default TTL
    const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

    const plan: DeliveryPlan = {
      deliveryId: `del-${Math.random().toString(36).substring(2, 9)}`,
      webhookId: params.webhookId,
      eventType: params.eventType,
      payload: Object.freeze({ ...params.payload }),
      destinationUrl: params.destinationUrl,
      status: "READY",
      maxAttempts: params.maxAttempts ?? 5,
      currentAttempt: 0,
      scheduledAt: createdAt,
      expiresAt,
      correlationId: params.correlationId || `corr-del-${Math.random().toString(36).substring(2, 9)}`,
      traceId: params.traceId || `trace-${Math.random().toString(36).substring(2, 9)}`,
      metadata: params.metadata ? Object.freeze({ ...params.metadata }) : Object.freeze({}),
      createdAt,
      updatedAt: createdAt,
    };

    return Object.freeze(plan);
  }

  /**
   * Pure state transition function returning a new frozen DeliveryPlan instance.
   */
  public static transitionStatus(
    plan: DeliveryPlan,
    newStatus: DeliveryStatus,
    reason?: string,
    incrementAttempt: boolean = false
  ): DeliveryPlan {
    const now = new Date().toISOString();
    const updatedPlan: DeliveryPlan = {
      ...plan,
      status: newStatus,
      currentAttempt: incrementAttempt ? plan.currentAttempt + 1 : plan.currentAttempt,
      lastStatusReason: reason || plan.lastStatusReason,
      updatedAt: now,
    };

    return Object.freeze(updatedPlan);
  }

  /**
   * Pure evaluation of a batch of delivery plans against current time and context.
   */
  public static evaluateQueueBatch(
    plans: readonly DeliveryPlan[],
    context?: WebhookContextData
  ): QueuePlanEvaluationResult {
    const now = new Date().toISOString();
    const statusBreakdown: Record<DeliveryStatus, number> = {
      READY: 0,
      QUEUED: 0,
      PROCESSING: 0,
      DELIVERED: 0,
      FAILED: 0,
      DEAD_LETTER: 0,
      EXPIRED: 0,
    };

    const activePlans: DeliveryPlan[] = [];
    const expiredPlans: DeliveryPlan[] = [];

    for (const plan of plans) {
      const isExpired = new Date(plan.expiresAt).getTime() <= new Date(now).getTime();

      if (isExpired && plan.status !== "DELIVERED" && plan.status !== "DEAD_LETTER") {
        const expiredPlan = this.transitionStatus(plan, "EXPIRED", "TTL expired prior to completion");
        statusBreakdown.EXPIRED++;
        expiredPlans.push(expiredPlan);
      } else {
        statusBreakdown[plan.status]++;
        if (plan.status === "READY" || plan.status === "QUEUED" || plan.status === "PROCESSING") {
          activePlans.push(plan);
        }
      }
    }

    return Object.freeze({
      totalPlans: plans.length,
      statusBreakdown: Object.freeze(statusBreakdown),
      activePlans: Object.freeze(activePlans),
      expiredPlans: Object.freeze(expiredPlans),
      evaluatedAt: now,
    });
  }
}
