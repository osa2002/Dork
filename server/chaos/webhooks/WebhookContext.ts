import { OperationsCenter, OperationsCenterData } from "../operations/OperationsCenter";
import { ObservabilityContext, ObservabilityContextPayload } from "../observability/ObservabilityContext";
import { GovernanceContext, GovernanceContextData } from "../governance/GovernanceContext";
import { SecurityContext } from "../security/SecurityContext";
import { DeploymentContext } from "../deployment/DeploymentContext";
import { ReleaseContext, ReleaseContextPayload } from "../release-management/ReleaseContext";
import { PlatformContext, PlatformContextManager } from "../platform-kernel/PlatformContext";
import { ChangeContext, ChangeContextPayload } from "../change-management/ChangeContext";

export interface WebhookContextData {
  readonly timestamp: string;
  readonly environment: "production" | "staging" | "development";
  readonly correlationId: string;
  readonly operationsState: OperationsCenterData;
  readonly observability: ObservabilityContextPayload;
  readonly governance: GovernanceContextData;
  readonly security: {
    readonly environment: string;
    readonly securityLevel: string;
    readonly enforcementMode: string;
    readonly userRole: string;
  };
  readonly deployment: {
    readonly currentHealthScore: number;
    readonly changeRiskScore: number;
    readonly releaseComplexity: string;
    readonly emergencyOverride: boolean;
  };
  readonly release: ReleaseContextPayload;
  readonly change: ChangeContextPayload;
  readonly platformKernel: PlatformContext;
}

export class WebhookContext {
  /**
   * Compiles an immutable, read-only aggregate snapshot of the entire enterprise system state
   * for webhook evaluation and dispatch verification.
   */
  public static compile(
    environment: "production" | "staging" | "development" = "production",
    correlationId?: string
  ): WebhookContextData {
    const timestamp = new Date().toISOString();
    const activeCorrelationId =
      correlationId || `wh-ctx-${Math.random().toString(36).substring(2, 9)}`;

    const opsState = OperationsCenter.collectLiveState();
    const obsState = ObservabilityContext.compile(environment);
    const govState = GovernanceContext.compile(environment);

    const secContext = new SecurityContext({
      environment,
      correlationId: activeCorrelationId,
    });

    const depContext = new DeploymentContext({
      environment,
      correlationId: activeCorrelationId,
    });

    const relState = ReleaseContext.compile(environment);
    const changeState = ChangeContext.compile(environment);
    const kernelContext = PlatformContextManager.create(environment, activeCorrelationId);

    const snapshot: WebhookContextData = {
      timestamp,
      environment,
      correlationId: activeCorrelationId,
      operationsState: opsState,
      observability: obsState,
      governance: govState,
      security: Object.freeze({
        environment: secContext.environment,
        securityLevel: secContext.securityLevel,
        enforcementMode: secContext.enforcementMode,
        userRole: secContext.user.role || "SYSTEM",
      }),
      deployment: Object.freeze({
        currentHealthScore: depContext.currentHealthScore,
        changeRiskScore: depContext.changeRiskScore,
        releaseComplexity: depContext.releaseComplexity,
        emergencyOverride: depContext.emergencyOverride,
      }),
      release: relState,
      change: changeState,
      platformKernel: kernelContext,
    };

    return Object.freeze(snapshot);
  }
}
