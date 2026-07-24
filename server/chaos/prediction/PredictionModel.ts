export type PredictionType =
  | "FAILURE_PROBABILITY"
  | "RECOVERY_PROBABILITY"
  | "ERROR_BUDGET_CONSUMPTION"
  | "MTTR_EVOLUTION"
  | "BLAST_RADIUS_EVOLUTION"
  | "SUBSYSTEM_DEGRADATION"
  | "DEPENDENCY_INSTABILITY";

export interface PredictionModel {
  readonly predictionId: string;
  readonly timestamp: string;
  readonly correlationId: string;
  readonly predictionType: PredictionType;
  readonly confidence: number; // confidence score (0.0 to 1.0)
  readonly riskScore: number; // 0 to 100 risk score
  readonly predictedFailure: string; // failure mode or reason
  readonly predictedRecovery: string; // recovery workflow or action name
  readonly predictedMTTR: number; // predicted MTTR in ms
  readonly predictedBlastRadius: "Minimal" | "Low" | "Medium" | "High";
  readonly predictedErrorBudgetConsumption: number; // percentage (0 - 100)
  readonly affectedSubsystems: readonly string[];
  readonly supportingEvidence: readonly string[];
  readonly recommendations: readonly string[];
}
