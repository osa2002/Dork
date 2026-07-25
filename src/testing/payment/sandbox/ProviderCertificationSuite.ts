import { CertificationSuiteResult, TestCaseResult } from "../types";
import { IPaymentGatewayAdapter } from "../../../billing/ppal/contracts/IPaymentGatewayAdapter";
import { StripePaymentGatewayAdapter } from "../../../billing/providers/stripe/StripePaymentGatewayAdapter";
import { PayPalPaymentGatewayAdapter } from "../../../billing/providers/paypal/PayPalPaymentGatewayAdapter";
import { AdyenPaymentGatewayAdapter } from "../../../billing/providers/adyen/AdyenPaymentGatewayAdapter";
import { CheckoutComPaymentGatewayAdapter } from "../../../billing/providers/checkout/CheckoutComPaymentGatewayAdapter";
import { IyzicoPaymentGatewayAdapter } from "../../../billing/providers/iyzico/IyzicoPaymentGatewayAdapter";
import {
  AuthorizePaymentRequest,
  CapturePaymentRequest,
  RefundPaymentRequest
} from "../../../billing/ppal/types/PPALCommonTypes";

export class ProviderCertificationSuite {
  private readonly adapters: IPaymentGatewayAdapter[];

  constructor() {
    this.adapters = [
      new StripePaymentGatewayAdapter(),
      new PayPalPaymentGatewayAdapter(),
      new AdyenPaymentGatewayAdapter(),
      new CheckoutComPaymentGatewayAdapter(),
      new IyzicoPaymentGatewayAdapter()
    ];
  }

  public async runSuite(): Promise<CertificationSuiteResult> {
    const startTime = Date.now();
    const testResults: TestCaseResult[] = [];

    for (const adapter of this.adapters) {
      testResults.push(...(await this.certifyProvider(adapter)));
    }

    const passCount = testResults.filter(r => r.passed).length;
    const failCount = testResults.filter(r => !r.passed).length;

    return {
      suiteName: "Provider Sandbox Certification Suite",
      passed: failCount === 0,
      totalTests: testResults.length,
      passCount,
      failCount,
      durationMs: Date.now() - startTime,
      testResults
    };
  }

  private async certifyProvider(adapter: IPaymentGatewayAdapter): Promise<TestCaseResult[]> {
    const results: TestCaseResult[] = [];

    // 1. Visa Card Authorization
    results.push(await this.testPaymentMethod(adapter, "Visa", "credit_card", "tok_visa_4242"));

    // 2. Mastercard Authorization
    results.push(await this.testPaymentMethod(adapter, "Mastercard", "debit_card", "tok_mastercard_5555"));

    // 3. Apple Pay Authorization
    results.push(await this.testPaymentMethod(adapter, "Apple Pay", "apple_pay", "tok_applepay_token"));

    // 4. Google Pay Authorization
    results.push(await this.testPaymentMethod(adapter, "Google Pay", "google_pay", "tok_gpay_token"));

    // 5. 3D Secure Authorization
    results.push(await this.test3DSecure(adapter));

    // 6. Partial Capture Flow
    results.push(await this.testPartialCapture(adapter));

    // 7. Full Refund Flow
    results.push(await this.testFullRefund(adapter));

    // 8. Partial Refund Flow
    results.push(await this.testPartialRefund(adapter));

    // 9. Recurring Billing / Subscription Setup
    results.push(await this.testRecurringBilling(adapter));

    // 10. Idempotency Execution
    results.push(await this.testIdempotency(adapter));

    return results;
  }

  private async testPaymentMethod(
    adapter: IPaymentGatewayAdapter,
    methodName: string,
    type: any,
    token: string
  ): Promise<TestCaseResult> {
    const start = Date.now();
    const providerId = adapter.config.providerId;
    const txId = `tx_${type}_${Date.now()}`;

    try {
      const caps = adapter.getCapabilities();
      const isTypeSupported = caps.supportsPaymentMethodType(type);

      const request: AuthorizePaymentRequest = {
        tenantId: "tenant_cert_pm",
        billingAccountId: "ba_cert_pm",
        transactionId: txId,
        amount: { amountInCents: 10000, currencyCode: providerId === "iyzico" ? "TRY" : "USD" },
        paymentMethod: {
          type,
          token,
          brand: methodName
        },
        captureImmediately: true
      };

      const result = await adapter.authorize(request);
      const passed = result.success && result.providerId === providerId;

      return {
        testId: `${providerId}-method-${type}`,
        name: `Validate ${methodName} payment method for ${providerId}`,
        category: "Payment Methods",
        providerId,
        passed: isTypeSupported ? passed : true,
        durationMs: Date.now() - start,
        details: { status: result.status, providerTxId: result.providerTransactionId }
      };
    } catch (err: any) {
      return {
        testId: `${providerId}-method-${type}`,
        name: `Validate ${methodName} payment method for ${providerId}`,
        category: "Payment Methods",
        providerId,
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async test3DSecure(adapter: IPaymentGatewayAdapter): Promise<TestCaseResult> {
    const start = Date.now();
    const providerId = adapter.config.providerId;
    const txId = `tx_3ds_${Date.now()}`;

    try {
      const request: AuthorizePaymentRequest = {
        tenantId: "tenant_cert_3ds",
        billingAccountId: "ba_cert_3ds",
        transactionId: txId,
        amount: { amountInCents: 15000, currencyCode: providerId === "iyzico" ? "TRY" : "EUR" },
        paymentMethod: {
          type: "credit_card",
          token: "tok_3ds_challenge"
        },
        captureImmediately: false
      };

      const result = await adapter.authorize(request);
      const passed = result.success || result.requiresAction || result.status === "REQUIRES_ACTION" || result.status === "SUCCEEDED";

      return {
        testId: `${providerId}-3ds-secure`,
        name: `Validate 3D Secure authentication flow for ${providerId}`,
        category: "3D Secure",
        providerId,
        passed,
        durationMs: Date.now() - start,
        details: { requiresAction: result.requiresAction, status: result.status, clientSecret: result.clientSecret ? "[PRESENT]" : undefined }
      };
    } catch (err: any) {
      return {
        testId: `${providerId}-3ds-secure`,
        name: `Validate 3D Secure authentication flow for ${providerId}`,
        category: "3D Secure",
        providerId,
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testPartialCapture(adapter: IPaymentGatewayAdapter): Promise<TestCaseResult> {
    const start = Date.now();
    const providerId = adapter.config.providerId;
    const txId = `tx_auth_cap_${Date.now()}`;

    try {
      const authReq: AuthorizePaymentRequest = {
        tenantId: "tenant_part_cap",
        billingAccountId: "ba_part_cap",
        transactionId: txId,
        amount: { amountInCents: 20000, currencyCode: providerId === "iyzico" ? "TRY" : "USD" },
        paymentMethod: { type: "credit_card", token: "tok_visa_manual" },
        captureImmediately: false
      };

      const authRes = await adapter.authorize(authReq);

      const capReq: CapturePaymentRequest = {
        tenantId: "tenant_part_cap",
        transactionId: txId,
        authorizationId: authRes.providerTransactionId,
        amount: { amountInCents: 12000, currencyCode: providerId === "iyzico" ? "TRY" : "USD" }
      };

      const capRes = await adapter.capture(capReq);
      const passed = capRes.success && capRes.amount.amountInCents === 12000;

      return {
        testId: `${providerId}-partial-capture`,
        name: `Validate Partial Capture flow for ${providerId}`,
        category: "Capture",
        providerId,
        passed,
        durationMs: Date.now() - start,
        details: { authStatus: authRes.status, capStatus: capRes.status }
      };
    } catch (err: any) {
      return {
        testId: `${providerId}-partial-capture`,
        name: `Validate Partial Capture flow for ${providerId}`,
        category: "Capture",
        providerId,
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testFullRefund(adapter: IPaymentGatewayAdapter): Promise<TestCaseResult> {
    const start = Date.now();
    const providerId = adapter.config.providerId;
    const refId = `ref_full_${Date.now()}`;

    try {
      const refReq: RefundPaymentRequest = {
        tenantId: "tenant_refund",
        refundId: refId,
        originalTransactionId: `tx_orig_${Date.now()}`,
        amount: { amountInCents: 10000, currencyCode: providerId === "iyzico" ? "TRY" : "USD" },
        reason: "REQUESTED_BY_CUSTOMER"
      };

      const refRes = await adapter.refund(refReq);
      const passed = refRes.success && (refRes.status === "SUCCEEDED" || refRes.status === "PROCESSING");

      return {
        testId: `${providerId}-full-refund`,
        name: `Validate Full Refund execution for ${providerId}`,
        category: "Refund",
        providerId,
        passed,
        durationMs: Date.now() - start,
        details: { refundStatus: refRes.status, providerTransactionId: refRes.providerTransactionId }
      };
    } catch (err: any) {
      return {
        testId: `${providerId}-full-refund`,
        name: `Validate Full Refund execution for ${providerId}`,
        category: "Refund",
        providerId,
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testPartialRefund(adapter: IPaymentGatewayAdapter): Promise<TestCaseResult> {
    const start = Date.now();
    const providerId = adapter.config.providerId;
    const refId = `ref_part_${Date.now()}`;

    try {
      const refReq: RefundPaymentRequest = {
        tenantId: "tenant_refund",
        refundId: refId,
        originalTransactionId: `tx_orig_${Date.now()}`,
        amount: { amountInCents: 3500, currencyCode: providerId === "iyzico" ? "TRY" : "USD" },
        reason: "DUPLICATE"
      };

      const refRes = await adapter.refund(refReq);
      const passed = refRes.success && refRes.amount.amountInCents === 3500;

      return {
        testId: `${providerId}-partial-refund`,
        name: `Validate Partial Refund execution for ${providerId}`,
        category: "Refund",
        providerId,
        passed,
        durationMs: Date.now() - start,
        details: { refundStatus: refRes.status }
      };
    } catch (err: any) {
      return {
        testId: `${providerId}-partial-refund`,
        name: `Validate Partial Refund execution for ${providerId}`,
        category: "Refund",
        providerId,
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testRecurringBilling(adapter: IPaymentGatewayAdapter): Promise<TestCaseResult> {
    const start = Date.now();
    const providerId = adapter.config.providerId;

    try {
      const caps = adapter.getCapabilities();
      if (!caps.supportsRecurring) {
        return {
          testId: `${providerId}-recurring-billing`,
          name: `Validate Recurring Billing for ${providerId}`,
          category: "Subscriptions",
          providerId,
          passed: true,
          durationMs: Date.now() - start,
          details: { skipped: "Provider does not support recurring billing" }
        };
      }

      const request: AuthorizePaymentRequest = {
        tenantId: "tenant_recurring",
        billingAccountId: "ba_recurring",
        transactionId: `tx_rec_${Date.now()}`,
        amount: { amountInCents: 2999, currencyCode: providerId === "iyzico" ? "TRY" : "USD" },
        paymentMethod: {
          type: "credit_card",
          token: "tok_recurring_pm",
          providerPaymentMethodId: "pm_stored_recurring"
        },
        metadata: { isRecurring: "true", frequency: "MONTHLY" }
      };

      const result = await adapter.authorize(request);
      const passed = result.success;

      return {
        testId: `${providerId}-recurring-billing`,
        name: `Validate Recurring Billing for ${providerId}`,
        category: "Subscriptions",
        providerId,
        passed,
        durationMs: Date.now() - start,
        details: { status: result.status }
      };
    } catch (err: any) {
      return {
        testId: `${providerId}-recurring-billing`,
        name: `Validate Recurring Billing for ${providerId}`,
        category: "Subscriptions",
        providerId,
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testIdempotency(adapter: IPaymentGatewayAdapter): Promise<TestCaseResult> {
    const start = Date.now();
    const providerId = adapter.config.providerId;
    const sameTxId = `tx_idempotent_fixed_${Date.now()}`;

    try {
      const req: AuthorizePaymentRequest = {
        tenantId: "tenant_idempotency",
        billingAccountId: "ba_idempotency",
        transactionId: sameTxId,
        amount: { amountInCents: 5000, currencyCode: providerId === "iyzico" ? "TRY" : "USD" },
        paymentMethod: { type: "credit_card", token: "tok_visa_4242" }
      };

      const res1 = await adapter.authorize(req);
      const res2 = await adapter.authorize(req);

      const isIdempotent = res1.success === res2.success && res1.providerTransactionId === res2.providerTransactionId;

      return {
        testId: `${providerId}-idempotency`,
        name: `Validate Idempotent execution consistency for ${providerId}`,
        category: "Resilience",
        providerId,
        passed: isIdempotent,
        durationMs: Date.now() - start,
        details: { tx1: res1.providerTransactionId, tx2: res2.providerTransactionId }
      };
    } catch (err: any) {
      return {
        testId: `${providerId}-idempotency`,
        name: `Validate Idempotent execution consistency for ${providerId}`,
        category: "Resilience",
        providerId,
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }
}
