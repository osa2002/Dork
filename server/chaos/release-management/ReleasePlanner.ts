import { ReleaseDefinitionPayload, ReleaseStrategyType } from "./ReleaseDefinition";

export interface ReleaseStep {
  readonly sequence: number;
  readonly name: string;
  readonly action: string;
  readonly subsystem: string;
  readonly durationSeconds: number;
}

export interface RollbackStep {
  readonly sequence: number;
  readonly name: string;
  readonly action: string;
  readonly subsystem: string;
  readonly durationSeconds: number;
}

export interface ReleasePlanPayload {
  readonly strategyUsed: ReleaseStrategyType;
  readonly steps: readonly ReleaseStep[];
  readonly totalDurationSeconds: number;
}

export interface RollbackPlanPayload {
  readonly steps: readonly RollbackStep[];
  readonly totalDurationSeconds: number;
  readonly triggers: readonly string[];
}

export class ReleasePlanner {
  /**
   * Generates step-by-step deployment timeline plan for selected release strategy.
   */
  public static generatePlan(
    definition: ReleaseDefinitionPayload,
    strategy: ReleaseStrategyType
  ): ReleasePlanPayload {
    const steps: ReleaseStep[] = [];
    const subsystems = definition.targetSubsystems;
    const primarySubsystem = subsystems[0] || "ExpressServer";

    // Step 1: Pre-Release validation and baseline
    steps.push({
      sequence: 1,
      name: "Pre-Release Health Scan",
      action: "Run deep Continuous Validation checks to confirm operational baseline.",
      subsystem: "ContinuousValidationPlatform",
      durationSeconds: 45,
    });

    // Strategy-specific steps
    if (strategy === "CANARY") {
      steps.push({
        sequence: 2,
        name: "Stage 1 Canary Route (5%)",
        action: `Route 5% of traffic to version ${definition.version} for subsystems: ${subsystems.join(", ")}.`,
        subsystem: "APIGateway",
        durationSeconds: 120,
      });
      steps.push({
        sequence: 3,
        name: "Canary Bake & Telemetry Check",
        action: "Analyze error logs, memory profiles, and active transactions on canary nodes.",
        subsystem: "OperationsCenter",
        durationSeconds: 180,
      });
      steps.push({
        sequence: 4,
        name: "Stage 2 Canary Promotion (25%)",
        action: "Expand canary route to 25% traffic allocation. Engage synthetic smoke tests.",
        subsystem: "APIGateway",
        durationSeconds: 150,
      });
      steps.push({
        sequence: 5,
        name: "Full Promotion (100%)",
        action: `Shift remaining 75% traffic. Update active live tags to ${definition.version}.`,
        subsystem: primarySubsystem,
        durationSeconds: 120,
      });
    } else if (strategy === "BLUE_GREEN") {
      steps.push({
        sequence: 2,
        name: "Deploy Standby (Green) Fleet",
        action: `Provision fully-scaled isolated replica containers running version ${definition.version}.`,
        subsystem: "InfrastructureController",
        durationSeconds: 240,
      });
      steps.push({
        sequence: 3,
        name: "Warm Standby Smoke Audit",
        action: "Execute localized synthetic HTTP probes on standby nodes before switching.",
        subsystem: "ContinuousValidationPlatform",
        durationSeconds: 90,
      });
      steps.push({
        sequence: 4,
        name: "Cutover Routing Map",
        action: "Perform atomic flip of live API route tables to active green nodes.",
        subsystem: "APIGateway",
        durationSeconds: 30,
      });
      steps.push({
        sequence: 5,
        name: "Drain Old (Blue) Nodes",
        action: "Keep old blue node cluster active in silent mode for 10 minutes in case of emergency rollback.",
        subsystem: "APIGateway",
        durationSeconds: 180,
      });
    } else if (strategy === "PROGRESSIVE") {
      steps.push({
        sequence: 2,
        name: "Initialize Controlled Alpha Rollout",
        action: `Expose version ${definition.version} to 10% alpha users with feature-flags active.`,
        subsystem: "APIGateway",
        durationSeconds: 180,
      });
      steps.push({
        sequence: 3,
        name: "Progressive Beta Expansion (40%)",
        action: "Verify beta user SLA indicators. Expand rollout to 40% target cohort.",
        subsystem: "ControlPlane",
        durationSeconds: 240,
      });
      steps.push({
        sequence: 4,
        name: "Final Broad Release (100%)",
        action: "De-restrict regional rules. Fully release the version globally.",
        subsystem: primarySubsystem,
        durationSeconds: 120,
      });
    } else {
      // ROLLING
      steps.push({
        sequence: 2,
        name: "Rolling Batch 1 Update (33%)",
        action: `Incrementally cycle first batch of container nodes to version ${definition.version}.`,
        subsystem: primarySubsystem,
        durationSeconds: 90,
      });
      steps.push({
        sequence: 3,
        name: "Rolling Batch 2 Update (66%)",
        action: "Cycle the second batch of container nodes. Verify active connections are preserved.",
        subsystem: primarySubsystem,
        durationSeconds: 90,
      });
      steps.push({
        sequence: 4,
        name: "Rolling Batch 3 Finalization (100%)",
        action: "Cycle final batch. Complete release validation audits.",
        subsystem: primarySubsystem,
        durationSeconds: 90,
      });
    }

    // Step Final: Post-Release Assertion
    steps.push({
      sequence: steps.length + 1,
      name: "Post-Release Acceptance Test",
      action: "Execute complete continuous validation suite to authorize final release closure.",
      subsystem: "ContinuousValidationPlatform",
      durationSeconds: 60,
    });

    const totalDurationSeconds = steps.reduce((sum, s) => sum + s.durationSeconds, 0);

    return Object.freeze({
      strategyUsed: strategy,
      steps: Object.freeze(steps),
      totalDurationSeconds,
    });
  }

  /**
   * Generates rollback steps to safely undo the deployment in reverse order.
   */
  public static generateRollbackPlan(definition: ReleaseDefinitionPayload): RollbackPlanPayload {
    const steps: RollbackStep[] = [];
    const subsystems = definition.targetSubsystems;
    const primarySubsystem = subsystems[0] || "ExpressServer";

    steps.push({
      sequence: 1,
      name: "Immediate Traffic Rollback",
      action: "Flip global router maps instantly back to previous stable active tag.",
      subsystem: "APIGateway",
      durationSeconds: 15,
    });

    steps.push({
      sequence: 2,
      name: "Restore Feature Flag Baselines",
      action: `Disable all newly introduced feature flags for version ${definition.version}.`,
      subsystem: "ControlPlane",
      durationSeconds: 30,
    });

    steps.push({
      sequence: 3,
      name: "Decommission Degraded Release Containers",
      action: `Teardown and scale down active target pods running version ${definition.version}.`,
      subsystem: primarySubsystem,
      durationSeconds: 120,
    });

    steps.push({
      sequence: 4,
      name: "Emergency SRE Health Assurance Scan",
      action: "Run comprehensive continuous validation to verify baseline operational wellness.",
      subsystem: "ContinuousValidationPlatform",
      durationSeconds: 60,
    });

    const totalDurationSeconds = steps.reduce((sum, s) => sum + s.durationSeconds, 0);

    const triggers = [
      "Any HTTP 5xx error surge exceeding 1.0% in any 1-minute interval",
      "p99 response latency exceeds 500ms degradation threshold",
      "Control plane health changes to DEGRADED or UNAVAILABLE",
      "Failed post-release continuous validation baseline run",
    ];

    return Object.freeze({
      steps: Object.freeze(steps),
      totalDurationSeconds,
      triggers: Object.freeze(triggers),
    });
  }
}
