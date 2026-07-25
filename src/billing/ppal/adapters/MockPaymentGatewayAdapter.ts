import { BasePaymentGatewayAdapter } from "./BasePaymentGatewayAdapter";
import { ProviderCapabilities } from "../capabilities/ProviderCapabilities";
import {
  AuthorizePaymentRequest,
  CapturePaymentRequest,
  RefundPaymentRequest,
  CancelPaymentRequest,
  TransactionResult,
  AdapterConfig
} from "../types/PPALCommonTypes";

export class MockPaymentGatewayAdapter extends BasePaymentGatewayAdapter {
  constructor(config?: Partial<AdapterConfig>) {
    super({
      providerId: config?.providerId || "mock_provider",
      environment: config?.environment || "sandbox",
      timeoutMs: config?.timeoutMs || 5000
    });
  }

  public getCapabilities(): ProviderCapabilities {
    return new ProviderCapabilities({
      supports3DSecure: true,
      supportsRecurring: true,
      supportsPartialRefunds: true,
      supportsMultipleCurrencies: true,
      supportsWebhooks: true,
      supportsImmediateCapture: true,
      supportsManualCapture: true,
      supportedPaymentMethodTypes: ["credit_card", "debit_card", "bank_transfer", "sepa", "paypal", "apple_pay", "google_pay"],
      supportedCurrencies: ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"]
    });
  }

  protected async doAuthorize(request: AuthorizePaymentRequest): Promise<TransactionResult> {
    return {
      success: true,
      providerId: this.config.providerId,
      providerTransactionId: `mock_tx_${crypto.randomUUID()}`,
      status: "SUCCEEDED",
      amount: request.amount,
      occurredAt: new Date()
    };
  }

  protected async doCapture(request: CapturePaymentRequest): Promise<TransactionResult> {
    return {
      success: true,
      providerId: this.config.providerId,
      providerTransactionId: request.authorizationId,
      status: "SUCCEEDED",
      amount: request.amount,
      occurredAt: new Date()
    };
  }

  protected async doRefund(request: RefundPaymentRequest): Promise<TransactionResult> {
    return {
      success: true,
      providerId: this.config.providerId,
      providerTransactionId: `mock_ref_${request.refundId}`,
      status: "SUCCEEDED",
      amount: request.amount,
      occurredAt: new Date()
    };
  }

  protected async doCancel(request: CancelPaymentRequest): Promise<TransactionResult> {
    return {
      success: true,
      providerId: this.config.providerId,
      providerTransactionId: request.transactionId,
      status: "CANCELED",
      amount: { amountInCents: 0, currencyCode: "USD" },
      occurredAt: new Date()
    };
  }

  protected async doFetchTransactionStatus(transactionId: string): Promise<TransactionResult> {
    return {
      success: true,
      providerId: this.config.providerId,
      providerTransactionId: transactionId,
      status: "SUCCEEDED",
      amount: { amountInCents: 1000, currencyCode: "USD" },
      occurredAt: new Date()
    };
  }
}
