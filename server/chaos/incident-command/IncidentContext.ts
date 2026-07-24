import { OperationsCenter, OperationsCenterData } from "../operations/OperationsCenter";
import { GovernanceContext, GovernanceContextData } from "../governance/GovernanceContext";
import { TwinSnapshot } from "../digital-twin/TwinSnapshot";
import { DigitalTwinEngine } from "../digital-twin/DigitalTwinEngine";
import { PredictionModel } from "../prediction/PredictionModel";
import { PredictionEngine } from "../prediction/PredictionEngine";
import { ValidationRunRecord, ValidationHistory } from "../validation/ValidationHistory";
import { RecoveryResult } from "../recovery/RecoveryResult";
import { RecoveryHistory } from "../recovery/RecoveryHistory";
import { KnowledgeRecord } from "../knowledge/KnowledgeRecord";
import { KnowledgeRepository } from "../knowledge/KnowledgeRepository";
import { ChangeAudit, ChangeAuditRecord } from "../change-management/ChangeAudit";
import { ReleaseAudit, ReleaseAuditRecord } from "../release-management/ReleaseAudit";
import { DecisionHistory } from "../autonomous/DecisionHistory";
import { AutonomousDecision } from "../autonomous/AutonomousDecision";
import { OperationalControlPlane } from "../control-plane/OperationalControlPlane";
import { HealthSummary } from "../control-plane/HealthCoordinator";

export interface IncidentContextPayload {
  readonly timestamp: string;
  readonly environment: "production" | "staging" | "development";
  readonly liveState: OperationsCenterData;
  readonly governanceData: GovernanceContextData;
  readonly twinSnapshot: TwinSnapshot;
  readonly failureProbabilityPrediction: PredictionModel;
  readonly degradationPrediction: PredictionModel;
  readonly recentValidationRuns: readonly ValidationRunRecord[];
  readonly recentRecoveries: readonly RecoveryResult[];
  readonly knowledgeRecords: readonly KnowledgeRecord[];
  readonly recentChanges: readonly ChangeAuditRecord[];
  readonly recentReleases: readonly ReleaseAuditRecord[];
  readonly recentDecisions: readonly AutonomousDecision[];
  readonly controlPlaneHealth: HealthSummary;
}

export class IncidentContext {
  /**
   * Compiles the dynamic read-only Incident Context from across core SRE databases.
   */
  public static compile(
    environment: "production" | "staging" | "development" = "production",
    requester?: {
      readonly id: string;
      readonly team: string;
      readonly role: "SRE_LEAD" | "SRE_OPERATOR" | "DEVELOPER" | "GUEST";
      readonly permissions: string[];
    }
  ): IncidentContextPayload {
    const timestamp = new Date().toISOString();
    
    // 1. Collect live SRE platform operational metrics
    const liveState = OperationsCenter.collectLiveState();

    // 2. Fetch Governance Context Data
    const governanceData = GovernanceContext.compile(environment, requester);

    // 3. Obtain Digital Twin snapshot
    const twinState = DigitalTwinEngine.createTwinFromProduction(`corr-inc-ctx-${Math.random().toString(36).substring(2, 9)}`);
    const twinSnapshot = twinState.getData();

    // 4. Generate prediction models statelessly
    const failureProbabilityPrediction = PredictionEngine.generatePrediction("FAILURE_PROBABILITY");
    const degradationPrediction = PredictionEngine.generatePrediction("SUBSYSTEM_DEGRADATION");

    // 5. Query validation histories
    const recentValidationRuns = Object.freeze([...ValidationHistory.getHistory()]);

    // 6. Query recovery histories
    const recentRecoveries = Object.freeze([...RecoveryHistory.getHistory()]);

    // 7. Query knowledge engineering database
    const knowledgeRecords = Object.freeze([...KnowledgeRepository.getAll()]);

    // 8. Integrate Change Management Audits
    const recentChanges = Object.freeze([...ChangeAudit.getLogs()]);

    // 9. Integrate Release Management Audits
    const recentReleases = Object.freeze([...ReleaseAudit.getLogs()]);

    // 10. Integrate Autonomous Decisions
    const recentDecisions = Object.freeze([...DecisionHistory.getHistory()]);

    // 11. Evaluate Operational Control Plane Health
    const controlPlaneHealth = OperationalControlPlane.evaluateHealth();

    const payload: IncidentContextPayload = {
      timestamp,
      environment,
      liveState,
      governanceData,
      twinSnapshot,
      failureProbabilityPrediction,
      degradationPrediction,
      recentValidationRuns,
      recentRecoveries,
      knowledgeRecords,
      recentChanges,
      recentReleases,
      recentDecisions,
      controlPlaneHealth,
    };

    return Object.freeze(payload);
  }
}

