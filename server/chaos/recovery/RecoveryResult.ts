import { RecoveryPolicyConfig } from "./RecoveryPolicy";
import { RecoveryTimelineEvent } from "./RecoveryContext";

export type RecoveryStatus =
  | "SUCCESS"
  | "FAILED"
  | "ROLLED_BACK"
  | "SKIPPED"
  | "PENDING_APPROVAL";

export interface RecoveryResult {
  recoveryId: string;
  decisionId: string;
  timestamp: string;
  workflowName: string;
  status: RecoveryStatus;
  durationMs: number;
  rollbackDurationMs: number;
  attempts: number;
  logs: string[];
  timeline: RecoveryTimelineEvent[];
  evidence: string[];
  policyApplied: RecoveryPolicyConfig;
  error?: string;
}
