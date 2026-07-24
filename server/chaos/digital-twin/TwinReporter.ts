import { TwinState } from "./TwinState";
import { TwinDeltaReport } from "./TwinComparison";

export interface TwinReporterOutput {
  reportId: string;
  timestamp: string;
  enterpriseReadinessScore: number;
  json: any;
  markdown: string;
}

export class TwinReporter {
  /**
   * Compiles and formats a detailed Enterprise Digital Twin report in Markdown and JSON.
   */
  public static generateReport(
    scenarioName: string,
    initialState: TwinState,
    finalState: TwinState,
    delta: TwinDeltaReport
  ): TwinReporterOutput {
    const reportId = `report-twin-${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();

    const before = initialState.getData();
    const after = finalState.getData();

    // Enterprise readiness score ranges from 0 to 100 based on remaining scores and delta
    const readinessScore = Math.max(0, Math.min(100, Math.round(after.governance.scores.overallEnterpriseScore)));

    const markdown = `
# 🔮 ENTERPRISE DIGITAL TWIN ENGINE REPORT

**Simulation Scenario:** \`${scenarioName}\`  
**Report ID:** \`${reportId}\`  
**Calibrated At:** ${timestamp}  
**Simulated Enterprise Readiness Score:** **${readinessScore}/100** (\`${after.governance.scores.letterGrade}\`)

---

## 🕒 Simulation Timeline
1. **[T+0s]** Initial State Captured: Overall Score \`${before.governance.scores.overallEnterpriseScore}%\` (${before.governance.scores.letterGrade}), SLO Availability \`${before.slo.availability.actual}%\`.
2. **[T+1s]** Disruption Injected: Triggering virtual failures matching scenario patterns.
3. **[T+3s]** Cascading propagation completed across virtual dependency edges.
4. **[T+5s]** Virtual Health Check finalized: Status set to \`${after.health.status}\` (Impact Score: ${after.health.impactScore}).

---

## 🛡️ Risk Summary & Delta Analysis
- **Availability Delta:** \`${delta.availabilityDelta.beforePercent}%\` ➔ \`${delta.availabilityDelta.afterPercent}%\` (**${delta.availabilityDelta.deltaPercent > 0 ? "+" : ""}${delta.availabilityDelta.deltaPercent}%**)
- **P95 Latency Delta:** \`${delta.latencyDelta.beforeP95Ms}ms\` ➔ \`${delta.latencyDelta.afterP95Ms}ms\` (**${delta.latencyDelta.deltaMs > 0 ? "+" : ""}${delta.latencyDelta.deltaMs}ms**)
- **Error Budget Delta:** \`${delta.errorBudgetDelta.beforePercent}%\` ➔ \`${delta.errorBudgetDelta.afterPercent}%\` (**${delta.errorBudgetDelta.deltaPercent > 0 ? "+" : ""}${delta.errorBudgetDelta.deltaPercent}%**)
- **Enterprise Score Delta:** \`${delta.enterpriseScoreDelta.beforeScore}%\` (${delta.enterpriseScoreDelta.beforeGrade}) ➔ \`${delta.enterpriseScoreDelta.afterScore}%\` (${delta.enterpriseScoreDelta.afterGrade}) (**${delta.enterpriseScoreDelta.deltaScore > 0 ? "+" : ""}${delta.enterpriseScoreDelta.deltaScore}%**)
- **Threat Vector Escalation:** \`${delta.riskDelta.beforeRisk}\` ➔ \`${delta.riskDelta.afterRisk}\` (Risk Level Changed: ${delta.riskDelta.isRiskIncreased ? "🟩 ESCALATED" : "⬜ UNCHANGED"})

---

## 🏗️ Dependency Graph Summary
- **Degraded/Unavailable Virtual Nodes:** \`${delta.dependencyDelta.failedNodesCount}\` / \`${after.dependencyGraph.nodes.length}\`
- **Failing Virtual Edges:** \`${delta.dependencyDelta.failingEdgesCount}\` / \`${after.dependencyGraph.edges.length}\`
- **Impacted Subsystems:** \`${after.dependencyGraph.nodes.filter(n => n.status !== "HEALTHY").map(n => n.name).join(", ") || "None"}\`

---

## 📡 Prediction Summary
- **Predicted Outcomes:** \`${after.prediction.predictedFailure || "Nominal"}\`
- **Recovery SLA Target:** \`${after.prediction.predictedRecovery || "Self-healing Playbook"}\`
- **Forecast MTTR:** \`${after.prediction.predictedMTTR || 1200}ms\`

---

## 🚑 Recovery Expectations
- **Autonomous Recovery Workflow:** \`${delta.recoveryDelta.recoveryAction}\`
- **Estimated Failover Mitigation Window:** \`${delta.recoveryDelta.expectedRecoveryTimeMs}ms\`

---

## 💡 Recommended Proactive SRE Actions
${after.prediction.recommendations?.map((rec: string, i: number) => `${i + 1}. **${rec}**`).join("\n") || "1. Continue regular game-day exercises to reinforce failover gates.\n2. Enable real-time regression alerts."}

---
*Enterprise Digital Twin Simulator v1.0.0*
`.trim();

    const json = {
      reportId,
      scenarioName,
      timestamp,
      readinessScore,
      delta,
      before: {
        score: before.governance.scores.overallEnterpriseScore,
        grade: before.governance.scores.letterGrade,
        availability: before.slo.availability.actual,
        latencyMs: before.slo.latency.actualP95Ms,
      },
      after: {
        score: after.governance.scores.overallEnterpriseScore,
        grade: after.governance.scores.letterGrade,
        availability: after.slo.availability.actual,
        latencyMs: after.slo.latency.actualP95Ms,
        healthStatus: after.health.status,
        impactScore: after.health.impactScore,
      },
    };

    return {
      reportId,
      timestamp,
      enterpriseReadinessScore: readinessScore,
      json,
      markdown,
    };
  }
}
