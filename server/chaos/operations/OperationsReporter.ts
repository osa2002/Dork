import { OperationsDashboard } from "./OperationsDashboard";
import { OperationsCenter } from "./OperationsCenter";
import { OperationsTopology } from "./OperationsTopology";
import { OperationsAnalytics } from "./OperationsAnalytics";
import { OperationsHealthMatrix } from "./OperationsHealthMatrix";

export interface OperationsReport {
  timestamp: string;
  architectureScore: number;
  riskScore: number;
  operationalSummary: {
    healthScore: number;
    availability: number;
    resilienceGrade: string;
    subsystemsCount: number;
    exceptionsCount: number;
  };
  topologySummary: {
    totalEngines: number;
    totalEdges: number;
    hasCircular: boolean;
    missingDependenciesCount: number;
  };
  readinessReport: {
    controlPlaneReadiness: number;
    validationSuccessRate: number;
    recoverySuccessRate: number;
    status: string;
  };
  executiveDashboard: {
    validationStatus: string;
    recoveryStatus: string;
    decisionStatus: string;
    digitalTwinStatus: string;
    knowledgeCoverage: number;
    integrationHealth: number;
  };
  markdown: string;
  json: string;
}

export class OperationsReporter {
  /**
   * Generates a complete, high-fidelity Enterprise Operations and SRE report.
   */
  public static generateReport(): OperationsReport {
    const timestamp = new Date().toISOString();
    const dashboard = OperationsDashboard.computeDashboard();
    const liveState = OperationsCenter.collectLiveState();
    const topology = OperationsTopology.generateTopology();
    const analytics = OperationsAnalytics.calculateAnalytics();
    const healthMatrix = OperationsHealthMatrix.generateMatrix();

    // 1. Compute Architecture Score
    // Starts at 100, penalized by SRE architectural smells
    let architectureScore = 100;
    if (topology.circularDependencies.length > 0) {
      architectureScore -= 20; // major violation
    }
    architectureScore -= topology.missingDependencies.length * 10;
    architectureScore -= topology.incompatibleDependencies.length * 5;
    architectureScore = Math.max(0, architectureScore);

    // 2. Compute Risk Score
    // Driven by active predictions, system health degradation, and exceptions
    const totalExceptions = healthMatrix.reduce((sum, row) => sum + row.exceptionsCount, 0);
    const healthRiskFactor = (100 - dashboard.enterpriseHealthScore) * 0.4;
    const exceptionRiskFactor = Math.min(30, totalExceptions * 5);
    const predictionRiskFactor = dashboard.predictionRisk * 0.3;
    const riskScore = Number(Math.min(100, Math.max(0, healthRiskFactor + exceptionRiskFactor + predictionRiskFactor)).toFixed(1));

    // 3. Operational Summary
    const operationalSummary = {
      healthScore: dashboard.enterpriseHealthScore,
      availability: dashboard.availability,
      resilienceGrade: dashboard.resilienceGrade,
      subsystemsCount: healthMatrix.length,
      exceptionsCount: totalExceptions,
    };

    // 4. Topology Summary
    const topologySummary = {
      totalEngines: topology.nodes.length,
      totalEdges: topology.edges.length,
      hasCircular: topology.circularDependencies.length > 0,
      missingDependenciesCount: topology.missingDependencies.length,
    };

    // 5. Readiness Report
    const validationSuccessRate = analytics.validationSuccessRate;
    const recoverySuccessRate = analytics.recoverySuccessRate;
    let readinessStatus = "EXCELLENT";
    if (dashboard.enterpriseHealthScore < 80 || validationSuccessRate < 80) {
      readinessStatus = "NEEDS_ATTENTION";
    } else if (dashboard.enterpriseHealthScore < 90 || validationSuccessRate < 95) {
      readinessStatus = "STABLE";
    }

    const readinessReport = {
      controlPlaneReadiness: dashboard.readinessScore,
      validationSuccessRate,
      recoverySuccessRate,
      status: readinessStatus,
    };

    // 6. Executive Dashboard
    const executiveDashboard = {
      validationStatus: dashboard.validationStatus,
      recoveryStatus: dashboard.recoveryStatus,
      decisionStatus: dashboard.decisionStatus,
      digitalTwinStatus: dashboard.digitalTwinStatus,
      knowledgeCoverage: dashboard.knowledgeCoverage,
      integrationHealth: dashboard.integrationHealth,
    };

    // 7. Compile Markdown Report
    const markdown = this.compileMarkdown(
      timestamp,
      architectureScore,
      riskScore,
      operationalSummary,
      topologySummary,
      readinessReport,
      executiveDashboard,
      healthMatrix,
      analytics
    );

    // 8. Pack as JSON
    const reportData = {
      timestamp,
      architectureScore,
      riskScore,
      operationalSummary,
      topologySummary,
      readinessReport,
      executiveDashboard,
      analytics,
    };
    const json = JSON.stringify(reportData, null, 2);

    return {
      timestamp,
      architectureScore,
      riskScore,
      operationalSummary,
      topologySummary,
      readinessReport,
      executiveDashboard,
      markdown,
      json,
    };
  }

  /**
   * Constructs the beautiful markdown executive-facing document.
   */
  private static compileMarkdown(
    timestamp: string,
    architectureScore: number,
    riskScore: number,
    op: any,
    top: any,
    readiness: any,
    exec: any,
    matrix: any[],
    analytics: any
  ): string {
    return `# 🎛️ ENTERPRISE OPERATIONS CENTER EXECUTIVE REPORT

**Report Generated At:** ${timestamp}  
**Classification:** STRICTLY ENTERPRISE CONFIDENTIAL / READ-ONLY STATUS

---

## 📊 EXECUTIVE OVERVIEW & KEY PERFORMANCE INDEX (KPI)

The following scores represent the aggregated mathematical health of the SRE Operations Center.

| Metric | Value | Status / Description |
| :--- | :---: | :--- |
| **Enterprise Health Score** | **${op.healthScore}%** | System resilience weighted performance index |
| **Resilience Grade** | **${op.resilienceGrade}** | Standardized operational survivability tier |
| **Platform Availability (SLO)** | **${op.availability}%** | Live transaction success rate (Target: 99.9%) |
| **Enterprise Architecture Score** | **${architectureScore}%** | Compliance with clean architecture & layer isolation rules |
| **Active Risk Index** | **${riskScore}%** | Combined predicted risk profile (Lower is safer) |

---

## 🛠️ SUBSYSTEM HEALTH MATRIX

Live matrix representing every completed enterprise subsystem and its operational capacity.

| Subsystem | Status | Readiness | Exceptions | Active Alerts |
| :--- | :---: | :---: | :---: | :--- |
${matrix
  .map(
    (row) =>
      `| ${row.subsystem} | \`${row.status}\` | ${row.readiness}% | ${
        row.exceptionsCount
      } | ${row.activeAlerts.join("; ") || "None"} |`
  )
  .join("\n")}

---

## 🌀 SYSTEM TOPOLOGY SUMMARY

*   **Total Registered SRE Engines:** ${top.totalEngines}
*   **Total Inter-Engine Dependencies:** ${top.totalEdges}
*   **Circular Dependencies Detected:** ${top.hasCircular ? "⚠️ YES - CRITICAL FAIL" : "✅ NONE"}
*   **Missing System Dependencies:** ${top.missingDependenciesCount}

---

## 🚀 ENTERPRISE READINESS REPORT

*   **Continuous Validation Succeeded:** ${readiness.validationSuccessRate}%
*   **Autonomous Mitigation Success Rate:** ${readiness.recoverySuccessRate}%
*   **Control Plane Readiness Index:** ${readiness.controlPlaneReadiness}%
*   **Overall SRE Status:** \`${readiness.status}\`

---

## 📈 SYSTEM PERFORMANCE ANALYTICS

*   **Mean Time To Resolution (MTTR):** ${(analytics.mttrMs / 1000).toFixed(2)} seconds
*   **Mean Time Between Failures (MTBF):** ${(analytics.mtbfMs / 3600000).toFixed(1)} hours
*   **Prediction Model Accuracy:** ${analytics.predictionAccuracy}%
*   **Knowledge Base Record Count:** ${analytics.knowledgeGrowthRate}
`;
  }
}
