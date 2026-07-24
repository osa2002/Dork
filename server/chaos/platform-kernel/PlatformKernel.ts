import { ModuleRegistry } from "./ModuleRegistry";
import { CapabilityRegistry } from "./CapabilityRegistry";
import { ServiceDiscovery } from "./ServiceDiscovery";
import { PlatformKernelEngine, PlatformKernelAuditResult } from "./PlatformKernelEngine";

export class PlatformKernel {
  /**
   * Single source of truth for all module registrations.
   */
  public static readonly modules = ModuleRegistry;

  /**
   * Capability and API provider registries.
   */
  public static readonly capabilities = CapabilityRegistry;

  /**
   * Service discovery query engine.
   */
  public static readonly discovery = ServiceDiscovery;

  /**
   * Executes a stateless system-wide capability, compatibility, and health audit.
   */
  public static evaluate(
    environment: "production" | "staging" | "development" = "production",
    correlationId?: string
  ): PlatformKernelAuditResult {
    return PlatformKernelEngine.evaluate(environment, correlationId);
  }
}
