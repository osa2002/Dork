export interface ChangePolicyConfig {
  readonly id: string;
  readonly name: string;
  readonly minErrorBudgetForChange: number; // e.g. 20.0%
  readonly maxRiskScoreAllowed: number; // e.g. 75
  readonly blockOnActiveOutages: boolean;
  readonly emergencyRequiresLead: boolean;
  readonly restrictionWindows: readonly number[]; // Peak hour values
  readonly requiresRollbackPlan: boolean;
}

export class ChangePolicy {
  /**
   * Default production-grade enterprise SRE change safety policy.
   */
  public static getStandardPolicy(): ChangePolicyConfig {
    return {
      id: "chg-pol-standard",
      name: "Standard Enterprise SRE Change Safety Policy",
      minErrorBudgetForChange: 20.0,
      maxRiskScoreAllowed: 75,
      blockOnActiveOutages: true,
      emergencyRequiresLead: true,
      restrictionWindows: [9, 10, 11, 12, 13, 14, 15, 16, 17], // Busy business hours (peak transactions)
      requiresRollbackPlan: true,
    };
  }

  /**
   * Safe non-production policy for sandbox and local testing.
   */
  public static getPermissivePolicy(): ChangePolicyConfig {
    return {
      id: "chg-pol-permissive",
      name: "Permissive Sandbox SRE Policy",
      minErrorBudgetForChange: 0.0,
      maxRiskScoreAllowed: 95,
      blockOnActiveOutages: false,
      emergencyRequiresLead: false,
      restrictionWindows: [],
      requiresRollbackPlan: false,
    };
  }
}
