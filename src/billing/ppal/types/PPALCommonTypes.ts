import { PaymentProviderId } from "./PaymentProviderId";
import { EnvironmentMode } from "./EnvironmentMode";

export interface MoneyValue {
  amountInCents: number;
  currencyCode: string;
}

export type PPALPaymentMethodType = "credit_card" | "debit_card" | "bank_transfer" | "sepa" | "paypal" | "apple_pay" | "google_pay";

export interface PaymentMethodData {
  type: PPALPaymentMethodType;
  providerPaymentMethodId?: string;
  token?: string;
  lastFourDigits?: string;
  expiryMonth?: number;
  expiryYear?: number;
  brand?: string;
}

export interface AuthorizePaymentRequest {
  transactionId: string;
  tenantId: string;
  billingAccountId: string;
  amount: MoneyValue;
  paymentMethod: PaymentMethodData;
  captureImmediately?: boolean;
  metadata?: Record<string, string>;
}

export interface CapturePaymentRequest {
  authorizationId: string;
  transactionId: string;
  tenantId: string;
  amount: MoneyValue;
  metadata?: Record<string, string>;
}

export interface RefundPaymentRequest {
  originalTransactionId: string;
  refundId: string;
  tenantId: string;
  amount: MoneyValue;
  reason: "DUPLICATE" | "FRAUDULENT" | "REQUESTED_BY_CUSTOMER" | "SYSTEM_ERROR";
  metadata?: Record<string, string>;
}

export interface CancelPaymentRequest {
  transactionId: string;
  tenantId: string;
  reason?: string;
}

export interface TransactionResult {
  success: boolean;
  providerId: PaymentProviderId;
  providerTransactionId: string;
  status: string;
  amount: MoneyValue;
  rawResponseCode?: string;
  errorMessage?: string;
  requiresAction?: boolean;
  clientSecret?: string;
  occurredAt: Date;
}

export interface AdapterConfig {
  providerId: PaymentProviderId;
  environment: EnvironmentMode;
  apiKeyReference?: string;
  merchantId?: string;
  timeoutMs?: number;
}
