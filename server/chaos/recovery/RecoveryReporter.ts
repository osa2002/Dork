import { RecoveryResult } from "./RecoveryResult";

export class RecoveryReporter {
  /**
   * Generates a beautifully formatted, highly detailed SRE Markdown report of a recovery run.
   */
  public static generateMarkdown(result: RecoveryResult): string {
    const statusEmojis: Record<string, string> = {
      SUCCESS: "🟢 SUCCESS",
      FAILED: "🔴 FAILED",
      ROLLED_BACK: "🔄 ROLLED_BACK",
      SKIPPED: "🟡 SKIPPED",
      PENDING_APPROVAL: "🔒 PENDING_APPROVAL",
    };

    const timelineRows = result.timeline
      .map((t) => `| \`${t.timestamp}\` | ${t.message} |`)
      .join("\n");

    const logsBlock = result.logs.join("\n");

    return `# 🛠️ Autonomous Recovery Execution Report

## Execution Metadata
- **Recovery Run ID**: \`${result.recoveryId}\`
- **Related Decision ID**: \`${result.decisionId}\`
- **Timestamp**: \`${result.timestamp}\`
- **Selected SRE Workflow**: **${result.workflowName}**
- **Status Outcome**: **${statusEmojis[result.status] || result.status}**

---

## 📊 Performance & Telemetry metrics
- **Overall Execution Duration**: \`${result.durationMs}ms\`
- **Rollback Sequence Duration**: \`${result.rollbackDurationMs}ms\`
- **Execution Attempts**: \`${result.attempts}/${result.policyApplied.maxRetryAttempts}\`

---

## 📋 Evidence Gathered
${result.evidence.map((ev) => `- ${ev}`).join("\n")}

---

## ⏳ Recovery Operations Timeline
| Timestamp | Operational Event Description |
| :--- | :--- |
${timelineRows || "| N/A | No operational timeline events recorded |"}

---

## 📜 Complete SRE Exec Console Logs
\`\`\`text
${logsBlock || "No execution console logs captured."}
\`\`\`

---

## 🔒 Safety Compliance Audit Notice
*This action was executed by the stateless Enterprise Autonomous Recovery Engine. All state modifications are bounded, recorded, and published on the Enterprise Event Bus under strict policy checks.*
`;
  }

  /**
   * Generates a structured, machine-parsable JSON representation of the recovery run.
   */
  public static generateJson(result: RecoveryResult): string {
    return JSON.stringify(
      {
        reportType: "AutonomousRecoveryResult",
        schemaVersion: "1.0.0",
        recoveryId: result.recoveryId,
        decisionId: result.decisionId,
        timestamp: result.timestamp,
        workflowSelected: result.workflowName,
        outcome: result.status,
        durationTelemetry: {
          executionDurationMs: result.durationMs,
          rollbackDurationMs: result.rollbackDurationMs,
          attemptsCount: result.attempts,
        },
        evidence: result.evidence,
        timeline: result.timeline,
        logs: result.logs,
        appliedPolicy: {
          minConfidenceRequired: result.policyApplied.minConfidenceRequired,
          maxRetryAttempts: result.policyApplied.maxRetryAttempts,
          retryDelayMs: result.policyApplied.retryDelayMs,
          highRiskThresholdScore: result.policyApplied.highRiskThresholdScore,
          maxAllowedIncidents: result.policyApplied.maxAllowedIncidents,
          sloAvailabilityThreshold: result.policyApplied.sloAvailabilityThreshold,
        },
      },
      null,
      2
    );
  }
}
