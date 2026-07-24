import { EngineDescriptor } from "./EngineDescriptor";
import { DependencyResolver } from "./DependencyResolver";

export interface EngineHealthDetail {
  id: string;
  name: string;
  status: "ACTIVE" | "DEGRADED" | "STANDBY" | "UNAVAILABLE";
  latencyMs?: number;
  reason?: string;
  lastChecked: string;
}

export interface HealthSummary {
  overallHealth: "HEALTHY" | "DEGRADED" | "PARTIALLY_DEGRADED" | "UNAVAILABLE";
  engineHealth: Record<string, EngineHealthDetail>;
  dependencyHealth: {
    success: boolean;
    missingDependenciesCount: number;
    unresolvedCyclesCount: number;
    incompatibleVersionsCount: number;
  };
  operationalReadiness: number; // 0 to 100
}

export class HealthCoordinator {
  /**
   * Aggregates live health statuses from all registered engines and calculates overall operational readiness.
   */
  public static evaluateHealth(engines: EngineDescriptor[]): HealthSummary {
    const timestamp = new Date().toISOString();
    const engineHealth: Record<string, EngineHealthDetail> = {};

    let totalDeductions = 0;
    let criticalFailuresCount = 0;
    let degradedCount = 0;

    // 1. Resolve dependencies to assess dependency health impacts
    const depReport = DependencyResolver.resolve(engines);

    // 2. Query each engine's health
    for (const eng of engines) {
      let status: "ACTIVE" | "DEGRADED" | "STANDBY" | "UNAVAILABLE" = eng.status || "ACTIVE";
      let reason = "Engine operating normally";

      try {
        // Dynamic inspection of instance for health or status reporting methods
        const inst = eng.instance;
        if (inst) {
          if (typeof inst.getHealthStatus === "function") {
            const liveHealth = inst.getHealthStatus();
            if (liveHealth && liveHealth.status) {
              const liveStatus = liveHealth.status;
              if (liveStatus === "HEALTHY" || liveStatus === "ACTIVE") {
                status = "ACTIVE";
              } else if (liveStatus === "DEGRADED") {
                status = "DEGRADED";
              } else if (liveStatus === "PARTIALLY_DEGRADED") {
                status = "DEGRADED";
              } else if (liveStatus === "UNAVAILABLE") {
                status = "UNAVAILABLE";
              }
              if (liveHealth.reason) {
                reason = liveHealth.reason;
              }
            }
          } else if (typeof inst.getStatus === "function") {
            const liveStatus = inst.getStatus();
            if (typeof liveStatus === "string") {
              if (["ACTIVE", "DEGRADED", "STANDBY", "UNAVAILABLE"].includes(liveStatus)) {
                status = liveStatus as any;
              }
            }
          }
        }
      } catch (err: any) {
        status = "UNAVAILABLE";
        reason = `Health query exception: ${err.message}`;
      }

      // Deduct readiness based on engine status
      if (status === "UNAVAILABLE") {
        totalDeductions += 25;
        criticalFailuresCount++;
        reason = reason || "Engine is unavailable";
      } else if (status === "DEGRADED") {
        totalDeductions += 10;
        degradedCount++;
        reason = reason || "Engine is degraded";
      } else if (status === "STANDBY") {
        totalDeductions += 2;
        reason = reason || "Engine is in standby";
      }

      engineHealth[eng.id] = {
        id: eng.id,
        name: eng.name,
        status,
        reason,
        lastChecked: timestamp
      };
    }

    // 3. Add deductions for dependency issues
    const missingCount = depReport.missing.length;
    const cycleCount = depReport.cycles.length;
    const incompatibleCount = depReport.incompatible.length;

    totalDeductions += missingCount * 15;
    totalDeductions += cycleCount * 20;
    totalDeductions += incompatibleCount * 10;

    // Calculate Operational Readiness (0 to 100)
    const operationalReadiness = Math.max(0, 100 - totalDeductions);

    // 4. Map overall health
    let overallHealth: "HEALTHY" | "DEGRADED" | "PARTIALLY_DEGRADED" | "UNAVAILABLE" = "HEALTHY";

    if (operationalReadiness < 50 || criticalFailuresCount > 1 || missingCount > 2) {
      overallHealth = "UNAVAILABLE";
    } else if (operationalReadiness < 85 || criticalFailuresCount === 1 || degradedCount > 1) {
      overallHealth = "DEGRADED";
    } else if (operationalReadiness < 98 || degradedCount === 1 || incompatibleCount > 0 || cycleCount > 0) {
      overallHealth = "PARTIALLY_DEGRADED";
    }

    return {
      overallHealth,
      engineHealth,
      dependencyHealth: {
        success: depReport.success,
        missingDependenciesCount: missingCount,
        unresolvedCyclesCount: cycleCount,
        incompatibleVersionsCount: incompatibleCount
      },
      operationalReadiness
    };
  }
}
