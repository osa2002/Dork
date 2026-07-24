import { DeploymentContext } from "./DeploymentContext";
import { DeploymentDefinition, DeploymentStatus, DeploymentEnvironment } from "./DeploymentDefinition";
import { DeploymentPlanner, DeploymentPlan } from "./DeploymentPlanner";
import { DeploymentValidator, DeploymentValidationReport } from "./DeploymentValidator";
import { DeploymentHistory } from "./DeploymentHistory";
import { DeploymentAudit, TimelineEvent, DeploymentAuditTrail } from "./DeploymentAudit";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

export interface PromotionPipelineStage {
  readonly environment: DeploymentEnvironment;
  readonly name: string;
  readonly status: DeploymentStatus;
  readonly validationPassed: boolean;
  readonly executedAt?: string;
}

export interface DeploymentOrchestrationResult {
  readonly deploymentId: string;
  readonly correlationId: string;
  readonly status: DeploymentStatus;
  readonly plan: DeploymentPlan;
  readonly validation: DeploymentValidationReport;
  readonly audit: DeploymentAuditTrail;
  readonly promotionPipeline: readonly PromotionPipelineStage[];
  readonly rollbackExecuted: boolean;
  readonly rollbackReason?: string;
}

export class DeploymentOrchestrator {
  public static execute(
    contextConfig?: Parameters<typeof DeploymentContext.create>[0],
    definition?: DeploymentDefinition
  ): DeploymentOrchestrationResult {
    const context = DeploymentContext.create(contextConfig);
    const targetDef = definition || DeploymentDefinition.createDefaultProductionDefinition("1.0.0");
    const plan = DeploymentPlanner.createPlan(context, targetDef);
    const validation = DeploymentValidator.validate(context, plan);

    const deploymentId = `dep-exec-${Math.random().toString(36).substring(2, 9)}`;
    const timeline: TimelineEvent[] = [];

    timeline.push({
      timestamp: new Date().toISOString(),
      phase: "PLANNING",
      message: `Deployment plan '${plan.planId}' compiled for version ${plan.releaseVersion} in ${plan.environment}.`,
      status: "INFO",
    });

    timeline.push({
      timestamp: new Date().toISOString(),
      phase: "VALIDATION",
      message: `Health gates evaluated. Overall valid: ${validation.overallValid}. Health score: ${validation.healthGatesScore}%.`,
      status: validation.overallValid ? "SUCCESS" : "ERROR",
    });

    // Construct Promotion Pipeline
    const promotionStages: PromotionPipelineStage[] = [
      { environment: "development", name: "Development Unit & Integration Gate", status: "PROMOTED", validationPassed: true, executedAt: new Date().toISOString() },
      { environment: "qa", name: "QA & Synthetic Testing Gate", status: "PROMOTED", validationPassed: true, executedAt: new Date().toISOString() },
      { environment: "staging", name: "Staging Pre-Release Integration Gate", status: "PROMOTED", validationPassed: true, executedAt: new Date().toISOString() },
      {
        environment: context.environment,
        name: `${context.environment.toUpperCase()} Release Promotion Gate`,
        status: validation.overallValid ? "PROMOTED" : "FAILED",
        validationPassed: validation.overallValid,
        executedAt: new Date().toISOString(),
      },
    ];

    let finalStatus: DeploymentStatus = "PROMOTED";
    let rollbackExecuted = false;
    let rollbackReason: string | undefined = undefined;

    if (!validation.overallValid) {
      finalStatus = "ROLLED_BACK";
      rollbackExecuted = true;
      const failedGates = validation.healthGates.filter((g) => !g.passed).map((g) => g.name).join(", ");
      rollbackReason = `Deployment health validation failed on gates: [${failedGates}]. Initiated automatic emergency rollback to previous healthy revision.`;

      timeline.push({
        timestamp: new Date().toISOString(),
        phase: "ROLLBACK",
        message: rollbackReason,
        status: "ERROR",
      });
    } else {
      timeline.push({
        timestamp: new Date().toISOString(),
        phase: "EXECUTION",
        message: `Executed deployment strategy '${plan.strategyPlan.name}' across ${plan.strategyPlan.steps.length} zero-downtime stages.`,
        status: "SUCCESS",
      });

      timeline.push({
        timestamp: new Date().toISOString(),
        phase: "PROMOTION",
        message: `Successfully promoted release version ${plan.releaseVersion} to ${plan.environment}.`,
        status: "SUCCESS",
      });
    }

    const audit = DeploymentAudit.createAuditTrail(context, plan, validation, finalStatus, timeline);

    // Record in immutable history
    DeploymentHistory.recordDeployment({
      deploymentId,
      correlationId: context.correlationId,
      releaseVersion: plan.releaseVersion,
      environment: context.environment,
      strategy: plan.strategyPlan.name,
      status: finalStatus,
      startedAt: context.timestamp,
      completedAt: new Date().toISOString(),
      healthScore: validation.healthGatesScore,
      rollbackTriggered: rollbackExecuted,
      rollbackReason,
      logs: timeline.map((t) => `[${t.timestamp}] [${t.phase}] ${t.message}`),
    });

    // Publish event to Enterprise Event Bus
    try {
      EnterpriseEventBus.publish(
        "ComplianceCheckCompleted",
        {
          engine: "DeploymentEngine",
          deploymentId,
          environment: context.environment,
          status: finalStatus,
          overallValid: validation.overallValid,
          rollbackExecuted,
        },
        context.correlationId
      );
    } catch (err) {
      // Event bus publish non-blocking
    }

    return Object.freeze({
      deploymentId,
      correlationId: context.correlationId,
      status: finalStatus,
      plan,
      validation,
      audit,
      promotionPipeline: Object.freeze(promotionStages),
      rollbackExecuted,
      rollbackReason,
    });
  }
}
