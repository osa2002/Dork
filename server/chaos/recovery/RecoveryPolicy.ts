export interface RecoveryPolicyConfig {
  /**
   * Enforce NODE_ENV check to prevent execution in production.
   */
  isProductionSafetyEnabled: boolean;

  /**
   * Enforce CHAOS_MODE check to verify chaos/recovery is permitted.
   */
  isChaosModeSafetyEnabled: boolean;

  /**
   * Minimum confidence score (0-100) required to execute autonomous recovery actions.
   */
  minConfidenceRequired: number;

  /**
   * Maximum allowed retries for recovery workflow steps.
   */
  maxRetryAttempts: number;

  /**
   * Wait time (in ms) between retry attempts.
   */
  retryDelayMs: number;

  /**
   * Individual workflow timeouts (in ms).
   */
  workflowTimeouts: Record<string, number>;

  /**
   * If true, require manual SRE operator approval when overall enterprise scores drop below a threshold.
   */
  requireManualApprovalForHighRisk: boolean;

  /**
   * The SRE score threshold under which an environment is considered high-risk (e.g. 50/100).
   */
  highRiskThresholdScore: number;

  /**
   * Maximum blast radius allowed to recover automatically. "Minimal" | "Low" | "Medium" | "High".
   */
  maxAllowedBlastRadius: "Minimal" | "Low" | "Medium" | "High";

  /**
   * Maximum unresolved incidents allowed before automatic recovery stops or escalates.
   */
  maxAllowedIncidents: number;

  /**
   * Safety SLO availability threshold (e.g., 99.0%). If lower, we may pause/escalate instead of other active recoveries.
   */
  sloAvailabilityThreshold: number;
}

export class RecoveryPolicy {
  private static currentPolicy: RecoveryPolicyConfig = {
    isProductionSafetyEnabled: true,
    isChaosModeSafetyEnabled: true,
    minConfidenceRequired: 70,
    maxRetryAttempts: 3,
    retryDelayMs: 100,
    workflowTimeouts: {
      "Rollback Workflow": 10000,
      "Pause Experiments": 5000,
      "Reduce Risk": 5000,
      "Open Incident": 4000,
      "Escalate": 4000,
      "Request Manual Approval": 4000,
      "Resume Operations": 5000,
      "No Action": 2000,
    },
    requireManualApprovalForHighRisk: true,
    highRiskThresholdScore: 50,
    maxAllowedBlastRadius: "High",
    maxAllowedIncidents: 5,
    sloAvailabilityThreshold: 95.0,
  };

  /**
   * Returns the current active recovery policy.
   */
  public static getPolicy(): RecoveryPolicyConfig {
    return { ...this.currentPolicy };
  }

  /**
   * Overrides policy rules dynamically.
   */
  public static updatePolicy(overrides: Partial<RecoveryPolicyConfig>) {
    this.currentPolicy = {
      ...this.currentPolicy,
      ...overrides,
      workflowTimeouts: {
        ...this.currentPolicy.workflowTimeouts,
        ...(overrides.workflowTimeouts || {}),
      },
    };
  }

  /**
   * Resets policy rules back to SRE standard defaults.
   */
  public static resetToDefault() {
    this.currentPolicy = {
      isProductionSafetyEnabled: true,
      isChaosModeSafetyEnabled: true,
      minConfidenceRequired: 70,
      maxRetryAttempts: 3,
      retryDelayMs: 100,
      workflowTimeouts: {
        "Rollback Workflow": 10000,
        "Pause Experiments": 5000,
        "Reduce Risk": 5000,
        "Open Incident": 4000,
        "Escalate": 4000,
        "Request Manual Approval": 4000,
        "Resume Operations": 5000,
        "No Action": 2000,
      },
      requireManualApprovalForHighRisk: true,
      highRiskThresholdScore: 50,
      maxAllowedBlastRadius: "High",
      maxAllowedIncidents: 5,
      sloAvailabilityThreshold: 95.0,
    };
  }
}
