import { CertificationSuiteResult, TestCaseResult } from "../types";
import { CircuitBreaker } from "../../../billing/ppal/circuit-breaker/CircuitBreaker";
import { CircuitBreakerOpenException } from "../../../billing/ppal/exceptions/PPALExceptions";

export class CircuitBreakerSuite {
  public async runSuite(): Promise<CertificationSuiteResult> {
    const startTime = Date.now();
    const testResults: TestCaseResult[] = [];

    testResults.push(await this.testCircuitBreakerStateTransitions());
    testResults.push(await this.testCircuitBreakerExecutionGuard());
    testResults.push(await this.testCircuitBreakerRecoveryOnHalfOpen());

    const passCount = testResults.filter(r => r.passed).length;
    const failCount = testResults.filter(r => !r.passed).length;

    return {
      suiteName: "Circuit Breaker Chaos & Fault Tolerance Suite",
      passed: failCount === 0,
      totalTests: testResults.length,
      passCount,
      failCount,
      durationMs: Date.now() - startTime,
      testResults
    };
  }

  private async testCircuitBreakerStateTransitions(): Promise<TestCaseResult> {
    const start = Date.now();
    try {
      const cb = new CircuitBreaker("stripe_chaos", { failureThreshold: 3, resetTimeoutMs: 100 });

      const state1 = cb.state; // Expect CLOSED

      cb.recordFailure(new Error("Failure 1"));
      cb.recordFailure(new Error("Failure 2"));
      const state2 = cb.state; // Expect CLOSED

      cb.recordFailure(new Error("Failure 3"));
      const state3 = cb.state; // Expect OPEN

      const passed = state1 === "CLOSED" && state2 === "CLOSED" && state3 === "OPEN";

      return {
        testId: "cb-state-transitions",
        name: "Validate Circuit Breaker CLOSED -> OPEN transition upon consecutive failures",
        category: "Chaos & Fault Tolerance",
        passed,
        durationMs: Date.now() - start,
        details: { state1, state2, state3 }
      };
    } catch (err: any) {
      return {
        testId: "cb-state-transitions",
        name: "Validate Circuit Breaker CLOSED -> OPEN transition upon consecutive failures",
        category: "Chaos & Fault Tolerance",
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testCircuitBreakerExecutionGuard(): Promise<TestCaseResult> {
    const start = Date.now();
    try {
      const cb = new CircuitBreaker("paypal_chaos", { failureThreshold: 1, resetTimeoutMs: 5000 });
      cb.recordFailure(new Error("Trigger OPEN"));

      let actionExecuted = false;
      await cb.execute(async () => {
        actionExecuted = true;
        return "success";
      });

      return {
        testId: "cb-execution-guard",
        name: "Validate Circuit Breaker blocks execution when OPEN",
        category: "Chaos & Fault Tolerance",
        passed: false,
        durationMs: Date.now() - start,
        error: "Expected CircuitBreakerOpenException but action executed"
      };
    } catch (err: any) {
      const isExpected = err instanceof CircuitBreakerOpenException;
      return {
        testId: "cb-execution-guard",
        name: "Validate Circuit Breaker blocks execution when OPEN",
        category: "Chaos & Fault Tolerance",
        passed: isExpected,
        durationMs: Date.now() - start
      };
    }
  }

  private async testCircuitBreakerRecoveryOnHalfOpen(): Promise<TestCaseResult> {
    const start = Date.now();
    try {
      const cb = new CircuitBreaker("adyen_chaos", { failureThreshold: 2, resetTimeoutMs: 50 });
      cb.recordFailure(new Error("F1"));
      cb.recordFailure(new Error("F2")); // Now OPEN

      // Wait 60ms to let it transition to HALF_OPEN on next check
      await new Promise(r => setTimeout(r, 60));

      const halfOpenState = cb.state; // HALF_OPEN

      // Execute successful action during HALF_OPEN
      const result = await cb.execute(async () => "recovered");

      const finalState = cb.state; // CLOSED after success

      const passed = halfOpenState === "HALF_OPEN" && result === "recovered" && finalState === "CLOSED";

      return {
        testId: "cb-half-open-recovery",
        name: "Validate Circuit Breaker HALF_OPEN recovery back to CLOSED upon success",
        category: "Chaos & Fault Tolerance",
        passed,
        durationMs: Date.now() - start,
        details: { halfOpenState, result, finalState }
      };
    } catch (err: any) {
      return {
        testId: "cb-half-open-recovery",
        name: "Validate Circuit Breaker HALF_OPEN recovery back to CLOSED upon success",
        category: "Chaos & Fault Tolerance",
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }
}
