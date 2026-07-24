import { ChaosState } from "../ChaosState";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

export type HealthStatus = "HEALTHY" | "DEGRADED" | "PARTIAL_OUTAGE" | "UNAVAILABLE";

export interface ChaosHealthDetails {
  status: HealthStatus;
  reason: string;
  activeScenarios: string[];
  latencyAddedMs: number;
  injectionProbability: number;
  impactScore: number; // 0 - 100%
}

export class ChaosHealthContributor {
  private static lastStatus: HealthStatus = "HEALTHY";

  /**
   * Evaluates and returns the precise system health status as affected by active chaos injections.
   */
  public static getHealthStatus(): ChaosHealthDetails {
    if (!ChaosState.getIsEnabled()) {
      const currentDetails: ChaosHealthDetails = {
        status: "HEALTHY",
        reason: "Chaos mode is currently disabled. No failure models are actively impacting the system.",
        activeScenarios: [],
        latencyAddedMs: 0,
        injectionProbability: 0,
        impactScore: 0,
      };

      if (this.lastStatus !== "HEALTHY") {
        const prev = this.lastStatus;
        this.lastStatus = "HEALTHY";
        EnterpriseEventBus.publish("HealthChanged", {
          previousStatus: prev,
          currentStatus: "HEALTHY",
          impactScore: 0,
        });
      }

      return currentDetails;
    }

    const activeScenarios = ChaosState.getActiveScenarios();
    const latencyAddedMs = ChaosState.getLatency();
    const injectionProbability = ChaosState.getProbability();

    // Core heuristic categorization
    let highestImpact: HealthStatus = "HEALTHY";
    let impactScore = 0;
    let reason = "Chaos injection is active under nominal thresholds.";

    if (activeScenarios.length > 0) {
      for (const s of activeScenarios) {
        const scenarioLower = s.toLowerCase();

        // 1. Critical Level (UNAVAILABLE / Core database blackout)
        if (
          scenarioLower.includes("blackout") ||
          scenarioLower.includes("partition") ||
          scenarioLower.includes("kill") ||
          scenarioLower.includes("unavailability")
        ) {
          highestImpact = "UNAVAILABLE";
          impactScore = Math.max(impactScore, 95);
          reason = `System is UNAVAILABLE due to critical active infrastructure chaos scenario: ${s}`;
        }
        // 2. High Level (PARTIAL_OUTAGE / Crucial dependency cut)
        else if (
          scenarioLower.includes("stripe") ||
          scenarioLower.includes("gemini") ||
          scenarioLower.includes("twilio") ||
          scenarioLower.includes("timeout") ||
          scenarioLower.includes("contention") ||
          scenarioLower.includes("transaction") ||
          scenarioLower.includes("cleanup")
        ) {
          if (highestImpact !== "UNAVAILABLE") {
            highestImpact = "PARTIAL_OUTAGE";
          }
          impactScore = Math.max(impactScore, 65);
          reason = `System is experiencing a PARTIAL_OUTAGE of external dependencies under active scenario: ${s}`;
        }
        // 3. Medium Level (DEGRADED / High CPU, latency, delays)
        else if (
          scenarioLower.includes("latency") ||
          scenarioLower.includes("delay") ||
          scenarioLower.includes("pressure") ||
          scenarioLower.includes("scheduler") ||
          scenarioLower.includes("loop") ||
          scenarioLower.includes("limit")
        ) {
          if (highestImpact !== "UNAVAILABLE" && highestImpact !== "PARTIAL_OUTAGE") {
            highestImpact = "DEGRADED";
          }
          impactScore = Math.max(impactScore, 35);
          reason = `System performance is DEGRADED under latency/resource pressure scenario: ${s}`;
        }
      }
    } else if (latencyAddedMs > 0) {
      // Latency only active
      highestImpact = "DEGRADED";
      impactScore = latencyAddedMs > 2000 ? 50 : 25;
      reason = `System response is DEGRADED due to global latency addition of ${latencyAddedMs}ms.`;
    }

    // Adjust impact score based on probability
    impactScore = Math.round(impactScore * injectionProbability);

    if (this.lastStatus !== highestImpact) {
      const prev = this.lastStatus;
      this.lastStatus = highestImpact;
      EnterpriseEventBus.publish("HealthChanged", {
        previousStatus: prev,
        currentStatus: highestImpact,
        impactScore,
      });
    }

    return {
      status: highestImpact,
      reason,
      activeScenarios,
      latencyAddedMs,
      injectionProbability,
      impactScore,
    };
  }
}
