import { ChangeRequestPayload } from "./ChangeRequest";
import { ChangeContextPayload } from "./ChangeContext";
import { ChangePolicyConfig } from "./ChangePolicy";
import { RiskEvaluator } from "./RiskEvaluator";

export type ChangeApprovalStatus = "AUTO_APPROVED" | "PENDING_APPROVAL" | "REJECTED";

export interface ChangeApprovalStage {
  readonly sequence: number;
  readonly name: string;
  readonly requiredRole: "SRE_LEAD" | "SRE_OPERATOR" | "DEVELOPER" | "SECURITY_AUDITOR";
  readonly status: "APPROVED" | "PENDING" | "SKIPPED";
  readonly authorizedBy?: string;
}

export interface ChangeApprovalPayload {
  readonly status: ChangeApprovalStatus;
  readonly passedRules: readonly string[];
  readonly failedRules: readonly string[];
  readonly requiredApprovals: readonly string[];
  readonly stages: readonly ChangeApprovalStage[];
  readonly reasoning: string;
}

export class ApprovalEngine {
  /**
   * Evaluates change compliance and risk factors against a policy to produce a detailed approval/rejection decision.
   */
  public static evaluate(
    request: ChangeRequestPayload,
    context: ChangeContextPayload,
    policy: ChangePolicyConfig
  ): ChangeApprovalPayload {
    const passed: string[] = [];
    const failed: string[] = [];
    const requiredApprovals: string[] = [];
    let status: ChangeApprovalStatus = "AUTO_APPROVED";
    const reasons: string[] = [];

    // 1. Error Budget Safety Floor
    const currentErrorBudget = context.governanceData?.errorBudgetRemaining ?? 100;
    if (currentErrorBudget < policy.minErrorBudgetForChange) {
      failed.push("Rule_ErrorBudget_Depleted");
      reasons.push(`Error budget (${currentErrorBudget}%) is below change-safety policy minimum (${policy.minErrorBudgetForChange}%).`);
      status = "REJECTED";
    } else {
      passed.push("Rule_ErrorBudget_Healthy");
    }

    // 2. Active Outages / Incident Co-location block
    if (policy.blockOnActiveOutages && context.activeIncidentsCount > 0) {
      failed.push("Rule_ActiveIncidents_Block");
      reasons.push(`Cannot inject changes with ${context.activeIncidentsCount} active incidents on platform.`);
      status = "REJECTED";
    } else {
      passed.push("Rule_IncidentCoLocation_Safe");
    }

    // 3. Risk Threshold Limit
    const riskResult = RiskEvaluator.evaluate(request, context);
    if (riskResult.riskScore > policy.maxRiskScoreAllowed) {
      failed.push("Rule_Risk_Exceeds_Threshold");
      reasons.push(`Change risk score (${riskResult.riskScore}) exceeds policy maximum (${policy.maxRiskScoreAllowed}).`);
      status = "REJECTED";
    } else {
      passed.push("Rule_Risk_Acceptable");
    }

    // 4. Role Hierarchy Check
    if (request.classification === "EMERGENCY" && policy.emergencyRequiresLead) {
      if (request.requester.role !== "SRE_LEAD") {
        failed.push("Rule_Emergency_Requires_Lead");
        reasons.push("Emergency changes require 'SRE_LEAD' role configuration.");
        if (status !== "REJECTED") {
          status = "PENDING_APPROVAL";
          requiredApprovals.push("SRE_LEAD");
        }
      } else {
        passed.push("Rule_Emergency_Authorized_Lead");
      }
    }

    // Generate step-by-step approvals stages
    const stages: ChangeApprovalStage[] = [];

    // Stage 1: Peer operator review for MAJOR / EMERGENCY or high-risk
    const needsPeerReview = request.classification === "MAJOR" || request.classification === "EMERGENCY" || riskResult.riskScore > 40;
    stages.push({
      sequence: 1,
      name: "SRE Peer Review",
      requiredRole: "SRE_OPERATOR",
      status: needsPeerReview ? "PENDING" : "SKIPPED",
    });

    // Stage 2: SRE Lead authorization
    const needsLeadSignoff = requiredApprovals.includes("SRE_LEAD") || request.classification === "MAJOR" || riskResult.riskScore > 60;
    stages.push({
      sequence: 2,
      name: "SRE Lead Authorization",
      requiredRole: "SRE_LEAD",
      status: needsLeadSignoff ? "PENDING" : "SKIPPED",
    });

    // Stage 3: Security & Compliance verification for CRITICAL risk
    const needsSecurityReview = riskResult.riskScore >= 80 || request.targetSubsystems.includes("StripeAPI") || request.targetSubsystems.includes("Firestore");
    stages.push({
      sequence: 3,
      name: "SRE Compliance Audit",
      requiredRole: "SECURITY_AUDITOR",
      status: needsSecurityReview ? "PENDING" : "SKIPPED",
    });

    // Recompute status based on stages
    const pendingStages = stages.filter((s) => s.status === "PENDING");
    if (status !== "REJECTED") {
      if (pendingStages.length > 0) {
        status = "PENDING_APPROVAL";
      } else {
        status = "AUTO_APPROVED";
      }
    }

    // Compile human-readable reasons
    let reasoning = "";
    if (status === "REJECTED") {
      reasoning = `Change Request blocked by policy safeguards: ${reasons.join(" ")}`;
    } else if (status === "PENDING_APPROVAL") {
      reasoning = `Change Request requires active human approval stages. Active blocks: ${pendingStages.map((s) => s.name).join(", ")}`;
    } else {
      reasoning = `Change Request automatically approved. All safety and budget policies fully compliant.`;
    }

    const finalRequiredApprovals = pendingStages.map((s) => s.requiredRole);

    return Object.freeze({
      status,
      passedRules: passed,
      failedRules: failed,
      requiredApprovals: finalRequiredApprovals,
      stages,
      reasoning,
    });
  }
}
