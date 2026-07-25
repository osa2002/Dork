import { BillingInterval } from "../value-objects/BillingPeriod";

export interface CreateSubscriptionCommand {
  tenantId: string;
  billingAccountId: string;
  planId: string;
  unitPriceCents: number;
  currencyCode?: string;
  quantity?: number;
  interval?: BillingInterval;
  trialDays?: number;
}

export interface CancelSubscriptionCommand {
  tenantId: string;
  subscriptionId: string;
  immediately?: boolean;
  reason?: string;
}

export interface GenerateInvoiceCommand {
  tenantId: string;
  billingAccountId: string;
  subscriptionId?: string;
  dueDateDays?: number;
}

export interface ProcessPaymentCommand {
  tenantId: string;
  billingAccountId: string;
  invoiceId: string;
  paymentMethodId?: string;
  amountCents: number;
  currencyCode?: string;
}

export interface IssueRefundCommand {
  tenantId: string;
  paymentIntentId: string;
  amountCents: number;
  currencyCode?: string;
  reason: "DUPLICATE" | "FRAUDULENT" | "REQUESTED_BY_CUSTOMER" | "SYSTEM_ERROR";
}
