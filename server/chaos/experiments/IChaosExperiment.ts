export interface IChaosExperiment {
  name: string;
  description: string;
  riskLevel: "Low" | "Medium" | "High" | "Critical";
  blastRadius: "Minimal" | "Low" | "Medium" | "High";
  automaticRollback: boolean;
  manualRollback: string;
  expectedMetrics: string[];
  expectedTelemetry: string[];
  expectedRecovery: string;
  estimatedExecutionDuration: number; // in milliseconds

  prepare(): Promise<void>;
  execute(): Promise<void>;
  verify(): Promise<boolean>;
  rollback(): Promise<void>;
  cleanup(): Promise<void>;
}

export function isChaosAllowed(): boolean {
  return process.env.CHAOS_MODE === "true" && process.env.NODE_ENV !== "production";
}
