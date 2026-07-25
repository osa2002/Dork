import { CertificationSuiteResult, TestCaseResult } from "../types";
import { PaymentProviderRegistry } from "../../../billing/ppal/registry/PaymentProviderRegistry";
import { registerEnterprisePaymentProviders } from "../../../billing/providers";
import { SmartPaymentRouter } from "../../../billing/ppal/router/SmartPaymentRouter";
import { CircuitBreaker } from "../../../billing/ppal/circuit-breaker/CircuitBreaker";
import { AuthorizePaymentRequest } from "../../../billing/ppal/types/PPALCommonTypes";
import { PaymentProviderNotFoundException, ProviderCapabilityMismatchException } from "../../../billing/ppal/exceptions/PPALExceptions";

export class SmartRouterDecisionSuite {
  private readonly registry: PaymentProviderRegistry;

  constructor() {
    this.registry = new PaymentProviderRegistry();
    registerEnterprisePaymentProviders(this.registry);
  }

  public async runSuite(): Promise<CertificationSuiteResult> {
    const startTime = Date.now();
    const testResults: TestCaseResult[] = [];

    testResults.push(await this.testPreferredProviderRouting());
    testResults.push(await this.testCurrencyBasedRouting());
    testResults.push(await this.testPaymentMethodBasedRouting());
    testResults.push(await this.testCircuitBreakerFailoverRouting());
    testResults.push(await this.testUnsupportedCriteriaException());

    const passCount = testResults.filter(r => r.passed).length;
    const failCount = testResults.filter(r => !r.passed).length;

    return {
      suiteName: "Smart Payment Router Decisions Suite",
      passed: failCount === 0,
      totalTests: testResults.length,
      passCount,
      failCount,
      durationMs: Date.now() - startTime,
      testResults
    };
  }

  private async testPreferredProviderRouting(): Promise<TestCaseResult> {
    const start = Date.now();
    try {
      const router = new SmartPaymentRouter(this.registry);

      const request: AuthorizePaymentRequest = {
        tenantId: "tenant_router",
        billingAccountId: "ba_router",
        transactionId: "tx_route_pref",
        amount: { amountInCents: 5000, currencyCode: "USD" },
        paymentMethod: { type: "credit_card", token: "tok_visa" }
      };

      const selected = router.routeForRequest(request, "stripe");
      const passed = selected === "stripe";

      return {
        testId: "router-preferred-provider",
        name: "Validate router selects preferred provider when healthy and capable",
        category: "Smart Router",
        passed,
        durationMs: Date.now() - start,
        details: { selected }
      };
    } catch (err: any) {
      return {
        testId: "router-preferred-provider",
        name: "Validate router selects preferred provider when healthy and capable",
        category: "Smart Router",
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testCurrencyBasedRouting(): Promise<TestCaseResult> {
    const start = Date.now();
    try {
      const router = new SmartPaymentRouter(this.registry);

      const tryRequest: AuthorizePaymentRequest = {
        tenantId: "tenant_router",
        billingAccountId: "ba_router",
        transactionId: "tx_route_try",
        amount: { amountInCents: 15000, currencyCode: "TRY" },
        paymentMethod: { type: "credit_card", token: "tok_card" }
      };

      const selectedTry = router.routeForRequest(tryRequest);
      const isCapableForTry = this.registry.getAdapter(selectedTry).getCapabilities().supportsCurrency("TRY");

      return {
        testId: "router-currency-routing",
        name: "Validate currency-specific capability routing (TRY -> Iyzico/Adyen)",
        category: "Smart Router",
        passed: isCapableForTry,
        durationMs: Date.now() - start,
        details: { selectedTry }
      };
    } catch (err: any) {
      return {
        testId: "router-currency-routing",
        name: "Validate currency-specific capability routing (TRY -> Iyzico/Adyen)",
        category: "Smart Router",
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testPaymentMethodBasedRouting(): Promise<TestCaseResult> {
    const start = Date.now();
    try {
      const router = new SmartPaymentRouter(this.registry);

      const paypalReq: AuthorizePaymentRequest = {
        tenantId: "tenant_router",
        billingAccountId: "ba_router",
        transactionId: "tx_route_paypal",
        amount: { amountInCents: 2500, currencyCode: "USD" },
        paymentMethod: { type: "paypal", token: "tok_paypal" }
      };

      const selectedPaypal = router.routeForRequest(paypalReq);
      const isCapable = this.registry.getAdapter(selectedPaypal).getCapabilities().supportsPaymentMethodType("paypal");

      return {
        testId: "router-method-routing",
        name: "Validate payment method specific routing (paypal method -> PayPal/Adyen)",
        category: "Smart Router",
        passed: isCapable,
        durationMs: Date.now() - start,
        details: { selectedPaypal }
      };
    } catch (err: any) {
      return {
        testId: "router-method-routing",
        name: "Validate payment method specific routing (paypal method -> PayPal/Adyen)",
        category: "Smart Router",
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testCircuitBreakerFailoverRouting(): Promise<TestCaseResult> {
    const start = Date.now();
    try {
      const circuitBreakers = new Map<string, CircuitBreaker>();

      const stripeCb = new CircuitBreaker("stripe", { failureThreshold: 1 });
      stripeCb.recordFailure(new Error("Stripe simulated outage"));
      circuitBreakers.set("stripe", stripeCb);

      const router = new SmartPaymentRouter(this.registry, circuitBreakers as any);

      const request: AuthorizePaymentRequest = {
        tenantId: "tenant_router",
        billingAccountId: "ba_router",
        transactionId: "tx_route_cb_failover",
        amount: { amountInCents: 5000, currencyCode: "USD" },
        paymentMethod: { type: "credit_card", token: "tok_visa" }
      };

      const selected = router.routeForRequest(request, "stripe");
      const passed = selected !== "stripe" && selected.length > 0;

      return {
        testId: "router-circuit-breaker-failover",
        name: "Validate failover away from provider with OPEN circuit breaker",
        category: "Smart Router",
        passed,
        durationMs: Date.now() - start,
        details: { preferred: "stripe", selectedAlternative: selected }
      };
    } catch (err: any) {
      return {
        testId: "router-circuit-breaker-failover",
        name: "Validate failover away from provider with OPEN circuit breaker",
        category: "Smart Router",
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testUnsupportedCriteriaException(): Promise<TestCaseResult> {
    const start = Date.now();
    try {
      const router = new SmartPaymentRouter(this.registry);

      router.route({
        currency: "XYZ_UNSUPPORTED_CURRENCY",
        paymentMethodType: "unsupported_method" as any,
        amountInCents: 100
      });

      return {
        testId: "router-unsupported-exception",
        name: "Validate exception throwing for completely unsupported routing criteria",
        category: "Smart Router",
        passed: false,
        durationMs: Date.now() - start,
        error: "Expected PaymentProviderNotFoundException but route() succeeded"
      };
    } catch (err: any) {
      const isExpected = err instanceof PaymentProviderNotFoundException || err instanceof ProviderCapabilityMismatchException;
      return {
        testId: "router-unsupported-exception",
        name: "Validate exception throwing for completely unsupported routing criteria",
        category: "Smart Router",
        passed: isExpected,
        durationMs: Date.now() - start,
        details: { exceptionName: err.constructor.name, message: err.message }
      };
    }
  }
}
