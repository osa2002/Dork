import { ReleaseStrategyType, ReleaseDefinitionPayload } from "./ReleaseDefinition";
import { ReleaseContextPayload } from "./ReleaseContext";

export interface StrategyDetail {
  readonly strategy: ReleaseStrategyType;
  readonly confidenceScore: number; // 0-100
  readonly suitabilityIndex: "HIGH" | "MEDIUM" | "LOW";
  readonly justifications: readonly string[];
  readonly rolloutPhases: readonly {
    readonly phaseName: string;
    readonly trafficPercentage: number;
    readonly durationSeconds: number;
    readonly safetyGates: readonly string[];
  }[];
}

export interface StrategyRecommendationPayload {
  readonly recommendedStrategy: ReleaseStrategyType;
  readonly confidenceScore: number;
  readonly options: readonly StrategyDetail[];
  readonly justification: string;
}

export class ReleaseStrategy {
  /**
   * Evaluates the optimal deployment strategy based on the release complexity, targets, and ambient SRE risk.
   */
  public static recommend(
    definition: ReleaseDefinitionPayload,
    context: ReleaseContextPayload
  ): StrategyRecommendationPayload {
    const isCriticalSubsystem = definition.targetSubsystems.some(
      (sub) => sub === "Firestore" || sub === "ExpressServer" || sub === "StripeAPI"
    );
    const failureRisk = context.failureProbabilityPrediction?.riskScore ?? 10;
    const isHighComplexity = definition.complexity === "HIGH";

    const options: StrategyDetail[] = [];

    // 1. Canary Strategy Suitability
    const canaryJustifications: string[] = [];
    let canaryScore = 50;
    if (isHighComplexity) {
      canaryScore += 30;
      canaryJustifications.push("Canary isolates high complexity updates to fractional traffic slices first.");
    }
    if (isCriticalSubsystem) {
      canaryScore += 20;
      canaryJustifications.push("Mitigates direct blast radius impact on core critical subsystems.");
    }
    if (failureRisk > 40) {
      canaryScore += 10;
      canaryJustifications.push(`Elevated failure probability risk (${failureRisk}%) recommends gradual canary exposure.`);
    }
    if (definition.featureFlags.length > 0) {
      canaryScore += 10;
      canaryJustifications.push("Pairs perfectly with incremental feature flag activation.");
    }
    options.push({
      strategy: "CANARY",
      confidenceScore: Math.min(100, canaryScore),
      suitabilityIndex: canaryScore >= 80 ? "HIGH" : canaryScore >= 50 ? "MEDIUM" : "LOW",
      justifications: canaryJustifications,
      rolloutPhases: [
        { phaseName: "Canary Bake Stage", trafficPercentage: 5, durationSeconds: 60, safetyGates: ["p99_latency_check", "http_error_rate_gate"] },
        { phaseName: "Canary Expansion", trafficPercentage: 25, durationSeconds: 120, safetyGates: ["validation_suite_assert"] },
        { phaseName: "Canary Half-Capacity", trafficPercentage: 50, durationSeconds: 120, safetyGates: ["prediction_drift_assert"] },
        { phaseName: "Canary Final Promotion", trafficPercentage: 100, durationSeconds: 60, safetyGates: ["active_alerts_check"] },
      ],
    });

    // 2. Blue/Green Strategy Suitability
    const bgJustifications: string[] = [];
    let bgScore = 40;
    if (definition.targetSubsystems.includes("Firestore")) {
      bgScore += 40;
      bgJustifications.push("Blue/Green ensures zero database state inconsistency via warm standbys.");
    }
    if (definition.complexity === "MEDIUM") {
      bgScore += 20;
      bgJustifications.push("Provides instant rollback capability for standard complexity profiles.");
    }
    options.push({
      strategy: "BLUE_GREEN",
      confidenceScore: Math.min(100, bgScore),
      suitabilityIndex: bgScore >= 80 ? "HIGH" : bgScore >= 50 ? "MEDIUM" : "LOW",
      justifications: bgJustifications,
      rolloutPhases: [
        { phaseName: "Deploy Green Target", trafficPercentage: 0, durationSeconds: 120, safetyGates: ["smoke_test_suite"] },
        { phaseName: "Flip Traffic Route", trafficPercentage: 100, durationSeconds: 30, safetyGates: ["continuous_validation_assert"] },
        { phaseName: "Standby Blue Monitor", trafficPercentage: 0, durationSeconds: 180, safetyGates: ["standby_health_check"] },
      ],
    });

    // 3. Rolling Strategy Suitability
    const rollingJustifications: string[] = [];
    let rollingScore = 30;
    if (definition.complexity === "LOW" && !isCriticalSubsystem) {
      rollingScore += 50;
      rollingJustifications.push("Simple rolling replacement is fast, cost-effective, and highly suitable for low-complexity packages.");
    } else {
      rollingJustifications.push("Rolling has limited rollback isolation granularity under high system complexity.");
    }
    options.push({
      strategy: "ROLLING",
      confidenceScore: Math.min(100, rollingScore),
      suitabilityIndex: rollingScore >= 80 ? "HIGH" : rollingScore >= 50 ? "MEDIUM" : "LOW",
      justifications: rollingJustifications,
      rolloutPhases: [
        { phaseName: "Rolling Batch 1", trafficPercentage: 33, durationSeconds: 60, safetyGates: ["container_startup_probe"] },
        { phaseName: "Rolling Batch 2", trafficPercentage: 66, durationSeconds: 60, safetyGates: ["container_startup_probe"] },
        { phaseName: "Rolling Batch 3", trafficPercentage: 100, durationSeconds: 60, safetyGates: ["validation_baseline_check"] },
      ],
    });

    // 4. Progressive Strategy Suitability
    const progJustifications: string[] = [];
    let progScore = 40;
    if (definition.complexity === "HIGH" && definition.featureFlags.length > 2) {
      progScore += 50;
      progJustifications.push("Progressive delivery with deep feature-flag targeting mitigates multi-tenant exposure hazards.");
    } else if (isHighComplexity) {
      progScore += 35;
      progJustifications.push("Enables long-duration baking across progressive subsystem tiers.");
    }
    options.push({
      strategy: "PROGRESSIVE",
      confidenceScore: Math.min(100, progScore),
      suitabilityIndex: progScore >= 80 ? "HIGH" : progScore >= 50 ? "MEDIUM" : "LOW",
      justifications: progJustifications,
      rolloutPhases: [
        { phaseName: "Alpha Stage", trafficPercentage: 10, durationSeconds: 180, safetyGates: ["compliance_gate", "ff_drift_check"] },
        { phaseName: "Beta Stage", trafficPercentage: 40, durationSeconds: 240, safetyGates: ["user_telemetry_gate"] },
        { phaseName: "Regional Rollout", trafficPercentage: 80, durationSeconds: 240, safetyGates: ["latency_profile_gate"] },
        { phaseName: "Full Scale", trafficPercentage: 100, durationSeconds: 120, safetyGates: ["continuous_validation_assert"] },
      ],
    });

    // Find the option with the highest confidence score
    const recommended = options.reduce((best, cur) => (cur.confidenceScore > best.confidenceScore ? cur : best), options[0]);

    const reasons = [
      `Recommended strategy is "${recommended.strategy}" with confidence ${recommended.confidenceScore}%.`,
      ...recommended.justifications,
    ];

    return Object.freeze({
      recommendedStrategy: recommended.strategy,
      confidenceScore: recommended.confidenceScore,
      options: Object.freeze(options),
      justification: reasons.join(" "),
    });
  }
}
