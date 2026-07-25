export * from "./types";
export * from "./contracts";
export * from "./sandbox";
export * from "./integration";
export * from "./webhooks";
export * from "./chaos";
export * from "./performance";

import { MasterCertificationReport, CertificationSuiteResult } from "./types";
import { ProviderContractTestSuite } from "./contracts/ProviderContractTestSuite";
import { CurrencyValidationSuite } from "./contracts/CurrencyValidationSuite";
import { ProviderCertificationSuite } from "./sandbox/ProviderCertificationSuite";
import { MultiTenantIsolationSuite } from "./integration/MultiTenantIsolationSuite";
import { SmartRouterDecisionSuite } from "./integration/SmartRouterDecisionSuite";
import { WebhookVerificationSuite } from "./webhooks/WebhookVerificationSuite";
import { WebhookDuplicateAndReplaySuite } from "./webhooks/WebhookDuplicateAndReplaySuite";
import { CircuitBreakerSuite } from "./chaos/CircuitBreakerSuite";
import { RetryAndTimeoutSuite } from "./chaos/RetryAndTimeoutSuite";
import { PerformanceAndConcurrencySuite } from "./performance/PerformanceAndConcurrencySuite";

export class EnterprisePaymentCertificationRunner {
  public async executeFullCertification(): Promise<MasterCertificationReport> {
    const startTime = Date.now();
    const suiteResults: CertificationSuiteResult[] = [];

    // 1. Contracts & Capabilities
    const contractSuite = new ProviderContractTestSuite();
    suiteResults.push(await contractSuite.runSuite());

    // 2. Multi-Currency Validation
    const currencySuite = new CurrencyValidationSuite();
    suiteResults.push(await currencySuite.runSuite());

    // 3. Provider Sandbox Scenarios
    const sandboxSuite = new ProviderCertificationSuite();
    suiteResults.push(await sandboxSuite.runSuite());

    // 4. Multi-Tenant Isolation
    const isolationSuite = new MultiTenantIsolationSuite();
    suiteResults.push(await isolationSuite.runSuite());

    // 5. Smart Router Decisions
    const routerSuite = new SmartPaymentRouterDecisionSuiteWrapper();
    suiteResults.push(await routerSuite.runSuite());

    // 6. Webhook Verification & Normalization
    const webhookVerifySuite = new WebhookVerificationSuite();
    suiteResults.push(await webhookVerifySuite.runSuite());

    // 7. Webhook Duplicate & Replay Defense
    const webhookReplaySuite = new WebhookDuplicateAndReplaySuite();
    suiteResults.push(await webhookReplaySuite.runSuite());

    // 8. Circuit Breaker Chaos
    const cbSuite = new CircuitBreakerSuite();
    suiteResults.push(await cbSuite.runSuite());

    // 9. Retry Strategy & Timeout
    const retrySuite = new RetryAndTimeoutSuite();
    suiteResults.push(await retrySuite.runSuite());

    // 10. Performance & Concurrency
    const perfSuite = new PerformanceAndConcurrencySuite();
    suiteResults.push(await perfSuite.runSuite());

    const totalDurationMs = Date.now() - startTime;
    const passedSuites = suiteResults.filter(s => s.passed).length;
    const failedSuites = suiteResults.filter(s => !s.passed).length;
    const overallPassed = failedSuites === 0;

    return {
      timestamp: new Date().toISOString(),
      overallPassed,
      totalSuites: suiteResults.length,
      passedSuites,
      failedSuites,
      totalDurationMs,
      providersCertified: ["stripe", "paypal", "adyen", "checkout_com", "iyzico"],
      capabilitiesValidated: [
        "Visa",
        "Mastercard",
        "Apple Pay",
        "Google Pay",
        "3D Secure",
        "Partial Capture",
        "Partial Refund",
        "Full Refund",
        "Recurring Billing",
        "Webhook Verification",
        "Duplicate Webhooks",
        "Replay Attacks",
        "Idempotency",
        "Circuit Breaker",
        "Retry Strategy",
        "Timeout Handling",
        "Multi-Tenant Isolation",
        "Currency Validation",
        "Smart Router Decisions"
      ],
      suiteResults
    };
  }
}

class SmartPaymentRouterDecisionSuiteWrapper {
  public async runSuite(): Promise<CertificationSuiteResult> {
    const { SmartRouterDecisionSuite } = await import("./integration/SmartRouterDecisionSuite");
    const suite = new SmartRouterDecisionSuite();
    return suite.runSuite();
  }
}
