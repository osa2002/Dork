import { ModuleRegistry } from "./ModuleRegistry";
import { CompatibilityMatrix } from "./CompatibilityMatrix";
import { DependencyCatalog } from "./DependencyCatalog";

export interface PlatformHealthSummary {
  readonly readinessScore: number;
  readonly healthScore: number;
  readonly compatibilityScore: number;
  readonly dependencyScore: number;
  readonly registrationScore: number;
  readonly overallHealthScore: number;
  readonly systemStatus: "HEALTHY" | "DEGRADED" | "CRITICAL";
}

export class PlatformHealth {
  /**
   * Compiles and calculates multi-variable platform health equations.
   */
  public static evaluate(): PlatformHealthSummary {
    const modules = ModuleRegistry.getAll();

    // 1. Readiness Score: Mean readiness across all registered engines
    const totalReadiness = modules.reduce((acc, m) => acc + m.readiness, 0);
    const readinessScore = modules.length > 0 ? Math.round(totalReadiness / modules.length) : 100;

    // 2. Health Score: State mapping value mean
    // ACTIVE -> 100, STANDBY -> 90, DEGRADED -> 60, UNAVAILABLE -> 0
    const healthMap = {
      ACTIVE: 100,
      STANDBY: 90,
      DEGRADED: 60,
      UNAVAILABLE: 0,
    };
    const totalHealthPoints = modules.reduce((acc, m) => acc + (healthMap[m.health] ?? 100), 0);
    const healthScore = modules.length > 0 ? Math.round(totalHealthPoints / modules.length) : 100;

    // 3. Compatibility Score: Evaluated from Compatibility Matrix
    const compatReport = CompatibilityMatrix.evaluate();
    const compatibilityScore = compatReport.compatibilityScore;

    // 4. Dependency Score: Deductions for missing or circular connections
    const depAudit = DependencyCatalog.audit();
    const missingDeduction = depAudit.missingDependencies.length * 15;
    const circularDeduction = depAudit.circularDependencies.length * 25;
    const dependencyScore = Math.max(0, 100 - missingDeduction - circularDeduction);

    // 5. Registration Score: Structural completeness of metadata
    let validRegistrationsCount = 0;
    modules.forEach((m) => {
      const hasId = typeof m.id === "string" && m.id.length > 0;
      const hasName = typeof m.name === "string" && m.name.length > 0;
      const hasVersion = typeof m.version === "string" && m.version.length > 0;
      const hasOwner = typeof m.owner === "string" && m.owner.length > 0;
      const hasCaps = Array.isArray(m.capabilities) && m.capabilities.length > 0;
      const hasAPIs = Array.isArray(m.supportedAPIs);

      if (hasId && hasName && hasVersion && hasOwner && hasCaps && hasAPIs) {
        validRegistrationsCount++;
      }
    });
    const registrationScore = modules.length > 0 ? Math.round((validRegistrationsCount / modules.length) * 100) : 100;

    // 6. Overall Enterprise Health Score (Weighted index)
    // Dependencies & Compatibility are core pillars (25% each), followed by Readiness (20%), Health (20%), and Registration (10%)
    const overallHealthScore = Math.round(
      readinessScore * 0.2 +
        healthScore * 0.2 +
        compatibilityScore * 0.25 +
        dependencyScore * 0.25 +
        registrationScore * 0.1
    );

    // 7. System status classification
    let systemStatus: "HEALTHY" | "DEGRADED" | "CRITICAL" = "HEALTHY";
    if (overallHealthScore < 70 || healthScore < 60 || compatibilityScore < 70) {
      systemStatus = "CRITICAL";
    } else if (overallHealthScore < 90 || healthScore < 90 || compatibilityScore < 90) {
      systemStatus = "DEGRADED";
    }

    return Object.freeze({
      readinessScore,
      healthScore,
      compatibilityScore,
      dependencyScore,
      registrationScore,
      overallHealthScore,
      systemStatus,
    });
  }
}
