import { describe, it, expect, beforeEach } from "vitest";
import { DeploymentDefinition } from "./DeploymentDefinition";
import { DeploymentContext } from "./DeploymentContext";
import { DeploymentPolicy } from "./DeploymentPolicy";
import { DeploymentStrategy } from "./DeploymentStrategy";
import { DeploymentPlanner } from "./DeploymentPlanner";
import { DeploymentValidator } from "./DeploymentValidator";
import { DeploymentOrchestrator } from "./DeploymentOrchestrator";
import { DeploymentHistory } from "./DeploymentHistory";
import { DeploymentAudit } from "./DeploymentAudit";
import { DeploymentReporter } from "./DeploymentReporter";
import { DeploymentEngine } from "./DeploymentEngine";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

describe("🚀 Enterprise Deployment Automation Platform", () => {
  beforeEach(() => {
    EnterpriseEventBus.clear();
    DeploymentHistory.clear();
  });

  describe("DeploymentDefinition", () => {
    it("should instantiate default production deployment definition", () => {
      const def = DeploymentDefinition.createDefaultProductionDefinition("1.2.0");
      expect(def.releaseVersion).toBe("1.2.0");
      expect(def.targetEnvironment).toBe("production");
      expect(def.strategy).toBe("BlueGreen");
      expect(def.cloudRun.targetPort).toBe(3000);
      expect(def.cloudRun.stateless).toBe(true);
      expect(def.gates.length).toBe(4);
      expect(Object.isFrozen(def)).toBe(true);
      expect(Object.isFrozen(def.cloudRun)).toBe(true);
    });
  });

  describe("DeploymentContext", () => {
    it("should instantiate immutable context with sensible defaults", () => {
      const ctx = DeploymentContext.create();
      expect(ctx.environment).toBe("production");
      expect(ctx.correlationId).toMatch(/^dep-corr-/);
      expect(ctx.requestedBy.role).toBe("RELEASE_MANAGER");
      expect(ctx.currentHealthScore).toBe(98);
      expect(ctx.changeRiskScore).toBe(15);
      expect(Object.isFrozen(ctx)).toBe(true);
    });
  });

  describe("DeploymentPolicy", () => {
    it("should evaluate policies and approve low-risk production deployment", () => {
      const ctx = DeploymentContext.create();
      const def = DeploymentDefinition.createDefaultProductionDefinition("1.0.0");
      const report = DeploymentPolicy.evaluate(ctx, def);

      expect(report.allowed).toBe(true);
      expect(report.recommendedStrategy).toBe("BlueGreen");
      expect(report.ruleResults.length).toBe(4);
      expect(report.ruleResults.every((r) => r.passed)).toBe(true);
    });

    it("should recommend Canary strategy for high risk production release", () => {
      const ctx = DeploymentContext.create({ changeRiskScore: 45, releaseComplexity: "HIGH" });
      const def = DeploymentDefinition.createDefaultProductionDefinition("1.0.0");
      const report = DeploymentPolicy.evaluate(ctx, def);

      expect(report.recommendedStrategy).toBe("Canary");
    });
  });

  describe("DeploymentStrategy", () => {
    it("should generate strategy plans for all 5 deployment strategies", () => {
      const def = DeploymentDefinition.createDefaultProductionDefinition("1.0.0");
      const strategies = ["Rolling", "BlueGreen", "Canary", "ProgressiveRollout", "EmergencyRollback"] as const;

      strategies.forEach((strat) => {
        const plan = DeploymentStrategy.getStrategyPlan(strat, def.cloudRun);
        expect(plan.strategyType).toBe(strat);
        expect(plan.steps.length).toBeGreaterThan(0);
        expect(plan.zeroDowntime).toBe(true);
      });
    });

    it("should recommend EmergencyRollback when emergencyOverride is active", () => {
      const ctx = DeploymentContext.create({ emergencyOverride: true });
      const rec = DeploymentStrategy.recommendStrategy(ctx);
      expect(rec).toBe("EmergencyRollback");
    });
  });

  describe("DeploymentPlanner", () => {
    it("should compile an immutable deployment plan with rollback triggers", () => {
      const ctx = DeploymentContext.create();
      const plan = DeploymentPlanner.createPlan(ctx);

      expect(plan.planId).toMatch(/^plan-production-/);
      expect(plan.correlationId).toBe(ctx.correlationId);
      expect(plan.rollbackTriggers.length).toBe(4);
      expect(plan.approved).toBe(true);
      expect(Object.isFrozen(plan)).toBe(true);
    });
  });

  describe("DeploymentValidator", () => {
    it("should validate health gates and Cloud Run readiness checks", () => {
      const ctx = DeploymentContext.create();
      const plan = DeploymentPlanner.createPlan(ctx);
      const validation = DeploymentValidator.validate(ctx, plan);

      expect(validation.overallValid).toBe(true);
      expect(validation.healthGatesScore).toBeGreaterThanOrEqual(90);
      expect(validation.cloudRunScore).toBe(100);
      expect(validation.healthGates.length).toBe(5);
      expect(validation.cloudRunChecks.length).toBe(6);
    });
  });

  describe("DeploymentHistory & Audit", () => {
    it("should record deployment history and create audit trail", () => {
      const ctx = DeploymentContext.create();
      const plan = DeploymentPlanner.createPlan(ctx);
      const validation = DeploymentValidator.validate(ctx, plan);
      const audit = DeploymentAudit.createAuditTrail(ctx, plan, validation, "PROMOTED", []);

      expect(audit.auditId).toMatch(/^audit-production-/);
      expect(audit.finalStatus).toBe("PROMOTED");
      expect(audit.healthGatesPassed).toBe(true);

      DeploymentHistory.recordDeployment({
        deploymentId: "dep-test-1",
        correlationId: ctx.correlationId,
        releaseVersion: "1.0.0",
        environment: "production",
        strategy: "BlueGreen",
        status: "PROMOTED",
        startedAt: ctx.timestamp,
        completedAt: new Date().toISOString(),
        healthScore: 100,
        rollbackTriggered: false,
        logs: ["test log"],
      });

      const history = DeploymentHistory.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].deploymentId).toBe("dep-test-1");
    });
  });

  describe("DeploymentOrchestrator & Reporter", () => {
    it("should execute complete deployment orchestration and publish event", async () => {
      let eventPublished = false;
      EnterpriseEventBus.subscribe("DeployTest", "ComplianceCheckCompleted", (evt) => {
        if (evt.payload.engine === "DeploymentEngine") {
          eventPublished = true;
        }
      });

      const result = DeploymentOrchestrator.execute();
      expect(result.status).toBe("PROMOTED");
      expect(result.validation.overallValid).toBe(true);
      expect(result.rollbackExecuted).toBe(false);
      expect(result.promotionPipeline.length).toBe(4);

      const md = DeploymentReporter.generateMarkdownReport(result);
      const json = DeploymentReporter.generateJsonReport(result);

      expect(md).toContain("DORK ENTERPRISE DEPLOYMENT AUTOMATION PLATFORM");
      expect(md).toContain("Blue/Green Zero-Downtime Deployment");
      expect(json.version).toBe("1.0.0");
      expect(json.certified).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(eventPublished).toBe(true);
    });

    it("should execute automatic rollback if health score is critically degraded", () => {
      const ctxConfig = { currentHealthScore: 50 }; // Degraded score < 90 SLA
      const result = DeploymentOrchestrator.execute(ctxConfig);

      expect(result.status).toBe("ROLLED_BACK");
      expect(result.validation.overallValid).toBe(false);
      expect(result.rollbackExecuted).toBe(true);
      expect(result.rollbackReason).toContain("Initiated automatic emergency rollback");
    });
  });

  describe("DeploymentEngine Façade", () => {
    it("should execute full deployment flow via DeploymentEngine façade", () => {
      const summary = DeploymentEngine.execute();
      expect(summary.result.status).toBe("PROMOTED");
      expect(summary.reportMarkdown).toContain("Executive Summary");
      expect(summary.reportJson.certified).toBe(true);

      const rec = DeploymentEngine.recommendStrategy({ environment: "staging" });
      expect(rec).toBe("Rolling");

      const history = DeploymentEngine.getHistory();
      expect(history.length).toBeGreaterThan(0);
    });
  });
});
