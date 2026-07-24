import { AutonomousDecision } from "../autonomous/AutonomousDecision";

export type GovernanceDecisionStatus = "APPROVED" | "REJECTED" | "ESCALATED" | "PENDING_APPROVAL";

export interface GovernanceDecisionPayload {
  readonly id: string;
  readonly timestamp: string;
  readonly status: GovernanceDecisionStatus;
  readonly policyId: string;
  readonly compliancePolicyId: string;
  readonly riskScore: number; // 0-100
  readonly complianceScore: number; // 0-100
  readonly reasoning: string;
  readonly passedRules: readonly string[];
  readonly failedRules: readonly string[];
  readonly requiredApprovals: readonly string[]; // e.g. ["SRE_LEAD", "ISO_AUDITOR"]
  readonly environment: string;
  readonly autonomousDecision?: AutonomousDecision;
}

export class GovernanceDecision {
  /**
   * Helper to deeply freeze any decision payload to ensure strict immutability.
   */
  public static deepFreeze<T>(obj: T): T {
    if (obj && typeof obj === "object") {
      Object.freeze(obj);
      Object.getOwnPropertyNames(obj).forEach((prop) => {
        const val = (obj as any)[prop];
        if (
          val !== null &&
          (typeof val === "object" || typeof val === "function") &&
          !Object.isFrozen(val)
        ) {
          GovernanceDecision.deepFreeze(val);
        }
      });
    }
    return obj;
  }
}
