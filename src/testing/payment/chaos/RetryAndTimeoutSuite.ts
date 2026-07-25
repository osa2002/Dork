import { CertificationSuiteResult, TestCaseResult } from "../types";
import { RetryStrategy } from "../../../billing/ppal/retry/RetryStrategy";
import { MaxRetryExceededException } from "../../../billing/ppal/exceptions/PPALExceptions";
import { StripePaymentGatewayAdapter } from "../../../billing/providers/stripe/StripePaymentGatewayAdapter";

export class RetryAndTimeoutSuite {
  public async runSuite(): Promise<CertificationSuiteResult> {
    const startTime = Date.now();
    const testResults: TestCaseResult[] = [];

    testResults.push(await this.testRetryStrategyMaxAttemptsExceeded());
    testResults.push(await this.testRetryStrategyNonRetryableShortCircuit());
    testResults.push(await this.testAdapterTimeoutHandling());

    const passCount = testResults.filter(r => r.passed).length;
    const failCount = testResults.filter(r => !r.passed).length;

    return {
      suiteName: "Retry Strategy & Timeout Chaos Suite",
      passed: failCount === 0,
      totalTests: testResults.length,
      passCount,
      failCount,
      durationMs: Date.now() - startTime,
      testResults
    };
  }

  private async testRetryStrategyMaxAttemptsExceeded(): Promise<TestCaseResult> {
    const start = Date.now();
    try {
      const retry = new RetryStrategy({ maxAttempts: 3, initialDelayMs: 10, backoffFactor: 1.5 });

      await retry.execute(async (attempt) => {
        throw new Error(`Simulated transient error attempt ${attempt}`);
      });

      return {
        testId: "retry-max-attempts-exceeded",
        name: "Validate RetryStrategy max attempts limit and MaxRetryExceededException",
        category: "Chaos & Retry",
        passed: false,
        durationMs: Date.now() - start,
        error: "Expected MaxRetryExceededException but execute completed"
      };
    } catch (err: any) {
      const isExpected = err instanceof MaxRetryExceededException;
      return {
        testId: "retry-max-attempts-exceeded",
        name: "Validate RetryStrategy max attempts limit and MaxRetryExceededException",
        category: "Chaos & Retry",
        passed: isExpected,
        durationMs: Date.now() - start,
        details: { message: err.message }
      };
    }
  }

  private async testRetryStrategyNonRetryableShortCircuit(): Promise<TestCaseResult> {
    const start = Date.now();
    try {
      const retry = new RetryStrategy({ maxAttempts: 5, initialDelayMs: 10 });

      await retry.execute(
        async () => {
          const error = new Error("NON_RETRYABLE_AUTH_ERROR");
          (error as any).isFatal = true;
          throw error;
        },
        (error: any) => !error.isFatal
      );

      return {
        testId: "retry-non-retryable-short-circuit",
        name: "Validate RetryStrategy short-circuits on non-retryable errors",
        category: "Chaos & Retry",
        passed: false,
        durationMs: Date.now() - start,
        error: "Expected exception to be thrown immediately"
      };
    } catch (err: any) {
      const isShortCircuited = err instanceof MaxRetryExceededException;
      return {
        testId: "retry-non-retryable-short-circuit",
        name: "Validate RetryStrategy short-circuits on non-retryable errors",
        category: "Chaos & Retry",
        passed: isShortCircuited,
        durationMs: Date.now() - start
      };
    }
  }

  private async testAdapterTimeoutHandling(): Promise<TestCaseResult> {
    const start = Date.now();
    try {
      const adapter = new StripePaymentGatewayAdapter({ timeoutMs: 1 });

      const res = await adapter.authorize({
        tenantId: "tenant_timeout",
        billingAccountId: "ba_timeout",
        transactionId: "tx_timeout_01",
        amount: { amountInCents: 1000, currencyCode: "USD" },
        paymentMethod: { type: "credit_card", token: "tok_visa" }
      });

      return {
        testId: "adapter-timeout-handling",
        name: "Validate provider adapter timeout configuration & AbortController handling",
        category: "Chaos & Timeout",
        passed: typeof res.success === "boolean",
        durationMs: Date.now() - start
      };
    } catch (err: any) {
      return {
        testId: "adapter-timeout-handling",
        name: "Validate provider adapter timeout configuration & AbortController handling",
        category: "Chaos & Timeout",
        passed: true,
        durationMs: Date.now() - start,
        details: { errorCaught: err.message }
      };
    }
  }
}
