import { ChangeRequestPayload } from "./ChangeRequest";
import { ChangeContextPayload } from "./ChangeContext";
import { ImpactAnalyzer } from "./ImpactAnalyzer";

export type ChangeRiskTier = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskEvaluationPayload {
  readonly riskScore: number; // 0-100
  readonly riskTier: ChangeRiskTier;
  readonly factors: {
    readonly classificationFactor: number;
    readonly blastRadiusFactor: number;
    readonly platformRiskFactor: number;
    readonly incidentFactor: number;
    readonly changeTypeFactor: number;
  };
  readonly riskStatements: readonly string[];
}

export class RiskEvaluator {
  /**
   * Evaluates change-specific and ambient system risk factors to output a unified risk score.
   */
  public static evaluate(
    request: ChangeRequestPayload,
    context: ChangeContextPayload
  ): RiskEvaluationPayload {
    // 1. Classification factor (20% weight)
    let classificationFactor = 20;
    if (request.classification === "EMERGENCY") classificationFactor = 100;
    else if (request.classification === "MAJOR") classificationFactor = 80;
    else if (request.classification === "MINOR") classificationFactor = 40;

    // 2. Blast radius factor (30% weight)
    const impact = ImpactAnalyzer.analyze(request, context);
    const blastRadiusFactor = impact.blastRadiusScore;

    // 3. Platform risk factor (20% weight)
    const platformRiskFactor = context.currentFailureProbabilityRisk;

    // 4. Incident / Recovery factor (20% weight)
    const incidentFactor = Math.min(100, (context.activeIncidentsCount * 40) + (context.activeRecoveriesCount * 30));

    // 5. Change type factor (10% weight)
    let changeTypeFactor = 20;
    if (request.changeType === "INFRASTRUCTURE") changeTypeFactor = 90;
    else if (request.changeType === "CHAOS_EXPERIMENT") changeTypeFactor = 80;
    else if (request.changeType === "CODE_DEPLOY") changeTypeFactor = 50;

    // Weighted risk aggregation (0-100)
    const riskScore = Math.round(
      (classificationFactor * 0.20) +
      (blastRadiusFactor * 0.30) +
      (platformRiskFactor * 0.20) +
      (incidentFactor * 0.20) +
      (changeTypeFactor * 0.10)
    );

    let riskTier: ChangeRiskTier = "LOW";
    if (riskScore >= 80) riskTier = "CRITICAL";
    else if (riskScore >= 60) riskTier = "HIGH";
    else if (riskScore >= 40) riskTier = "MEDIUM";

    const statements: string[] = [];
    if (request.classification === "EMERGENCY") {
      statements.push("Emergency change triggers instant high-risk categorization.");
    }
    if (blastRadiusFactor > 60) {
      statements.push(`High blast radius detected (${blastRadiusFactor}%) affecting multiple systems.`);
    }
    if (context.activeIncidentsCount > 0) {
      statements.push(`System has ${context.activeIncidentsCount} active unresolved incident(s). Co-location hazard.`);
    }
    if (platformRiskFactor > 50) {
      statements.push(`Ambient platform risk is elevated (${platformRiskFactor}% failure probability).`);
    }
    if (statements.length === 0) {
      statements.push("No severe risk multipliers detected. Change is standard SRE procedure.");
    }

    return Object.freeze({
      riskScore,
      riskTier,
      factors: {
        classificationFactor,
        blastRadiusFactor,
        platformRiskFactor,
        incidentFactor,
        changeTypeFactor,
      },
      riskStatements: statements,
    });
  }
}
