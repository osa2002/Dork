import { PlatformContext } from "./PlatformContext";
import { PlatformTopologyData } from "./PlatformTopology";
import { CompatibilityReport } from "./CompatibilityMatrix";
import { PlatformHealthSummary } from "./PlatformHealth";
import { ModuleRegistry } from "./ModuleRegistry";

export class PlatformReporter {
  /**
   * Generates a structural SRE Markdown Report for executive review.
   */
  public static generateMarkdown(
    context: PlatformContext,
    topology: PlatformTopologyData,
    compatibility: CompatibilityReport,
    health: PlatformHealthSummary
  ): string {
    // Generate intelligent SRE recommendations
    const recommendations: string[] = [];

    if (health.overallHealthScore < 90) {
      recommendations.push(
        "- ⚠️ **Critical Alert**: Overall platform health has dipped below enterprise SLA targets (90%). Investigate degraded modules immediately."
      );
    }

    const failedChecks = compatibility.checks.filter((c) => c.status === "FAIL");
    if (failedChecks.length > 0) {
      failedChecks.forEach((check) => {
        recommendations.push(
          `- 🛠️ **Refactor Action (${check.type})**: Align ${check.sourceEngineId} dependency structures. Incident: ${check.message}`
        );
      });
    }

    // Detect isolated nodes (orphans)
    const orphans = ModuleRegistry.getAll()
      .filter((m) => m.dependencies.length === 0)
      .map((m) => m.id);
    if (orphans.length > 10) {
      recommendations.push(
        "- ℹ️ **Recommendation**: Review loose module registration boundaries. Ensure modular engines subscribe to the Enterprise Event Bus."
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "- ✅ **Status Certified**: Zero architectural violations or dependency mismatches detected. Platform certified for high-capacity production load."
      );
    }

    return `
# ENTERPRISE PLATFORM KERNEL & CAPABILITY REGISTRY AUDIT REPORT

## 1. Executive Summary
- **Session Timestamp**: \`${context.timestamp}\`
- **Environment**: \`${context.environment}\`
- **Correlation ID**: \`${context.correlationId}\`
- **Kernel Version**: \`v${context.kernelVersion}\`
- **Unified Platform Health Score**: **${health.overallHealthScore}%** (Status: **${health.systemStatus}**)

---

## 2. Multi-Dimensional Scorecard
| Metric Core Pillar | Calculated Score | Status Target |
| :--- | :--- | :--- |
| **Operational Readiness Score** | \`${health.readinessScore}%\` | \`>=95%\` |
| **Active Subsystem Health Score** | \`${health.healthScore}%\` | \`>=95%\` |
| **API & Version Compatibility Score** | \`${health.compatibilityScore}%\` | \`100%\` |
| **Dependency Integrity Score** | \`${health.dependencyScore}%\` | \`100%\` |
| **Metadata Registration Score** | \`${health.registrationScore}%\` | \`100%\` |

---

## 3. Platform Architecture & Topology
### Module Layers (Topologically Sorted)
${topology.topologicalLayers.map((layer, index) => `${index + 1}. \`${layer}\``).join("\n")}

### Registered Capabilities Mapping
${Object.entries(topology.capabilityGraph)
  .map(([cap, providers]) => `- **Capability \`${cap}\`**: provided by [${providers.map((p) => `\`${p}\``).join(", ")}]`)
  .join("\n")}

---

## 4. Architectural Compatibility Ledger
- **Status**: **${compatibility.isCompatible ? "COMPATIBLE" : "INCOMPATIBLE"}**
- **SLA Audited Checks Count**: \`${compatibility.checks.length}\`

### Compatibility Violations
${
  failedChecks.length === 0
    ? "*Zero contract failures, API mismatches, or lifecycle overrides detected.*"
    : failedChecks.map((v) => `- ❌ **[${v.type}]** on module \`${v.sourceEngineId}\`: ${v.message}`).join("\n")
}

---

## 5. Strategic SRE Mitigations & Recommendations
${recommendations.join("\n")}
    `.trim();
  }

  /**
   * Generates a beautiful structured JSON Report payload.
   */
  public static generateJson(
    context: PlatformContext,
    topology: PlatformTopologyData,
    compatibility: CompatibilityReport,
    health: PlatformHealthSummary
  ): string {
    const payload = {
      context,
      health,
      topology,
      compatibility,
      engineCount: ModuleRegistry.getAll().length,
    };
    return JSON.stringify(payload, null, 2);
  }
}
