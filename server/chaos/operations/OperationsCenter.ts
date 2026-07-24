import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";
import { OperationalControlPlane } from "../control-plane/OperationalControlPlane";
import { PredictionEngine } from "../prediction/PredictionEngine";
import { DecisionEngine } from "../autonomous/DecisionEngine";
import { DecisionHistory } from "../autonomous/DecisionHistory";
import { RecoveryHistory } from "../recovery/RecoveryHistory";
import { KnowledgeRepository } from "../knowledge/KnowledgeRepository";
import { ValidationHistory } from "../validation/ValidationHistory";
import { DigitalTwinEngine } from "../digital-twin/DigitalTwinEngine";
import { IntegrationValidator } from "../integration/IntegrationValidator";
import { SLOService } from "../../../src/services/SLOService";

export interface OperationsCenterData {
  timestamp: string;
  eventBus: {
    historyCount: number;
    diagnosticsCount: number;
    subscribersCount: number;
  };
  controlPlane: {
    healthStatus: string;
    readinessScore: number;
    engineCount: number;
    dependencyCount: number;
    hasCircularDependencies: boolean;
  };
  predictions: {
    activeRiskScore: number;
    lastPredictionType: string;
  };
  decisions: {
    lastDecision: string;
    lastConfidence: number;
    historySize: number;
  };
  recovery: {
    lastStatus: string;
    successRate: number;
    historySize: number;
  };
  knowledge: {
    recordCount: number;
    capacityLimit: number;
  };
  validation: {
    lastSuccessRate: number;
    runCount: number;
  };
  digitalTwin: {
    status: string;
    lastSyncTimestamp: string;
  };
  integration: {
    status: string;
  };
}

export class OperationsCenter {
  /**
   * Safe read-only aggregation of the entire platform's live SRE state.
   * Leverages internal static history and status records without mutations or side effects.
   */
  public static collectLiveState(): OperationsCenterData {
    const now = new Date().toISOString();

    // 1. Event Bus Aggregation
    const eventHistory = EnterpriseEventBus.getHistory();
    const eventDiagnostics = EnterpriseEventBus.getDiagnostics();
    const activeSubscribers = EnterpriseEventBus.getActiveSubscribers();

    // 2. Control Plane Evaluation
    const cpHealth = OperationalControlPlane.evaluateHealth();
    const cpDeps = OperationalControlPlane.auditDependencies();

    // 3. Predictions - stateless generation without mutation
    const currentPrediction = PredictionEngine.generatePrediction("FAILURE_PROBABILITY");

    // 4. Autonomous Decisions
    const decisionHistory = DecisionHistory.getHistory();
    const latestDecision = decisionHistory[0];

    // 5. Recovery Actions
    const recoveryHistory = RecoveryHistory.getHistory();
    const latestRecovery = recoveryHistory[0];
    const completedRecoveries = recoveryHistory.filter(r => r.status === "SUCCESS" || r.status === "ROLLED_BACK");
    const recoverySuccessRate = recoveryHistory.length > 0
      ? (completedRecoveries.length / recoveryHistory.length) * 100
      : 100;

    // 6. Knowledge Records
    const knowledgeRecords = KnowledgeRepository.getAll();

    // 7. Validation Execution History
    const validationHistory = ValidationHistory.getHistory();
    const latestValidationRun = validationHistory[validationHistory.length - 1];

    // 8. Digital Twin Status check
    const twinState = DigitalTwinEngine.createTwinFromProduction("corr-operations-facade");
    const twinSnapshot = twinState.getData();

    // 9. Integration state checking (read-only diagnostics based on event log patterns)
    const e2eEvents = eventHistory.filter(e => e.correlationId.startsWith("corr-e2e-"));
    const integrationStatus = e2eEvents.length > 0
      ? (e2eEvents.some(e => e.type === "ExperimentFailed" || e.payload?.success === false) ? "DEGRADED" : "HEALTHY")
      : "UNKNOWN";

    return {
      timestamp: now,
      eventBus: {
        historyCount: eventHistory.length,
        diagnosticsCount: eventDiagnostics.length,
        subscribersCount: activeSubscribers.length
      },
      controlPlane: {
        healthStatus: cpHealth.overallHealth,
        readinessScore: cpHealth.operationalReadiness,
        engineCount: cpHealth.engineHealth ? Object.keys(cpHealth.engineHealth).length : 0,
        dependencyCount: cpDeps.resolvedOrder.length,
        hasCircularDependencies: cpDeps.cycles.length > 0
      },
      predictions: {
        activeRiskScore: currentPrediction.riskScore,
        lastPredictionType: currentPrediction.predictionType
      },
      decisions: {
        lastDecision: latestDecision ? latestDecision.decision : "NO_ACTION",
        lastConfidence: latestDecision ? latestDecision.confidence : 100,
        historySize: decisionHistory.length
      },
      recovery: {
        lastStatus: latestRecovery ? latestRecovery.status : "IDLE",
        successRate: Number(recoverySuccessRate.toFixed(2)),
        historySize: recoveryHistory.length
      },
      knowledge: {
        recordCount: knowledgeRecords.length,
        capacityLimit: KnowledgeRepository.getCapacityLimit()
      },
      validation: {
        lastSuccessRate: latestValidationRun ? latestValidationRun.successRate : 100,
        runCount: validationHistory.length
      },
      digitalTwin: {
        status: twinSnapshot ? "SYNCHRONIZED" : "OUT_OF_SYNC",
        lastSyncTimestamp: twinSnapshot ? twinSnapshot.timestamp : now
      },
      integration: {
        status: integrationStatus
      }
    };
  }
}
