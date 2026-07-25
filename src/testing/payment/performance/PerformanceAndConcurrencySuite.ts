import { CertificationSuiteResult, TestCaseResult } from "../types";
import { PaymentProviderRegistry } from "../../../billing/ppal/registry/PaymentProviderRegistry";
import { registerEnterprisePaymentProviders } from "../../../billing/providers";
import { PPALOrchestratorService } from "../../../billing/ppal/services/PPALOrchestratorService";
import { SmartPaymentRouter } from "../../../billing/ppal/router/SmartPaymentRouter";
import { RetryStrategy } from "../../../billing/ppal/retry/RetryStrategy";
import { AuthorizePaymentRequest } from "../../../billing/ppal/types/PPALCommonTypes";

export class PerformanceAndConcurrencySuite {
  private readonly orchestrator: PPALOrchestratorService;
  private readonly registry: PaymentProviderRegistry;

  constructor() {
    this.registry = new PaymentProviderRegistry();
    registerEnterprisePaymentProviders(this.registry);
    const router = new SmartPaymentRouter(this.registry);
    const retry = new RetryStrategy({ maxAttempts: 2, initialDelayMs: 5 });
    this.orchestrator = new PPALOrchestratorService(this.registry, router, retry);
  }

  public async runSuite(): Promise<CertificationSuiteResult> {
    const startTime = Date.now();
    const testResults: TestCaseResult[] = [];

    testResults.push(await this.testHighConcurrencyThroughput());
    testResults.push(await this.testLatencyDistributionP99());
    testResults.push(await this.testMultiProviderParallelExecution());

    const passCount = testResults.filter(r => r.passed).length;
    const failCount = testResults.filter(r => !r.passed).length;

    return {
      suiteName: "High-Performance Concurrency & Throughput Suite",
      passed: failCount === 0,
      totalTests: testResults.length,
      passCount,
      failCount,
      durationMs: Date.now() - startTime,
      testResults
    };
  }

  private async testHighConcurrencyThroughput(): Promise<TestCaseResult> {
    const start = Date.now();
    const totalRequests = 50;
    const requests: AuthorizePaymentRequest[] = [];

    for (let i = 0; i < totalRequests; i++) {
      requests.push({
        tenantId: `tenant_perf_${i % 5}`,
        billingAccountId: `ba_perf_${i % 5}`,
        transactionId: `tx_perf_bench_${i}_${Date.now()}`,
        amount: { amountInCents: 1000 + i * 10, currencyCode: "USD" },
        paymentMethod: { type: "credit_card", token: "tok_visa" }
      });
    }

    try {
      const promises = requests.map(req => this.orchestrator.processAuthorization(req, "stripe"));
      const results = await Promise.all(promises);

      const elapsedMs = Date.now() - start;
      const opsPerSec = Math.round((totalRequests / elapsedMs) * 1000);
      const allPassed = results.every(r => r.success);

      return {
        testId: "perf-high-concurrency-throughput",
        name: `Validate high concurrency throughput (${totalRequests} parallel transactions)`,
        category: "Performance",
        passed: allPassed && elapsedMs < 5000,
        durationMs: elapsedMs,
        details: { totalRequests, elapsedMs, opsPerSec }
      };
    } catch (err: any) {
      return {
        testId: "perf-high-concurrency-throughput",
        name: `Validate high concurrency throughput (${totalRequests} parallel transactions)`,
        category: "Performance",
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testLatencyDistributionP99(): Promise<TestCaseResult> {
    const start = Date.now();
    const sampleSize = 25;
    const latencies: number[] = [];

    try {
      for (let i = 0; i < sampleSize; i++) {
        const t0 = Date.now();
        await this.orchestrator.processAuthorization({
          tenantId: "tenant_lat",
          billingAccountId: "ba_lat",
          transactionId: `tx_lat_${i}_${Date.now()}`,
          amount: { amountInCents: 2000, currencyCode: "EUR" },
          paymentMethod: { type: "credit_card", token: "tok_visa" }
        }, "adyen");
        latencies.push(Date.now() - t0);
      }

      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(sampleSize * 0.5)];
      const p95 = latencies[Math.floor(sampleSize * 0.95)];
      const p99 = latencies[latencies.length - 1];

      return {
        testId: "perf-latency-distribution-p99",
        name: "Validate authorization latency distribution (P50, P95, P99)",
        category: "Performance",
        passed: p99 < 1000,
        durationMs: Date.now() - start,
        details: { p50Ms: p50, p95Ms: p95, p99Ms: p99 }
      };
    } catch (err: any) {
      return {
        testId: "perf-latency-distribution-p99",
        name: "Validate authorization latency distribution (P50, P95, P99)",
        category: "Performance",
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testMultiProviderParallelExecution(): Promise<TestCaseResult> {
    const start = Date.now();
    const providers = ["stripe", "paypal", "adyen", "checkout_com", "iyzico"] as const;

    try {
      const promises = providers.map(pId =>
        this.orchestrator.processAuthorization(
          {
            tenantId: `tenant_multi_${pId}`,
            billingAccountId: `ba_multi_${pId}`,
            transactionId: `tx_multi_prov_${pId}_${Date.now()}`,
            amount: { amountInCents: 5000, currencyCode: pId === "iyzico" ? "TRY" : "USD" },
            paymentMethod: { type: "credit_card", token: "tok_visa" }
          },
          pId
        )
      );

      const results = await Promise.all(promises);
      const allPassed = results.every(r => r.success);

      return {
        testId: "perf-multi-provider-parallel",
        name: "Validate simultaneous multi-provider parallel execution across all 5 adapters",
        category: "Performance",
        passed: allPassed,
        durationMs: Date.now() - start,
        details: { providersExecuted: providers.length }
      };
    } catch (err: any) {
      return {
        testId: "perf-multi-provider-parallel",
        name: "Validate simultaneous multi-provider parallel execution across all 5 adapters",
        category: "Performance",
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }
}
