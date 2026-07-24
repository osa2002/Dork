import { ModuleRegistry } from "./ModuleRegistry";
import { EngineManifest } from "./EngineManifest";

export interface ServiceDiscoveryResult {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly owner: string;
  readonly capabilities: readonly string[];
  readonly dependencies: readonly string[];
  readonly supportedAPIs: readonly string[];
  readonly health: "ACTIVE" | "DEGRADED" | "STANDBY" | "UNAVAILABLE";
  readonly readiness: number;
}

export class ServiceDiscovery {
  /**
   * Discovers all active and registered engines matching optional search criteria.
   */
  public static discover(filter?: {
    readonly id?: string;
    readonly capability?: string;
    readonly dependency?: string;
    readonly api?: string;
  }): readonly ServiceDiscoveryResult[] {
    let list = ModuleRegistry.getAll();

    if (filter) {
      if (filter.id) {
        list = list.filter((m) => m.id === filter.id);
      }
      if (filter.capability) {
        list = list.filter((m) => m.capabilities.includes(filter.capability!));
      }
      if (filter.dependency) {
        list = list.filter((m) => m.dependencies.includes(filter.dependency!));
      }
      if (filter.api) {
        list = list.filter((m) => m.supportedAPIs.includes(filter.api!));
      }
    }

    const results: ServiceDiscoveryResult[] = list.map((m) => ({
      id: m.id,
      name: m.name,
      version: m.version,
      owner: m.owner,
      capabilities: m.capabilities,
      dependencies: m.dependencies,
      supportedAPIs: m.supportedAPIs,
      health: m.health,
      readiness: m.readiness,
    }));

    return Object.freeze(results);
  }

  /**
   * Discovers the exact API signatures and capabilities of a single engine.
   */
  public static locate(id: string): ServiceDiscoveryResult | undefined {
    const m = ModuleRegistry.get(id);
    if (!m) return undefined;
    return Object.freeze({
      id: m.id,
      name: m.name,
      version: m.version,
      owner: m.owner,
      capabilities: m.capabilities,
      dependencies: m.dependencies,
      supportedAPIs: m.supportedAPIs,
      health: m.health,
      readiness: m.readiness,
    });
  }
}
