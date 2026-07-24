export type ChangeClassification = "STANDARD" | "MINOR" | "MAJOR" | "EMERGENCY";
export type ChangeType = "INFRASTRUCTURE" | "CODE_DEPLOY" | "CHAOS_EXPERIMENT" | "CONFIGURATION";

export interface ChangeRequestPayload {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly requester: {
    readonly id: string;
    readonly name: string;
    readonly role: "SRE_LEAD" | "SRE_OPERATOR" | "DEVELOPER" | "GUEST";
    readonly team: string;
  };
  readonly targetSubsystems: readonly string[];
  readonly classification: ChangeClassification;
  readonly scheduledTime?: string;
  readonly changeType: ChangeType;
  readonly parameters: Record<string, any>;
  readonly timestamp: string;
}

export class ChangeRequest {
  /**
   * Helper to instantiate a fully immutable Change Request.
   */
  public static create(data: Omit<ChangeRequestPayload, "id" | "timestamp">): ChangeRequestPayload {
    const id = `chg-${Math.random().toString(36).substring(2, 9)}`;
    return Object.freeze({
      ...data,
      id,
      timestamp: new Date().toISOString(),
    });
  }
}
