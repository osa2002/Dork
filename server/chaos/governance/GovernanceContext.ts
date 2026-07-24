import { SLOService } from "../../../src/services/SLOService";
import { OperationsCenter } from "../operations/OperationsCenter";

export interface GovernanceContextData {
  readonly timestamp: string;
  readonly environment: "production" | "staging" | "development";
  readonly currentHour: number; // 0-23, for maintenance windows / quiet hours
  readonly isWithinMaintenanceWindow: boolean;
  readonly errorBudgetRemaining: number; // 0-100
  readonly availabilityActual: number; // 0-100
  readonly liveRiskScore: number; // 0-100
  readonly requester: {
    readonly id: string;
    readonly team: string;
    readonly role: "SRE_LEAD" | "SRE_OPERATOR" | "DEVELOPER" | "GUEST";
    readonly permissions: string[];
  };
  readonly targetExperiment: {
    readonly id: string;
    readonly name: string;
    readonly estimatedRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    readonly affectedSubsystems: string[];
    readonly requiresApproval: boolean;
  };
  readonly safetyGatesActive: boolean;
}

export class GovernanceContext {
  /**
   * Compiles the real-time, read-only Governance Context from the running SRE components
   * and blends it with request-specific data.
   */
  public static compile(
    environment: "production" | "staging" | "development" = "production",
    requester?: Partial<GovernanceContextData["requester"]>,
    targetExperiment?: Partial<GovernanceContextData["targetExperiment"]>
  ): GovernanceContextData {
    const liveState = OperationsCenter.collectLiveState();
    const slo = SLOService.getSLOSummary();

    // Determine current hour of the day
    const now = new Date();
    const currentHour = now.getUTCHours();

    // A simulated maintenance window (e.g. standard maintenance window between 02:00 and 05:00 UTC)
    const isWithinMaintenanceWindow = currentHour >= 2 && currentHour <= 5;

    // Safety gates: active if digital twin is degraded, or general state is critical
    const safetyGatesActive =
      liveState.controlPlane.healthStatus === "UNAVAILABLE" ||
      liveState.predictions.activeRiskScore > 75;

    return {
      timestamp: now.toISOString(),
      environment,
      currentHour,
      isWithinMaintenanceWindow,
      errorBudgetRemaining: slo.availability.errorBudgetRemaining,
      availabilityActual: slo.availability.actual,
      liveRiskScore: liveState.predictions.activeRiskScore,
      requester: {
        id: requester?.id || "usr-sre-77a",
        team: requester?.team || "Platform SRE",
        role: requester?.role || "SRE_OPERATOR",
        permissions: requester?.permissions || ["RUN_EXPERIMENTS", "APPROVE_MITIGATION"],
      },
      targetExperiment: {
        id: targetExperiment?.id || "exp-default",
        name: targetExperiment?.name || "Generic Latency Injection",
        estimatedRisk: targetExperiment?.estimatedRisk || "MEDIUM",
        affectedSubsystems: targetExperiment?.affectedSubsystems || ["APIGateway", "Database"],
        requiresApproval: targetExperiment?.requiresApproval ?? true,
      },
      safetyGatesActive,
    };
  }
}
