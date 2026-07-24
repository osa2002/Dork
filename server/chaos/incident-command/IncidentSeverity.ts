import { IncidentDefinitionPayload } from "./IncidentDefinition";
import { IncidentContextPayload } from "./IncidentContext";

export type IncidentSeverityLevel = "SEV1" | "SEV2" | "SEV3" | "SEV4";

export interface IncidentSeverityTriage {
  readonly level: IncidentSeverityLevel;
  readonly confidence: number;
  readonly triggers: readonly string[];
  readonly description: string;
}

export class IncidentSeverity {
  /**
   * Evaluates the definition & context to classify severity levels.
   */
  public static classify(
    definition: IncidentDefinitionPayload,
    context: IncidentContextPayload
  ): IncidentSeverityTriage {
    const triggers: string[] = [];
    let level: IncidentSeverityLevel = "SEV4";
    let confidence = 0.95;

    const errorRate = definition.metricsSnapshot?.errorRate ?? 0;
    const latency = definition.metricsSnapshot?.p99LatencyMs ?? 0;
    
    // Evaluate metrics snapshot
    if (errorRate >= 0.10) {
      triggers.push(`Critical error rate detected: ${(errorRate * 100).toFixed(1)}% (>= 10.0%)`);
      level = "SEV1";
    } else if (errorRate >= 0.04) {
      triggers.push(`High error rate detected: ${(errorRate * 100).toFixed(1)}% (>= 4.0%)`);
      level = "SEV2";
    } else if (errorRate >= 0.01) {
      triggers.push(`Elevated error rate detected: ${(errorRate * 100).toFixed(1)}% (>= 1.0%)`);
      level = "SEV3";
    }

    if (latency >= 1000) {
      triggers.push(`Critical P99 latency registered: ${latency}ms (>= 1000ms)`);
      if (level !== "SEV1") level = "SEV1";
    } else if (latency >= 500) {
      triggers.push(`High P99 latency registered: ${latency}ms (>= 500ms)`);
      if (level !== "SEV1" && level !== "SEV2") level = "SEV2";
    } else if (latency >= 200) {
      triggers.push(`Elevated P99 latency registered: ${latency}ms (>= 200ms)`);
      if (level === "SEV4") level = "SEV3";
    }

    // Check affected subsystems against digital twin layout
    const affected = definition.affectedSubsystems;
    if (affected.some(s => s.toLowerCase().includes("gateway") || s.toLowerCase().includes("core") || s.toLowerCase().includes("auth"))) {
      triggers.push(`Core architecture / ingress gateway subsystem impacted: ${affected.join(", ")}`);
      if (level === "SEV3" || level === "SEV4") {
        level = "SEV2"; // Upgrade to major
      }
    }

    // Check if the prediction service flags high risk of system failure
    if (context.failureProbabilityPrediction.riskScore > 80) {
      triggers.push(`Prediction Engine registers dangerous system failure probability: ${context.failureProbabilityPrediction.riskScore}%`);
      if (level === "SEV2") {
        level = "SEV1"; // Upgrade to Critical SRE Crisis
        confidence = 0.88; // Slightly lower confidence because of predictive dependency
      }
    }

    // Check recent validation failures
    const recentFailures = context.recentValidationRuns.filter(r => r.failedCount > 0);
    if (recentFailures.length >= 2) {
      triggers.push(`Multiple recent continuous validation failures detected: ${recentFailures.length} runs failed`);
      if (level === "SEV4") level = "SEV3";
    }

    let description = "Trivial incident with zero business or customer impact. Monitor for changes.";
    if (level === "SEV1") {
      description = "CRITICAL SEVERITY: Extreme business threat, complete service blackout, or high security breach. Requires instant executive page out.";
    } else if (level === "SEV2") {
      description = "MAJOR SEVERITY: Key systems degraded, degraded latency/error rate, or partial checkout/SLA failure. Active response recommended.";
    } else if (level === "SEV3") {
      description = "MINOR SEVERITY: Isolated service degradation with acceptable workarounds. Track via normal support channels.";
    }

    return Object.freeze({
      level,
      confidence,
      triggers: Object.freeze(triggers),
      description,
    });
  }
}
