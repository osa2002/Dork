import { CertificationSuiteResult, TestCaseResult } from "../types";
import { IPaymentGatewayAdapter } from "../../../billing/ppal/contracts/IPaymentGatewayAdapter";
import { StripePaymentGatewayAdapter } from "../../../billing/providers/stripe/StripePaymentGatewayAdapter";
import { PayPalPaymentGatewayAdapter } from "../../../billing/providers/paypal/PayPalPaymentGatewayAdapter";
import { AdyenPaymentGatewayAdapter } from "../../../billing/providers/adyen/AdyenPaymentGatewayAdapter";
import { CheckoutComPaymentGatewayAdapter } from "../../../billing/providers/checkout/CheckoutComPaymentGatewayAdapter";
import { IyzicoPaymentGatewayAdapter } from "../../../billing/providers/iyzico/IyzicoPaymentGatewayAdapter";
import { AuthorizePaymentRequest } from "../../../billing/ppal/types/PPALCommonTypes";

export class ProviderContractTestSuite {
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
      testResults.push(...(await this.testProviderContract(adapter)));
    }

    const passCount = testResults.filter(r => r.passed).length;
    const failCount = testResults.filter(r => !r.passed).length;

    return {
      suiteName: "Provider Contract & Capability Compliance Suite",
      passed: failCount === 0,
      totalTests: testResults.length,
      passCount,
      failCount,
      durationMs: Date.now() - startTime,
      testResults
    };
  }

  private async testProviderContract(adapter: IPaymentGatewayAdapter): Promise<TestCaseResult[]> {
    const results: TestCaseResult[] = [];
    const providerId = adapter.config.providerId;

    // Test 1: Capability Matrix Compliance
    const capStart = Date.now();
    try {
      const caps = adapter.getCapabilities();
      const hasBasicCaps =
        typeof caps.supports3DSecure === "boolean" &&
        typeof caps.supportsRecurring === "boolean" &&
        typeof caps.supportsPartialRefunds === "boolean" &&
        Array.isArray(caps.supportedCurrencies) &&
        caps.supportedCurrencies.length > 0 &&
        Array.isArray(caps.supportedPaymentMethodTypes) &&
        caps.supportedPaymentMethodTypes.length > 0;

      results.push({
        testId: `${providerId}-contract-capabilities`,
        name: `Validate capabilities schema compliance for ${providerId}`,
        category: "Contracts",
        providerId,
        passed: hasBasicCaps,
        durationMs: Date.now() - capStart,
        details: { currenciesCount: caps.supportedCurrencies.length }
      });
    } catch (err: any) {
      results.push({
        testId: `${providerId}-contract-capabilities`,
        name: `Validate capabilities schema compliance for ${providerId}`,
        category: "Contracts",
        providerId,
        passed: false,
        durationMs: Date.now() - capStart,
        error: err.message
      });
    }

    // Test 2: Standard Authorization Contract Test
    const authStart = Date.now();
    try {
      const authRequest: AuthorizePaymentRequest = {
        tenantId: "tenant_cert_101",
        billingAccountId: "ba_cert_101",
        transactionId: `tx_cert_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        amount: { amountInCents: 2500, currencyCode: "USD" },
        paymentMethod: {
          type: "credit_card",
          token: "tok_visa_4242",
          brand: "Visa",
          expiryMonth: 12,
          expiryYear: 2028
        }
      };

      const result = await adapter.authorize(authRequest);
      const isValidResult =
        typeof result.success === "boolean" &&
        result.providerId === providerId &&
        typeof result.providerTransactionId === "string" &&
        typeof result.status === "string";

      results.push({
        testId: `${providerId}-contract-authorize`,
        name: `Validate authorize response contract for ${providerId}`,
        category: "Contracts",
        providerId,
        passed: isValidResult,
        durationMs: Date.now() - authStart,
        details: { status: result.status, providerTransactionId: result.providerTransactionId }
      });
    } catch (err: any) {
      results.push({
        testId: `${providerId}-contract-authorize`,
        name: `Validate authorize response contract for ${providerId}`,
        category: "Contracts",
        providerId,
        passed: false,
        durationMs: Date.now() - authStart,
        error: err.message
      });
    }

    // Test 3: Standard Transaction Status Lookup Contract Test
    const statusStart = Date.now();
    try {
      const statusResult = await adapter.fetchTransactionStatus("tx_test_status_lookup");
      const isValidStatus =
        typeof statusResult.success === "boolean" &&
        statusResult.providerId === providerId &&
        typeof statusResult.status === "string";

      results.push({
        testId: `${providerId}-contract-status-lookup`,
        name: `Validate fetchTransactionStatus contract for ${providerId}`,
        category: "Contracts",
        providerId,
        passed: isValidStatus,
        durationMs: Date.now() - statusStart,
        details: { status: statusResult.status }
      });
    } catch (err: any) {
      results.push({
        testId: `${providerId}-contract-status-lookup`,
        name: `Validate fetchTransactionStatus contract for ${providerId}`,
        category: "Contracts",
        providerId,
        passed: false,
        durationMs: Date.now() - statusStart,
        error: err.message
      });
    }

    return results;
  }
}
