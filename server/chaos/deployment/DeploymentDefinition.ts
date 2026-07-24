export type DeploymentEnvironment = "development" | "qa" | "staging" | "production";

export type StrategyType =
  | "Rolling"
  | "BlueGreen"
  | "Canary"
  | "ProgressiveRollout"
  | "EmergencyRollback";

export type DeploymentStatus =
  | "PLANNED"
  | "VALIDATING"
  | "IN_PROGRESS"
  | "PROMOTED"
  | "FAILED"
  | "ROLLED_BACK";

export interface CloudRunRevisionConfig {
  readonly serviceName: string;
  readonly containerImage: string;
  readonly targetPort: number;
  readonly minInstances: number;
  readonly maxInstances: number;
  readonly concurrency: number;
  readonly memoryLimit: string;
  readonly cpuLimit: string;
  readonly trafficPercent: number;
  readonly stateless: boolean;
}

export interface PromotionGateRequirement {
  readonly gateId: string;
  readonly name: string;
  readonly requiredScore: number;
  readonly mandatory: boolean;
  readonly description: string;
}

export interface DeploymentDefinitionConfig {
  readonly id: string;
  readonly name: string;
  readonly releaseVersion: string;
  readonly targetEnvironment: DeploymentEnvironment;
  readonly strategy: StrategyType;
  readonly cloudRun: CloudRunRevisionConfig;
  readonly gates: readonly PromotionGateRequirement[];
  readonly createdAt?: string;
}

export class DeploymentDefinition {
  public readonly id: string;
  public readonly name: string;
  public readonly releaseVersion: string;
  public readonly targetEnvironment: DeploymentEnvironment;
  public readonly strategy: StrategyType;
  public readonly cloudRun: CloudRunRevisionConfig;
  public readonly gates: readonly PromotionGateRequirement[];
  public readonly createdAt: string;

  constructor(config: DeploymentDefinitionConfig) {
    this.id = config.id;
    this.name = config.name;
    this.releaseVersion = config.releaseVersion;
    this.targetEnvironment = config.targetEnvironment;
    this.strategy = config.strategy;
    this.cloudRun = Object.freeze({ ...config.cloudRun });
    this.gates = Object.freeze([...config.gates]);
    this.createdAt = config.createdAt || new Date().toISOString();

    Object.freeze(this);
  }

  public static createDefaultProductionDefinition(version: string = "1.0.0"): DeploymentDefinition {
    return new DeploymentDefinition({
      id: `dep-def-prod-${Math.random().toString(36).substring(2, 9)}`,
      name: "Dork Enterprise SaaS Platform - Cloud Run Deployment",
      releaseVersion: version,
      targetEnvironment: "production",
      strategy: "BlueGreen",
      cloudRun: {
        serviceName: "dork-enterprise-platform",
        containerImage: `gcr.io/dork-enterprise-saas/app:v${version}`,
        targetPort: 3000,
        minInstances: 2,
        maxInstances: 50,
        concurrency: 80,
        memoryLimit: "1Gi",
        cpuLimit: "1",
        trafficPercent: 100,
        stateless: true,
      },
      gates: [
        {
          gateId: "GATE-OBS",
          name: "Observability Health Gate",
          requiredScore: 90,
          mandatory: true,
          description: "Verify SLA metrics and zero telemetry error spikes.",
        },
        {
          gateId: "GATE-SEC",
          name: "Security & Compliance Gate",
          requiredScore: 90,
          mandatory: true,
          description: "Verify zero secret leaks, SBOM generation, and license compliance.",
        },
        {
          gateId: "GATE-GOV",
          name: "Governance & Risk Gate",
          requiredScore: 90,
          mandatory: true,
          description: "Verify approval signatures and risk scorecard compliance.",
        },
        {
          gateId: "GATE-REL",
          name: "Release Management Gate",
          requiredScore: 95,
          mandatory: true,
          description: "Verify semantic versioning and compatibility matrix integrity.",
        },
      ],
    });
  }
}
