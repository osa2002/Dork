export type ReleaseStrategyType = "CANARY" | "BLUE_GREEN" | "ROLLING" | "PROGRESSIVE";

export interface FeatureFlagConfig {
  readonly flagName: string;
  readonly enabled: boolean;
  readonly rolloutPercentage: number;
}

export interface ReleaseDefinitionPayload {
  readonly id: string;
  readonly version: string; // semver
  readonly title: string;
  readonly description: string;
  readonly strategy: ReleaseStrategyType;
  readonly targetSubsystems: readonly string[];
  readonly featureFlags: readonly FeatureFlagConfig[];
  readonly requester: {
    readonly id: string;
    readonly name: string;
    readonly role: "SRE_LEAD" | "SRE_OPERATOR" | "DEVELOPER" | "GUEST";
    readonly team: string;
  };
  readonly complexity: "LOW" | "MEDIUM" | "HIGH";
  readonly scheduledTime?: string;
  readonly hasRollbackPlan: boolean;
  readonly changeRequestId?: string;
  readonly timestamp: string;
}

export class ReleaseDefinition {
  private static readonly SEMVER_REGEX = 
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

  /**
   * Helper to instantiate a fully immutable Release Definition.
   */
  public static create(data: Omit<ReleaseDefinitionPayload, "id" | "timestamp">): ReleaseDefinitionPayload {
    if (!this.isValidSemVer(data.version)) {
      throw new Error(`Invalid semantic versioning format: "${data.version}"`);
    }

    const id = `rel-${Math.random().toString(36).substring(2, 9)}`;
    const record: ReleaseDefinitionPayload = {
      ...data,
      id,
      timestamp: new Date().toISOString(),
    };

    return Object.freeze(record);
  }

  /**
   * Validates semantic versioning strings against the official SemVer 2.0.0 specification regex.
   */
  public static isValidSemVer(version: string): boolean {
    return this.SEMVER_REGEX.test(version);
  }
}
