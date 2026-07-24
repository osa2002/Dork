import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ReleaseDefinition } from "./ReleaseDefinition";
import { ReleaseContext } from "./ReleaseContext";
import { ReleasePolicy } from "./ReleasePolicy";
import { ReleaseStrategy } from "./ReleaseStrategy";
import { ReleaseValidator } from "./ReleaseValidator";
import { ReleaseApproval } from "./ReleaseApproval";
import { ReleasePlanner } from "./ReleasePlanner";
import { ReleasePipeline } from "./ReleasePipeline";
import { ReleaseAudit } from "./ReleaseAudit";
import { ReleaseReporter } from "./ReleaseReporter";
import { ReleaseManagementEngine } from "./ReleaseManagementEngine";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";
import { SLOService } from "../../../src/services/SLOService";

describe("Enterprise Release Management Platform Test Suite", () => {
  beforeEach(() => {
    ReleaseAudit.clear();
    EnterpriseEventBus.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("ReleaseDefinition (Semantic Versioning & Payload Validation)", () => {
    it("should successfully validate standard SemVer strings", () => {
      expect(ReleaseDefinition.isValidSemVer("1.0.0")).toBe(true);
      expect(ReleaseDefinition.isValidSemVer("2.14.3-alpha.1")).toBe(true);
      expect(ReleaseDefinition.isValidSemVer("0.0.1-rc.2+build.123")).toBe(true);
      expect(ReleaseDefinition.isValidSemVer("invalid-semver")).toBe(false);
      expect(ReleaseDefinition.isValidSemVer("1.2")).toBe(false);
    });

    it("should instantiate a fully frozen immutable ReleaseDefinition", () => {
      const payload = ReleaseDefinition.create({
        version: "1.2.3",
        title: "Database Optimization Patch",
        description: "Optimizes indexing configurations on critical collections.",
        strategy: "BLUE_GREEN",
        targetSubsystems: ["Firestore"],
        featureFlags: [{ flagName: "enable_db_optimize", enabled: true, rolloutPercentage: 100 }],
        requester: {
          id: "usr-sre-99b",
          name: "SRE Operator Alpha",
          role: "SRE_OPERATOR",
          team: "SRE Platform Core",
        },
        complexity: "MEDIUM",
        hasRollbackPlan: true,
      });

      expect(payload.id).toBeDefined();
      expect(payload.version).toBe("1.2.3");
      expect(Object.isFrozen(payload)).toBe(true);
    });

    it("should throw a clear validation error on invalid semantic versions", () => {
      expect(() => {
        ReleaseDefinition.create({
          version: "1.0", // Invalid SemVer
          title: "Broken Release",
          description: "This should fail validation.",
          strategy: "ROLLING",
          targetSubsystems: ["ExpressServer"],
          featureFlags: [],
          requester: {
            id: "usr-dev-12",
            name: "John Dev",
            role: "DEVELOPER",
            team: "App Dev",
          },
          complexity: "LOW",
          hasRollbackPlan: false,
        });
      }).toThrowError(/Invalid semantic versioning format/);
    });
  });

  describe("ReleaseContext (Dynamic SRE State Aggregation)", () => {
    it("should compile a rich read-only context of current platform state", () => {
      const context = ReleaseContext.compile("production", {
        id: "usr-sre-99b",
        team: "SRE Platform Core",
        role: "SRE_OPERATOR",
        permissions: ["RUN_EXPERIMENTS"],
      });

      expect(context.timestamp).toBeDefined();
      expect(context.environment).toBe("production");
      expect(context.liveState).toBeDefined();
      expect(context.governanceData).toBeDefined();
      expect(context.twinSnapshot).toBeDefined();
      expect(context.failureProbabilityPrediction).toBeDefined();
      expect(context.recentValidationRuns).toBeDefined();
      expect(context.recentRecoveries).toBeDefined();
      expect(context.knowledgeRecords).toBeDefined();
      expect(context.changeAuditRecords).toBeDefined();
    });
  });

  describe("ReleasePolicy (Threshold Definitions)", () => {
    it("should retrieve correct safety constraints for Standard policy", () => {
      const policy = ReleasePolicy.getStandardPolicy();
      expect(policy.id).toBe("rel-pol-standard");
      expect(policy.minErrorBudgetForRelease).toBe(20.0);
      expect(policy.maxFailureProbabilityAllowed).toBe(55);
      expect(policy.blockOnActiveOutages).toBe(true);
      expect(policy.requiresRollbackPlan).toBe(true);
      expect(policy.requiresFeatureFlagValidation).toBe(true);
      expect(policy.minReadinessScore).toBe(80);
      expect(policy.releaseFreezeWindows).toContain(12);
    });

    it("should retrieve relaxed settings for Permissive policy", () => {
      const policy = ReleasePolicy.getPermissivePolicy();
      expect(policy.id).toBe("rel-pol-permissive");
      expect(policy.minErrorBudgetForRelease).toBe(0.0);
      expect(policy.blockOnActiveOutages).toBe(false);
      expect(policy.requiresRollbackPlan).toBe(false);
      expect(policy.minReadinessScore).toBe(0);
    });
  });

  describe("ReleaseStrategy (Decision Matrix & Rollout Phases)", () => {
    const mockDef = ReleaseDefinition.create({
      version: "2.0.0",
      title: "Major API Upgrade",
      description: "Introducing breaking updates with gradual feature flags.",
      strategy: "CANARY",
      targetSubsystems: ["StripeAPI", "ExpressServer"],
      featureFlags: [
        { flagName: "stripe_v2", enabled: true, rolloutPercentage: 50 },
      ],
      requester: {
        id: "usr-sre-lead",
        name: "Jane Lead",
        role: "SRE_LEAD",
        team: "Platform Ops",
      },
      complexity: "HIGH",
      hasRollbackPlan: true,
    });

    const mockCtx = ReleaseContext.compile("production");

    it("should recommend CANARY for high complexity and critical subsystems", () => {
      const recommendation = ReleaseStrategy.recommend(mockDef, mockCtx);
      expect(recommendation.recommendedStrategy).toBe("CANARY");
      expect(recommendation.confidenceScore).toBeGreaterThanOrEqual(70);
      expect(recommendation.justification).toContain("Canary");
    });

    it("should return detailed rollout phases for Canary option", () => {
      const recommendation = ReleaseStrategy.recommend(mockDef, mockCtx);
      const canaryOption = recommendation.options.find((o) => o.strategy === "CANARY");
      expect(canaryOption).toBeDefined();
      expect(canaryOption?.rolloutPhases.length).toBe(4);
      expect(canaryOption?.rolloutPhases[0].trafficPercentage).toBe(5);
      expect(canaryOption?.rolloutPhases[3].trafficPercentage).toBe(100);
    });
  });

  describe("ReleaseValidator (Multi-stage Safety Validation)", () => {
    it("should calculate correct readiness scores and generate findings on violations", () => {
      const def = ReleaseDefinition.create({
        version: "1.4.0",
        title: "Test Release",
        description: "Standard rollout test.",
        strategy: "ROLLING",
        targetSubsystems: ["ExpressServer"],
        featureFlags: [
          { flagName: "broken_flag", enabled: true, rolloutPercentage: 150 }, // Invalid percentage
        ],
        requester: { id: "1", name: "Bob", role: "DEVELOPER", team: "A" },
        complexity: "LOW",
        hasRollbackPlan: true,
      });

      const context = ReleaseContext.compile("production");
      const validation = ReleaseValidator.validate(def, context);

      expect(validation.isEligible).toBe(false); // invalid flag % is critical
      const flagFinding = validation.findings.find((f) => f.code === "FF_INVALID_PERCENTAGE");
      expect(flagFinding).toBeDefined();
      expect(flagFinding?.severity).toBe("CRITICAL");
    });

    it("should flag critical errors if platform health is down", () => {
      const def = ReleaseDefinition.create({
        version: "1.4.0",
        title: "Standard Patch",
        description: "Low-impact testing.",
        strategy: "ROLLING",
        targetSubsystems: ["ExpressServer"],
        featureFlags: [],
        requester: { id: "1", name: "Bob", role: "DEVELOPER", team: "A" },
        complexity: "LOW",
        hasRollbackPlan: true,
      });

      // Construct a customized state to simulate down conditions
      const customCtx = {
        ...ReleaseContext.compile("production"),
        liveState: {
          timestamp: new Date().toISOString(),
          eventBus: { historyCount: 0, diagnosticsCount: 0, subscribersCount: 0 },
          controlPlane: {
            healthStatus: "UNAVAILABLE", // DOWN
            readinessScore: 40, // LOW
            engineCount: 0,
            dependencyCount: 0,
            hasCircularDependencies: false,
          },
          predictions: { activeRiskScore: 90, lastPredictionType: "FAILURE_PROBABILITY" },
          decisions: { lastDecision: "NO_ACTION", lastConfidence: 100, historySize: 0 },
          recovery: { lastStatus: "IDLE", successRate: 100, historySize: 0 },
          knowledge: { recordCount: 0, capacityLimit: 10 },
          validation: { lastSuccessRate: 100, runCount: 0 },
          digitalTwin: { status: "SYNCHRONIZED", lastSyncTimestamp: "" },
          integration: { status: "HEALTHY" },
        },
      };

      const validation = ReleaseValidator.validate(def, customCtx);
      expect(validation.isEligible).toBe(false); // Should be blocked
      expect(validation.findings.some((f) => f.code === "HEALTH_PLATFORM_DOWN")).toBe(true);
      expect(validation.findings.some((f) => f.code === "HEALTH_READINESS_LOW")).toBe(true);
      expect(validation.readinessScore).toBeLessThan(50);
    });
  });

  describe("ReleaseApproval (Governance Gate Rules)", () => {
    const standardPolicy = ReleasePolicy.getStandardPolicy();

    it("should AUTO_APPROVED if all rules are fully met", () => {
      const def = ReleaseDefinition.create({
        version: "1.0.0",
        title: "Standard Maintenance Release",
        description: "Routine optimization.",
        strategy: "ROLLING",
        targetSubsystems: ["ExpressServer"],
        featureFlags: [],
        requester: { id: "1", name: "SRE Operator", role: "SRE_OPERATOR", team: "Ops" },
        complexity: "LOW",
        hasRollbackPlan: true,
      });

      const context = {
        ...ReleaseContext.compile("production"),
        governanceData: {
          timestamp: new Date().toISOString(),
          environment: "production" as const,
          currentHour: 20, // Outside freeze windows (freeze is 9-17)
          isWithinMaintenanceWindow: false,
          errorBudgetRemaining: 95.0, // Plenty of budget
          availabilityActual: 99.9,
          liveRiskScore: 10,
          requester: { id: "1", team: "Ops", role: "SRE_OPERATOR" as const, permissions: [] },
          targetExperiment: { id: "1", name: "1", estimatedRisk: "LOW" as const, affectedSubsystems: [], requiresApproval: false },
          safetyGatesActive: false,
        },
      };

      const validation = ReleaseValidator.validate(def, context);
      const approval = ReleaseApproval.evaluate(def, context, standardPolicy, validation);

      expect(approval.status).toBe("AUTO_APPROVED");
      expect(approval.evaluatedRules.every((r) => r.passed)).toBe(true);
    });

    it("should REJECT release if the error budget of the SRE platform is depleted", () => {
      const def = ReleaseDefinition.create({
        version: "1.0.0",
        title: "Standard Release",
        description: "Routine updates.",
        strategy: "ROLLING",
        targetSubsystems: ["ExpressServer"],
        featureFlags: [],
        requester: { id: "1", name: "SRE", role: "SRE_OPERATOR", team: "Ops" },
        complexity: "LOW",
        hasRollbackPlan: true,
      });

      const context = {
        ...ReleaseContext.compile("production"),
        governanceData: {
          timestamp: new Date().toISOString(),
          environment: "production" as const,
          currentHour: 20,
          isWithinMaintenanceWindow: false,
          errorBudgetRemaining: 5.0, // Depleted (threshold is 20.0)
          availabilityActual: 99.9,
          liveRiskScore: 10,
          requester: { id: "1", team: "Ops", role: "SRE_OPERATOR" as const, permissions: [] },
          targetExperiment: { id: "1", name: "1", estimatedRisk: "LOW" as const, affectedSubsystems: [], requiresApproval: false },
          safetyGatesActive: false,
        },
      };

      const validation = ReleaseValidator.validate(def, context);
      const approval = ReleaseApproval.evaluate(def, context, standardPolicy, validation);

      expect(approval.status).toBe("REJECTED");
      const budgetRule = approval.evaluatedRules.find((r) => r.ruleId === "Rule_ErrorBudget_Sufficient");
      expect(budgetRule?.passed).toBe(false);
    });

    it("should transition to PENDING_APPROVAL inside freeze windows requiring SRE_LEAD role override", () => {
      const def = ReleaseDefinition.create({
        version: "1.0.0",
        title: "Routine update",
        description: "Updating CSS assets.",
        strategy: "ROLLING",
        targetSubsystems: ["ExpressServer"],
        featureFlags: [],
        requester: { id: "1", name: "Operator", role: "SRE_OPERATOR", team: "Ops" },
        complexity: "LOW",
        hasRollbackPlan: true,
      });

      const context = {
        ...ReleaseContext.compile("production"),
        governanceData: {
          timestamp: new Date().toISOString(),
          environment: "production" as const,
          currentHour: 12, // INSIDE FREEZE WINDOW (9-17)
          isWithinMaintenanceWindow: false,
          errorBudgetRemaining: 95.0,
          availabilityActual: 99.9,
          liveRiskScore: 10,
          requester: { id: "1", team: "Ops", role: "SRE_OPERATOR" as const, permissions: [] },
          targetExperiment: { id: "1", name: "1", estimatedRisk: "LOW" as const, affectedSubsystems: [], requiresApproval: false },
          safetyGatesActive: false,
        },
      };

      const validation = ReleaseValidator.validate(def, context);
      const approval = ReleaseApproval.evaluate(def, context, standardPolicy, validation);

      expect(approval.status).toBe("PENDING_APPROVAL");
      expect(approval.requiredOverrideRole).toBe("SRE_LEAD");
    });
  });

  describe("ReleasePlanner (Timeline Plan & Fallback Rollbacks)", () => {
    const def = ReleaseDefinition.create({
      version: "3.2.0-beta.1",
      title: "Beta Patch",
      description: "Low blast-radius feature rollout.",
      strategy: "ROLLING",
      targetSubsystems: ["ExpressServer"],
      featureFlags: [],
      requester: { id: "1", name: "Dev", role: "DEVELOPER", team: "A" },
      complexity: "LOW",
      hasRollbackPlan: true,
    });

    it("should generate a complete Rolling deployment timeline plan", () => {
      const plan = ReleasePlanner.generatePlan(def, "ROLLING");
      expect(plan.strategyUsed).toBe("ROLLING");
      expect(plan.steps.length).toBeGreaterThanOrEqual(3);
      expect(plan.totalDurationSeconds).toBeGreaterThan(0);
      expect(plan.steps[0].name).toContain("Pre-Release");
    });

    it("should generate a valid fallback Rollback plan with predefined trigger thresholds", () => {
      const rollback = ReleasePlanner.generateRollbackPlan(def);
      expect(rollback.steps.length).toBeGreaterThanOrEqual(2);
      expect(rollback.triggers.length).toBeGreaterThanOrEqual(3);
      expect(rollback.triggers[0]).toContain("HTTP 5xx");
    });
  });

  describe("ReleasePipeline (Phased Simulated Lifecycle)", () => {
    it("should evaluate transitions, log phase details, and close standard runs", () => {
      const pipeline = ReleasePipeline.simulate(true, 95, 200);
      expect(pipeline.isSuccess).toBe(true);
      expect(pipeline.currentPhase).toBe("CLOSED");
      expect(pipeline.phases.some((p) => p.phase === "PRE_FLIGHT" && p.status === "PASSED")).toBe(true);
    });

    it("should fail gracefully and skip post rollout phases when ineligible", () => {
      const pipeline = ReleasePipeline.simulate(false, 50, 0);
      expect(pipeline.isSuccess).toBe(false);
      expect(pipeline.currentPhase).toBe("PRE_FLIGHT");
      expect(pipeline.phases.find((p) => p.phase === "ROLLOUT")?.status).toBe("SKIPPED");
    });
  });

  describe("ReleaseAudit (Immutable Logging Trails)", () => {
    it("should append audit records to session logs successfully", () => {
      const def = ReleaseDefinition.create({
        version: "1.1.0",
        title: "Test Release",
        description: "Desc",
        strategy: "ROLLING",
        targetSubsystems: ["ExpressServer"],
        featureFlags: [],
        requester: { id: "1", name: "A", role: "DEVELOPER", team: "B" },
        complexity: "LOW",
        hasRollbackPlan: true,
      });

      const context = ReleaseContext.compile("production");
      const val = ReleaseValidator.validate(def, context);
      const appr = ReleaseApproval.evaluate(def, context, ReleasePolicy.getStandardPolicy(), val);

      const audit = ReleaseAudit.log(def, val, appr);
      expect(audit.auditId).toBeDefined();
      expect(audit.version).toBe("1.1.0");

      const logs = ReleaseAudit.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].auditId).toBe(audit.auditId);
    });
  });

  describe("ReleaseReporter (Executive Reports)", () => {
    it("should output highly scannable Markdown and structured JSON structures", () => {
      const def = ReleaseDefinition.create({
        version: "1.1.0",
        title: "Test Release",
        description: "Desc",
        strategy: "ROLLING",
        targetSubsystems: ["ExpressServer"],
        featureFlags: [],
        requester: { id: "1", name: "A", role: "DEVELOPER", team: "B" },
        complexity: "LOW",
        hasRollbackPlan: true,
      });

      const context = ReleaseContext.compile("production");
      const val = ReleaseValidator.validate(def, context);
      const appr = ReleaseApproval.evaluate(def, context, ReleasePolicy.getStandardPolicy(), val);
      const strat = ReleaseStrategy.recommend(def, context);
      const plan = ReleasePlanner.generatePlan(def, "ROLLING");
      const rollback = ReleasePlanner.generateRollbackPlan(def);
      const pipeline = ReleasePipeline.simulate(true, 95, 200);
      const audit = ReleaseAudit.log(def, val, appr);

      const reporterOutput = ReleaseReporter.generate(def, val, appr, strat, plan, rollback, pipeline, audit);

      expect(reporterOutput.reportId).toBeDefined();
      expect(reporterOutput.markdown).toContain("ENTERPRISE RELEASE MANAGEMENT PLATFORM");
      expect(reporterOutput.json.readinessScore).toBe(val.readinessScore);
    });
  });

  describe("ReleaseManagementEngine (End-to-End Coordination Flows)", () => {
    it("should complete a comprehensive dry-run plan release, publishing operational event signals", async () => {
      const def = ReleaseDefinition.create({
        version: "2.1.0-rc.1",
        title: "Release Candidate Plan",
        description: "Simulating release deployment of next core build.",
        strategy: "CANARY",
        targetSubsystems: ["ExpressServer"],
        featureFlags: [],
        requester: { id: "1", name: "Lead SRE", role: "SRE_LEAD", team: "Release Core" },
        complexity: "MEDIUM",
        hasRollbackPlan: true,
      });

      // Track published event counts
      let publishedEventsCount = 0;
      EnterpriseEventBus.subscribe("sub-test-1", "ComplianceCheckCompleted", () => {
        publishedEventsCount++;
      });
      EnterpriseEventBus.subscribe("sub-test-2", "SystemStateChanged", () => {
        publishedEventsCount++;
      });

      const result = ReleaseManagementEngine.planRelease(def, "production");

      expect(result.context).toBeDefined();
      expect(result.validation).toBeDefined();
      expect(result.approval).toBeDefined();
      expect(result.deploymentPlan).toBeDefined();
      expect(result.report).toBeDefined();

      // Await standard macro-task execution to allow EventBus dispatch loop to fire
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check event publishing
      expect(publishedEventsCount).toBe(2);
    });
  });
});
