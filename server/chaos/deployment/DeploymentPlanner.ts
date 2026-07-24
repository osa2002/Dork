import { DeploymentDefinition, DeploymentEnvironment, StrategyType } from "./DeploymentDefinition";
import { DeploymentContext } from "./DeploymentContext";
import { DeploymentStrategy, StrategyPlan } from "./DeploymentStrategy";
import { DeploymentPolicy } from "./DeploymentPolicy";

export interface RollbackTriggerCondition {
  readonly triggerId: string;
  readonly name: string;
  readonly metricThreshold: string;
  readonly automatic: boolean;
}

export interface DeploymentPlan {
  readonly planId: string;
  readonly correlationId: string;
  readonly releaseVersion: string;
  readonly environment: DeploymentEnvironment;
  readonly strategyPlan: StrategyPlan;
  readonly definition: DeploymentDefinition;
  readonly rollbackTriggers: readonly RollbackTriggerCondition[];
  readonly plannedAt: string;
  readonly approved: boolean;
  readonly recommendationReason: string;
}

export class DeploymentPlanner {
  public static createPlan(
    context: DeploymentContext,
    definition?: DeploymentDefinition
  ): DeploymentPlan {
    const targetDef = definition || DeploymentDefinition.createDefaultProductionDefinition("1.0.0");
    const policyEval = DeploymentPolicy.evaluate(context, targetDef);

    const chosenStrategyType: StrategyType = policyEval.recommendedStrategy;
    const strategyPlan = DeploymentStrategy.getStrategyPlan(chosenStrategyType, targetDef.cloudRun);

    const rollbackTriggers: RollbackTriggerCondition[] = [
      {
        triggerId: "TRIG-SLA-01",
        name: "Observability SLA Violation",
        metricThreshold: "Health Score < 90%",
        automatic: true,
      },
      {
        triggerId: "TRIG-INC-01",
        name: "Critical Incident Severity 1 Trigger",
        metricThreshold: "Incident Severity === CRITICAL",
        automatic: true,
      },
      {
        triggerId: "TRIG-GOV-01",
        name: "Governance Compliance Gate Failure",
        metricThreshold: "Governance Score < 90%",
        automatic: true,
      },
      {
        triggerId: "TRIG-VAL-01",
        name: "Release Certification Gate Failure",
        metricThreshold: "Release Gate Certification === FAILED",
        automatic: true,
      },
    ];

    const planId = `plan-${context.environment}-${Math.random().toString(36).substring(2, 9)}`;

    return Object.freeze({
      planId,
      correlationId: context.correlationId,
      releaseVersion: targetDef.releaseVersion,
      environment: context.environment,
      strategyPlan,
      definition: targetDef,
      rollbackTriggers: Object.freeze(rollbackTriggers),
      plannedAt: new Date().toISOString(),
      approved: policyEval.allowed,
      recommendationReason: `Policy evaluation determined strategy '${chosenStrategyType}' based on risk score (${context.changeRiskScore}), health (${context.currentHealthScore}%), and environment '${context.environment}'.`,
    });
  }
}
