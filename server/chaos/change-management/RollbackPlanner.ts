import { ChangeRequestPayload } from "./ChangeRequest";

export interface RollbackStep {
  readonly sequence: number;
  readonly name: string;
  readonly action: string;
  readonly subsystem: string;
  readonly estimatedRemediationTimeSeconds: number;
}

export interface RollbackPlanPayload {
  readonly planId: string;
  readonly steps: readonly RollbackStep[];
  readonly totalRemediationTimeSeconds: number;
  readonly triggerMetricThresholds: readonly string[];
}

export class RollbackPlanner {
  /**
   * Generates a comprehensive rollback plan specifying recovery procedures and trigger metrics.
   */
  public static generateRollbackPlan(request: ChangeRequestPayload): RollbackPlanPayload {
    const steps: RollbackStep[] = [];
    const planId = `rbp-${Math.random().toString(36).substring(2, 9)}`;

    // Generate steps in reverse order of change logic
    if (request.changeType === "CONFIGURATION") {
      steps.push({
        sequence: 1,
        name: "Revert Parameters State",
        action: "Restore parameters database and configurations from previous commit tag",
        subsystem: request.targetSubsystems[0] || "ControlPlane",
        estimatedRemediationTimeSeconds: 45,
      });
      steps.push({
        sequence: 2,
        name: "Hot-reload Previous Configuration",
        action: "Force configuration engine reload and flush cache memory",
        subsystem: request.targetSubsystems[0] || "ControlPlane",
        estimatedRemediationTimeSeconds: 30,
      });
    } else if (request.changeType === "CODE_DEPLOY") {
      steps.push({
        sequence: 1,
        name: "Instantly Revert Traffic Weight",
        action: "Shift 100% traffic weight back to the previous stable active code revision",
        subsystem: request.targetSubsystems[0] || "APIGateway",
        estimatedRemediationTimeSeconds: 15,
      });
      steps.push({
        sequence: 2,
        name: "Decommission Degraded Revision",
        action: "De-provision and teardown containers running the buggy or crashing version",
        subsystem: request.targetSubsystems[0] || "APIGateway",
        estimatedRemediationTimeSeconds: 90,
      });
    } else if (request.changeType === "INFRASTRUCTURE") {
      steps.push({
        sequence: 1,
        name: "Restore Point-in-time Snapshot",
        action: "Hot-swap active databases with warm snapshot database replica",
        subsystem: "Firestore",
        estimatedRemediationTimeSeconds: 180,
      });
      steps.push({
        sequence: 2,
        name: "Teardown Provisioned Nodes",
        action: "De-allocate resources and scale back virtual nodes to previous capacity limit",
        subsystem: "InfrastructureController",
        estimatedRemediationTimeSeconds: 120,
      });
    } else if (request.changeType === "CHAOS_EXPERIMENT") {
      steps.push({
        sequence: 1,
        name: "Kill Active Chaos Scenarios",
        action: "Send termination request to ChaosOrchestrator to stop virtual injections",
        subsystem: "ChaosOrchestrator",
        estimatedRemediationTimeSeconds: 10,
      });
      steps.push({
        sequence: 2,
        name: "Assert Clean SRE RecoveryState",
        action: "Verify no residual synthetic failure models are active on the platform",
        subsystem: "RecoveryEngine",
        estimatedRemediationTimeSeconds: 30,
      });
    }

    // Always append final validation step to confirm recovery
    steps.push({
      sequence: steps.length + 1,
      name: "Remediation Health Audit",
      action: "Execute complete SRE continuous validation suite to confirm 100% post-rollback health",
      subsystem: "ContinuousValidationPlatform",
      estimatedRemediationTimeSeconds: 45,
    });

    const totalRemediationTimeSeconds = steps.reduce((sum, s) => sum + s.estimatedRemediationTimeSeconds, 0);

    const triggerMetricThresholds = [
      "HTTP 5xx Error Rate > 1.5% for over 30 seconds",
      "p99 latency degradation > 500ms on core APIs",
      "Continuous Validation Health Score falls under 90%",
      "Any unhandled node crash or database connection loss",
    ];

    return Object.freeze({
      planId,
      steps,
      totalRemediationTimeSeconds,
      triggerMetricThresholds,
    });
  }
}
