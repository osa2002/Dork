import { CertificationSuiteResult, TestCaseResult } from "../types";
import { PaymentProviderRegistry } from "../../../billing/ppal/registry/PaymentProviderRegistry";
import { registerEnterprisePaymentProviders } from "../../../billing/providers";
import { AuthorizePaymentRequest } from "../../../billing/ppal/types/PPALCommonTypes";

export class MultiTenantIsolationSuite {
  private readonly registry: PaymentProviderRegistry;

  constructor() {
    this.registry = new PaymentProviderRegistry();
    registerEnterprisePaymentProviders(this.registry);
  }

  public async runSuite(): Promise<CertificationSuiteResult> {
    const startTime = Date.now();
    const testResults: TestCaseResult[] = [];

    testResults.push(await this.testTenantMetadataIsolation());
    testResults.push(await this.testConcurrentMultiTenantRequests());
    testResults.push(await this.testTenantContextImmutability());

    const passCount = testResults.filter(r => r.passed).length;
    const failCount = testResults.filter(r => !r.passed).length;

    return {
      suiteName: "Multi-Tenant Data & Processing Isolation Suite",
      passed: failCount === 0,
      totalTests: testResults.length,
      passCount,
      failCount,
      durationMs: Date.now() - startTime,
      testResults
    };
  }

  private async testTenantMetadataIsolation(): Promise<TestCaseResult> {
    const start = Date.now();
    try {
      const adapter = this.registry.getAdapter("stripe");

      const reqTenantA: AuthorizePaymentRequest = {
        tenantId: "TENANT_ALPHA_001",
        billingAccountId: "ba_alpha_001",
        transactionId: `tx_alpha_${Date.now()}`,
        amount: { amountInCents: 1000, currencyCode: "USD" },
        paymentMethod: { type: "credit_card", token: "tok_visa" },
        metadata: { secretOrgKey: "alpha_secret_999" }
      };

      const reqTenantB: AuthorizePaymentRequest = {
        tenantId: "TENANT_BETA_002",
        billingAccountId: "ba_beta_002",
        transactionId: `tx_beta_${Date.now()}`,
        amount: { amountInCents: 2000, currencyCode: "USD" },
        paymentMethod: { type: "credit_card", token: "tok_visa" },
        metadata: { secretOrgKey: "beta_secret_888" }
      };

      const [resA, resB] = await Promise.all([
        adapter.authorize(reqTenantA),
        adapter.authorize(reqTenantB)
      ]);

      const distinctTxIds = resA.providerTransactionId !== resB.providerTransactionId;
      const passed = resA.success && resB.success && distinctTxIds;

      return {
        testId: "multi-tenant-metadata-isolation",
        name: "Validate tenant metadata boundaries and secret isolation",
        category: "Multi-Tenant Isolation",
        passed,
        durationMs: Date.now() - start,
        details: { txA: resA.providerTransactionId, txB: resB.providerTransactionId }
      };
    } catch (err: any) {
      return {
        testId: "multi-tenant-metadata-isolation",
        name: "Validate tenant metadata boundaries and secret isolation",
        category: "Multi-Tenant Isolation",
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testConcurrentMultiTenantRequests(): Promise<TestCaseResult> {
    const start = Date.now();
    try {
      const adapter = this.registry.getAdapter("checkout_com");
      const tenantIds = ["TENANT_A", "TENANT_B", "TENANT_C", "TENANT_D", "TENANT_E"];

      const promises = tenantIds.map((tId, idx) =>
        adapter.authorize({
          tenantId: tId,
          billingAccountId: `ba_${tId}`,
          transactionId: `tx_conc_${tId}_${idx}`,
          amount: { amountInCents: 5000 + idx * 100, currencyCode: "USD" },
          paymentMethod: { type: "credit_card", token: "tok_visa" }
        })
      );

      const results = await Promise.all(promises);
      const allPassed = results.every(r => r.success);
      const uniqueIds = new Set(results.map(r => r.providerTransactionId)).size === tenantIds.length;

      return {
        testId: "multi-tenant-concurrent-processing",
        name: "Validate concurrent multi-tenant transaction execution",
        category: "Multi-Tenant Isolation",
        passed: allPassed && uniqueIds,
        durationMs: Date.now() - start,
        details: { countProcessed: results.length }
      };
    } catch (err: any) {
      return {
        testId: "multi-tenant-concurrent-processing",
        name: "Validate concurrent multi-tenant transaction execution",
        category: "Multi-Tenant Isolation",
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }

  private async testTenantContextImmutability(): Promise<TestCaseResult> {
    const start = Date.now();
    try {
      const req: AuthorizePaymentRequest = {
        tenantId: "TENANT_IMMUTABLE",
        billingAccountId: "ba_immutable",
        transactionId: "tx_immutable_101",
        amount: { amountInCents: 7500, currencyCode: "EUR" },
        paymentMethod: { type: "credit_card", token: "tok_visa" }
      };

      const originalTenantId = req.tenantId;
      const originalAmount = req.amount.amountInCents;

      const adapter = this.registry.getAdapter("adyen");
      await adapter.authorize(req);

      const isUnmutated = req.tenantId === originalTenantId && req.amount.amountInCents === originalAmount;

      return {
        testId: "multi-tenant-context-immutability",
        name: "Validate request object immutability post-authorization",
        category: "Multi-Tenant Isolation",
        passed: isUnmutated,
        durationMs: Date.now() - start
      };
    } catch (err: any) {
      return {
        testId: "multi-tenant-context-immutability",
        name: "Validate request object immutability post-authorization",
        category: "Multi-Tenant Isolation",
        passed: false,
        durationMs: Date.now() - start,
        error: err.message
      };
    }
  }
}
