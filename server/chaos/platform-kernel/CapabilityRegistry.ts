import { ModuleRegistry } from "./ModuleRegistry";
import { EngineManifest } from "./EngineManifest";

export class CapabilityRegistry {
  /**
   * Retrieves all unique capabilities declared across the platform.
   */
  public static getAllCapabilities(): readonly string[] {
    const caps = new Set<string>();
    ModuleRegistry.getAll().forEach((manifest) => {
      manifest.capabilities.forEach((cap) => caps.add(cap));
    });
    return Object.freeze(Array.from(caps).sort());
  }

  /**
   * Discovers which modules provide a specific capability.
   */
  public static findByCapability(capability: string): readonly EngineManifest[] {
    const providers = ModuleRegistry.getAll().filter((manifest) =>
      manifest.capabilities.includes(capability)
    );
    return Object.freeze(providers);
  }

  /**
   * Discovers which modules provide a specific API function.
   */
  public static findByAPI(apiName: string): readonly EngineManifest[] {
    const providers = ModuleRegistry.getAll().filter((manifest) =>
      manifest.supportedAPIs.includes(apiName)
    );
    return Object.freeze(providers);
  }
}
