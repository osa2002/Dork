import { ModuleRegistry } from "./ModuleRegistry";
import { VersionCatalog } from "./VersionCatalog";
import { DependencyCatalog } from "./DependencyCatalog";

export interface CompatibilityCheck {
  readonly type: "VERSION" | "API" | "DEPENDENCY" | "LIFECYCLE";
  readonly status: "PASS" | "FAIL";
  readonly sourceEngineId: string;
  readonly targetEngineId?: string;
  readonly message: string;
}

export interface CompatibilityReport {
  readonly isCompatible: boolean;
  readonly compatibilityScore: number; // 0 to 100
  readonly checks: readonly CompatibilityCheck[];
}

export class CompatibilityMatrix {
  /**
   * Evaluates and audits compliance and capability compatibility.
   */
  public static evaluate(): CompatibilityReport {
    const modules = ModuleRegistry.getAll();
    const modulesMap = new Map(modules.map((m) => [m.id, m]));
    const checks: CompatibilityCheck[] = [];

    // 1. Dependency topology check
    const depReport = DependencyCatalog.audit();
    depReport.missingDependencies.forEach((m) => {
      checks.push({
        type: "DEPENDENCY",
        status: "FAIL",
        sourceEngineId: m.id,
        targetEngineId: m.dependencyId,
        message: `Dependency '${m.dependencyId}' requested by '${m.id}' is missing from the registry.`,
      });
    });

    depReport.circularDependencies.forEach((cycle) => {
      checks.push({
        type: "DEPENDENCY",
        status: "FAIL",
        sourceEngineId: cycle[0],
        message: `Circular dependency path detected: ${cycle.join(" -> ")}`,
      });
    });

    // 2. Process version alignment
    modules.forEach((m) => {
      Object.entries(m.compatibilityVersions).forEach(([depId, range]) => {
        const target = modulesMap.get(depId);
        if (!target) {
          // Handled by missing dependencies check
          return;
        }

        const isSatisfied = VersionCatalog.satisfies(target.version, range);
        checks.push({
          type: "VERSION",
          status: isSatisfied ? "PASS" : "FAIL",
          sourceEngineId: m.id,
          targetEngineId: depId,
          message: isSatisfied
            ? `Version check passed: '${target.id}' (${target.version}) satisfies requested range '${range}' for '${m.id}'.`
            : `Version mismatch: '${target.id}' is registered at '${target.version}' which does not satisfy '${range}' requested by '${m.id}'.`,
        });
      });
    });

    // 3. API Contract Compatibility
    // Every dependency should have some expected APIs based on standard service discovery
    modules.forEach((m) => {
      m.dependencies.forEach((depId) => {
        const target = modulesMap.get(depId);
        if (!target) return;

        // If a target has 0 supported APIs, warn/fail contract
        const hasAPIs = target.supportedAPIs.length > 0;
        checks.push({
          type: "API",
          status: hasAPIs ? "PASS" : "FAIL",
          sourceEngineId: m.id,
          targetEngineId: depId,
          message: hasAPIs
            ? `API compliance verified for target '${depId}'. Exposed methods: [${target.supportedAPIs.join(", ")}].`
            : `API contract warning: dependency target '${depId}' exposes no public API interfaces.`,
        });
      });
    });

    // 4. Lifecycle Readiness & Availability Alignment
    modules.forEach((m) => {
      const isAvailable = m.health !== "UNAVAILABLE";
      checks.push({
        type: "LIFECYCLE",
        status: isAvailable ? "PASS" : "FAIL",
        sourceEngineId: m.id,
        message: isAvailable
          ? `Lifecycle of engine '${m.id}' is operational. Registered hooks: [${[
              m.lifecycle.hasInitialize ? "init" : "",
              m.lifecycle.hasExecute ? "exec" : "",
              m.lifecycle.hasCleanup ? "cleanup" : "",
            ]
              .filter(Boolean)
              .join(", ")}].`
          : `Lifecycle fault: engine '${m.id}' is marked as UNAVAILABLE.`,
      });
    });

    // Compute metrics
    const totalChecks = checks.length;
    const passedChecks = checks.filter((c) => c.status === "PASS").length;
    const compatibilityScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;
    const isCompatible = checks.every((c) => c.status === "PASS");

    return Object.freeze({
      isCompatible,
      compatibilityScore,
      checks: Object.freeze(checks),
    });
  }
}
