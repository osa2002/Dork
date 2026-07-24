import { KnowledgeRecord } from "./KnowledgeRecord";

export interface FailureFrequency {
  readonly experimentId: string;
  readonly count: number;
  readonly statusList: readonly string[];
}

export interface DependencyImpact {
  readonly nodeId: string;
  readonly count: number;
  readonly impactSum: number;
}

export interface WorkflowFrequency {
  readonly workflow: string;
  readonly count: number;
  readonly successRate: number;
}

export interface RollbackPerformance {
  readonly avgDurationMs: number;
  readonly totalRollbacks: number;
  readonly successRate: number;
}

export interface IncidentChain {
  readonly incidentId: string;
  readonly experimentIds: readonly string[];
  readonly workflows: readonly string[];
}

export interface CorrelationReport {
  readonly repeatedFailures: readonly FailureFrequency[];
  readonly repeatedDependencies: readonly DependencyImpact[];
  readonly repeatedWorkflows: readonly WorkflowFrequency[];
  readonly rollbackPatterns: RollbackPerformance;
  readonly mttrTrend: "improving" | "stable" | "degrading" | "unknown";
  readonly incidentChains: readonly IncidentChain[];
}

export class KnowledgeCorrelation {
  /**
   * Evaluates historical records to locate systemic correlations, bottlenecks, SRE performance
   * trends, and repeated failure cascades.
   */
  public static analyze(records: readonly KnowledgeRecord[]): CorrelationReport {
    if (!records || records.length === 0) {
      return {
        repeatedFailures: [],
        repeatedDependencies: [],
        repeatedWorkflows: [],
        rollbackPatterns: { avgDurationMs: 0, totalRollbacks: 0, successRate: 100 },
        mttrTrend: "unknown",
        incidentChains: [],
      };
    }

    // 1. Repeated Failures
    const failureGroups: Record<string, { count: number; statusList: string[] }> = {};
    for (const r of records) {
      if (!failureGroups[r.experimentId]) {
        failureGroups[r.experimentId] = { count: 0, statusList: [] };
      }
      failureGroups[r.experimentId].count += 1;
      failureGroups[r.experimentId].statusList.push(r.status);
    }
    const repeatedFailures: FailureFrequency[] = Object.keys(failureGroups).map((experimentId) => ({
      experimentId,
      count: failureGroups[experimentId].count,
      statusList: Object.freeze(failureGroups[experimentId].statusList),
    }));

    // 2. Repeated Dependencies
    const depGroups: Record<string, { count: number; impactSum: number }> = {};
    for (const r of records) {
      if (r.dependencyGraphSnapshot?.nodes) {
        for (const node of r.dependencyGraphSnapshot.nodes) {
          if (!depGroups[node.id]) {
            depGroups[node.id] = { count: 0, impactSum: 0 };
          }
          depGroups[node.id].count += 1;
          depGroups[node.id].impactSum += r.impact;
        }
      }
    }
    const repeatedDependencies: DependencyImpact[] = Object.keys(depGroups).map((nodeId) => ({
      nodeId,
      count: depGroups[nodeId].count,
      impactSum: depGroups[nodeId].impactSum,
    }));

    // 3. Repeated Workflows
    const workflowGroups: Record<string, { count: number; successes: number }> = {};
    for (const r of records) {
      if (r.workflow) {
        if (!workflowGroups[r.workflow]) {
          workflowGroups[r.workflow] = { count: 0, successes: 0 };
        }
        workflowGroups[r.workflow].count += 1;
        if (r.status === "SUCCESS") {
          workflowGroups[r.workflow].successes += 1;
        }
      }
    }
    const repeatedWorkflows: WorkflowFrequency[] = Object.keys(workflowGroups).map((workflow) => {
      const { count, successes } = workflowGroups[workflow];
      return {
        workflow,
        count,
        successRate: count > 0 ? (successes / count) * 100 : 100,
      };
    });

    // 4. Rollback Patterns
    const rollbacks = records.filter((r) => r.rollback.occurred);
    let totalRollbackDuration = 0;
    let successfulRollbacks = 0;
    for (const r of rollbacks) {
      totalRollbackDuration += r.rollback.durationMs;
      if (r.rollback.success) {
        successfulRollbacks += 1;
      }
    }
    const rollbackPatterns: RollbackPerformance = {
      avgDurationMs: rollbacks.length > 0 ? totalRollbackDuration / rollbacks.length : 0,
      totalRollbacks: rollbacks.length,
      successRate: rollbacks.length > 0 ? (successfulRollbacks / rollbacks.length) * 100 : 100,
    };

    // 5. MTTR Trends (Chronologically sorted, oldest to newest)
    const chronologicalRecords = [...records].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const mttrSequence = chronologicalRecords.map((r) => r.MTTR).filter((m) => m > 0);

    let mttrTrend: "improving" | "stable" | "degrading" | "unknown" = "unknown";
    if (mttrSequence.length >= 2) {
      let increases = 0;
      let decreases = 0;
      for (let i = 1; i < mttrSequence.length; i++) {
        if (mttrSequence[i] > mttrSequence[i - 1]) {
          increases += 1;
        } else if (mttrSequence[i] < mttrSequence[i - 1]) {
          decreases += 1;
        }
      }
      if (increases > decreases) {
        mttrTrend = "degrading";
      } else if (decreases > increases) {
        mttrTrend = "improving";
      } else {
        mttrTrend = "stable";
      }
    } else if (mttrSequence.length === 1) {
      mttrTrend = "stable";
    }

    // 6. Incident Chains
    const incidentGroups: Record<string, { experimentIds: Set<string>; workflows: Set<string> }> = {};
    for (const r of records) {
      if (r.incidentId) {
        if (!incidentGroups[r.incidentId]) {
          incidentGroups[r.incidentId] = {
            experimentIds: new Set<string>(),
            workflows: new Set<string>(),
          };
        }
        incidentGroups[r.incidentId].experimentIds.add(r.experimentId);
        incidentGroups[r.incidentId].workflows.add(r.workflow);
      }
    }
    const incidentChains: IncidentChain[] = Object.keys(incidentGroups).map((incidentId) => ({
      incidentId,
      experimentIds: Object.freeze(Array.from(incidentGroups[incidentId].experimentIds)),
      workflows: Object.freeze(Array.from(incidentGroups[incidentId].workflows)),
    }));

    return Object.freeze({
      repeatedFailures: Object.freeze(repeatedFailures),
      repeatedDependencies: Object.freeze(repeatedDependencies),
      repeatedWorkflows: Object.freeze(repeatedWorkflows),
      rollbackPatterns: Object.freeze(rollbackPatterns),
      mttrTrend,
      incidentChains: Object.freeze(incidentChains),
    });
  }
}
