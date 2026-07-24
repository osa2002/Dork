import { EngineLifecycle } from "./EngineLifecycle";

export interface EngineDescriptor {
  id: string;
  name: string;
  version: string;
  status: "ACTIVE" | "DEGRADED" | "STANDBY" | "UNAVAILABLE";
  owner: string;
  capabilities: string[];
  dependencies: string[];
  compatibilityMatrix: Record<string, string>; // dependencyId -> compatible version ranges (e.g. "^1.0.0")
  priority: number; // Execution order priority (higher value runs first in same stage)
  instance: any; // Direct reference to the singleton instance
  lifecycle: EngineLifecycle;
}
