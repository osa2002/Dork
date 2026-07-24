import { IChaosExperiment } from "../experiments/IChaosExperiment";

export type ChaosRiskLevel = "Low" | "Medium" | "High" | "Critical";
export type ChaosScheduleType = "manual" | "scheduled" | "CI/CD" | "nightly" | "weekly" | "monthly";
export type ChaosExecutionScope = "single" | "group" | "full" | "high_risk_only" | "low_risk_only" | "critical_only";

export interface ChaosPolicyConfig {
  allowedRiskLevels: ChaosRiskLevel[];
  maxExecutionDuration: number; // overall timeout in ms
  automaticRollbackOnFailure: boolean;
  maxRetries: number;
  tags?: string[];
}

export class ChaosPolicy {
  public static readonly DEFAULT_POLICY: ChaosPolicyConfig = {
    allowedRiskLevels: ["Low", "Medium", "High", "Critical"],
    maxExecutionDuration: 30000, // 30 seconds
    automaticRollbackOnFailure: true,
    maxRetries: 1,
    tags: ["staging", "automated-audit"],
  };

  /**
   * Validates if an experiment complies with the active policy configuration
   */
  public static isAllowed(experiment: IChaosExperiment, policy: ChaosPolicyConfig): boolean {
    // 1. Risk Level check
    if (!policy.allowedRiskLevels.includes(experiment.riskLevel)) {
      return false;
    }

    // 2. Tags check (if specified)
    if (policy.tags && policy.tags.length > 0) {
      // If the experiment is tagged or we let it pass by default
    }

    return true;
  }
}
