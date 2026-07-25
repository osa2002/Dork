import crypto from "crypto";
import { CertificationSuiteResult, TestCaseResult } from "../types";
import { WebhookNormalizerRegistry } from "../../../billing/ppal/webhooks/WebhookNormalizerRegistry";
import { StripeWebhookNormalizer } from "../../../billing/providers/stripe/StripeWebhookNormalizer";
import { PayPalWebhookNormalizer } from "../../../billing/providers/paypal/PayPalWebhookNormalizer";
import { AdyenWebhookNormalizer } from "../../../billing/providers/adyen/AdyenWebhookNormalizer";
import { CheckoutComWebhookNormalizer } from "../../../billing/providers/checkout/CheckoutComWebhookNormalizer";
import { IyzicoWebhookNormalizer } from "../../../billing/providers/iyzico/IyzicoWebhookNormalizer";
import { WebhookVerificationFailedException } from "../../../billing/ppal/exceptions/PPALExceptions";

export class WebhookVerificationSuite {
  private readonly registry: WebhookNormalizerRegistry;

  constructor() {
    this.registry = new WebhookNormalizerRegistry();
    this.registry.register(new StripeWebhookNormalizer());
    this.registry.register(new PayPalWebhookNormalizer());
    this.registry.register(new AdyenWebhookNormalizer());
    this.registry.register(new CheckoutComWebhookNormalizer());
    this.registry.register(new IyzicoWebhookNormalizer());
  }

  public async runSuite(): Promise<CertificationSuiteResult> {
    const startTime = Date.now();
    const testResults: TestCaseResult[] = [];

    testResults.push(await this.testStripeWebhookVerification());
    testResults.push(await this.testPayPalWebhookVerification());
    testResults.push(await this.testAdyenWebhookVerification());
    testResults.push(await this.testCheckoutComWebhookVerification());
    testResults.push(await this.testIyzicoWebhookVerification());
    testResults.push(await this.testInvalidSignatureRejection());

    const passCount = testResults.filter(r => r.passed).length;
    const failCount = testResults.filter(r => !r.passed).length;

    return {
      suiteName: "Webhook Verification & Normalization Suite",
      passed: failCount === 0,
      totalTests: testResults.length,
      passCount,
      failCount,
      durationMs: Date.now() - startTime,
      testResults
    };
  }

  private async testStripeWebhookVerification(): Promise<TestCaseResult> {
    const start = Date.now();
    const secret = "whsec_test_stripe_secret_key";
    const bodyObj = {
      id: "evt_stripe_1001",
      type: "payment_intent.succeeded",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: "pi_stripe_1001",
          amount: 5000,
          currency: "usd",
          customer: "cus_stripe_123"
        }
      }
    };

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyStr = JSON.stringify(bodyObj);
    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${bodyStr}`, "utf8")
      .digest("hex");

    const rawPayload = {
      headers: {
        "stripe-signature": `t=${timestamp},v1=${signature}`
      },
      body: bodyStr
    };

    try {
      const normalized = this.registry.processWebhook("stripe", rawPayload, secret);
      const passed =
        normalized.eventId === "evt_stripe_1001" &&
        normalized.providerId === "stripe" &&
        normalized.eventType === "PAYMENT_SUCCEEDED" &&
        normalized.amount.amountInCents === 5000 &&
        normalized.providerTransactionId === "pi_stripe_1001";

      return {
        testId: "webhook-verify-stripe",
        name: "Validate Stripe HMAC SHA-256 signature verification & normalization",
        category: "Webhooks",
        providerId: "stripe",
        passed,
        durationMs: Date.now() - start,
        details: { eventType: normalized.eventType, amount: normalized.amount.amountInCents }
      };
    } catch (err: any) {
      return {
        testId: "webhook-verify-stripe",
        name: "Validate Stripe HMAC SHA-256 signature verification & normalization",
        category: "Webhooks",
        providerId: "stripe",
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testPayPalWebhookVerification(): Promise<TestCaseResult> {
    const start = Date.now();
    const secret = "paypal_webhook_secret_key";
    const bodyObj = {
      id: "evt_paypal_2002",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      create_time: new Date().toISOString(),
      resource: {
        id: "cap_paypal_2002",
        amount: { value: "75.00", currency_code: "USD" }
      }
    };

    const rawPayload = {
      headers: {
        "paypal-transmission-id": "trans_12345",
        "paypal-transmission-time": new Date().toISOString(),
        "paypal-transmission-sig": "mock_valid_signature_base64"
      },
      body: bodyObj
    };

    try {
      const normalized = this.registry.processWebhook("paypal", rawPayload, secret);
      const passed =
        normalized.eventId === "evt_paypal_2002" &&
        normalized.eventType === "PAYMENT_SUCCEEDED" &&
        normalized.amount.amountInCents === 7500;

      return {
        testId: "webhook-verify-paypal",
        name: "Validate PayPal webhook signature verification & normalization",
        category: "Webhooks",
        providerId: "paypal",
        passed,
        durationMs: Date.now() - start
      };
    } catch (err: any) {
      return {
        testId: "webhook-verify-paypal",
        name: "Validate PayPal webhook signature verification & normalization",
        category: "Webhooks",
        providerId: "paypal",
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testAdyenWebhookVerification(): Promise<TestCaseResult> {
    const start = Date.now();
    const secretHex = "44556677889900aabbccddeeff0011223344556677889900aabbccddeeff0011";
    const bodyObj = {
      notificationItems: [
        {
          NotificationRequestItem: {
            pspReference: "psp_adyen_3003",
            eventCode: "AUTHORISATION",
            eventDate: new Date().toISOString(),
            merchantAccountCode: "DorkEnterpriseCOM",
            merchantReference: "ref_1003",
            amount: { value: 12000, currency: "EUR" },
            success: "true"
          }
        }
      ]
    };

    const rawPayload = {
      headers: {},
      body: bodyObj
    };

    try {
      const normalized = this.registry.processWebhook("adyen", rawPayload, secretHex);
      const passed =
        normalized.providerTransactionId === "psp_adyen_3003" &&
        normalized.eventType === "PAYMENT_SUCCEEDED" &&
        normalized.amount.amountInCents === 12000;

      return {
        testId: "webhook-verify-adyen",
        name: "Validate Adyen notification signature verification & normalization",
        category: "Webhooks",
        providerId: "adyen",
        passed,
        durationMs: Date.now() - start
      };
    } catch (err: any) {
      return {
        testId: "webhook-verify-adyen",
        name: "Validate Adyen notification signature verification & normalization",
        category: "Webhooks",
        providerId: "adyen",
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testCheckoutComWebhookVerification(): Promise<TestCaseResult> {
    const start = Date.now();
    const secret = "cko_secret_webhook_key";
    const bodyObj = {
      id: "evt_cko_4004",
      type: "payment_approved",
      created_on: new Date().toISOString(),
      data: {
        id: "pay_cko_4004",
        amount: 8500,
        currency: "USD"
      }
    };

    const bodyStr = JSON.stringify(bodyObj);
    const signature = crypto
      .createHmac("sha256", secret)
      .update(bodyStr, "utf8")
      .digest("hex");

    const rawPayload = {
      headers: {
        "cko-signature": signature
      },
      body: bodyStr
    };

    try {
      const normalized = this.registry.processWebhook("checkout_com", rawPayload, secret);
      const passed =
        normalized.eventId === "evt_cko_4004" &&
        normalized.eventType === "PAYMENT_SUCCEEDED" &&
        normalized.amount.amountInCents === 8500;

      return {
        testId: "webhook-verify-checkout-com",
        name: "Validate Checkout.com HMAC signature verification & normalization",
        category: "Webhooks",
        providerId: "checkout_com",
        passed,
        durationMs: Date.now() - start
      };
    } catch (err: any) {
      return {
        testId: "webhook-verify-checkout-com",
        name: "Validate Checkout.com HMAC signature verification & normalization",
        category: "Webhooks",
        providerId: "checkout_com",
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testIyzicoWebhookVerification(): Promise<TestCaseResult> {
    const start = Date.now();
    const secret = "iyzico_secret_key";
    const bodyObj = {
      iyziEventId: "evt_iyz_5005",
      iyziEventType: "PAYMENT_SUCCESS",
      paymentId: "iyz_5005",
      price: "250.00",
      currency: "TRY"
    };

    const bodyStr = JSON.stringify(bodyObj);
    const signature = crypto
      .createHmac("sha256", secret)
      .update(bodyStr, "utf8")
      .digest("base64");

    const rawPayload = {
      headers: {
        "x-iyzi-signature": signature
      },
      body: bodyStr
    };

    try {
      const normalized = this.registry.processWebhook("iyzico", rawPayload, secret);
      const passed =
        normalized.eventId === "evt_iyz_5005" &&
        normalized.eventType === "PAYMENT_SUCCEEDED" &&
        normalized.amount.amountInCents === 25000;

      return {
        testId: "webhook-verify-iyzico",
        name: "Validate Iyzico HMAC signature verification & normalization",
        category: "Webhooks",
        providerId: "iyzico",
        passed,
        durationMs: Date.now() - start
      };
    } catch (err: any) {
      return {
        testId: "webhook-verify-iyzico",
        name: "Validate Iyzico HMAC signature verification & normalization",
        category: "Webhooks",
        providerId: "iyzico",
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testInvalidSignatureRejection(): Promise<TestCaseResult> {
    const start = Date.now();
    const rawPayload = {
      headers: {
        "stripe-signature": "t=1000,v1=INVALID_SIGNATURE_BAD_HASH"
      },
      body: JSON.stringify({ id: "evt_fake", type: "payment_intent.succeeded" })
    };

    try {
      this.registry.processWebhook("stripe", rawPayload, "whsec_real_secret");
      return {
        testId: "webhook-invalid-signature-rejection",
        name: "Validate rejection of forged/invalid webhook signatures",
        category: "Webhooks",
        passed: false,
        durationMs: Date.now() - start,
        error: "Expected WebhookVerificationFailedException but processWebhook succeeded"
      };
    } catch (err: any) {
      const isExpected = err instanceof WebhookVerificationFailedException;
      return {
        testId: "webhook-invalid-signature-rejection",
        name: "Validate rejection of forged/invalid webhook signatures",
        category: "Webhooks",
        passed: isExpected,
        durationMs: Date.now() - start
      };
    }
  }
}
