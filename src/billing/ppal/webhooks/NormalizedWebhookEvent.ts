import { MoneyValue } from "../types/PPALCommonTypes";

export type NormalizedWebhookType =
  | "PAYMENT_SUCCEEDED"
  | "PAYMENT_FAILED"
  | "PAYMENT_REQUIRES_ACTION"
  | "REFUND_SUCCEEDED"
  | "REFUND_FAILED"
  | "SUBSCRIPTION_UPDATED"
  | "SUBSCRIPTION_CANCELED"
  | "DISPUTE_CREATED"
  | "UNKNOWN";

export interface NormalizedWebhookEventProps {
  eventId: string;
  providerId: string;
  eventType: NormalizedWebhookType;
  rawEventType: string;
  providerTransactionId?: string;
  providerCustomerId?: string;
  amount?: MoneyValue;
  payload: Record<string, unknown>;
  verified: boolean;
  occurredAt: Date;
}

export class NormalizedWebhookEvent {
  public readonly eventId: string;
  public readonly providerId: string;
  public readonly eventType: NormalizedWebhookType;
  public readonly rawEventType: string;
  public readonly providerTransactionId?: string;
  public readonly providerCustomerId?: string;
  public readonly amount?: MoneyValue;
  public readonly payload: Readonly<Record<string, unknown>>;
  public readonly verified: boolean;
  public readonly occurredAt: Date;

  constructor(props: NormalizedWebhookEventProps) {
    if (!props.eventId) throw new Error("NormalizedWebhookEvent requires eventId.");
    if (!props.providerId) throw new Error("NormalizedWebhookEvent requires providerId.");

    this.eventId = props.eventId;
    this.providerId = props.providerId.toLowerCase();
    this.eventType = props.eventType;
    this.rawEventType = props.rawEventType;
    this.providerTransactionId = props.providerTransactionId;
    this.providerCustomerId = props.providerCustomerId;
    this.amount = props.amount;
    this.payload = Object.freeze({ ...props.payload });
    this.verified = props.verified;
    this.occurredAt = props.occurredAt;
  }
}
