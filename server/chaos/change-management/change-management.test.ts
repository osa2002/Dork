import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { ChangeRequest } from "./ChangeRequest";
import { ChangeContext } from "./ChangeContext";
import { ChangePolicy } from "./ChangePolicy";
import { ImpactAnalyzer } from "./ImpactAnalyzer";
import { RiskEvaluator } from "./RiskEvaluator";
import { ApprovalEngine } from "./ApprovalEngine";
import { ChangePlanner } from "./ChangePlanner";
import { RollbackPlanner } from "./RollbackPlanner";
import { ChangeExecutor } from "./ChangeExecutor";
import { ChangeAudit } from "./ChangeAudit";
import { ChangeReporter } from "./ChangeReporter";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

describe("Enterprise Change Management Platform Test Suite", () => {
  beforeAll(() => {
    EnterpriseEventBus.clear();
  });

  beforeEach(() => {
    ChangeAudit.clearLogs();
  });

  describe("ChangeRequest model", () => {
    it("should instantiate an immutable change request with correct fields", () => {
      const payload = ChangeRequest.create({
        title: "Database Index Migration",
        description: "Adding active sessions indexes to Firestore",
        requester: {
          id: "usr-sre-lead-1",
          name: "SRE Operator Alpha",
          role: "SRE_LEAD",
          team: "SRE Core",
        },
        targetSubsystems: ["Firestore"],
        classification: "STANDARD",
        changeType: "CONFIGURATION",
        parameters: { indexName: "idx_sessions_active" },
      });

      expect(payload.id).toBeDefined();
      expect(payload.id.startsWith("chg-")).toBe(true);
      expect(payload.title).toBe("Database Index Migration");
      expect(payload.requester.role).toBe("SRE_LEAD");
      expect(payload.targetSubsystems).toContain("Firestore");
      expect(payload.classification).toBe("STANDARD");
      expect(payload.timestamp).toBeDefined();

      // Check immutability
      expect(() => {
        (payload as any).title = "New Title";
      }).toThrow();
    });
  });

  describe("ChangeContext compiler", () => {
    it("should compile a multi-system read-only operational state snapshot", () => {
      const context = ChangeContext.compile("production");

      expect(context.timestamp).toBeDefined();
      expect(context.environment).toBe("production");
      expect(context.liveState).toBeDefined();
      expect(context.governanceData).toBeDefined();
      expect(context.twinSnapshot).toBeDefined();
      expect(context.currentFailureProbabilityRisk).toBeTypeOf("number");
      expect(context.activeIncidentsCount).toBeTypeOf("number");
      expect(context.activeRecoveriesCount).toBeTypeOf("number");
      expect(context.totalValidationRuns).toBeTypeOf("number");
    });
  });

  describe("ChangePolicy catalog", () => {
    it("should provide standard and permissive policies", () => {
      const standard = ChangePolicy.getStandardPolicy();
      expect(standard.id).toBe("chg-pol-standard");
      expect(standard.minErrorBudgetForChange).toBe(20.0);
      expect(standard.maxRiskScoreAllowed).toBe(75);
      expect(standard.blockOnActiveOutages).toBe(true);

      const permissive = ChangePolicy.getPermissivePolicy();
      expect(permissive.id).toBe("chg-pol-permissive");
      expect(permissive.minErrorBudgetForChange).toBe(0.0);
      expect(permissive.maxRiskScoreAllowed).toBe(95);
      expect(permissive.blockOnActiveOutages).toBe(false);
    });
  });

  describe("ImpactAnalyzer", () => {
    it("should analyze blast radius and detect cascading dependencies", () => {
      const request = ChangeRequest.create({
        title: "Stripe Endpoint Configuration Update",
        description: "Hot swap of stripe webhook secret parameters",
        requester: {
          id: "usr-operator-2",
          name: "SRE Operator Beta",
          role: "SRE_OPERATOR",
          team: "Gateway SRE",
        },
        targetSubsystems: ["StripeAPI"],
        classification: "MINOR",
        changeType: "CONFIGURATION",
        parameters: { activeVersion: "v3" },
      });

      const context = ChangeContext.compile("production");
      const impact = ImpactAnalyzer.analyze(request, context);

      expect(impact.blastRadiusScore).toBeGreaterThanOrEqual(10);
      expect(impact.primaryImpactedSubsystems).toContain("StripeAPI");
      expect(impact.cascadingImpactedSubsystems).toBeDefined();
      expect(impact.resourceContentionRisk).toBeDefined();
      expect(impact.impactDetail.length).toBeGreaterThan(0);
    });
  });

  describe("RiskEvaluator", () => {
    it("should perform deterministic risk scores using ambient telemetry metrics", () => {
      const request = ChangeRequest.create({
        title: "API Gateway Memory Rescale",
        description: "Change container CPU memory limit parameters",
        requester: {
          id: "usr-operator-2",
          name: "SRE Operator Beta",
          role: "SRE_OPERATOR",
          team: "SRE Gateway",
        },
        targetSubsystems: ["ExpressServer"],
        classification: "MAJOR",
        changeType: "INFRASTRUCTURE",
        parameters: { memoryLimit: "4Gi" },
      });

      const context = ChangeContext.compile("production");
      const evaluation = RiskEvaluator.evaluate(request, context);

      expect(evaluation.riskScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.riskScore).toBeLessThanOrEqual(100);
      expect(evaluation.riskTier).toBeDefined();
      expect(evaluation.factors.classificationFactor).toBe(80); // Major is 80
      expect(evaluation.factors.changeTypeFactor).toBe(90); // Infrastructure is 90
      expect(evaluation.riskStatements.length).toBeGreaterThan(0);
    });
  });

  describe("ApprovalEngine rules evaluation", () => {
    it("should automatically approve standard, low-risk changes with healthy SRE budgets", () => {
      const request = ChangeRequest.create({
        title: "Standard Config Reflate",
        description: "Standard flush configuration logs on twin",
        requester: {
          id: "usr-developer-3",
          name: "SRE Developer Gamma",
          role: "DEVELOPER",
          team: "Feature Devs",
        },
        targetSubsystems: ["TwilioSMS"],
        classification: "STANDARD",
        changeType: "CONFIGURATION",
        parameters: { flushIntervalMs: 30000 },
      });

      const context = ChangeContext.compile("production");
      const policy = ChangePolicy.getPermissivePolicy(); // Permissive to guarantee auto approval
      const approval = ApprovalEngine.evaluate(request, context, policy);

      expect(approval.status).toBe("AUTO_APPROVED");
      expect(approval.passedRules).toContain("Rule_ErrorBudget_Healthy");
      expect(approval.failedRules.length).toBe(0);
      expect(approval.stages.length).toBeGreaterThan(0);
    });

    it("should reject changes if the error budget of the platform is completely depleted", () => {
      const request = ChangeRequest.create({
        title: "Emergency Gateway Redeploy",
        description: "Forced rebuild of core ingress pipelines",
        requester: {
          id: "usr-guest-4",
          name: "SRE Guest User",
          role: "GUEST",
          team: "External Support",
        },
        targetSubsystems: ["ExpressServer"],
        classification: "EMERGENCY",
        changeType: "CODE_DEPLOY",
        parameters: {},
      });

      const context = ChangeContext.compile("production");
      // Force low error budget policy
      const strictPolicy = {
        ...ChangePolicy.getStandardPolicy(),
        minErrorBudgetForChange: 101.0, // Guaranteed to exceed maximum possible remaining budget (100)
      };

      const approval = ApprovalEngine.evaluate(request, context, strictPolicy);

      expect(approval.status).toBe("REJECTED");
      expect(approval.failedRules).toContain("Rule_ErrorBudget_Depleted");
      expect(approval.reasoning).toContain("budget");
    });
  });

  describe("ChangePlanner and RollbackPlanner", () => {
    it("should construct detailed sequences and metrics", () => {
      const request = ChangeRequest.create({
        title: "Release v1.2.0 Ingress",
        description: "Major release deployment",
        requester: {
          id: "usr-operator-1",
          name: "SRE Lead Team",
          role: "SRE_LEAD",
          team: "Deploy SRE",
        },
        targetSubsystems: ["ExpressServer"],
        classification: "MAJOR",
        changeType: "CODE_DEPLOY",
        parameters: { version: "v1.2.0" },
      });

      const plan = ChangePlanner.generatePlan(request);
      expect(plan.steps.length).toBeGreaterThan(2);
      expect(plan.steps[0].name).toBe("Pre-change SRE Validation");
      expect(plan.totalEstimatedDurationSeconds).toBeGreaterThan(0);

      const rollback = RollbackPlanner.generateRollbackPlan(request);
      expect(rollback.steps.length).toBeGreaterThan(1);
      expect(rollback.steps[0].action).toContain("Shift 100% traffic weight back");
      expect(rollback.totalRemediationTimeSeconds).toBeGreaterThan(0);
      expect(rollback.triggerMetricThresholds.length).toBeGreaterThan(0);
    });
  });

  describe("ChangeExecutor and Auditing flow", () => {
    it("should simulate execution with zero production mutation and audit logs properly", () => {
      const request = ChangeRequest.create({
        title: "Chaos Stress Run",
        description: "Simulated memory injection validation",
        requester: {
          id: "usr-sre-lead-1",
          name: "SRE Operator Alpha",
          role: "SRE_LEAD",
          team: "SRE Core",
        },
        targetSubsystems: ["GeminiAI"],
        classification: "MINOR",
        changeType: "CHAOS_EXPERIMENT",
        parameters: { scale: 50 },
      });

      const context = ChangeContext.compile("production");
      const simulation = ChangeExecutor.simulate(request, context);

      expect(simulation.simulationId).toBeDefined();
      expect(simulation.timestamp).toBeDefined();
      expect(simulation.executionPlan).toBeDefined();
      expect(simulation.rollbackPlan).toBeDefined();

      // Log results into ChangeAudit
      const impact = ImpactAnalyzer.analyze(request, context);
      const risk = RiskEvaluator.evaluate(request, context);
      const policy = ChangePolicy.getStandardPolicy();
      const approval = ApprovalEngine.evaluate(request, context, policy);

      const logRecord = ChangeAudit.log(request, impact, risk, approval, simulation);
      expect(logRecord.id).toBeDefined();
      expect(ChangeAudit.getLogs().length).toBe(1);

      // Verify reporter
      const reporter = ChangeReporter.generateReport();
      expect(reporter.totalChangesProposed).toBe(1);
      expect(reporter.averageRiskScore).toBeTypeOf("number");
      expect(reporter.markdown).toContain("ENTERPRISE CHANGE MANAGEMENT & SRE SAFETY REPORT");
      expect(reporter.json).toBeTypeOf("string");
    });
  });
});
