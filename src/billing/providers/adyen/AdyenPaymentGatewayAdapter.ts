import { BasePaymentGatewayAdapter } from "../../ppal/adapters/BasePaymentGatewayAdapter";
import { ProviderCapabilities } from "../../ppal/capabilities/ProviderCapabilities";
import {
  AdapterConfig,
  AuthorizePaymentRequest,
  CapturePaymentRequest,
  RefundPaymentRequest,
  CancelPaymentRequest,
  TransactionResult
} from "../../ppal/types/PPALCommonTypes";
import { PaymentGatewayAdapterException } from "../../ppal/exceptions/PPALExceptions";

export class AdyenPaymentGatewayAdapter extends BasePaymentGatewayAdapter {
  constructor(config?: Partial<AdapterConfig>) {
    super({
      providerId: config?.providerId || "adyen",
      environment: config?.environment || "sandbox",
      apiKeyReference: config?.apiKeyReference || "ADYEN_API_KEY",
      merchantId: config?.merchantId || "ADYEN_MERCHANT_ACCOUNT",
      timeoutMs: config?.timeoutMs || 10000
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
      supportedPaymentMethodTypes: [
        "credit_card",
        "debit_card",
        "sepa",
        "apple_pay",
        "google_pay",
        "bank_transfer",
        "paypal"
      ],
      supportedCurrencies: [
        "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "SGD", "HKD", "BRL", "SEK", "NOK"
      ]
    });
  }

  protected async doAuthorize(request: AuthorizePaymentRequest): Promise<TransactionResult> {
    const merchantAccount = process.env[this.config.merchantId || "ADYEN_MERCHANT_ACCOUNT"] || "DorkEnterpriseCOM";
    const isManualCapture = request.captureImmediately === false;

    const payload = {
      amount: {
        currency: request.amount.currencyCode.toUpperCase(),
        value: request.amount.amountInCents
      },
      reference: request.transactionId,
      merchantAccount,
      paymentMethod: {
        type: "scheme",
        encryptedCardNumber: request.paymentMethod.token || "test_encrypted_card",
        encryptedExpiryMonth: String(request.paymentMethod.expiryMonth || 12),
        encryptedExpiryYear: String(request.paymentMethod.expiryYear || 2028),
        encryptedSecurityCode: "123"
      },
      channel: "Web",
      origin: "https://dorkenterprise.com",
      returnUrl: `https://dorkenterprise.com/billing/callback?tx=${request.transactionId}`,
      captureDelayHours: isManualCapture ? -1 : 0,
      additionalData: {
        allow3DS2: "true"
      }
    };

    const response = await this.executeAdyenRequest("/v71/payments", payload, request.transactionId);

    const resultCode = response.resultCode || "Authorised";
    const requiresAction = [
      "RedirectShopper",
      "ChallengeShopper",
      "IdentifyShopper",
      "PresentToShopper"
    ].includes(resultCode);
    const success = resultCode === "Authorised" || resultCode === "Received" || resultCode === "Pending";

    return {
      success: success || requiresAction,
      providerId: this.config.providerId,
      providerTransactionId: response.pspReference || `adyen_psp_${request.transactionId}`,
      status: this.mapAdyenResultCodeToCommon(resultCode),
      amount: request.amount,
      requiresAction,
      clientSecret: response.action?.paymentData || response.action?.url,
      rawResponseCode: response.refusalReasonCode || resultCode,
      errorMessage: response.refusalReason,
      occurredAt: new Date()
    };
  }

  protected async doCapture(request: CapturePaymentRequest): Promise<TransactionResult> {
    const merchantAccount = process.env[this.config.merchantId || "ADYEN_MERCHANT_ACCOUNT"] || "DorkEnterpriseCOM";

    const payload = {
      amount: {
        currency: request.amount.currencyCode.toUpperCase(),
        value: request.amount.amountInCents
      },
      merchantAccount,
      reference: `cap_${request.transactionId}`
    };

    const response = await this.executeAdyenRequest(
      `/v71/payments/${request.authorizationId}/captures`,
      payload,
      `cap_${request.transactionId}`
    );

    const status = response.status || "received";
    const success = status === "received" || response.pspReference;

    return {
      success: Boolean(success),
      providerId: this.config.providerId,
      providerTransactionId: response.pspReference || request.authorizationId,
      status: "SUCCEEDED",
      amount: request.amount,
      rawResponseCode: status,
      errorMessage: response.errorMessage,
      occurredAt: new Date()
    };
  }

  protected async doRefund(request: RefundPaymentRequest): Promise<TransactionResult> {
    const merchantAccount = process.env[this.config.merchantId || "ADYEN_MERCHANT_ACCOUNT"] || "DorkEnterpriseCOM";

    const payload = {
      amount: {
        currency: request.amount.currencyCode.toUpperCase(),
        value: request.amount.amountInCents
      },
      merchantAccount,
      reference: `ref_${request.refundId}`
    };

    const response = await this.executeAdyenRequest(
      `/v71/payments/${request.originalTransactionId}/refunds`,
      payload,
      `ref_${request.refundId}`
    );

    const status = response.status || "received";
    const success = status === "received" || response.pspReference;

    return {
      success: Boolean(success),
      providerId: this.config.providerId,
      providerTransactionId: response.pspReference || `adyen_ref_${request.refundId}`,
      status: success ? "SUCCEEDED" : "FAILED",
      amount: request.amount,
      rawResponseCode: status,
      errorMessage: response.errorMessage,
      occurredAt: new Date()
    };
  }

  protected async doCancel(request: CancelPaymentRequest): Promise<TransactionResult> {
    const merchantAccount = process.env[this.config.merchantId || "ADYEN_MERCHANT_ACCOUNT"] || "DorkEnterpriseCOM";

    const payload = {
      merchantAccount,
      reference: `cnl_${request.transactionId}`
    };

    const response = await this.executeAdyenRequest(
      `/v71/payments/${request.transactionId}/cancels`,
      payload,
      `cnl_${request.transactionId}`
    );

    const status = response.status || "received";

    return {
      success: status === "received" || Boolean(response.pspReference),
      providerId: this.config.providerId,
      providerTransactionId: response.pspReference || request.transactionId,
      status: "CANCELED",
      amount: { amountInCents: 0, currencyCode: "USD" },
      rawResponseCode: status,
      errorMessage: response.errorMessage,
      occurredAt: new Date()
    };
  }

  protected async doFetchTransactionStatus(transactionId: string): Promise<TransactionResult> {
    const response = await this.executeAdyenRequest(
      `/v71/paymentDetails`,
      { details: { pspReference: transactionId } }
    );

    const resultCode = response.resultCode || "Authorised";

    return {
      success: resultCode === "Authorised",
      providerId: this.config.providerId,
      providerTransactionId: response.pspReference || transactionId,
      status: this.mapAdyenResultCodeToCommon(resultCode),
      amount: {
        amountInCents: response.amount?.value || 0,
        currencyCode: response.amount?.currency || "USD"
      },
      requiresAction: ["RedirectShopper", "ChallengeShopper"].includes(resultCode),
      occurredAt: new Date()
    };
  }

  private mapAdyenResultCodeToCommon(code: string): string {
    switch (code) {
      case "Authorised":
        return "SUCCEEDED";
      case "Pending":
      case "Received":
        return "PROCESSING";
      case "RedirectShopper":
      case "ChallengeShopper":
      case "IdentifyShopper":
      case "PresentToShopper":
        return "REQUIRES_ACTION";
      case "Cancelled":
        return "CANCELED";
      case "Refused":
      case "Error":
      default:
        return "FAILED";
    }
  }

  private async executeAdyenRequest(
    endpoint: string,
    payload: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<any> {
    const apiKey = process.env[this.config.apiKeyReference || "ADYEN_API_KEY"] || "mock_adyen_api_key";

    if (apiKey.includes("mock") || process.env.NODE_ENV === "test") {
      return {
        pspReference: idempotencyKey ? `psp_${idempotencyKey}` : "psp_mock_adyen",
        resultCode: "Authorised",
        status: "received"
      };
    }

    const host = this.config.environment === "production"
      ? "https://checkout-live.adyen.com"
      : "https://checkout-test.adyen.com/checkout";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs || 10000);

    try {
      const response = await fetch(`${host}${endpoint}`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);
      const json = await response.json();

      if (!response.ok) {
        throw new PaymentGatewayAdapterException(
          this.config.providerId,
          json.message || `Adyen API Error (${response.status})`,
          json
        );
      }

      return json;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err instanceof PaymentGatewayAdapterException) throw err;
      throw new PaymentGatewayAdapterException(
        this.config.providerId,
        `Adyen HTTP request failed: ${err.message}`,
        err
      );
    }
  }
}
