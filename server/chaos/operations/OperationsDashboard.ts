import { OperationsCenter } from "./OperationsCenter";
import { SLOService } from "../../../src/services/SLOService";
import { DecisionHistory } from "../autonomous/DecisionHistory";
import { RecoveryHistory } from "../recovery/RecoveryHistory";
import { ValidationHistory } from "../validation/ValidationHistory";
import { KnowledgeRepository } from "../knowledge/KnowledgeRepository";

export interface OperationsDashboardPayload {
  timestamp: string;
  enterpriseHealthScore: number;
  readinessScore: number;
  availability: number;
  resilienceGrade: string;
  predictionRisk: number;
  validationStatus: string;
  recoveryStatus: string;
  decisionStatus: string;
  digitalTwinStatus: string;
  knowledgeCoverage: number;
  integrationHealth: number;
}

export class OperationsDashboard {
  /**
   * Computes the high-fidelity operational overview of the platform.
   */
  public static computeDashboard(): OperationsDashboardPayload {
    const liveState = OperationsCenter.collectLiveState();
    const slo = SLOService.getSLOSummary();

    // 1. Availability from SRE SLO Service
    const availability = slo.availability.actual;

    // 2. Readiness Score from Control Plane
    const readinessScore = liveState.controlPlane.readinessScore;

    // 3. Validation Status
    const validationHistory = ValidationHistory.getHistory();
    const latestVal = validationHistory[validationHistory.length - 1];
    let validationStatus = "HEALTHY";
    if (latestVal) {
      if (latestVal.successRate < 80) {
        validationStatus = "DEGRADED";
      } else if (latestVal.successRate < 100) {
        validationStatus = "WARNING";
      }
    }

    // 4. Recovery Status
    const recoveryHistory = RecoveryHistory.getHistory();
    const latestRec = recoveryHistory[0];
    let recoveryStatus = "IDLE";
    if (latestRec) {
      if (latestRec.status === "PENDING_APPROVAL") {
        recoveryStatus = "ACTIVE";
      } else {
        recoveryStatus = "COMPLETED";
      }
    }

    // 5. Decision Status
    const decisionHistory = DecisionHistory.getHistory();
    const latestDec = decisionHistory[0];
    const decisionStatus = latestDec ? latestDec.decision : "STABLE";

    // 6. Digital Twin Status
    const digitalTwinStatus = liveState.digitalTwin.status;

    // 7. Knowledge Coverage (Ratio of stored records vs capacity limit)
    const recordCount = KnowledgeRepository.getAll().length;
    const capacityLimit = KnowledgeRepository.getCapacityLimit();
    const knowledgeCoverage = Number(((recordCount / capacityLimit) * 100).toFixed(2));

    // 8. Integration Health Score (Calculated from active subscribers and errors if any)
    const liveEventBus = liveState.eventBus;
    const integrationHealth = liveEventBus.subscribersCount > 0
      ? Math.max(0, 100 - (liveEventBus.diagnosticsCount * 10))
      : 100;

    // 9. Enterprise Health Score (Weighted index of system availability, readiness, recovery rate, and validation)
    const recoverySuccessWeight = liveState.recovery.successRate;
    const validationSuccessWeight = latestVal ? latestVal.successRate : 100;
    
    // Weighted formula:
    // 30% Availability, 30% Control Plane Readiness, 20% Recovery Success, 20% Validation Success
    const weightedScore = (
      (availability * 0.3) +
      (readinessScore * 0.3) +
      (recoverySuccessWeight * 0.2) +
      (validationSuccessWeight * 0.2)
    );

    const enterpriseHealthScore = Number(Math.min(100, Math.max(0, weightedScore)).toFixed(2));

    // 10. Resilience Grade Selection
    let resilienceGrade = "F";
    if (enterpriseHealthScore >= 95) {
      resilienceGrade = "A+";
    } else if (enterpriseHealthScore >= 90) {
      resilienceGrade = "A";
    } else if (enterpriseHealthScore >= 80) {
      resilienceGrade = "B";
    } else if (enterpriseHealthScore >= 70) {
      resilienceGrade = "C";
    } else if (enterpriseHealthScore >= 60) {
      resilienceGrade = "D";
    }

    return {
      timestamp: new Date().toISOString(),
      enterpriseHealthScore,
      readinessScore,
      availability,
      resilienceGrade,
      predictionRisk: liveState.predictions.activeRiskScore,
      validationStatus,
      recoveryStatus,
      decisionStatus,
      digitalTwinStatus,
      knowledgeCoverage,
      integrationHealth
    };
  }
}
