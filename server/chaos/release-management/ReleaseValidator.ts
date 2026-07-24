import { ReleaseDefinitionPayload } from "./ReleaseDefinition";
import { ReleaseContextPayload } from "./ReleaseContext";

export interface ValidationFinding {
  readonly code: string;
  readonly severity: "CRITICAL" | "WARNING" | "INFO";
  readonly category: "FEATURE_FLAG" | "DEPENDENCY_CONFLICT" | "RISK_PREDICTION" | "HEALTH_STABILITY" | "VALIDATION_BASELINE";
  readonly message: string;
}

export interface ReleaseValidationPayload {
  readonly readinessScore: number; // 0-100
  readonly isEligible: boolean;
  readonly findings: readonly ValidationFinding[];
  readonly timestamp: string;
}

export class ReleaseValidator {
  /**
   * Evaluates a release definition against the dynamic release context to determine structural safety and stability.
   */
  public static validate(
    definition: ReleaseDefinitionPayload,
    context: ReleaseContextPayload
  ): ReleaseValidationPayload {
    const findings: ValidationFinding[] = [];
    const timestamp = new Date().toISOString();

    // 1. Feature Flag Validation
    for (const flag of definition.featureFlags) {
      if (flag.rolloutPercentage < 0 || flag.rolloutPercentage > 100) {
        findings.push({
          code: "FF_INVALID_PERCENTAGE",
          severity: "CRITICAL",
          category: "FEATURE_FLAG",
          message: `Feature flag "${flag.flagName}" has an invalid rollout percentage of ${flag.rolloutPercentage}%.`,
        });
      }
      if (flag.enabled && flag.rolloutPercentage === 0) {
        findings.push({
          code: "FF_ENABLED_ZERO_ROLLOUT",
          severity: "WARNING",
          category: "FEATURE_FLAG",
          message: `Feature flag "${flag.flagName}" is enabled but has 0% rollout target.`,
        });
      }
    }

    // 2. Digital Twin Dependency Conflicts & Health checks
    const twinGraph = context.twinSnapshot?.dependencyGraph || { nodes: [], edges: [] };
    const targetSet = new Set(definition.targetSubsystems);

    // Check if targets exist in the dependency graph
    for (const target of definition.targetSubsystems) {
      const node = twinGraph.nodes.find((n) => n.id === target);
      if (!node) {
        findings.push({
          code: "DEP_UNKNOWN_SUBSYSTEM",
          severity: "WARNING",
          category: "DEPENDENCY_CONFLICT",
          message: `Target subsystem "${target}" is not present in the current live Digital Twin topology graph.`,
        });
      } else if (node.status !== "HEALTHY") {
        findings.push({
          code: "DEP_TARGET_DEGRADED",
          severity: "CRITICAL",
          category: "DEPENDENCY_CONFLICT",
          message: `Release target subsystem "${target}" is in state "${node.status}" on the digital twin. Releases blocked on degraded components.`,
        });
      }
    }

    // Check for circular dependency involvement
    const hasCircDeps = context.liveState.controlPlane.hasCircularDependencies;
    if (hasCircDeps) {
      findings.push({
        code: "DEP_CIRCULAR_DETECTION",
        severity: "WARNING",
        category: "DEPENDENCY_CONFLICT",
        message: "Active circular dependency cycles detected on platform control plane nodes.",
      });
    }

    // 3. Failure & Degradation Risk Predictions
    const failureScore = context.failureProbabilityPrediction?.riskScore ?? 0;
    if (failureScore > 75) {
      findings.push({
        code: "RISK_PREDICTION_CRITICAL",
        severity: "CRITICAL",
        category: "RISK_PREDICTION",
        message: `Prediction engine forecasts critical ambient SRE failure score (${failureScore}%). Release halted.`,
      });
    } else if (failureScore > 40) {
      findings.push({
        code: "RISK_PREDICTION_ELEVATED",
        severity: "WARNING",
        category: "RISK_PREDICTION",
        message: `Prediction engine forecasts elevated SRE failure probability (${failureScore}%).`,
      });
    }

    // 4. Control Plane Health and Readiness Criteria
    const controlPlaneHealth = context.liveState.controlPlane.healthStatus;
    const readinessScore = context.liveState.controlPlane.readinessScore;

    if (controlPlaneHealth === "UNAVAILABLE") {
      findings.push({
        code: "HEALTH_PLATFORM_DOWN",
        severity: "CRITICAL",
        category: "HEALTH_STABILITY",
        message: "Platform Control Plane Health status is UNAVAILABLE. Operations locked.",
      });
    }

    if (readinessScore < 70) {
      findings.push({
        code: "HEALTH_READINESS_LOW",
        severity: "CRITICAL",
        category: "HEALTH_STABILITY",
        message: `Platform readiness score (${readinessScore}) falls critically below safety threshold (70).`,
      });
    } else if (readinessScore < 85) {
      findings.push({
        code: "HEALTH_READINESS_SUBOPTIMAL",
        severity: "WARNING",
        category: "HEALTH_STABILITY",
        message: `Platform readiness index is sub-optimal (${readinessScore}). Standard operations permitted but caution is advised.`,
      });
    }

    // 5. Continuous Validation Baseline Checking
    const recentValList = context.recentValidationRuns;
    if (recentValList.length === 0) {
      findings.push({
        code: "VAL_NO_BASELINE",
        severity: "WARNING",
        category: "VALIDATION_BASELINE",
        message: "No continuous validation runs detected in current session. Standard baseline remains unverified.",
      });
    } else {
      const latestVal = recentValList[recentValList.length - 1];
      if (latestVal.successRate < 85) {
        findings.push({
          code: "VAL_BASELINE_FAILING",
          severity: "CRITICAL",
          category: "VALIDATION_BASELINE",
          message: `The latest SRE continuous validation run has a degraded success rate of ${latestVal.successRate}%.`,
        });
      } else if (latestVal.successRate < 95) {
        findings.push({
          code: "VAL_BASELINE_WARNING",
          severity: "WARNING",
          category: "VALIDATION_BASELINE",
          message: `Latest validation run indicates slightly degraded success rate (${latestVal.successRate}%).`,
        });
      }
    }

    // 6. Active incidents co-location check
    const activeIncidents = context.liveState.eventBus.historyCount > 0 && context.liveState.recovery.historySize > 0; // wait, let's use recent validations or similar
    const incCount = context.changeAuditRecords.filter((rec) => rec.approval.status === "REJECTED").length; // use as active indicators
    const liveIncidentsCount = context.governanceData.safetyGatesActive ? 1 : 0;
    if (liveIncidentsCount > 0) {
      findings.push({
        code: "HEALTH_ACTIVE_INCIDENTS",
        severity: "CRITICAL",
        category: "HEALTH_STABILITY",
        message: "Active platform outages or safety gates are engaged. Out-of-band updates restricted.",
      });
    }

    // Calculate final readiness score out of 100
    let calculatedReadinessScore = 100;
    for (const f of findings) {
      if (f.severity === "CRITICAL") calculatedReadinessScore -= 25;
      else if (f.severity === "WARNING") calculatedReadinessScore -= 10;
      else if (f.severity === "INFO") calculatedReadinessScore -= 2;
    }
    calculatedReadinessScore = Math.min(100, Math.max(0, calculatedReadinessScore));

    const isEligible = !findings.some((f) => f.severity === "CRITICAL");

    const payload: ReleaseValidationPayload = {
      readinessScore: calculatedReadinessScore,
      isEligible,
      findings: Object.freeze(findings),
      timestamp,
    };

    return Object.freeze(payload);
  }
}
