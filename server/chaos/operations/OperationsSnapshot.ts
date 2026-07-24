import { OperationsDashboard } from "./OperationsDashboard";
import { OperationsCenter } from "./OperationsCenter";

export interface ImmutableOperationsSnapshot {
  readonly id: string;
  readonly timestamp: string;
  readonly healthScore: number;
  readonly availability: number;
  readonly resilienceGrade: string;
  readonly controlPlane: {
    readonly overallHealth: string;
    readonly totalEngines: number;
    readonly hasCircularDependencies: boolean;
  };
  readonly predictions: {
    readonly activeRiskScore: number;
    readonly type: string;
  };
  readonly historySizes: {
    readonly eventBus: number;
    readonly decisions: number;
    readonly recoveries: number;
    readonly validations: number;
    readonly knowledge: number;
  };
}

export class OperationsSnapshot {
  /**
   * Helper to deeply freeze any JavaScript object or array to ensure SRE immutability.
   */
  private static deepFreeze<T>(obj: T): T {
    if (obj && typeof obj === "object") {
      Object.freeze(obj);
      Object.getOwnPropertyNames(obj).forEach((prop) => {
        const val = (obj as any)[prop];
        if (
          val !== null &&
          (typeof val === "object" || typeof val === "function") &&
          !Object.isFrozen(val)
        ) {
          this.deepFreeze(val);
        }
      });
    }
    return obj;
  }

  /**
   * Captures and freezes an immutable snapshot of the platform's current operational state.
   */
  public static takeSnapshot(): ImmutableOperationsSnapshot {
    const dashboard = OperationsDashboard.computeDashboard();
    const liveState = OperationsCenter.collectLiveState();

    const snapshot: ImmutableOperationsSnapshot = {
      id: `snap-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      healthScore: dashboard.enterpriseHealthScore,
      availability: dashboard.availability,
      resilienceGrade: dashboard.resilienceGrade,
      controlPlane: {
        overallHealth: liveState.controlPlane.healthStatus,
        totalEngines: liveState.controlPlane.engineCount,
        hasCircularDependencies: liveState.controlPlane.hasCircularDependencies,
      },
      predictions: {
        activeRiskScore: liveState.predictions.activeRiskScore,
        type: liveState.predictions.lastPredictionType,
      },
      historySizes: {
        eventBus: liveState.eventBus.historyCount,
        decisions: liveState.decisions.historySize,
        recoveries: liveState.recovery.historySize,
        validations: liveState.validation.runCount,
        knowledge: liveState.knowledge.recordCount,
      },
    };

    // Deep freeze the snapshot before returning to guarantee zero downstream modifications
    return this.deepFreeze(snapshot);
  }
}
