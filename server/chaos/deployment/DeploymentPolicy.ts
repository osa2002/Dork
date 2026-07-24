import { DeploymentContext } from "./DeploymentContext";
import { DeploymentDefinition, StrategyType } from "./DeploymentDefinition";

export interface PolicyRuleResult {
  readonly ruleId: string;
  readonly name: string;
  readonly passed: boolean;
  readonly reason: string;
}

export interface PolicyEvaluationReport {
  readonly timestamp: string;
  readonly correlationId: string;
  readonly allowed: boolean;
  readonly recommendedStrategy: StrategyType;
  readonly ruleResults: readonly PolicyRuleResult[];
}

export class DeploymentPolicy {
  public static evaluate(context: DeploymentContext, definition: DeploymentDefinition): PolicyEvaluationReport {
    const rules: PolicyRuleResult[] = [];

    // Rule 1: Health Threshold Check (SLA >= 90)
    const healthPassed = context.currentHealthScore >= 90 || context.emergencyOverride;
    rules.push({
      ruleId: "DEP-POL-01",
      name: "System Health Score Gate",
      passed: healthPassed,
      reason: healthPassed
        ? `Current health score (${context.currentHealthScore}%) meets deployment threshold (>=90%).`
        : `System health score (${context.currentHealthScore}%) is below SLA threshold.`,
    });

    // Rule 2: Change Risk Score Cap (< 50 for Production)
    const maxRisk = context.environment === "production" ? 50 : 80;
    const riskPassed = context.changeRiskScore <= maxRisk || context.emergencyOverride;
    rules.push({
      ruleId: "DEP-POL-02",
      name: "Change Risk Threshold Gate",
      passed: riskPassed,
      reason: riskPassed
        ? `Change risk score (${context.changeRiskScore}) is within acceptable range (<= ${maxRisk}).`
        : `Change risk score (${context.changeRiskScore}) exceeds environment threshold (${maxRisk}).`,
    });

    // Rule 3: Cloud Run Target Port Compliance (3000)
    const portPassed = definition.cloudRun.targetPort === 3000;
    rules.push({
      ruleId: "DEP-POL-03",
      name: "Cloud Run Container Port Compliance",
      passed: portPassed,
      reason: portPassed
        ? `Target container port ${definition.cloudRun.targetPort} matches standard Cloud Run ingress proxy.`
        : `Invalid port ${definition.cloudRun.targetPort}. Port 3000 required for Cloud Run proxy ingress.`,
    });

    // Rule 4: Stateless Cloud Run Execution Constraint
    const statelessPassed = definition.cloudRun.stateless;
    rules.push({
      ruleId: "DEP-POL-04",
      name: "Stateless Cloud Run Runtime Enforcement",
      passed: statelessPassed,
      reason: statelessPassed
        ? "Container configured for stateless execution."
        : "Stateless execution required for Cloud Run instances.",
    });

    const allowed = rules.every((r) => r.passed);

    // Recommend strategy automatically based on Health, Risk, Complexity
    let recommendedStrategy: StrategyType = definition.strategy;
    if (context.emergencyOverride) {
      recommendedStrategy = "EmergencyRollback";
    } else if (context.environment === "production") {
      if (context.changeRiskScore > 35 || context.releaseComplexity === "HIGH" || context.releaseComplexity === "CRITICAL") {
        recommendedStrategy = "Canary";
      } else {
        recommendedStrategy = "BlueGreen";
      }
    } else if (context.environment === "staging") {
      recommendedStrategy = "Rolling";
    } else {
      recommendedStrategy = "ProgressiveRollout";
    }

    return {
      timestamp: new Date().toISOString(),
      correlationId: context.correlationId,
      allowed,
      recommendedStrategy,
      ruleResults: Object.freeze(rules),
    };
  }
}
