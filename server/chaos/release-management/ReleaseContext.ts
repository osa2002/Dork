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

export interface ReleaseContextPayload {
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
  readonly changeAuditRecords: readonly ChangeAuditRecord[];
}

export class ReleaseContext {
  /**
   * Compiles the dynamic read-only Release Context from across all key SRE subsystems.
   */
  public static compile(
    environment: "production" | "staging" | "development" = "production",
    requester?: {
      readonly id: string;
      readonly team: string;
      readonly role: "SRE_LEAD" | "SRE_OPERATOR" | "DEVELOPER" | "GUEST";
      readonly permissions: string[];
    }
  ): ReleaseContextPayload {
    const timestamp = new Date().toISOString();
    
    // 1. Collect live SRE platform operational state
    const liveState = OperationsCenter.collectLiveState();

    // 2. Fetch Governance Context Data
    const governanceData = GovernanceContext.compile(environment, requester);

    // 3. Obtain Digital Twin snapshot
    const twinState = DigitalTwinEngine.createTwinFromProduction(`corr-rel-ctx-${Math.random().toString(36).substring(2, 9)}`);
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

    // 8. Query change management audit database
    const changeAuditRecords = Object.freeze([...ChangeAudit.getLogs()]);

    const payload: ReleaseContextPayload = {
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
      changeAuditRecords,
    };

    return Object.freeze(payload);
  }
}
