export interface SreGovernancePolicyConfig {
  readonly id: string;
  readonly name: string;
  readonly minErrorBudgetRemaining: number; // e.g. 10%
  readonly minSloAvailability: number; // e.g. 99.0%
  readonly allowProductionChaos: boolean;
  readonly productionRequiresSreLead: boolean;
  readonly allowedMaintenanceHoursOnly: boolean; // if true, only allows chaos during UTC 02:00 - 05:00
  readonly maxAllowedLiveRiskScore: number; // e.g. 80
  readonly blockChaosOnSafetyGateActive: boolean;
  readonly allowedTeams: readonly string[];
}

export class GovernancePolicy {
  /**
   * Default SRE Governance Policy.
   * Leverages robust thresholds to safe-guard the system's uptime.
   */
  public static getDefaultPolicy(): SreGovernancePolicyConfig {
    return {
      id: "pol-sre-default",
      name: "Default Strict SRE Capacity Governance",
      minErrorBudgetRemaining: 20.0, // Fail if error budget goes under 20%
      minSloAvailability: 99.5, // Target SLO floor
      allowProductionChaos: true,
      productionRequiresSreLead: true, // Lead must authorize prod chaos
      allowedMaintenanceHoursOnly: false, // Permissive by default but strictly audited
      maxAllowedLiveRiskScore: 75, // Cap of 75 before block
      blockChaosOnSafetyGateActive: true,
      allowedTeams: ["Platform SRE", "Site Reliability Engineering", "Core Infra"],
    };
  }

  /**
   * Ultra Strict SRE Governance Policy.
   * Deployed under extreme platform pressure or during major commercial events.
   */
  public static getUltraStrictPolicy(): SreGovernancePolicyConfig {
    return {
      id: "pol-sre-strict",
      name: "Commercial Event Quiet Hours / Extreme Guard Policy",
      minErrorBudgetRemaining: 50.0,
      minSloAvailability: 99.9,
      allowProductionChaos: false, // Zero prod chaos allowed
      productionRequiresSreLead: true,
      allowedMaintenanceHoursOnly: true, // Only during UTC 02:00 - 05:00
      maxAllowedLiveRiskScore: 40,
      blockChaosOnSafetyGateActive: true,
      allowedTeams: ["Site Reliability Engineering"],
    };
  }
}
