import { RiskEvaluationFactors } from "../value-objects/FinancialValueObjects";

export type FraudDecision = "ALLOW" | "REQUIRE_3DS2" | "FLAG_MANUAL_REVIEW" | "BLOCK_TRANSACTION";

export interface RiskEvaluationResult {
  score: number; // 0 to 100
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  decision: FraudDecision;
  reasons: string[];
  evaluatedAtIso: string;
}

export class FraudDetectionEngine {
  public evaluateRisk(factors: RiskEvaluationFactors): RiskEvaluationResult {
    let score = 0;
    const reasons: string[] = [];

    // 1. Velocity check
    if (factors.velocity24hCount > 10) {
      score += 40;
      reasons.push(`Extreme 24h card velocity: ${factors.velocity24hCount} authorization attempts.`);
    } else if (factors.velocity24hCount > 5) {
      score += 20;
      reasons.push(`High 24h velocity: ${factors.velocity24hCount} authorization attempts.`);
    }

    // 2. GeoIP vs Card Issuer Country mismatch
    if (factors.ipCountryCode && factors.cardCountryCode && factors.ipCountryCode !== factors.cardCountryCode) {
      score += 25;
      reasons.push(`Geo Mismatch: IP Country (${factors.ipCountryCode}) differs from Card Country (${factors.cardCountryCode}).`);
    }

    // 3. Chargeback / Dispute History
    if (factors.chargebackHistoryCount > 0) {
      score += 35;
      reasons.push(`Historical dispute flag: ${factors.chargebackHistoryCount} past chargebacks recorded.`);
    }

    // 4. Device Fingerprint Risk
    if (factors.deviceFingerprintRisk > 50) {
      const weight = Math.round(factors.deviceFingerprintRisk * 0.3);
      score += weight;
      reasons.push(`Suspicious device fingerprint score: ${factors.deviceFingerprintRisk}`);
    }

    // 5. Email Domain Reputation
    if (factors.emailDomainReputation === "DISPOSABLE") {
      score += 30;
      reasons.push("Disposable/temporary email domain detected.");
    } else if (factors.emailDomainReputation === "SUSPICIOUS") {
      score += 15;
      reasons.push("Suspicious email domain pattern.");
    }

    // Bound score
    const finalScore = Math.min(100, Math.max(0, score));

    let level: RiskEvaluationResult["level"] = "LOW";
    let decision: FraudDecision = "ALLOW";

    if (finalScore >= 80) {
      level = "CRITICAL";
      decision = "BLOCK_TRANSACTION";
    } else if (finalScore >= 55) {
      level = "HIGH";
      decision = "FLAG_MANUAL_REVIEW";
    } else if (finalScore >= 30) {
      level = "MEDIUM";
      decision = "REQUIRE_3DS2";
    }

    return {
      score: finalScore,
      level,
      decision,
      reasons,
      evaluatedAtIso: new Date().toISOString()
    };
  }
}
