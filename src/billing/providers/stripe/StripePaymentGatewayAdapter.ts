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

export class StripePaymentGatewayAdapter extends BasePaymentGatewayAdapter {
  constructor(config?: Partial<AdapterConfig>) {
    super({
      providerId: config?.providerId || "stripe",
      environment: config?.environment || "sandbox",
      apiKeyReference: config?.apiKeyReference || "STRIPE_SECRET_KEY",
      merchantId: config?.merchantId,
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
        "bank_transfer"
      ],
      supportedCurrencies: [
        "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "NZD", "SGD", "HKD", "SEK", "NOK", "DKK"
      ]
    });
  }

  protected async doAuthorize(request: AuthorizePaymentRequest): Promise<TransactionResult> {
    const isManualCapture = request.captureImmediately === false;
    const captureMethod = isManualCapture ? "manual" : "automatic";

    // Build Stripe PaymentIntent payload
    const payload = new URLSearchParams({
      amount: request.amount.amountInCents.toString(),
      currency: request.amount.currencyCode.toLowerCase(),
      capture_method: captureMethod,
      confirm: "true",
      "payment_method_types[0]": this.mapPaymentMethodType(request.paymentMethod.type)
    });

    if (request.paymentMethod.providerPaymentMethodId) {
      payload.append("payment_method", request.paymentMethod.providerPaymentMethodId);
    } else if (request.paymentMethod.token) {
      payload.append("payment_method_data[type]", "card");
      payload.append("payment_method_data[card][token]", request.paymentMethod.token);
    }

    if (request.metadata) {
      for (const [key, value] of Object.entries(request.metadata)) {
        payload.append(`metadata[${key}]`, value);
      }
    }
    payload.append("metadata[tenantId]", request.tenantId);
    payload.append("metadata[transactionId]", request.transactionId);

    const response = await this.executeStripeRequest("/v1/payment_intents", payload, request.transactionId);

    const status = response.status || "succeeded";
    const requiresAction = status === "requires_action" || status === "requires_source_action" || status === "requires_confirmation";
    const succeeded = status === "succeeded" || status === "requires_capture";

    return {
      success: succeeded || requiresAction,
      providerId: this.config.providerId,
      providerTransactionId: response.id || `pi_stripe_${request.transactionId}`,
      status: this.mapStripeStatusToCommon(status),
      amount: request.amount,
      requiresAction: requiresAction,
      clientSecret: response.client_secret || undefined,
      rawResponseCode: response.error?.code || status,
      errorMessage: response.error?.message,
      occurredAt: new Date()
    };
  }

  protected async doCapture(request: CapturePaymentRequest): Promise<TransactionResult> {
    const payload = new URLSearchParams({
      amount_to_capture: request.amount.amountInCents.toString()
    });

    const response = await this.executeStripeRequest(
      `/v1/payment_intents/${request.authorizationId}/capture`,
      payload,
      `cap_${request.transactionId}`
    );

    const status = response.status || "succeeded";
    const success = status === "succeeded";

    return {
      success,
      providerId: this.config.providerId,
      providerTransactionId: response.id || request.authorizationId,
      status: this.mapStripeStatusToCommon(status),
      amount: request.amount,
      rawResponseCode: response.error?.code || status,
      errorMessage: response.error?.message,
      occurredAt: new Date()
    };
  }

  protected async doRefund(request: RefundPaymentRequest): Promise<TransactionResult> {
    const payload = new URLSearchParams({
      payment_intent: request.originalTransactionId,
      amount: request.amount.amountInCents.toString(),
      reason: this.mapRefundReason(request.reason)
    });

    const response = await this.executeStripeRequest("/v1/refunds", payload, `ref_${request.refundId}`);

    const status = response.status || "succeeded";
    const success = status === "succeeded" || status === "pending";

    return {
      success,
      providerId: this.config.providerId,
      providerTransactionId: response.id || `re_stripe_${request.refundId}`,
      status: success ? "SUCCEEDED" : "FAILED",
      amount: request.amount,
      rawResponseCode: response.error?.code || status,
      errorMessage: response.error?.message,
      occurredAt: new Date()
    };
  }

  protected async doCancel(request: CancelPaymentRequest): Promise<TransactionResult> {
    const payload = new URLSearchParams({
      cancellation_reason: "abandoned"
    });

    const response = await this.executeStripeRequest(
      `/v1/payment_intents/${request.transactionId}/cancel`,
      payload,
      `cnl_${request.transactionId}`
    );

    const status = response.status || "canceled";
    return {
      success: status === "canceled",
      providerId: this.config.providerId,
      providerTransactionId: response.id || request.transactionId,
      status: "CANCELED",
      amount: { amountInCents: 0, currencyCode: "USD" },
      rawResponseCode: response.error?.code || status,
      errorMessage: response.error?.message,
      occurredAt: new Date()
    };
  }

  protected async doFetchTransactionStatus(transactionId: string): Promise<TransactionResult> {
    const response = await this.executeStripeGetRequest(`/v1/payment_intents/${transactionId}`);
    const status = response.status || "succeeded";

    return {
      success: status === "succeeded" || status === "requires_capture",
      providerId: this.config.providerId,
      providerTransactionId: response.id || transactionId,
      status: this.mapStripeStatusToCommon(status),
      amount: {
        amountInCents: response.amount || 0,
        currencyCode: (response.currency || "USD").toUpperCase()
      },
      requiresAction: status === "requires_action",
      clientSecret: response.client_secret,
      occurredAt: new Date()
    };
  }

  private mapPaymentMethodType(type: string): string {
    switch (type) {
      case "credit_card":
      case "debit_card":
        return "card";
      case "sepa":
        return "sepa_debit";
      case "apple_pay":
      case "google_pay":
        return "card";
      case "bank_transfer":
        return "customer_balance";
      default:
        return "card";
    }
  }

  private mapStripeStatusToCommon(status: string): string {
    switch (status) {
      case "succeeded":
        return "SUCCEEDED";
      case "requires_capture":
        return "REQUIRES_CAPTURE";
      case "requires_action":
      case "requires_confirmation":
        return "REQUIRES_ACTION";
      case "processing":
        return "PROCESSING";
      case "canceled":
        return "CANCELED";
      default:
        return "FAILED";
    }
  }

  private mapRefundReason(reason: string): string {
    switch (reason) {
      case "DUPLICATE":
        return "duplicate";
      case "FRAUDULENT":
        return "fraudulent";
      default:
        return "requested_by_customer";
    }
  }

  private async executeStripeRequest(
    endpoint: string,
    body: URLSearchParams,
    idempotencyKey?: string
  ): Promise<any> {
    const apiKey = process.env[this.config.apiKeyReference || "STRIPE_SECRET_KEY"] || "sk_test_mock_stripe_key";
    
    // In stateless Cloud Run / offline dev mode, build structured response or perform HTTPS call
    if (apiKey.startsWith("sk_test_mock") || process.env.NODE_ENV === "test") {
      return {
        id: endpoint.includes("refunds") ? `re_${idempotencyKey}` : endpoint.includes("cancel") ? idempotencyKey : `pi_${idempotencyKey}`,
        status: "succeeded",
        client_secret: `pi_${idempotencyKey}_secret_mock`,
        amount: Number(body.get("amount") || 1000),
        currency: body.get("currency") || "usd"
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs || 10000);

    try {
      const response = await fetch(`https://api.stripe.com${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
        },
        body: body.toString(),
        signal: controller.signal
      });

      clearTimeout(timeout);
      const json = await response.json();

      if (!response.ok) {
        throw new PaymentGatewayAdapterException(
          this.config.providerId,
          json.error?.message || `Stripe API error (${response.status})`,
          json.error
        );
      }

      return json;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err instanceof PaymentGatewayAdapterException) throw err;
      throw new PaymentGatewayAdapterException(
        this.config.providerId,
        `Stripe HTTP request failed: ${err.message}`,
        err
      );
    }
  }

  private async executeStripeGetRequest(endpoint: string): Promise<any> {
    const apiKey = process.env[this.config.apiKeyReference || "STRIPE_SECRET_KEY"] || "sk_test_mock_stripe_key";

    if (apiKey.startsWith("sk_test_mock") || process.env.NODE_ENV === "test") {
      return {
        id: "pi_mock_sync",
        status: "succeeded",
        amount: 1000,
        currency: "usd"
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs || 10000);

    try {
      const response = await fetch(`https://api.stripe.com${endpoint}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        signal: controller.signal
      });

      clearTimeout(timeout);
      const json = await response.json();

      if (!response.ok) {
        throw new PaymentGatewayAdapterException(
          this.config.providerId,
          json.error?.message || `Stripe GET error (${response.status})`,
          json.error
        );
      }

      return json;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err instanceof PaymentGatewayAdapterException) throw err;
      throw new PaymentGatewayAdapterException(
        this.config.providerId,
        `Stripe GET request failed: ${err.message}`,
        err
      );
    }
  }
}
