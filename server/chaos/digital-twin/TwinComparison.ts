import { TwinState } from "./TwinState";

export interface TwinDeltaReport {
  timestamp: string;
  riskDelta: {
    beforeRisk: string;
    afterRisk: string;
    isRiskIncreased: boolean;
  };
  recoveryDelta: {
    expectedRecoveryTimeMs: number;
    recoveryAction: string;
  };
  availabilityDelta: {
    beforePercent: number;
    afterPercent: number;
    deltaPercent: number;
  };
  latencyDelta: {
    beforeP95Ms: number;
    afterP95Ms: number;
    deltaMs: number;
  };
  errorBudgetDelta: {
    beforePercent: number;
    afterPercent: number;
    deltaPercent: number;
  };
  dependencyDelta: {
    failedNodesCount: number;
    failingEdgesCount: number;
  };
  enterpriseScoreDelta: {
    beforeScore: number;
    afterScore: number;
    deltaScore: number;
    beforeGrade: string;
    afterGrade: string;
  };
}

export class TwinComparison {
  /**
   * Performs deep delta evaluation between two twin states.
   */
  public static compare(beforeState: TwinState, afterState: TwinState): TwinDeltaReport {
    const before = beforeState.getData();
    const after = afterState.getData();

    const beforeAvailability = before.slo.availability.actual;
    const afterAvailability = after.slo.availability.actual;
    const availabilityDelta = Number((afterAvailability - beforeAvailability).toFixed(3));

    const beforeLatency = before.slo.latency.actualP95Ms;
    const afterLatency = after.slo.latency.actualP95Ms;
    const latencyDelta = afterLatency - beforeLatency;

    const beforeEB = before.slo.availability.errorBudgetRemaining;
    const afterEB = after.slo.availability.errorBudgetRemaining;
    const ebDelta = Number((afterEB - beforeEB).toFixed(2));

    const failedNodesCount = after.dependencyGraph.nodes.filter(n => n.status !== "HEALTHY").length;
    const failingEdgesCount = after.dependencyGraph.edges.filter(e => e.status !== "normal").length;

    const beforeReliability = before.governance.scores.overallEnterpriseScore;
    const afterReliability = after.governance.scores.overallEnterpriseScore;
    const scoreDelta = afterReliability - beforeReliability;

    const beforeRisk = beforeReliability > 85 ? "Low" : beforeReliability > 50 ? "Medium" : "High";
    const afterRisk = afterReliability > 85 ? "Low" : afterReliability > 50 ? "Medium" : "High";

    return {
      timestamp: new Date().toISOString(),
      riskDelta: {
        beforeRisk,
        afterRisk,
        isRiskIncreased: afterReliability < beforeReliability,
      },
      recoveryDelta: {
        expectedRecoveryTimeMs: after.health.latencyAddedMs > 1000 ? 5000 : 1200,
        recoveryAction: after.health.status === "UNAVAILABLE" ? "Failover Orchestrator Autonomous Re-routing" : "Self-Healing Fallback Workflow",
      },
      availabilityDelta: {
        beforePercent: beforeAvailability,
        afterPercent: afterAvailability,
        deltaPercent: availabilityDelta,
      },
      latencyDelta: {
        beforeP95Ms: beforeLatency,
        afterP95Ms: afterLatency,
        deltaMs: latencyDelta,
      },
      errorBudgetDelta: {
        beforePercent: beforeEB,
        afterPercent: afterEB,
        deltaPercent: ebDelta,
      },
      dependencyDelta: {
        failedNodesCount,
        failingEdgesCount,
      },
      enterpriseScoreDelta: {
        beforeScore: beforeReliability,
        afterScore: afterReliability,
        deltaScore: scoreDelta,
        beforeGrade: before.governance.scores.letterGrade,
        afterGrade: after.governance.scores.letterGrade,
      },
    };
  }
}
