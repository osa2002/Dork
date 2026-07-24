import { DeploymentEnvironment } from "./DeploymentDefinition";

export interface DeploymentUser {
  readonly uid: string;
  readonly role: string;
  readonly email: string;
}

export interface DeploymentContextConfig {
  readonly correlationId?: string;
  readonly environment?: DeploymentEnvironment;
  readonly requestedBy?: DeploymentUser;
  readonly releaseComplexity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly currentHealthScore?: number;
  readonly changeRiskScore?: number;
  readonly emergencyOverride?: boolean;
}

export class DeploymentContext {
  public readonly correlationId: string;
  public readonly environment: DeploymentEnvironment;
  public readonly requestedBy: DeploymentUser;
  public readonly releaseComplexity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  public readonly currentHealthScore: number;
  public readonly changeRiskScore: number;
  public readonly emergencyOverride: boolean;
  public readonly timestamp: string;

  constructor(config?: DeploymentContextConfig) {
    this.correlationId = config?.correlationId || `dep-corr-${Math.random().toString(36).substring(2, 9)}`;
    this.environment = config?.environment || "production";
    this.requestedBy = Object.freeze({
      uid: config?.requestedBy?.uid || "deploy-bot",
      role: config?.requestedBy?.role || "RELEASE_MANAGER",
      email: config?.requestedBy?.email || "deploy@dork-enterprise.internal",
    });
    this.releaseComplexity = config?.releaseComplexity || "MEDIUM";
    this.currentHealthScore = config?.currentHealthScore ?? 98;
    this.changeRiskScore = config?.changeRiskScore ?? 15; // Low risk score out of 100
    this.emergencyOverride = config?.emergencyOverride || false;
    this.timestamp = new Date().toISOString();

    Object.freeze(this);
  }

  public static create(config?: DeploymentContextConfig): DeploymentContext {
    return new DeploymentContext(config);
  }
}
