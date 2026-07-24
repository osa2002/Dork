import { describe, it, expect, beforeEach } from "vitest";
import { ContinuousValidationService } from "./ContinuousValidationService";
import { ValidationHistory } from "./ValidationHistory";
import { ValidationCatalog } from "./ValidationCatalog";
import { ValidationEngine } from "./ValidationEngine";
import { ValidationDashboard } from "./ValidationDashboard";
import { ValidationReporter } from "./ValidationReporter";

describe("Phase 10.18 - Enterprise Continuous Validation Platform (CVP)", () => {
  beforeEach(() => {
    ValidationHistory.clear();
  });

  it("should execute a complete validation run on-demand and produce outputs", async () => {
    const output = await ContinuousValidationService.validatePlatform("CONTINUOUS");

    expect(output).toBeDefined();
    expect(output.validationId).toBeDefined();
    expect(output.timestamp).toBeDefined();
    expect(output.correlationId).toBeDefined();
    expect(output.results.length).toBeGreaterThan(0);
    expect(output.dashboard).toBeDefined();
    expect(output.report).toBeDefined();
  });

  it("should contain all 19 target system rules in the catalog", () => {
    const rules = ValidationCatalog.getRules();
    expect(rules.length).toBe(19);

    // Verify all core components are target of validation
    const expectedComponents = [
      "Architecture",
      "DependencyGraph",
      "KnowledgeRepository",
      "EnterpriseEventBus",
      "KnowledgeEngine",
      "PredictionEngine",
      "RecoveryEngine",
      "EnterpriseScoreEngine",
      "DigitalTwinEngine",
      "SLOService",
      "MetricsService",
      "TelemetryService",
      "ChaosHealthContributor",
      "ChaosRegistry",
      "WorkflowValidator",
      "DecisionEngine",
      "Integration",
      "APIContract"
    ];

    expectedComponents.forEach((component) => {
      const hasComponentRule = rules.some((r) => r.component === component);
      expect(hasComponentRule).toBe(true);
    });
  });

  it("should execute the rule engine with custom test context", async () => {
    const context = {
      validationId: "test-id-123",
      timestamp: new Date().toISOString(),
      validationType: "MANUAL" as const,
      correlationId: "test-corr-123"
    };

    const results = await ValidationEngine.execute(context);
    expect(results.length).toBe(19);
    expect(results.every((r) => r.validationId === "test-id-123")).toBe(true);
  });

  it("should trim validation history records to enforce a maximum boundary (50 records)", async () => {
    const initialHistory = ValidationHistory.getHistory();
    expect(initialHistory.length).toBe(0);

    // Add 55 records
    for (let i = 0; i < 55; i++) {
      ValidationHistory.add({
        validationId: `val-${i}`,
        timestamp: new Date().toISOString(),
        validationType: "CONTINUOUS",
        correlationId: `corr-${i}`,
        results: [],
        successRate: 100,
        passedCount: 0,
        failedCount: 0
      });
    }

    const currentHistory = ValidationHistory.getHistory();
    expect(currentHistory.length).toBe(50); // Trimmed to MAX_LIMIT of 50
    expect(currentHistory[0].validationId).toBe("val-5"); // Truncated oldest 5
    expect(currentHistory[49].validationId).toBe("val-54"); // Has newest
  });

  it("should aggregate correct operational dashboard metrics based on validation results", () => {
    const mockResults = [
      {
        validationId: "test-1",
        timestamp: new Date().toISOString(),
        ruleId: "VAL-ARC-001",
        ruleName: "Arch",
        severity: "Critical" as const,
        component: "Architecture",
        success: true,
        expected: "Pass",
        actual: "Pass",
        recommendation: "None",
        evidence: []
      },
      {
        validationId: "test-1",
        timestamp: new Date().toISOString(),
        ruleId: "VAL-DEP-002",
        ruleName: "Deps",
        severity: "Critical" as const,
        component: "DependencyGraph",
        success: false, // failed critical
        expected: "Pass",
        actual: "Fail",
        recommendation: "Action required",
        evidence: []
      },
      {
        validationId: "test-1",
        timestamp: new Date().toISOString(),
        ruleId: "VAL-REP-003",
        ruleName: "Repo",
        severity: "High" as const,
        component: "KnowledgeRepository",
        success: false, // failed high
        expected: "Pass",
        actual: "Fail",
        recommendation: "Action required",
        evidence: []
      }
    ];

    const dashboard = ValidationDashboard.getDashboard(mockResults);

    expect(dashboard).toBeDefined();
    expect(dashboard.passedRules).toBe(1);
    expect(dashboard.failedRules).toBe(2);
    expect(dashboard.successRate).toBe(33.33);
    expect(dashboard.criticalFindings).toBe(1);
    expect(dashboard.warningCount).toBe(1); // High counts as warning
    expect(dashboard.overallHealth).toBe("DEGRADED");
    expect(dashboard.coverage).toBe(100);
    expect(dashboard.enterpriseReadiness).toBeLessThan(100); // Deductions applied
  });

  it("should generate SRE-compliant Markdown and JSON validation reports", () => {
    const mockResults = [
      {
        validationId: "val-report-1",
        timestamp: new Date().toISOString(),
        ruleId: "VAL-ARC-001",
        ruleName: "Architecture Integrity",
        severity: "Critical" as const,
        component: "Architecture",
        success: false,
        expected: "Core services loaded",
        actual: "Failed loading",
        recommendation: "Check paths",
        evidence: ["Error trace here"]
      }
    ];

    const report = ValidationReporter.generateReport("val-report-1", new Date().toISOString(), mockResults);

    expect(report.reportId).toBeDefined();
    expect(report.json).toBeDefined();
    expect(report.json.validationId).toBe("val-report-1");
    expect(report.json.successRate).toBe(0);
    
    expect(report.markdown).toContain("# 🛠️ DORK ENTERPRISE CONTINUOUS VALIDATION PLATFORM REPORT");
    expect(report.markdown).toContain("Architecture Integrity");
    expect(report.markdown).toContain("Error trace here");
  });

  it("should run complete validation processes in a pure stateless execution fashion", async () => {
    const startCount = ValidationHistory.getHistory().length;
    
    // Validate platform state twice
    const out1 = await ContinuousValidationService.validatePlatform("MANUAL");
    const out2 = await ContinuousValidationService.validatePlatform("MANUAL");

    expect(out1.validationId).not.toBe(out2.validationId);
    expect(ValidationHistory.getHistory().length).toBe(startCount + 2);
  });
});
