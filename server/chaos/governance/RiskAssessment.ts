import { GovernanceContextData } from "./GovernanceContext";

export type SreRiskTier = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskAssessmentPayload {
  readonly id: string;
  readonly timestamp: string;
  readonly riskScore: number; // 0-100
  readonly riskTier: SreRiskTier;
  readonly blastRadiusScore: number; // 0-100
  readonly breakdown: {
    readonly systemStateRisk: number; // based on current live risk score
    readonly experimentRisk: number; // based on estimated risk of target scenario
    readonly blastRadiusRisk: number; // based on affected subsystems
    readonly timeOfDayRisk: number; // peak vs off-peak hours
  };
  readonly recommendedSafeguards: readonly string[];
}

export class RiskAssessment {
  /**
   * Evaluates and quantifies pre-experiment SRE risk dynamically.
   */
  public static assess(context: GovernanceContextData): RiskAssessmentPayload {
    const id = `rsk-${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();

    // 1. System State Risk (40% weight)
    const systemStateRisk = context.liveRiskScore;

    // 2. Experiment Risk (30% weight)
    let experimentRisk = 10;
    switch (context.targetExperiment.estimatedRisk) {
      case "LOW":
        experimentRisk = 20;
        break;
      case "MEDIUM":
        experimentRisk = 50;
        break;
      case "HIGH":
        experimentRisk = 80;
        break;
      case "CRITICAL":
        experimentRisk = 100;
        break;
    }

    // 3. Blast Radius Risk (15% weight)
    const affectedCount = context.targetExperiment.affectedSubsystems.length;
    const blastRadiusScore = Math.min(100, affectedCount * 25);
    const blastRadiusRisk = blastRadiusScore;

    // 4. Time of Day Risk (15% weight)
    // Peak hours (e.g. 09:00 - 17:00 UTC) are riskier; quiet hours are safer
    const currentHour = context.currentHour;
    const isPeakHour = currentHour >= 9 && currentHour <= 17;
    const timeOfDayRisk = isPeakHour ? 80 : 20;

    // Compute aggregated weighted risk score (0-100)
    const riskScore = Math.round(
      (systemStateRisk * 0.4) +
      (experimentRisk * 0.3) +
      (blastRadiusRisk * 0.15) +
      (timeOfDayRisk * 0.15)
    );

    // Map to Risk Tier
    let riskTier: SreRiskTier = "LOW";
    if (riskScore >= 80) riskTier = "CRITICAL";
    else if (riskScore >= 60) riskTier = "HIGH";
    else if (riskScore >= 40) riskTier = "MEDIUM";

    // Dynamic safeguard recommendations
    const safeguards: string[] = [
      "Ensure automatic rollback is enabled in ChaosOrchestrator config.",
      `Limit execution window duration to maximum 10 minutes.`,
    ];

    if (riskTier === "CRITICAL" || riskTier === "HIGH") {
      safeguards.push(
        "Require SRE Lead or SRE Director presence during execution.",
        "Establish an active, separate monitoring bridge prior to launch.",
        "Ensure real production transactions are canary-routed with 10% traffic ceilings."
      );
    } else {
      safeguards.push("Perform automated continuous validation checks before cleanup.");
    }

    return {
      id,
      timestamp,
      riskScore,
      riskTier,
      blastRadiusScore,
      breakdown: {
        systemStateRisk,
        experimentRisk,
        blastRadiusRisk,
        timeOfDayRisk,
      },
      recommendedSafeguards: safeguards,
    };
  }
}
