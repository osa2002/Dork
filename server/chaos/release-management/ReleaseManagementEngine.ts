import { ReleaseDefinitionPayload } from "./ReleaseDefinition";
import { ReleaseContext, ReleaseContextPayload } from "./ReleaseContext";
import { ReleasePolicy, ReleasePolicyConfig } from "./ReleasePolicy";
import { ReleaseValidator, ReleaseValidationPayload } from "./ReleaseValidator";
import { ReleaseApproval, ReleaseApprovalPayload } from "./ReleaseApproval";
import { ReleaseStrategy, StrategyRecommendationPayload } from "./ReleaseStrategy";
import { ReleasePlanner, ReleasePlanPayload, RollbackPlanPayload } from "./ReleasePlanner";
import { ReleasePipeline, ReleasePipelinePayload } from "./ReleasePipeline";
import { ReleaseAudit, ReleaseAuditRecord } from "./ReleaseAudit";
import { ReleaseReporter, ReleaseReportOutput } from "./ReleaseReporter";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

export interface ReleaseOrchestrationResult {
  readonly context: ReleaseContextPayload;
  readonly validation: ReleaseValidationPayload;
  readonly approval: ReleaseApprovalPayload;
  readonly strategyRecommendation: StrategyRecommendationPayload;
  readonly deploymentPlan: ReleasePlanPayload;
  readonly rollbackPlan: RollbackPlanPayload;
  readonly pipelineSimulation: ReleasePipelinePayload;
  readonly auditRecord: ReleaseAuditRecord;
  readonly report: ReleaseReportOutput;
}

export class ReleaseManagementEngine {
  /**
   * Orchestrates a read-only, fully simulated Release Management planning workflow.
   * Leverages all key SRE system integrations without any production mutations.
   * Publishes "SystemStateChanged" and "ComplianceCheckCompleted" events to the Enterprise Event Bus.
   */
  public static planRelease(
    definition: ReleaseDefinitionPayload,
    environment: "production" | "staging" | "development" = "production",
    customPolicy?: ReleasePolicyConfig
  ): ReleaseOrchestrationResult {
    const correlationId = `corr-rel-run-${Math.random().toString(36).substring(2, 9)}`;

    // 1. Compile the read-only, dynamic SRE release context
    const context = ReleaseContext.compile(environment, {
      id: definition.requester.id,
      team: definition.requester.team,
      role: definition.requester.role,
      permissions: ["RUN_EXPERIMENTS", "APPROVE_MITIGATION"], // safe defaults
    });

    // 2. Select standard or custom policy
    const policy = customPolicy || (environment === "production" ? ReleasePolicy.getStandardPolicy() : ReleasePolicy.getPermissivePolicy());

    // 3. Run validation assertions
    const validation = ReleaseValidator.validate(definition, context);

    // 4. Evaluate Governance approval gates
    const approval = ReleaseApproval.evaluate(definition, context, policy, validation);

    // 5. Evaluate and recommend strategy
    const strategyRecommendation = ReleaseStrategy.recommend(definition, context);

    // 6. Generate step-by-step deployment timeline using recommended or requested strategy
    const strategyToUse = definition.strategy || strategyRecommendation.recommendedStrategy;
    const deploymentPlan = ReleasePlanner.generatePlan(definition, strategyToUse);

    // 7. Generate matching rollback plan
    const rollbackPlan = ReleasePlanner.generateRollbackPlan(definition);

    // 8. Simulate pipeline phases
    const pipelineSimulation = ReleasePipeline.simulate(
      validation.isEligible && approval.status !== "REJECTED",
      validation.readinessScore,
      rollbackPlan.totalDurationSeconds
    );

    // 9. Write session audit record
    const auditRecord = ReleaseAudit.log(definition, validation, approval);

    // 10. Generate beautiful Markdown and JSON reports
    const report = ReleaseReporter.generate(
      definition,
      validation,
      approval,
      strategyRecommendation,
      deploymentPlan,
      rollbackPlan,
      pipelineSimulation,
      auditRecord
    );

    // 11. Publish state and compliance updates on the Enterprise Event Bus
    EnterpriseEventBus.publish(
      "ComplianceCheckCompleted",
      {
        subsystem: "ReleaseManagement",
        auditId: auditRecord.auditId,
        releaseId: definition.id,
        version: definition.version,
        passed: validation.isEligible,
        readinessScore: validation.readinessScore,
        approvalStatus: approval.status,
      },
      correlationId
    );

    EnterpriseEventBus.publish(
      "SystemStateChanged",
      {
        component: "ReleaseManagementEngine",
        action: "PLAN_RELEASE",
        version: definition.version,
        status: approval.status,
        readinessScore: validation.readinessScore,
      },
      correlationId
    );

    return Object.freeze({
      context,
      validation,
      approval,
      strategyRecommendation,
      deploymentPlan,
      rollbackPlan,
      pipelineSimulation,
      auditRecord,
      report,
    });
  }
}
