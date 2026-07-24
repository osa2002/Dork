import { OperationsCenter } from "./OperationsCenter";
import { ValidationHistory } from "../validation/ValidationHistory";
import { RecoveryHistory } from "../recovery/RecoveryHistory";
import { DecisionHistory } from "../autonomous/DecisionHistory";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

export interface HealthMatrixRow {
  subsystem: string;
  status: "HEALTHY" | "DEGRADED" | "WARNING" | "CRITICAL";
  readiness: number;
  lastUpdated: string;
  exceptionsCount: number;
  activeAlerts: string[];
}

export class OperationsHealthMatrix {
  /**
   * Generates a matrix of subsystem health.
   */
  public static generateMatrix(): HealthMatrixRow[] {
    const liveState = OperationsCenter.collectLiveState();
    const eventHistory = EnterpriseEventBus.getHistory();
    const eventDiagnostics = EnterpriseEventBus.getDiagnostics();
    const valHistory = ValidationHistory.getHistory();
    const recHistory = RecoveryHistory.getHistory();
    const decHistory = DecisionHistory.getHistory();

    const timestamp = new Date().toISOString();

    // Determine subsystem alerts and exceptions
    const busExceptions = eventDiagnostics.length;
    const busAlerts = eventHistory
      .filter((e) => e.type === "AlertTriggered")
      .map((e) => e.payload?.message || "Subsystem alert active");

    const valRecord = valHistory[valHistory.length - 1];
    const valExceptions = valRecord ? valRecord.failedCount : 0;
    const valAlerts: string[] = [];
    if (valRecord && valRecord.failedCount > 0) {
      valAlerts.push(`${valRecord.failedCount} validation checks failed`);
    }

    const recRecord = recHistory[0];
    const recExceptions = recHistory.filter((r) => r.status === "FAILED").length;
    const recAlerts: string[] = [];
    if (recRecord && recRecord.status === "FAILED") {
      recAlerts.push(`Last recovery workflow failed: ${recRecord.workflowName}`);
    }

    const decRecord = decHistory[0];
    const decAlerts: string[] = [];
    if (decRecord && decRecord.decision === "PAUSE_EXPERIMENTS") {
      decAlerts.push("Autonomous Decision: PAUSE_EXPERIMENTS active");
    }

    const matrix: HealthMatrixRow[] = [
      {
        subsystem: "Enterprise Event Bus",
        status: busExceptions > 0 ? "WARNING" : "HEALTHY",
        readiness: Math.max(0, 100 - busExceptions * 10),
        lastUpdated: eventHistory[0] ? eventHistory[0].timestamp : timestamp,
        exceptionsCount: busExceptions,
        activeAlerts: busAlerts,
      },
      {
        subsystem: "Operational Control Plane",
        status: liveState.controlPlane.hasCircularDependencies ? "WARNING" : "HEALTHY",
        readiness: liveState.controlPlane.readinessScore,
        lastUpdated: timestamp,
        exceptionsCount: liveState.controlPlane.hasCircularDependencies ? 1 : 0,
        activeAlerts: liveState.controlPlane.hasCircularDependencies ? ["Circular dependency detected"] : [],
      },
      {
        subsystem: "Continuous Validation Platform",
        status: valExceptions > 0 ? "DEGRADED" : "HEALTHY",
        readiness: valRecord ? valRecord.successRate : 100,
        lastUpdated: valRecord ? valRecord.timestamp : timestamp,
        exceptionsCount: valExceptions,
        activeAlerts: valAlerts,
      },
      {
        subsystem: "Recovery Engine",
        status: recExceptions > 0 ? "WARNING" : "HEALTHY",
        readiness: liveState.recovery.successRate,
        lastUpdated: recRecord ? recRecord.timestamp : timestamp,
        exceptionsCount: recExceptions,
        activeAlerts: recAlerts,
      },
      {
        subsystem: "Autonomous Decision Engine",
        status: decRecord?.decision === "PAUSE_EXPERIMENTS" ? "WARNING" : "HEALTHY",
        readiness: liveState.decisions.lastConfidence,
        lastUpdated: decRecord ? decRecord.timestamp : timestamp,
        exceptionsCount: 0,
        activeAlerts: decAlerts,
      },
      {
        subsystem: "Prediction Engine",
        status: liveState.predictions.activeRiskScore > 70 ? "WARNING" : "HEALTHY",
        readiness: 100 - liveState.predictions.activeRiskScore,
        lastUpdated: timestamp,
        exceptionsCount: 0,
        activeAlerts: liveState.predictions.activeRiskScore > 70 ? ["Elevated platform risk predicted"] : [],
      },
      {
        subsystem: "Digital Twin Engine",
        status: "HEALTHY",
        readiness: 100,
        lastUpdated: timestamp,
        exceptionsCount: 0,
        activeAlerts: [],
      },
      {
        subsystem: "Integration Validator",
        status: liveState.integration.status === "DEGRADED" ? "DEGRADED" : "HEALTHY",
        readiness: liveState.integration.status === "DEGRADED" ? 50 : 100,
        lastUpdated: timestamp,
        exceptionsCount: liveState.integration.status === "DEGRADED" ? 1 : 0,
        activeAlerts: liveState.integration.status === "DEGRADED" ? ["Synthetic integration checks failed"] : [],
      },
    ];

    return matrix;
  }
}
