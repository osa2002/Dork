export interface EngineManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly owner: string;
  readonly capabilities: readonly string[];
  readonly dependencies: readonly string[];
  readonly readiness: number; // 0 to 100
  readonly health: "ACTIVE" | "DEGRADED" | "STANDBY" | "UNAVAILABLE";
  readonly lifecycle: {
    readonly hasInitialize: boolean;
    readonly hasExecute: boolean;
    readonly hasCleanup: boolean;
  };
  readonly supportedAPIs: readonly string[];
  readonly compatibilityVersions: Record<string, string>;
}
