import { EngineDescriptor } from "./EngineDescriptor";
import { HealthSummary } from "./HealthCoordinator";
import { DependencyReport } from "./DependencyResolver";
import { ExecutionSessionReport } from "./ExecutionCoordinator";

export interface ControlPlaneReportPayload {
  reportId: string;
  timestamp: string;
  overallHealth: string;
  readinessScore: number;
  topologySummary: {
    totalEngines: number;
    activeEnginesCount: number;
    degradedEnginesCount: number;
    unavailableEnginesCount: number;
    engines: Array<{
      id: string;
      name: string;
      version: string;
      owner: string;
      status: string;
      capabilities: string[];
    }>;
  };
  dependencyReport: {
    valid: boolean;
    missingCount: number;
    cyclesCount: number;
    incompatibleCount: number;
    duplicateOwnershipCount: number;
    resolvedExecutionGraph: string[];
    details: DependencyReport;
  };
  healthSummaryDetail: HealthSummary;
  executionSession?: ExecutionSessionReport;
}

export class ControlPlaneReporter {
  /**
   * Compiles control plane metadata, dependency matrices, and health aggregates into JSON and beautiful Markdown.
   */
  public static generateReport(
    engines: EngineDescriptor[],
    health: HealthSummary,
    dependencies: DependencyReport,
    execution?: ExecutionSessionReport
  ): { json: ControlPlaneReportPayload; markdown: string } {
    const timestamp = new Date().toISOString();
    const reportId = `rep-cp-${Math.random().toString(36).substring(2, 9)}`;

    const totalEngines = engines.length;
    const activeEnginesCount = engines.filter((e) => health.engineHealth[e.id]?.status === "ACTIVE").length;
    const degradedEnginesCount = engines.filter((e) => health.engineHealth[e.id]?.status === "DEGRADED").length;
    const unavailableEnginesCount = engines.filter((e) => health.engineHealth[e.id]?.status === "UNAVAILABLE").length;

    const json: ControlPlaneReportPayload = {
      reportId,
      timestamp,
      overallHealth: health.overallHealth,
      readinessScore: health.operationalReadiness,
      topologySummary: {
        totalEngines,
        activeEnginesCount,
        degradedEnginesCount,
        unavailableEnginesCount,
        engines: engines.map((e) => ({
          id: e.id,
          name: e.name,
          version: e.version,
          owner: e.owner,
          status: health.engineHealth[e.id]?.status ?? e.status,
          capabilities: e.capabilities
        }))
      },
      dependencyReport: {
        valid: dependencies.success,
        missingCount: dependencies.missing.length,
        cyclesCount: dependencies.cycles.length,
        incompatibleCount: dependencies.incompatible.length,
        duplicateOwnershipCount: dependencies.duplicateOwnership.length,
        resolvedExecutionGraph: dependencies.resolvedOrder,
        details: dependencies
      },
      healthSummaryDetail: health,
      executionSession: execution
    };

    // Build the beautiful Markdown report
    const healthIcon =
      health.overallHealth === "HEALTHY"
        ? "🟩"
        : health.overallHealth === "PARTIALLY_DEGRADED"
        ? "🟨"
        : health.overallHealth === "DEGRADED"
        ? "🟧"
        : "🟥";

    let markdown = `
# 🎛️ DORK ENTERPRISE OPERATIONAL CONTROL PLANE REPORT

**Report ID:** \`${reportId}\`  
**Generated At:** \`${timestamp}\`  
**Platform Status:** **${healthIcon} ${health.overallHealth}**  
**Operational Readiness Score:** **\`${health.operationalReadiness}/100\`**

---

## 📈 Executive Readiness Overview
The Dork Enterprise Operational Control Plane establishes real-time operational boundaries and coordinates all active system engines without retaining transient state.

- **Total Registered Engines:** \`${totalEngines}\`
- **Fully Operational (ACTIVE):** \`${activeEnginesCount}\`
- **Degraded Control Paths:** \`${degradedEnginesCount}\`
- **Critical Breaches (UNAVAILABLE):** \`${unavailableEnginesCount}\`

---

## 🗺️ Topology Summary & Capability Matrix

| Engine ID | Name | Version | Owner | Capabilities | Live Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
${engines
  .map((e) => {
    const eStatus = health.engineHealth[e.id]?.status ?? e.status;
    const icon = eStatus === "ACTIVE" ? "🟩 ACTIVE" : eStatus === "STANDBY" ? "🟨 STANDBY" : eStatus === "DEGRADED" ? "🟧 DEGRADED" : "🟥 UNAVAILABLE";
    return `| \`${e.id}\` | ${e.name} | \`${e.version}\` | \`${e.owner}\` | ${e.capabilities.map((cap) => `\`${cap}\``).join(", ")} | ${icon} |`;
  })
  .join("\n")}

---

## 🕸️ Dependency & Version Compatibility Matrix

- **Graph Validation Status:** ${dependencies.success ? "🟩 COMPLIANT" : "🟥 VIOLATION DETECTED"}
- **Missing Dependencies:** \`${dependencies.missing.length}\`
- **Circular References (Cycles):** \`${dependencies.cycles.length}\`
- **Incompatible Engine Versions:** \`${dependencies.incompatible.length}\`
- **Duplicate Owner Audits:** \`${dependencies.duplicateOwnership.length}\`

### 🔄 Resolved Topological Execution Order
This sequence represents the mathematically determined execution pathway that honors all priority constraints and inter-engine relationships:
\`\`\`
${dependencies.resolvedOrder.join(" ──► ")}
\`\`\`

`.trim();

    if (dependencies.missing.length > 0) {
      markdown += `\n### 🚨 Missing Engine Paths\n`;
      dependencies.missing.forEach((m) => {
        markdown += `- Engine \`${m.dependentId}\` declares dependency on missing engine \`${m.engineId}\`\n`;
      });
    }

    if (dependencies.cycles.length > 0) {
      markdown += `\n### 🔄 Circular Dependency Cycles\n`;
      dependencies.cycles.forEach((cyc, idx) => {
        markdown += `- Cycle #${idx + 1}: \`${cyc.join(" ──► ")}\`\n`;
      });
    }

    if (dependencies.incompatible.length > 0) {
      markdown += `\n### ⚠️ Version Incompatibilities\n`;
      dependencies.incompatible.forEach((inc) => {
        markdown += `- Engine \`${inc.dependentId}\` requires \`${inc.engineId}\` range \`${inc.required}\` but actual version is \`${inc.actual}\`\n`;
      });
    }

    if (dependencies.duplicateOwnership.length > 0) {
      markdown += `\n### 👥 Overlapping Ownership warnings\n`;
      dependencies.duplicateOwnership.forEach((o) => {
        markdown += `- \`${o.owner}\` manages engines: ${o.engines.map((e) => `\`${e}\``).join(", ")}\n`;
      });
    }

    if (execution) {
      const execIcon = execution.success ? "🟩 SUCCESS" : "🟥 FAILED";
      markdown += `
---

## ⚡ Execution Session Report (\`${execution.executionId}\`)

- **Execution Mode:** \`${execution.mode}\`
- **Result Status:** **${execIcon}**
- **Passed Tasks:** \`${execution.passedCount}\`
- **Failed Tasks:** \`${execution.failedCount}\`
- **Skipped Tasks:** \`${execution.skippedCount}\`
- **Total Duration:** \`${execution.totalDurationMs}ms\`

### Task Checklist Matrix
| Task ID | Engine ID | Task Name | Status | Duration | Output/Error |
| :--- | :--- | :--- | :--- | :--- | :--- |
${execution.tasks
  .map((t) => {
    const tIcon = t.status === "PASSED" ? "🟩 PASS" : t.status === "FAILED" ? "🟥 FAIL" : "🟨 SKIP";
    const detail = t.status === "FAILED" ? t.error : typeof t.output === "object" ? JSON.stringify(t.output) : t.output ?? "None";
    return `| \`${t.taskId}\` | \`${t.engineId}\` | ${t.name} | ${tIcon} | \`${t.durationMs}ms\` | ${detail} |`;
  })
  .join("\n")}
`;
    }

    markdown += `\n\n*Dork Enterprise Control Plane SRE Engine v1.0.0*`;

    return { json, markdown };
  }
}
