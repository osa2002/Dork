import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { GovernanceContext } from "./GovernanceContext";
import { GovernancePolicy } from "./GovernancePolicy";
import { CompliancePolicy } from "./CompliancePolicy";
import { PolicyCatalog } from "./PolicyCatalog";
import { GovernanceDecision } from "./GovernanceDecision";
import { GovernanceEngine } from "./GovernanceEngine";
import { ComplianceEngine } from "./ComplianceEngine";
import { ApprovalWorkflow } from "./ApprovalWorkflow";
import { RiskAssessment } from "./RiskAssessment";
import { PolicyReporter } from "./PolicyReporter";
import { EnterpriseEventBus } from "./EnterpriseEventBus";

describe("Enterprise Governance & Compliance Platform Test Suite", () => {
  beforeAll(() => {
    EnterpriseEventBus.clear();
  });

  beforeEach(() => {
    GovernanceEngine.clearAuditTrail();
  });

  describe("GovernanceContext", () => {
    it("should compile a read-only governance context with SRE metrics and default requester", () => {
      const context = GovernanceContext.compile("production");
      expect(context).toBeDefined();
      expect(context.environment).toBe("production");
      expect(context.timestamp).toBeTypeOf("string");
      expect(context.errorBudgetRemaining).toBeTypeOf("number");
      expect(context.availabilityActual).toBeTypeOf("number");
      expect(context.liveRiskScore).toBeTypeOf("number");
      expect(context.requester.id).toBeDefined();
      expect(context.requester.role).toBeTypeOf("string");
      expect(context.targetExperiment.id).toBeDefined();
    });

    it("should support custom overrides for requester and target experiment details", () => {
      const context = GovernanceContext.compile(
        "staging",
        { id: "usr-custom", role: "SRE_LEAD", team: "Core Infra" },
        { id: "exp-latency", name: "High Latency Injection", estimatedRisk: "HIGH" }
      );
      expect(context.environment).toBe("staging");
      expect(context.requester.id).toBe("usr-custom");
      expect(context.requester.role).toBe("SRE_LEAD");
      expect(context.requester.team).toBe("Core Infra");
      expect(context.targetExperiment.id).toBe("exp-latency");
      expect(context.targetExperiment.name).toBe("High Latency Injection");
      expect(context.targetExperiment.estimatedRisk).toBe("HIGH");
    });
  });

  describe("GovernancePolicy & CompliancePolicy", () => {
    it("should provide high-quality pre-configured policies", () => {
      const defGov = GovernancePolicy.getDefaultPolicy();
      expect(defGov.minSloAvailability).toBe(99.5);
      expect(defGov.minErrorBudgetRemaining).toBe(20.0);

      const strictGov = GovernancePolicy.getUltraStrictPolicy();
      expect(strictGov.allowProductionChaos).toBe(false);

      const soc2 = CompliancePolicy.getSOC2Policy();
      expect(soc2.standard).toBe("SOC2");
      expect(soc2.requiresAuditTrail).toBe(true);

      const pci = CompliancePolicy.getPCIDSSPolicy();
      expect(pci.standard).toBe("PCI_DSS");
      expect(pci.requiredMinimumRole).toBe("SRE_LEAD");
    });
  });

  describe("PolicyCatalog", () => {
    it("should lookup registered governance and compliance policies", () => {
      const gov = PolicyCatalog.getGovernancePolicy("pol-sre-strict");
      expect(gov.id).toBe("pol-sre-strict");
      expect(gov.allowProductionChaos).toBe(false);

      const comp = PolicyCatalog.getCompliancePolicy("comp-soc2");
      expect(comp.id).toBe("comp-soc2");
      expect(comp.standard).toBe("SOC2");

      const listGov = PolicyCatalog.getAllGovernancePolicies();
      expect(listGov.length).toBeGreaterThanOrEqual(2);

      const listComp = PolicyCatalog.getAllCompliancePolicies();
      expect(listComp.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("RiskAssessment", () => {
    it("should perform dynamic multi-dimensional risk assessment based on context", () => {
      const context = GovernanceContext.compile("production", {}, { estimatedRisk: "HIGH" });
      const assessment = RiskAssessment.assess(context);

      expect(assessment.id).toMatch(/^rsk-/);
      expect(assessment.riskScore).toBeGreaterThanOrEqual(0);
      expect(assessment.riskScore).toBeLessThanOrEqual(100);
      expect(assessment.riskTier).toBeTypeOf("string");
      expect(assessment.blastRadiusScore).toBeTypeOf("number");
      expect(assessment.breakdown.systemStateRisk).toBeDefined();
      expect(assessment.breakdown.experimentRisk).toBeDefined();
      expect(assessment.recommendedSafeguards.length).toBeGreaterThan(0);
    });
  });

  describe("ApprovalWorkflow", () => {
    it("should generate step-by-step approval sequences based on risk and environment", () => {
      const workflow = ApprovalWorkflow.generateWorkflow(85, "production", ["SRE_LEAD", "SECURITY_AUDITOR"]);
      expect(workflow.workflowId).toMatch(/^apw-/);
      expect(workflow.status).toBe("PENDING_APPROVAL");
      expect(workflow.stages.length).toBe(3);

      const leadStage = workflow.stages.find((s) => s.requiredRole === "SRE_LEAD");
      expect(leadStage).toBeDefined();
      expect(leadStage?.status).toBe("PENDING");
    });

    it("should auto-approve for low-risk, non-production environments with zero required manual steps", () => {
      const workflow = ApprovalWorkflow.generateWorkflow(15, "development", []);
      expect(workflow.status).toBe("AUTO_APPROVED");
      expect(workflow.stages.every((s) => s.status === "SKIPPED")).toBe(true);
    });
  });

  describe("ComplianceEngine", () => {
    it("should evaluate and verify compliance returning a granular compliance score", () => {
      const context = GovernanceContext.compile("production", { role: "SRE_LEAD" }, { estimatedRisk: "MEDIUM" });
      const policy = CompliancePolicy.getSOC2Policy();
      const result = ComplianceEngine.evaluate(context, policy);

      expect(result.complianceScore).toBe(100);
      expect(result.status).toBe("APPROVED");
      expect(result.failedRules.length).toBe(0);
    });

    it("should reject and penalize compliance score when user role is unauthorized", () => {
      const context = GovernanceContext.compile("production", { role: "GUEST" }, { estimatedRisk: "HIGH" });
      const policy = CompliancePolicy.getPCIDSSPolicy(); // Requires SRE_LEAD
      const result = ComplianceEngine.evaluate(context, policy);

      expect(result.status).toBe("REJECTED");
      expect(result.complianceScore).toBeLessThan(100);
      expect(result.failedRules).toContain("Rule_Role_Unauthorized");
    });
  });

  describe("GovernanceEngine", () => {
    it("should approve compliant requests under default SRE policies", () => {
      const context = GovernanceContext.compile("staging", { role: "SRE_OPERATOR", team: "Platform SRE" });
      const policy = GovernancePolicy.getDefaultPolicy();
      const result = GovernanceEngine.evaluate(context, policy);

      expect(result.status).toBe("APPROVED");
      expect(result.passedRules).toContain("Rule_ErrorBudget_Healthy");
    });

    it("should reject requests if error budget goes below the threshold", () => {
      const customContext = {
        ...GovernanceContext.compile("production"),
        errorBudgetRemaining: 5.0, // Default policy floor is 20%
      };
      const policy = GovernancePolicy.getDefaultPolicy();
      const result = GovernanceEngine.evaluate(customContext, policy);

      expect(result.status).toBe("REJECTED");
      expect(result.failedRules).toContain("Rule_ErrorBudget_Depleted");
    });

    it("should orchestrate full evaluations returning highly detailed immutable decision records", () => {
      const context = GovernanceContext.compile("production", { role: "SRE_LEAD" });
      const govPolicy = GovernancePolicy.getDefaultPolicy();
      const compPolicy = CompliancePolicy.getSOC2Policy();

      const decision = GovernanceEngine.evaluateRequest(context, govPolicy, compPolicy);

      expect(decision.id).toMatch(/^dec-/);
      expect(decision.timestamp).toBeTypeOf("string");
      expect(decision.status).toBeTypeOf("string");
      expect(decision.riskScore).toBeGreaterThanOrEqual(0);
      expect(decision.complianceScore).toBeGreaterThanOrEqual(0);
      expect(decision.reasoning).toBeTypeOf("string");
      expect(decision.passedRules.length).toBeGreaterThan(0);

      // Verify strict immutability
      expect(() => {
        (decision as any).riskScore = 999;
      }).toThrow();
    });
  });

  describe("PolicyReporter", () => {
    it("should compile high-quality Markdown and JSON report structures representing historical audit trails", () => {
      // Seed some evaluations first
      const govPolicy = GovernancePolicy.getDefaultPolicy();
      const compPolicy = CompliancePolicy.getSOC2Policy();

      GovernanceEngine.evaluateRequest(GovernanceContext.compile("production"), govPolicy, compPolicy);
      GovernanceEngine.evaluateRequest(GovernanceContext.compile("staging"), govPolicy, compPolicy);

      const report = PolicyReporter.generateReport();

      expect(report.timestamp).toBeTypeOf("string");
      expect(report.totalEvaluations).toBe(2);
      expect(report.averageRiskScore).toBeGreaterThan(0);
      expect(report.averageComplianceScore).toBeGreaterThan(0);
      expect(report.markdown).toContain("# 🏛️ ENTERPRISE SRE GOVERNANCE & COMPLIANCE REPORT");
      expect(report.markdown).toContain("GOVERNANCE KPI SUMMARY");
      expect(report.markdown).toContain("RECENT GOVERNANCE DECISION AUDIT TRAIL");
      expect(report.json).toBeTypeOf("string");

      const parsed = JSON.parse(report.json);
      expect(parsed.totalEvaluations).toBe(2);
      expect(parsed.auditTrail.length).toBe(2);
    });
  });
});
