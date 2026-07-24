import { GovernanceEngine } from "./GovernanceEngine";
import { PolicyCatalog } from "./PolicyCatalog";
import { GovernanceDecisionPayload } from "./GovernanceDecision";

export interface SreGovernanceReport {
  readonly timestamp: string;
  readonly activeGovernancePoliciesCount: number;
  readonly activeCompliancePoliciesCount: number;
  readonly totalEvaluations: number;
  readonly approvalRate: number; // percentage of approved requests
  readonly averageRiskScore: number; // mean pre-experiment risk
  readonly averageComplianceScore: number; // mean regulatory compliance score
  readonly auditTrail: readonly GovernanceDecisionPayload[];
  readonly markdown: string;
  readonly json: string;
}

export class PolicyReporter {
  /**
   * Generates a comprehensive, high-fidelity Enterprise Governance & Compliance SRE report.
   */
  public static generateReport(): SreGovernanceReport {
    const timestamp = new Date().toISOString();
    const auditTrail = GovernanceEngine.getAuditTrail();

    const activeGovCount = PolicyCatalog.getAllGovernancePolicies().length;
    const activeCompCount = PolicyCatalog.getAllCompliancePolicies().length;

    const total = auditTrail.length;
    let approvalRate = 100;
    let averageRiskScore = 0;
    let averageComplianceScore = 100;

    if (total > 0) {
      const approvedCount = auditTrail.filter((d) => d.status === "APPROVED").length;
      approvalRate = Number(((approvedCount / total) * 100).toFixed(2));

      const sumRisk = auditTrail.reduce((acc, d) => acc + d.riskScore, 0);
      averageRiskScore = Number((sumRisk / total).toFixed(1));

      const sumComp = auditTrail.reduce((acc, d) => acc + d.complianceScore, 0);
      averageComplianceScore = Number((sumComp / total).toFixed(1));
    }

    const reportData = {
      timestamp,
      activeGovernancePoliciesCount: activeGovCount,
      activeCompliancePoliciesCount: activeCompCount,
      totalEvaluations: total,
      approvalRate,
      averageRiskScore,
      averageComplianceScore,
      auditTrail,
    };

    const json = JSON.stringify(reportData, null, 2);
    const markdown = this.compileMarkdown(reportData);

    return {
      timestamp,
      activeGovernancePoliciesCount: activeGovCount,
      activeCompliancePoliciesCount: activeCompCount,
      totalEvaluations: total,
      approvalRate,
      averageRiskScore,
      averageComplianceScore,
      auditTrail,
      markdown,
      json,
    };
  }

  /**
   * Compiles the gorgeous human-readable executive Markdown report.
   */
  private static compileMarkdown(report: any): string {
    const auditLines = report.auditTrail.length > 0
      ? report.auditTrail
          .map(
            (d: any) =>
              `| \`${d.id}\` | \`${d.status}\` | ${d.riskScore}% | ${d.complianceScore}% | \`${d.environment}\` | ${d.reasoning.substring(0, 80)}... |`
          )
          .join("\n")
      : "| *No recent evaluations logged in this session* | | | | | |";

    return `# 🏛️ ENTERPRISE SRE GOVERNANCE & COMPLIANCE REPORT

**Report Compiled At:** ${report.timestamp}  
**Classification:** HIGH-SECURITY SRE AUDIT DOCUMENT

---

## 📊 GOVERNANCE KPI SUMMARY

| Metric | Measured Value | Description |
| :--- | :---: | :--- |
| **Average SRE Risk Score** | **${report.averageRiskScore}%** | Aggregated pre-execution danger index |
| **Average Compliance Score** | **${report.averageComplianceScore}%** | Adherence to regulatory rulesets (SOC2 / PCI) |
| **SRE Request Approval Rate** | **${report.approvalRate}%** | Proportion of safely approved executions |
| **Total Evaluations Run** | **${report.totalEvaluations}** | Sessions analyzed by the policy governance core |
| **Registered SRE Policies** | **${report.activeGovernancePoliciesCount}** | Active fine-grained SRE guardrails in PolicyCatalog |
| **Compliance Standard Specs** | **${report.activeCompliancePoliciesCount}** | Framework rules configured (SOC2, PCI-DSS, ISO27001) |

---

## 📜 RECENT GOVERNANCE DECISION AUDIT TRAIL

The following table logs every evaluated chaos and automated-action request in this SRE session.

| Decision ID | Status | Risk Score | Compliance Score | Environment | Key Evaluation Result / Reason |
| :--- | :---: | :---: | :---: | :---: | :--- |
${auditLines}

---

## 🛡️ CORE COMPLIANCE REGULATION STATEMENTS

1. **Audit Traceability Verification (SOC2 CC6.1)**: Every chaos scenario is strictly correlated to an initiator role, permission set, and unique tracking event.
2. **Uptime Safeguard Boundaries**: Experiments are automatically terminated if they exhaust available Error Budgets or degrade SLO availability beyond threshold.
3. **Data Mutation Restrictions**: Under strict PCI-DSS and SOC2 settings, no actual database mutations or customer-affecting state modifications are permitted.
`;
  }
}
