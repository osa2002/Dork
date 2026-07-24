import { OperationsCenter, OperationsCenterData } from "../operations/OperationsCenter";
import { OperationalControlPlane } from "../control-plane/OperationalControlPlane";
import { HealthSummary } from "../control-plane/HealthCoordinator";
import { ChangeAudit, ChangeAuditRecord } from "../change-management/ChangeAudit";
import { ReleaseAudit, ReleaseAuditRecord } from "../release-management/ReleaseAudit";
import { DigitalTwinEngine } from "../digital-twin/DigitalTwinEngine";
import { TwinSnapshot } from "../digital-twin/TwinSnapshot";
import { PredictionEngine } from "../prediction/PredictionEngine";
import { PredictionModel } from "../prediction/PredictionModel";

export interface ObservabilityContextPayload {
  readonly timestamp: string;
  readonly environment: "production" | "staging" | "development";
  readonly liveState: OperationsCenterData;
  readonly controlPlaneHealth: HealthSummary;
  readonly twinSnapshot: TwinSnapshot;
  readonly riskPrediction: PredictionModel;
  readonly recentChanges: readonly ChangeAuditRecord[];
  readonly recentReleases: readonly ReleaseAuditRecord[];
}

export class ObservabilityContext {
  /**
   * Reads from across the entire stateless platform ecosystem to compile a comprehensive Observability snapshot.
   */
  public static compile(
    environment: "production" | "staging" | "development" = "production"
  ): ObservabilityContextPayload {
    const timestamp = new Date().toISOString();

    const liveState = OperationsCenter.collectLiveState();
    const controlPlaneHealth = OperationalControlPlane.evaluateHealth();
    
    const twinState = DigitalTwinEngine.createTwinFromProduction(`obs-twin-${Math.random().toString(36).substring(2, 9)}`);
    const twinSnapshot = twinState.getData();

    const riskPrediction = PredictionEngine.generatePrediction("FAILURE_PROBABILITY");

    const recentChanges = Object.freeze([...ChangeAudit.getLogs()]);
    const recentReleases = Object.freeze([...ReleaseAudit.getLogs()]);

    return Object.freeze({
      timestamp,
      environment,
      liveState,
      controlPlaneHealth,
      twinSnapshot,
      riskPrediction,
      recentChanges,
      recentReleases,
    });
  }
}
