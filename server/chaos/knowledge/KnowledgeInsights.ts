import { KnowledgeRecord } from "./KnowledgeRecord";
import { KnowledgeRepository } from "./KnowledgeRepository";
import { KnowledgeClassifier } from "./KnowledgeClassifier";

export interface DependencyInsight {
  readonly nodeId: string;
  readonly occurrences: number;
  readonly accumulatedImpact: number;
}

export interface SubsystemInsight {
  readonly serviceId: string;
  readonly occurrences: number;
  readonly accumulatedImpact: number;
}

export interface ExperimentReliability {
  readonly experimentId: string;
  readonly experimentName: string;
  readonly totalExecutions: number;
  readonly failureRate: number; // percentage (0 - 100)
  readonly averageImpact: number;
}

export interface WorkflowSuccessRate {
  readonly workflow: string;
  readonly executions: number;
  readonly successRate: number; // percentage (0 - 100)
}

export interface EnterpriseInsights {
  readonly mostCommonFailureType: string;
  readonly mostSuccessfulRecoveryWorkflow: string;
  readonly highestMTTRMs: number;
  readonly highestMTTRExperimentId: string;
  readonly highestBlastRadiusSeen: "Minimal" | "Low" | "Medium" | "High";
  readonly mostUnstableDependency: DependencyInsight | null;
  readonly mostAffectedSubsystem: SubsystemInsight | null;
  readonly mostSuccessfulWorkflow: WorkflowSuccessRate | null;
  readonly leastReliableExperiment: ExperimentReliability | null;
  readonly recommendations: readonly string[];
}

export class KnowledgeInsights {
  /**
   * Generates deep, actionable SRE intelligence from historical chaos experiments
   * and recovery outcomes.
   */
  public static generate(customRecords?: readonly KnowledgeRecord[]): EnterpriseInsights {
    const records = customRecords || KnowledgeRepository.getAll();

    if (!records || records.length === 0) {
      return {
        mostCommonFailureType: "None",
        mostSuccessfulRecoveryWorkflow: "None",
        highestMTTRMs: 0,
        highestMTTRExperimentId: "None",
        highestBlastRadiusSeen: "Minimal",
        mostUnstableDependency: null,
        mostAffectedSubsystem: null,
        mostSuccessfulWorkflow: null,
        leastReliableExperiment: null,
        recommendations: Object.freeze([
          "No operational history found. Initiate baseline chaos experiments to build operational knowledge.",
        ]),
      };
    }

    // 1. Most Common Failure Type
    const failureCounts: Record<string, number> = {};
    for (const r of records) {
      const cls = KnowledgeClassifier.classify(r);
      failureCounts[cls.failureType] = (failureCounts[cls.failureType] || 0) + 1;
    }
    let mostCommonFailureType = "Unknown";
    let maxFailureCount = 0;
    for (const type of Object.keys(failureCounts)) {
      if (failureCounts[type] > maxFailureCount) {
        maxFailureCount = failureCounts[type];
        mostCommonFailureType = type;
      }
    }

    // 2. Highest MTTR & Highest Blast Radius
    let highestMTTRMs = 0;
    let highestMTTRExperimentId = "None";
    let highestBlastRadiusScore = 0; // Minimal: 0, Low: 1, Medium: 2, High: 3
    let highestBlastRadiusSeen: "Minimal" | "Low" | "Medium" | "High" = "Minimal";

    const blastRadiusMap: Record<"Minimal" | "Low" | "Medium" | "High", number> = {
      Minimal: 0,
      Low: 1,
      Medium: 2,
      High: 3,
    };

    for (const r of records) {
      if (r.MTTR > highestMTTRMs) {
        highestMTTRMs = r.MTTR;
        highestMTTRExperimentId = r.experimentId;
      }

      const brScore = blastRadiusMap[r.blastRadius];
      if (brScore > highestBlastRadiusScore) {
        highestBlastRadiusScore = brScore;
        highestBlastRadiusSeen = r.blastRadius;
      }
    }

    // 3. Most Unstable Dependency & Most Affected Subsystem (Service)
    const depAggregations: Record<string, { occurrences: number; accumulatedImpact: number }> = {};
    const subAggregations: Record<string, { occurrences: number; accumulatedImpact: number }> = {};

    for (const r of records) {
      if (r.dependencyGraphSnapshot?.nodes) {
        for (const node of r.dependencyGraphSnapshot.nodes) {
          if (node.type === "service") {
            if (!subAggregations[node.id]) {
              subAggregations[node.id] = { occurrences: 0, accumulatedImpact: 0 };
            }
            subAggregations[node.id].occurrences += 1;
            subAggregations[node.id].accumulatedImpact += r.impact;
          } else {
            if (!depAggregations[node.id]) {
              depAggregations[node.id] = { occurrences: 0, accumulatedImpact: 0 };
            }
            depAggregations[node.id].occurrences += 1;
            depAggregations[node.id].accumulatedImpact += r.impact;
          }
        }
      }
    }

    let mostUnstableDependency: DependencyInsight | null = null;
    let maxDepImpact = -1;
    for (const id of Object.keys(depAggregations)) {
      const agg = depAggregations[id];
      if (agg.accumulatedImpact > maxDepImpact) {
        maxDepImpact = agg.accumulatedImpact;
        mostUnstableDependency = {
          nodeId: id,
          occurrences: agg.occurrences,
          accumulatedImpact: agg.accumulatedImpact,
        };
      }
    }

    let mostAffectedSubsystem: SubsystemInsight | null = null;
    let maxSubImpact = -1;
    for (const id of Object.keys(subAggregations)) {
      const agg = subAggregations[id];
      if (agg.accumulatedImpact > maxSubImpact) {
        maxSubImpact = agg.accumulatedImpact;
        mostAffectedSubsystem = {
          serviceId: id,
          occurrences: agg.occurrences,
          accumulatedImpact: agg.accumulatedImpact,
        };
      }
    }

    // 4. Workflow success rates
    const workflowStats: Record<string, { executions: number; successes: number }> = {};
    for (const r of records) {
      if (!workflowStats[r.workflow]) {
        workflowStats[r.workflow] = { executions: 0, successes: 0 };
      }
      workflowStats[r.workflow].executions += 1;
      if (r.status === "SUCCESS") {
        workflowStats[r.workflow].successes += 1;
      }
    }

    const workflowList: WorkflowSuccessRate[] = Object.keys(workflowStats).map((wf) => ({
      workflow: wf,
      executions: workflowStats[wf].executions,
      successRate: (workflowStats[wf].successes / workflowStats[wf].executions) * 100,
    }));

    let mostSuccessfulWorkflow: WorkflowSuccessRate | null = null;
    if (workflowList.length > 0) {
      mostSuccessfulWorkflow = workflowList.reduce((best, cur) => {
        if (cur.successRate > best.successRate) return cur;
        if (cur.successRate === best.successRate && cur.executions > best.executions) return cur;
        return best;
      });
    }
    const mostSuccessfulRecoveryWorkflow = mostSuccessfulWorkflow?.workflow || "None";

    // 5. Least Reliable Experiment
    const experimentStats: Record<
      string,
      { name: string; executions: number; failures: number; totalImpact: number }
    > = {};

    for (const r of records) {
      if (!experimentStats[r.experimentId]) {
        experimentStats[r.experimentId] = {
          name: r.experimentName,
          executions: 0,
          failures: 0,
          totalImpact: 0,
        };
      }
      const stats = experimentStats[r.experimentId];
      stats.executions += 1;
      stats.totalImpact += r.impact;
      if (r.status !== "SUCCESS" && r.status !== "SKIPPED") {
        stats.failures += 1;
      }
    }

    const experimentList: ExperimentReliability[] = Object.keys(experimentStats).map((id) => {
      const stats = experimentStats[id];
      return {
        experimentId: id,
        experimentName: stats.name,
        totalExecutions: stats.executions,
        failureRate: (stats.failures / stats.executions) * 100,
        averageImpact: stats.totalImpact / stats.executions,
      };
    });

    let leastReliableExperiment: ExperimentReliability | null = null;
    if (experimentList.length > 0) {
      leastReliableExperiment = experimentList.reduce((worst, cur) => {
        if (cur.failureRate > worst.failureRate) return cur;
        if (cur.failureRate === worst.failureRate && cur.averageImpact > worst.averageImpact) return cur;
        return worst;
      });
    }

    // 6. Actionable recommendations
    const recommendations: string[] = [];

    if (highestMTTRMs > 5000) {
      recommendations.push(
        `High MTTR spike detected (${highestMTTRMs}ms) during execution of ${highestMTTRExperimentId}. Review automated playbook triggers to reduce detection-to-remediation delay.`
      );
    } else {
      recommendations.push(
        "Automated MTTR targets are stable. Maintain current proactive polling frequencies."
      );
    }

    if (mostUnstableDependency) {
      recommendations.push(
        `Dependency node [${mostUnstableDependency.nodeId}] shows elevated failure contribution (Accumulated Impact: ${mostUnstableDependency.accumulatedImpact}). Recommend adding robust circuit breakers, retry policies, or connection pools.`
      );
    }

    if (mostAffectedSubsystem) {
      recommendations.push(
        `Subsystem [${mostAffectedSubsystem.serviceId}] experienced highest impact load during experiments. Recommend optimizing container thread limits and verifying CPU limits.`
      );
    }

    if (leastReliableExperiment && leastReliableExperiment.failureRate > 30) {
      recommendations.push(
        `Experiment [${leastReliableExperiment.experimentName}] has a high failure rate (${leastReliableExperiment.failureRate.toFixed(1)}%). Refine injected faults to avoid severe cascading impacts.`
      );
    }

    if (highestBlastRadiusSeen === "High" || highestBlastRadiusSeen === "Medium") {
      recommendations.push(
        "Blast radius has previously breached Minimal thresholds. Ensure safety guardrails and manual approval locks remain strictly enforced on the production pipeline."
      );
    }

    return {
      mostCommonFailureType,
      mostSuccessfulRecoveryWorkflow,
      highestMTTRMs,
      highestMTTRExperimentId,
      highestBlastRadiusSeen,
      mostUnstableDependency,
      mostAffectedSubsystem,
      mostSuccessfulWorkflow,
      leastReliableExperiment,
      recommendations: Object.freeze(recommendations),
    };
  }
}
