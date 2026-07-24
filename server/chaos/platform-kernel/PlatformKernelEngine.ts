import { PlatformContextManager, PlatformContext } from "./PlatformContext";
import { PlatformTopology, PlatformTopologyData } from "./PlatformTopology";
import { CompatibilityMatrix, CompatibilityReport } from "./CompatibilityMatrix";
import { PlatformHealth, PlatformHealthSummary } from "./PlatformHealth";
import { PlatformReporter } from "./PlatformReporter";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";
import { ModuleRegistry } from "./ModuleRegistry";

export interface PlatformKernelAuditResult {
  readonly context: PlatformContext;
  readonly topology: PlatformTopologyData;
  readonly compatibility: CompatibilityReport;
  readonly health: PlatformHealthSummary;
  readonly reportMarkdown: string;
  readonly reportJson: string;
}

export class PlatformKernelEngine {
  /**
   * Executes a full, stateless, read-only audit of the entire Enterprise Platform Kernel.
   */
  public static evaluate(
    environment: "production" | "staging" | "development" = "production",
    correlationId?: string
  ): PlatformKernelAuditResult {
    const context = PlatformContextManager.create(environment, correlationId);

    // 1. Compile Live Platform Topology
    const topology = PlatformTopology.generate();

    // 2. Audit Compatibility Matrix
    const compatibility = CompatibilityMatrix.evaluate();

    // 3. Score overall platform Health
    const health = PlatformHealth.evaluate();

    // 4. Compile detailed reports
    const reportMarkdown = PlatformReporter.generateMarkdown(
      context,
      topology,
      compatibility,
      health
    );
    const reportJson = PlatformReporter.generateJson(
      context,
      topology,
      compatibility,
      health
    );

    // 5. Publish Audit Event to the Enterprise Event Bus
    try {
      EnterpriseEventBus.publish(
        "PlatformStateAudited",
        {
          timestamp: context.timestamp,
          platformId: context.platformId,
          healthScore: health.overallHealthScore,
          systemStatus: health.systemStatus,
          engineCount: ModuleRegistry.getAll().length,
          isCompatible: compatibility.isCompatible,
          compatibilityScore: compatibility.compatibilityScore,
        },
        context.correlationId
      );
    } catch (error) {
      console.warn("Telemetry publish skipped in PlatformKernelEngine:", error);
    }

    return Object.freeze({
      context,
      topology,
      compatibility,
      health,
      reportMarkdown,
      reportJson,
    });
  }
}
