import { ChangeRequestPayload } from "./ChangeRequest";

export interface ChangePlanStep {
  readonly sequence: number;
  readonly name: string;
  readonly action: string;
  readonly subsystem: string;
  readonly estimatedDurationSeconds: number;
}

export interface ChangePlanPayload {
  readonly id: string;
  readonly steps: readonly ChangePlanStep[];
  readonly totalEstimatedDurationSeconds: number;
}

export class ChangePlanner {
  /**
   * Generates a step-by-step execution timeline for a change request.
   */
  public static generatePlan(request: ChangeRequestPayload): ChangePlanPayload {
    const steps: ChangePlanStep[] = [];
    const id = `pln-${Math.random().toString(36).substring(2, 9)}`;

    // 1. Initial Validation / Backup Step
    steps.push({
      sequence: 1,
      name: "Pre-change SRE Validation",
      action: "Run Continuous Validation tests to establish health baseline",
      subsystem: "ContinuousValidationPlatform",
      estimatedDurationSeconds: 45,
    });

    // 2. Specific change-type plan steps
    if (request.changeType === "CONFIGURATION") {
      steps.push({
        sequence: 2,
        name: "Stage Config Changes",
        action: `Push parameters: ${JSON.stringify(request.parameters)} to shadow-registry`,
        subsystem: request.targetSubsystems[0] || "ControlPlane",
        estimatedDurationSeconds: 30,
      });
      steps.push({
        sequence: 3,
        name: "Apply and hot-reload Config",
        action: "Apply live configuration and force immediate container reload",
        subsystem: request.targetSubsystems[0] || "ControlPlane",
        estimatedDurationSeconds: 60,
      });
    } else if (request.changeType === "CODE_DEPLOY") {
      steps.push({
        sequence: 2,
        name: "Deploy Canary Instance",
        action: "Deploy new code revision with 10% canary traffic allocation",
        subsystem: request.targetSubsystems[0] || "APIGateway",
        estimatedDurationSeconds: 120,
      });
      steps.push({
        sequence: 3,
        name: "Bake and Monitor Canary",
        action: "Monitor error rate and latency of the 10% canary container",
        subsystem: "OperationsCenter",
        estimatedDurationSeconds: 180,
      });
      steps.push({
        sequence: 4,
        name: "Promote Build to Production",
        action: "Rollout new revision to 100% of traffic, decommission old container version",
        subsystem: request.targetSubsystems[0] || "APIGateway",
        estimatedDurationSeconds: 150,
      });
    } else if (request.changeType === "INFRASTRUCTURE") {
      steps.push({
        sequence: 2,
        name: "Take Warm Replica Database Snapshot",
        action: "Create a point-in-time snapshot prior to DB migration",
        subsystem: "Firestore",
        estimatedDurationSeconds: 90,
      });
      steps.push({
        sequence: 3,
        name: "Provision and Scale Nodes",
        action: `Scale and configure infrastructure for subsystems: ${request.targetSubsystems.join(", ")}`,
        subsystem: "InfrastructureController",
        estimatedDurationSeconds: 240,
      });
      steps.push({
        sequence: 4,
        name: "Verify Replica Health Sync",
        action: "Verify replica synchronization lag and replica node performance matrices",
        subsystem: "DigitalTwinEngine",
        estimatedDurationSeconds: 60,
      });
    } else if (request.changeType === "CHAOS_EXPERIMENT") {
      steps.push({
        sequence: 2,
        name: "Inject Virtual Failure Simulation",
        action: `Inject simulated SRE chaos experiment target: ${request.targetSubsystems.join(", ")} with details: ${JSON.stringify(request.parameters)}`,
        subsystem: "ChaosOrchestrator",
        estimatedDurationSeconds: 60,
      });
      steps.push({
        sequence: 3,
        name: "Assert Autonomous Recovery",
        action: "Validate SRE RecoveryEngine initiates rollback or failover within 120 seconds",
        subsystem: "RecoveryEngine",
        estimatedDurationSeconds: 120,
      });
    }

    // 3. Post-execution health assert step
    steps.push({
      sequence: steps.length + 1,
      name: "Post-change SRE Assertion",
      action: "Execute live smoke testing suite and final system-wide readiness validation",
      subsystem: "ContinuousValidationPlatform",
      estimatedDurationSeconds: 60,
    });

    const totalEstimatedDurationSeconds = steps.reduce((sum, s) => sum + s.estimatedDurationSeconds, 0);

    return Object.freeze({
      id,
      steps,
      totalEstimatedDurationSeconds,
    });
  }
}
