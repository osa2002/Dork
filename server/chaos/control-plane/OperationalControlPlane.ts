import { ControlPlaneContext } from "./ControlPlaneContext";
import { ControlPlaneRegistry } from "./ControlPlaneRegistry";
import { DependencyResolver, DependencyReport } from "./DependencyResolver";
import { HealthCoordinator, HealthSummary } from "./HealthCoordinator";
import { ControlPlaneReporter, ControlPlaneReportPayload } from "./ControlPlaneReporter";
import { ExecutionCoordinator, ExecutionTask, ExecutionSessionReport } from "./ExecutionCoordinator";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

export class OperationalControlPlane {
  /**
   * Run a full health evaluation on all registered engines.
   */
  public static evaluateHealth(): HealthSummary {
    const engines = ControlPlaneRegistry.getAll();
    return HealthCoordinator.evaluateHealth(engines);
  }

  /**
   * Audit all registered engines for cycles, missing paths, version conflicts, or duplications.
   */
  public static auditDependencies(): DependencyReport {
    const engines = ControlPlaneRegistry.getAll();
    return DependencyResolver.resolve(engines);
  }

  /**
   * Orchestrates a list of operational tasks, collects telemetry, aggregates engine healths,
   * generates detailed SRE reports, and publishes control events on the Enterprise Event Bus.
   */
  public static async coordinateExecution(
    mode: "SEQUENTIAL" | "PARALLEL" | "CONDITIONAL" | "DEPENDENCY_AWARE",
    tasks: ExecutionTask[],
    correlationId?: string
  ): Promise<{
    executionId: string;
    session: ExecutionSessionReport;
    health: HealthSummary;
    report: { json: ControlPlaneReportPayload; markdown: string };
  }> {
    const corrId = correlationId || `corr-cp-${Math.random().toString(36).substring(2, 9)}`;
    
    const ctx: ControlPlaneContext = {
      controlPlaneId: `cp-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      correlationId: corrId,
      executionMode: mode
    };

    // 1. Run Execution Session
    const session = await ExecutionCoordinator.coordinate(tasks, ctx);

    // 2. Audit current platform state & dependencies
    const engines = ControlPlaneRegistry.getAll();
    const health = HealthCoordinator.evaluateHealth(engines);
    const dependencies = DependencyResolver.resolve(engines);

    // 3. Compile full report
    const report = ControlPlaneReporter.generateReport(engines, health, dependencies, session);

    // 4. Publish Event to Enterprise Event Bus
    try {
      EnterpriseEventBus.publish(
        "SystemStateChanged", // Matches the required system state channel
        {
          controlPlaneId: ctx.controlPlaneId,
          correlationId: corrId,
          success: session.success,
          passedTasksCount: session.passedCount,
          failedTasksCount: session.failedCount,
          skippedTasksCount: session.skippedCount,
          overallReadiness: health.operationalReadiness
        },
        corrId
      );
    } catch (e) {
      // Graceful fallback if EventBus triggers any error, ensuring pure failure-isolated execution
      console.warn("Control Plane telemetry publish skipped:", e);
    }

    return {
      executionId: ctx.controlPlaneId,
      session,
      health,
      report
    };
  }
}
