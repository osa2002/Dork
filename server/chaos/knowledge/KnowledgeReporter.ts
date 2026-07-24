import { KnowledgeRecord } from "./KnowledgeRecord";
import { KnowledgeInsights } from "./KnowledgeInsights";
import { KnowledgeCorrelation } from "./KnowledgeCorrelation";

export interface EnterpriseReport {
  readonly timestamp: string;
  readonly json: Readonly<Record<string, any>>;
  readonly markdown: string;
}

export class KnowledgeReporter {
  /**
   * Generates beautiful markdown reports and complete JSON datasets for executives,
   * engineering teams, and automated compliance engines.
   */
  public static generateReport(records: readonly KnowledgeRecord[]): EnterpriseReport {
    const timestamp = new Date().toISOString();

    if (!records || records.length === 0) {
      return {
        timestamp,
        json: Object.freeze({
          recordsCount: 0,
          insights: null,
          correlation: null,
        }),
        markdown: `# SRE Operational Knowledge Report
Generated: ${timestamp}

## Executive Summary
**No operational history or completed chaos executions found.** 
To generate a comprehensive report, execute baseline experiments through the Chaos Orchestrator.
`,
      };
    }

    const insights = KnowledgeInsights.generate(records);
    const correlation = KnowledgeCorrelation.analyze(records);

    // Compute basic statistics
    const totalCount = records.length;
    const successCount = records.filter((r) => r.status === "SUCCESS").length;
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 100;

    const failedCount = records.filter((r) => r.status === "FAILED").length;
    const degradedCount = records.filter((r) => r.status === "DEGRADED").length;
    const skippedCount = records.filter((r) => r.status === "SKIPPED").length;

    // Build the JSON representation
    const reportJson = {
      timestamp,
      summary: {
        totalExecutions: totalCount,
        successRatePercentage: parseFloat(successRate.toFixed(2)),
        outcomes: {
          success: successCount,
          failed: failedCount,
          degraded: degradedCount,
          skipped: skippedCount,
        },
      },
      insights,
      correlation,
    };

    // Format a high-impact, professional Markdown Report
    const markdown = `
# SRE Operational Knowledge Report
**Generated:** ${timestamp}
**Scope:** ${totalCount} Automated Chaos Experiments and Recovery Logs

---

## 📈 Executive Summary

The Dork Enterprise Platform's automated resilience auditing has recorded **${totalCount}** total chaos executions with an overall success rate of **${successRate.toFixed(1)}%**.

- **SRE Pillar Integrity:** Evaluated system state through automated chaos injections.
- **Fail-Safe Integrity:** **${successCount}** injections were successfully mitigated or verified.
- **Primary Failure Vector:** \`${insights.mostCommonFailureType}\`
- **Most Effective Playbook:** \`${insights.mostSuccessfulRecoveryWorkflow}\`

### 🛡️ Core Vulnerabilities Snapshot
- **Max MTTR Recorded:** \`${insights.highestMTTRMs}ms\` (Triggered by \`${insights.highestMTTRExperimentId}\`)
- **Peak Blast Radius:** \`${insights.highestBlastRadiusSeen}\`
- **Most Critical Subsystem:** \`${insights.mostAffectedSubsystem?.serviceId || "None"}\` (Accumulated Impact: \`${insights.mostAffectedSubsystem?.accumulatedImpact || 0}\`)
- **Unstable Dependency Node:** \`${insights.mostUnstableDependency?.nodeId || "None"}\` (Total Occurrences: \`${insights.mostUnstableDependency?.occurrences || 0}\`)

---

## 📊 Trend Summary

### ⏱️ Mean Time To Recovery (MTTR) Trend
The overall historical recovery progression is classified as **${correlation.mttrTrend.toUpperCase()}**.
- *Stable/Improving*: Automation patterns are successfully suppressing cascade events.
- *Degrading*: Active playbooks are experiencing delayed execution window breaches.

### 🔄 Rollback Performance Breakdown
- **Active Rollbacks Executed:** \`${correlation.rollbackPatterns.totalRollbacks}\`
- **Rollback Success Rate:** \`${correlation.rollbackPatterns.successRate.toFixed(1)}%\`
- **Average Rollback Speed:** \`${correlation.rollbackPatterns.avgDurationMs.toFixed(0)}ms\`

### 🔗 Incident Co-occurrence Chains
Found **${correlation.incidentChains.length}** active incident chains linked to automated recovery protocols.
${
  correlation.incidentChains.length > 0
    ? correlation.incidentChains
        .map(
          (chain) =>
            `- **Incident \`${chain.incidentId}\`**: Triggered experiment(s) [\`${chain.experimentIds.join(
              "`, `"
            )}\`] which executed playbook: \`${chain.workflows.join(", ")}\``
        )
        .join("\n")
    : "*No incidents spawned or linked in this operational window.*"
}

---

## 🛠️ Operational Recommendations

Based on deep analysis of simulated regressions and telemetry data, SRE operations recommends the following actions:

${insights.recommendations.map((rec, index) => `${index + 1}. **[REC-${index + 1}]** ${rec}`).join("\n")}

---
**Dork Enterprise Platform — SRE & Autonomous Governance**
`;

    return {
      timestamp,
      json: Object.freeze(reportJson),
      markdown: markdown.trim(),
    };
  }
}
