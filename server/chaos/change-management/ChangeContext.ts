import { OperationsCenter, OperationsCenterData } from "../operations/OperationsCenter";
import { GovernanceContext, GovernanceContextData } from "../governance/GovernanceContext";
import { DigitalTwinEngine } from "../digital-twin/DigitalTwinEngine";
import { TwinSnapshot } from "../digital-twin/TwinSnapshot";
import { PredictionEngine } from "../prediction/PredictionEngine";
import { ValidationHistory } from "../validation/ValidationHistory";
import { RecoveryHistory } from "../recovery/RecoveryHistory";
import { IncidentService } from "../../../src/services/IncidentService";

export interface ChangeContextPayload {
  readonly timestamp: string;
  readonly environment: "production" | "staging" | "development";
  readonly liveState: OperationsCenterData;
  readonly governanceData: GovernanceContextData;
  readonly twinSnapshot: TwinSnapshot;
  readonly currentFailureProbabilityRisk: number;
  readonly activeIncidentsCount: number;
  readonly activeRecoveriesCount: number;
  readonly totalValidationRuns: number;
}

export class ChangeContext {
  /**
   * Compiles the dynamic read-only Change Context from across SRE platform subsystems.
   */
  public static compile(
    environment: "production" | "staging" | "development" = "production",
    requester?: {
      readonly id: string;
      readonly team: string;
      readonly role: "SRE_LEAD" | "SRE_OPERATOR" | "DEVELOPER" | "GUEST";
      readonly permissions: string[];
    },
    targetExperiment?: {
      readonly id: string;
      readonly name: string;
      readonly estimatedRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      readonly affectedSubsystems: string[];
      readonly requiresApproval: boolean;
    }
  ): ChangeContextPayload {
    const timestamp = new Date().toISOString();
    const liveState = OperationsCenter.collectLiveState();
    const governanceData = GovernanceContext.compile(environment, requester, targetExperiment);

    // Capture the digital twin snapshot
    const twinState = DigitalTwinEngine.createTwinFromProduction(`corr-chg-ctx-${Math.random().toString(36).substring(2, 9)}`);
    const twinSnapshot = twinState.getData();

    // Use prediction engine
    const prediction = PredictionEngine.generatePrediction("FAILURE_PROBABILITY");
    const currentFailureProbabilityRisk = prediction.riskScore;

    // Get active incidents
    const incidents = IncidentService.getIncidents();
    const activeIncidentsCount = incidents.filter((i) => i.status !== "RESOLVED").length;

    // Get active recoveries
    const recoveries = RecoveryHistory.getHistory();
    const activeRecoveriesCount = recoveries.filter((r) => r.status === "PENDING_APPROVAL").length;

    // Total validation runs
    const totalValidationRuns = ValidationHistory.getHistory().length;

    return Object.freeze({
      timestamp,
      environment,
      liveState,
      governanceData,
      twinSnapshot,
      currentFailureProbabilityRisk,
      activeIncidentsCount,
      activeRecoveriesCount,
      totalValidationRuns,
    });
  }
}
