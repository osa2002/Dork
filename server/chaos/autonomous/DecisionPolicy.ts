export interface DecisionPolicyConfig {
  unacceptableHealthStates: ("HEALTHY" | "DEGRADED" | "PARTIAL_OUTAGE" | "UNAVAILABLE")[];
  minReliabilityScore: number;
  minResilienceScore: number;
  minRecoverabilityScore: number;
  minObservabilityScore: number;
  minOperationalReadiness: number;
  minOverallEnterpriseScore: number;
  sloAvailabilityThreshold: number; // e.g., 99.9
  errorBudgetConsumedThreshold: number; // e.g., 10 (percentage)
  maxAllowedMttrMs: number; // e.g., 3000
  recentFailedRecoveriesAllowed: number; // e.g., 0
  regressionImpactAllowed: number; // e.g., 10 (deducted points)
  confidenceThreshold: number; // e.g., 80
  maxIncidentCount: number; // e.g., 1
  maxHistorySize: number; // e.g., 100
}

export class DecisionPolicy {
  private static currentPolicy: DecisionPolicyConfig = {
    unacceptableHealthStates: ["PARTIAL_OUTAGE", "UNAVAILABLE"],
    minReliabilityScore: 80,
    minResilienceScore: 70,
    minRecoverabilityScore: 75,
    minObservabilityScore: 60,
    minOperationalReadiness: 70,
    minOverallEnterpriseScore: 75,
    sloAvailabilityThreshold: 99.9,
    errorBudgetConsumedThreshold: 10,
    maxAllowedMttrMs: 3000,
    recentFailedRecoveriesAllowed: 0,
    regressionImpactAllowed: 10,
    confidenceThreshold: 80,
    maxIncidentCount: 1,
    maxHistorySize: 100,
  };

  /**
   * Retrieves the current active decision policy configuration.
   */
  public static getPolicy(): DecisionPolicyConfig {
    return { ...this.currentPolicy };
  }

  /**
   * Updates the decision policy configuration.
   */
  public static updatePolicy(newPolicy: Partial<DecisionPolicyConfig>): void {
    this.currentPolicy = {
      ...this.currentPolicy,
      ...newPolicy,
    };
  }

  /**
   * Resets the policy to default configurations.
   */
  public static resetToDefault(): void {
    this.currentPolicy = {
      unacceptableHealthStates: ["PARTIAL_OUTAGE", "UNAVAILABLE"],
      minReliabilityScore: 80,
      minResilienceScore: 70,
      minRecoverabilityScore: 75,
      minObservabilityScore: 60,
      minOperationalReadiness: 70,
      minOverallEnterpriseScore: 75,
      sloAvailabilityThreshold: 99.9,
      errorBudgetConsumedThreshold: 10,
      maxAllowedMttrMs: 3000,
      recentFailedRecoveriesAllowed: 0,
      regressionImpactAllowed: 10,
      confidenceThreshold: 80,
      maxIncidentCount: 1,
      maxHistorySize: 100,
    };
  }
}
