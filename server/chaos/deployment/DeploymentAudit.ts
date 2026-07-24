import { DeploymentContext } from "./DeploymentContext";
import { DeploymentPlan } from "./DeploymentPlanner";
import { DeploymentValidationReport } from "./DeploymentValidator";
import { DeploymentStatus } from "./DeploymentDefinition";

export interface TimelineEvent {
  readonly timestamp: string;
  readonly phase: string;
  readonly message: string;
  readonly status: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
}

export interface DeploymentAuditTrail {
  readonly auditId: string;
  readonly correlationId: string;
  readonly planId: string;
  readonly environment: string;
  readonly releaseVersion: string;
  readonly finalStatus: DeploymentStatus;
  readonly healthGatesPassed: boolean;
  readonly cloudRunValidated: boolean;
  readonly timeline: readonly TimelineEvent[];
  readonly createdAt: string;
}

export class DeploymentAudit {
  public static createAuditTrail(
    context: DeploymentContext,
    plan: DeploymentPlan,
    validation: DeploymentValidationReport,
    status: DeploymentStatus,
    timeline: readonly TimelineEvent[]
  ): DeploymentAuditTrail {
    const auditId = `audit-${context.environment}-${Math.random().toString(36).substring(2, 9)}`;

    return Object.freeze({
      auditId,
      correlationId: context.correlationId,
      planId: plan.planId,
      environment: context.environment,
      releaseVersion: plan.releaseVersion,
      finalStatus: status,
      healthGatesPassed: validation.overallValid,
      cloudRunValidated: validation.cloudRunChecks.every((c) => c.passed),
      timeline: Object.freeze([...timeline]),
      createdAt: new Date().toISOString(),
    });
  }
}
