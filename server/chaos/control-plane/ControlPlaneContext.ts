export interface ControlPlaneContext {
  controlPlaneId: string;
  timestamp: string;
  correlationId: string;
  executionMode: "SEQUENTIAL" | "PARALLEL" | "CONDITIONAL" | "DEPENDENCY_AWARE";
  metadata?: Record<string, any>;
}
