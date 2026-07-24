import { DeploymentEnvironment, DeploymentStatus } from "./DeploymentDefinition";

export interface DeploymentHistoryRecord {
  readonly deploymentId: string;
  readonly correlationId: string;
  readonly releaseVersion: string;
  readonly environment: DeploymentEnvironment;
  readonly strategy: string;
  readonly status: DeploymentStatus;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly healthScore: number;
  readonly rollbackTriggered: boolean;
  readonly rollbackReason?: string;
  readonly logs: readonly string[];
}

export class DeploymentHistory {
  private static readonly records: DeploymentHistoryRecord[] = [];

  public static recordDeployment(record: DeploymentHistoryRecord): void {
    this.records.push(Object.freeze({ ...record, logs: Object.freeze([...record.logs]) }));
  }

  public static getHistory(): readonly DeploymentHistoryRecord[] {
    return Object.freeze([...this.records]);
  }

  public static getHistoryForEnvironment(env: DeploymentEnvironment): readonly DeploymentHistoryRecord[] {
    return Object.freeze(this.records.filter((r) => r.environment === env));
  }

  public static getByCorrelationId(corrId: string): DeploymentHistoryRecord | undefined {
    return this.records.find((r) => r.correlationId === corrId);
  }

  public static clear(): void {
    this.records.length = 0;
  }
}
