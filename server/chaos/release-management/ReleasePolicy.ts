export interface ReleasePolicyConfig {
  readonly id: string;
  readonly name: string;
  readonly minErrorBudgetForRelease: number; // e.g. 20.0
  readonly maxFailureProbabilityAllowed: number; // e.g. 50 (above this risk level, releases are blocked)
  readonly blockOnActiveOutages: boolean;
  readonly emergencyRequiresLead: boolean;
  readonly releaseFreezeWindows: readonly number[]; // Block releases during busy hours (e.g. 9-17 UTC)
  readonly requiresRollbackPlan: boolean;
  readonly requiresFeatureFlagValidation: boolean;
  readonly minReadinessScore: number; // minimum readinessScore required (e.g. 80)
}

export class ReleasePolicy {
  /**
   * Enterprise-level strict production SRE release safety policy.
   */
  public static getStandardPolicy(): ReleasePolicyConfig {
    return {
      id: "rel-pol-standard",
      name: "Standard Enterprise SRE Release Safety Policy",
      minErrorBudgetForRelease: 20.0,
      maxFailureProbabilityAllowed: 55,
      blockOnActiveOutages: true,
      emergencyRequiresLead: true,
      releaseFreezeWindows: [9, 10, 11, 12, 13, 14, 15, 16], // Busy business hours (peak traffic)
      requiresRollbackPlan: true,
      requiresFeatureFlagValidation: true,
      minReadinessScore: 80,
    };
  }

  /**
   * Permissive sandbox policy for development, QA, and local environments.
   */
  public static getPermissivePolicy(): ReleasePolicyConfig {
    return {
      id: "rel-pol-permissive",
      name: "Permissive Sandbox Release Policy",
      minErrorBudgetForRelease: 0.0,
      maxFailureProbabilityAllowed: 95,
      blockOnActiveOutages: false,
      emergencyRequiresLead: false,
      releaseFreezeWindows: [],
      requiresRollbackPlan: false,
      requiresFeatureFlagValidation: false,
      minReadinessScore: 0,
    };
  }
}
