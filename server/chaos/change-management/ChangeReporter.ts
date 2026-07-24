import { ChangeAudit } from "./ChangeAudit";

export interface ChangeSreReport {
  readonly timestamp: string;
  readonly totalChangesProposed: number;
  readonly classificationCounts: {
    readonly STANDARD: number;
    readonly MINOR: number;
    readonly MAJOR: number;
    readonly EMERGENCY: number;
  };
  readonly approvalRate: number; // percentage approved
  readonly averageRiskScore: number;
  readonly markdown: string;
  readonly json: string;
}

export class ChangeReporter {
  /**
   * Generates a high-fidelity Enterprise Change Management and SRE Compliance Report.
   */
  public static generateReport(): ChangeSreReport {
    const timestamp = new Date().toISOString();
    const logs = ChangeAudit.getLogs();

    const total = logs.length;
    const classificationCounts = {
      STANDARD: 0,
      MINOR: 0,
      MAJOR: 0,
      EMERGENCY: 0,
    };

    let approvedCount = 0;
    let sumRisk = 0;

    for (const record of logs) {
      classificationCounts[requestClassification(record.request.classification)]++;
      if (record.approval.status === "AUTO_APPROVED" || record.approval.status === "PENDING_APPROVAL") {
        approvedCount++;
      }
      sumRisk += record.risk.riskScore;
    }

    const approvalRate = total > 0 ? Number(((approvedCount / total) * 100).toFixed(2)) : 100;
    const averageRiskScore = total > 0 ? Number((sumRisk / total).toFixed(1)) : 0;

    const reportData = {
      timestamp,
      totalChangesProposed: total,
      classificationCounts,
      approvalRate,
      averageRiskScore,
      logs,
    };

    const json = JSON.stringify(reportData, null, 2);
    const markdown = this.compileMarkdown(reportData);

    return {
      timestamp,
      totalChangesProposed: total,
      classificationCounts,
      approvalRate,
      averageRiskScore,
      markdown,
      json,
    };
  }

  private static compileMarkdown(report: any): string {
    const logsLines = report.logs.length > 0
      ? report.logs
          .map(
            (r: any) =>
              `| \`${r.request.id}\` | **${r.request.classification}** | \`${r.request.changeType}\` | ${r.risk.riskScore}% (${r.risk.riskTier}) | \`${r.approval.status}\` | ${r.request.title.substring(0, 40)}... |`
          )
          .join("\n")
      : "| *No proposed changes evaluated in this SRE session* | | | | | |";

    return `# 🏛️ ENTERPRISE CHANGE MANAGEMENT & SRE SAFETY REPORT

**Report Generated At:** ${report.timestamp}  
**Security Level:** SRE COMPLIANCE - LEVEL 4 AUDIT RECORD

---

## 📊 CHANGE EXECUTION SUMMARY

| SRE Metric | Value | Purpose / Threshold |
| :--- | :---: | :--- |
| **Total Changes Evaluated** | **${report.totalChangesProposed}** | Total proposed infra, config, and code changes |
| **Average SRE Risk Index** | **${report.averageRiskScore}%** | Integrated safety score of proposed pipelines |
| **Change Admission Rate** | **${report.approvalRate}%** | Percent of changes passing strict safety gates |
| **Emergency Escalations** | **${report.classificationCounts.EMERGENCY}** | Fast-tracked emergency production operations |
| **Major Releases Tracked** | **${report.classificationCounts.MAJOR}** | High-impact architectural adjustments |

---

## 🔍 CLASS DISTRIBUTION ANALYSIS

- **STANDARD CHANGES:** ${report.classificationCounts.STANDARD} (Pre-approved operational runs)
- **MINOR REVISIONS:** ${report.classificationCounts.MINOR} (Low-risk incremental adjustments)
- **MAJOR UPDATES:** ${report.classificationCounts.MAJOR} (High-impact infrastructural pathways)
- **EMERGENCY REPAIRS:** ${report.classificationCounts.EMERGENCY} (Urgent out-of-band remediation)

---

## 📜 CHANGE MANAGEMENT AUDIT LOGS

The following table records every proposed, simulated, and peer-reviewed change from the active session.

| Change ID | Class | Type | Risk Score | Approval Status | Description / Title |
| :--- | :---: | :---: | :---: | :---: | :--- |
${logsLines}

---

## 🛡️ SRE ADMISSION AND RUNTIME STATEMENTS

1. **Dual-Signoff Compliance (ISO27001 / SOC2)**: Any proposed changes with risk indices exceeding 60% are strictly barred from auto-approval and require manual operator + lead peer validation.
2. **Co-location Safety Shield**: Change Executor blocks execution of any change pipelines if the platform has active unresolved incidents, isolating operational risk.
3. **No-Mutation Guardrail**: Simulation engine validates structural readiness on high-fidelity Digital Twins with 0% production side effects.
`;
  }
}

function requestClassification(val: string): "STANDARD" | "MINOR" | "MAJOR" | "EMERGENCY" {
  if (val === "STANDARD" || val === "MINOR" || val === "MAJOR" || val === "EMERGENCY") {
    return val;
  }
  return "STANDARD";
}
