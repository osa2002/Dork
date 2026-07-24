import { GovernanceContextData } from "./GovernanceContext";
import { CompliancePolicyConfig } from "./CompliancePolicy";
import { GovernanceDecisionStatus } from "./GovernanceDecision";

export interface ComplianceEngineResult {
  readonly complianceScore: number; // 0-100
  readonly status: GovernanceDecisionStatus;
  readonly passedRules: readonly string[];
  readonly failedRules: readonly string[];
  readonly requiredApprovals: readonly string[];
  readonly reasoning: string;
}

export class ComplianceEngine {
  private static readonly ROLE_HIERARCHY = {
    GUEST: 0,
    DEVELOPER: 1,
    SRE_OPERATOR: 2,
    SRE_LEAD: 3,
  };

  /**
   * Evaluates compliance against a given CompliancePolicyConfig.
   */
  public static evaluate(
    context: GovernanceContextData,
    policy: CompliancePolicyConfig,
    activeInjectsCount: number = 0
  ): ComplianceEngineResult {
    const passed: string[] = [];
    const failed: string[] = [];
    const requiredApprovals: string[] = [];
    const reasons: string[] = [];
    let status: GovernanceDecisionStatus = "APPROVED";

    let auditScore = 100;
    let roleScore = 100;
    let riskApprovalScore = 100;
    let restrictionScore = 100;

    // 1. Audit Trail Compliance Rule
    if (policy.requiresAuditTrail) {
      const hasRequesterId = !!context.requester.id;
      const hasExperimentId = !!context.targetExperiment.id;
      if (!hasRequesterId || !hasExperimentId) {
        failed.push("Rule_Audit_MissingIdentifiers");
        reasons.push("Compliance breach: Audit trail requires a valid requester ID and experiment ID.");
        auditScore = 0;
        status = "REJECTED";
      } else {
        passed.push("Rule_Audit_Identified");
      }
    } else {
      passed.push("Rule_Audit_NotRequired");
    }

    // 2. Role Verification Rule
    const userRoleValue = this.ROLE_HIERARCHY[context.requester.role] ?? 0;
    const requiredRoleValue = this.ROLE_HIERARCHY[policy.requiredMinimumRole] ?? 2;

    if (userRoleValue < requiredRoleValue) {
      failed.push("Rule_Role_Unauthorized");
      reasons.push(
        `Role '${context.requester.role}' is insufficient. Minimum required for ${policy.standard} is '${policy.requiredMinimumRole}'.`
      );
      roleScore = 0;
      status = "REJECTED";
    } else {
      passed.push("Rule_Role_Authorized");
    }

    // 3. Independent Approval for Risk Rule
    const expRisk = context.targetExperiment.estimatedRisk;
    let needsIndependentSignoff = false;

    if (policy.requiresIndependentApprovalForRisk === "CRITICAL" && expRisk === "CRITICAL") {
      needsIndependentSignoff = true;
    } else if (
      policy.requiresIndependentApprovalForRisk === "HIGH" &&
      (expRisk === "HIGH" || expRisk === "CRITICAL")
    ) {
      needsIndependentSignoff = true;
    }

    if (needsIndependentSignoff) {
      const userHasApprovalPermission = context.requester.permissions.includes("APPROVE_EXPERIMENTS");
      if (!userHasApprovalPermission) {
        failed.push("Rule_Risk_IndependentApproval_Required");
        reasons.push(
          `Experiment risk is ${expRisk}, which requires independent peer approval under standard ${policy.standard}.`
        );
        riskApprovalScore = 0;
        if (status !== "REJECTED") {
          status = "PENDING_APPROVAL";
          requiredApprovals.push("SRE_LEAD");
        }
      } else {
        passed.push("Rule_Risk_IndependentApproval_Granted");
      }
    } else {
      passed.push("Rule_Risk_NoIndependentApproval_Needed");
    }

    // 4. Simultaneous Injections Limitation
    if (activeInjectsCount >= policy.maxSimultaneousInjects) {
      failed.push("Rule_Max_Simultaneous_Injects_Exceeded");
      reasons.push(
        `Active concurrent injections (${activeInjectsCount}) meet or exceed regulatory policy ceiling of (${policy.maxSimultaneousInjects}) for standard ${policy.standard}.`
      );
      restrictionScore -= 50;
      status = "REJECTED";
    } else {
      passed.push("Rule_Max_Simultaneous_Injects_Compliant");
    }

    // 5. Zone Isolation and Encryption rules
    if (policy.restrictToEncryptedZonesOnly && context.targetExperiment.affectedSubsystems.includes("PCI_STORE")) {
      failed.push("Rule_PCI_Zone_Breach");
      reasons.push("Attempted to inject faults directly into payment-sensitive PCI zones without compliance clearance.");
      restrictionScore -= 50;
      status = "REJECTED";
    } else {
      passed.push("Rule_PCI_Zone_Safe");
    }

    // Calculate final weighted compliance score
    // Equal weights of 25% for Audit, Role, RiskApproval, and Restrictions
    const complianceScore = Math.round(
      (auditScore * 0.25) + (roleScore * 0.25) + (riskApprovalScore * 0.25) + (restrictionScore * 0.25)
    );

    let reasoning = "";
    if (status === "APPROVED") {
      reasoning = `Compliance criteria fully VERIFIED for standard ${policy.standard}. Compliance Score: ${complianceScore}%.`;
    } else if (status === "PENDING_APPROVAL") {
      reasoning = `Compliance state is PENDING human oversight. Violations: ${reasons.join(" ")}`;
    } else {
      reasoning = `Compliance evaluation FAILED. Under regulatory standard ${policy.standard}, this request is blocked. Details: ${reasons.join(" ")}`;
    }

    return {
      complianceScore,
      status,
      passedRules: passed,
      failedRules: failed,
      requiredApprovals,
      reasoning,
    };
  }
}
