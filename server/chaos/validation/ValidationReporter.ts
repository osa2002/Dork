import { ValidationResult } from "./ValidationResult";

export interface ValidationReportOutput {
  reportId: string;
  timestamp: string;
  json: {
    validationId: string;
    timestamp: string;
    totalRules: number;
    passedCount: number;
    failedCount: number;
    successRate: number;
    findings: any[];
  };
  markdown: string;
}

export class ValidationReporter {
  /**
   * Compiles the validation results into elegant Markdown and structured JSON.
   */
  public static generateReport(
    validationId: string,
    timestamp: string,
    results: ValidationResult[]
  ): ValidationReportOutput {
    const totalRules = results.length;
    const passedCount = results.filter((r) => r.success).length;
    const failedCount = totalRules - passedCount;
    const successRate = totalRules > 0 ? Number(((passedCount / totalRules) * 100).toFixed(2)) : 100;

    const json = {
      validationId,
      timestamp,
      totalRules,
      passedCount,
      failedCount,
      successRate,
      findings: results.map((r) => ({
        ruleId: r.ruleId,
        ruleName: r.ruleName,
        severity: r.severity,
        component: r.component,
        success: r.success,
        expected: r.expected,
        actual: r.actual,
        recommendation: r.recommendation,
        evidence: r.evidence,
      })),
    };

    // Calculate critical count
    const criticalFailures = results.filter((r) => !r.success && r.severity === "Critical");
    const highFailures = results.filter((r) => !r.success && r.severity === "High");
    const warningCount = results.filter((r) => !r.success && (r.severity === "High" || r.severity === "Medium" || r.severity === "Low")).length;

    const overallStatus = failedCount === 0 ? "🟩 COMPLIANT" : criticalFailures.length > 0 ? "🟥 BREACHED" : "🟨 DEGRADED";

    // Build beautiful enterprise SRE report
    let markdown = `
# 🛠️ DORK ENTERPRISE CONTINUOUS VALIDATION PLATFORM REPORT

**Validation ID:** \`${validationId}\`  
**Calibrated At:** ${timestamp}  
**Platform Status:** **${overallStatus}**  
**Success Rate:** **${successRate}%** (\`${passedCount}/${totalRules}\` Rules Passed)

---

## 📊 Executive Summary
- **Total Evaluated Rules:** \`${totalRules}\`
- **Passed Controls:** \`${passedCount}\`
- **Failed Controls:** \`${failedCount}\`
- **Critical Breaches:** \`${criticalFailures.length}\`
- **Warnings & Anomalies:** \`${warningCount}\`

---

## 📋 Rule Checklist & Compliance Matrix

| Rule ID | Component | Severity | Description | Status |
| :--- | :--- | :--- | :--- | :--- |
${results
  .map(
    (r) =>
      `| \`${r.ruleId}\` | ${r.component} | \`${r.severity}\` | ${r.ruleName} | ${
        r.success ? "🟩 PASS" : "🟥 FAIL"
      } |`
  )
  .join("\n")}

---

## 🔍 Detailed Findings & Breaches
`.trim();

    if (failedCount === 0) {
      markdown += `\n\n🟩 **Zero failures detected.** The entire platform architecture, dependency mapping, event pipelines, and governance metrics perfectly align with Dork Enterprise compliance targets.`;
    } else {
      markdown += "\n\n";
      results
        .filter((r) => !r.success)
        .forEach((r, idx) => {
          markdown += `
### ${idx + 1}. [${r.severity}] ${r.ruleName} (\`${r.ruleId}\`)
- **Target Component:** \`${r.component}\`
- **Expected Outcome:** ${r.expected}
- **Actual State:** ${r.actual}
- **Recommendation:** ${r.recommendation}
- **Collected Evidence:**
${r.evidence.map((line) => `  - ${line}`).join("\n")}

---
`.trim();
        });
    }

    markdown += `\n\n*Dork Enterprise Continuous Validation Platform v1.0.0*`;

    return {
      reportId: `rep-val-${Math.random().toString(36).substring(2, 9)}`,
      timestamp,
      json,
      markdown,
    };
  }
}
