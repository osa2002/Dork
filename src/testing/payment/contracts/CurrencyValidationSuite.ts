import { CertificationSuiteResult, TestCaseResult } from "../types";
import { StripePaymentGatewayAdapter } from "../../../billing/providers/stripe/StripePaymentGatewayAdapter";
import { PayPalPaymentGatewayAdapter } from "../../../billing/providers/paypal/PayPalPaymentGatewayAdapter";
import { AdyenPaymentGatewayAdapter } from "../../../billing/providers/adyen/AdyenPaymentGatewayAdapter";
import { CheckoutComPaymentGatewayAdapter } from "../../../billing/providers/checkout/CheckoutComPaymentGatewayAdapter";
import { IyzicoPaymentGatewayAdapter } from "../../../billing/providers/iyzico/IyzicoPaymentGatewayAdapter";
import { IPaymentGatewayAdapter } from "../../../billing/ppal/contracts/IPaymentGatewayAdapter";

export class CurrencyValidationSuite {
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

    const testCurrencies = ["USD", "EUR", "GBP", "TRY", "JPY", "CAD", "AUD", "AED", "CHF", "BRL"];

    for (const adapter of this.adapters) {
      const providerId = adapter.config.providerId;
      const caps = adapter.getCapabilities();

      for (const curr of testCurrencies) {
        const testStart = Date.now();
        const isSupportedByCaps = caps.supportsCurrency(curr);

        try {
          const authResult = await adapter.authorize({
            tenantId: "tenant_curr_val",
            billingAccountId: "ba_curr_val",
            transactionId: `tx_curr_${curr}_${Date.now()}`,
            amount: { amountInCents: 5000, currencyCode: curr },
            paymentMethod: { type: "credit_card", token: "tok_visa_4242" }
          });

          const currencyMatches = authResult.amount.currencyCode === curr.toUpperCase();

          testResults.push({
            testId: `${providerId}-currency-${curr}`,
            name: `Validate currency processing for ${providerId} [${curr}]`,
            category: "Currency Validation",
            providerId,
            passed: isSupportedByCaps && currencyMatches,
            durationMs: Date.now() - testStart,
            details: {
              supportedByCaps: isSupportedByCaps,
              returnedCurrency: authResult.amount.currencyCode
            }
          });
        } catch (err: any) {
          testResults.push({
            testId: `${providerId}-currency-${curr}`,
            name: `Validate currency processing for ${providerId} [${curr}]`,
            category: "Currency Validation",
            providerId,
            passed: !isSupportedByCaps,
            durationMs: Date.now() - testStart,
            details: {
              supportedByCaps: isSupportedByCaps,
              error: err.message
            }
          });
        }
      }
    }

    const passCount = testResults.filter(r => r.passed).length;
    const failCount = testResults.filter(r => !r.passed).length;

    return {
      suiteName: "Multi-Currency Validation Suite",
      passed: failCount === 0,
      totalTests: testResults.length,
      passCount,
      failCount,
      durationMs: Date.now() - startTime,
      testResults
    };
  }
}
