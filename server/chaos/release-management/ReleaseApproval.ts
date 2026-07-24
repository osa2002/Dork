import { ReleaseDefinitionPayload } from "./ReleaseDefinition";
import { ReleaseContextPayload } from "./ReleaseContext";
import { ReleasePolicyConfig } from "./ReleasePolicy";
import { ReleaseValidationPayload } from "./ReleaseValidator";

export type ApprovalStatus = "AUTO_APPROVED" | "PENDING_APPROVAL" | "REJECTED";

export interface ApprovalRuleEvaluation {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly passed: boolean;
  readonly severity: "CRITICAL" | "WARNING" | "INFO";
  readonly reason: string;
}

export interface ReleaseApprovalPayload {
  readonly status: ApprovalStatus;
  readonly evaluatedRules: readonly ApprovalRuleEvaluation[];
  readonly decisionReason: string;
  readonly requiredOverrideRole?: "SRE_LEAD" | "SRE_OPERATOR";
  readonly timestamp: string;
}

export class ReleaseApproval {
  /**
   * Evaluates the policy rules and validation results to produce an immutable Release Approval payload.
   */
  public static evaluate(
    definition: ReleaseDefinitionPayload,
    context: ReleaseContextPayload,
    policy: ReleasePolicyConfig,
    validation: ReleaseValidationPayload
  ): ReleaseApprovalPayload {
    const evaluatedRules: ApprovalRuleEvaluation[] = [];
    const timestamp = new Date().toISOString();

    // 1. Error Budget Gate
    const errorBudget = context.governanceData.errorBudgetRemaining;
    const minBudget = policy.minErrorBudgetForRelease;
    const errorBudgetPassed = errorBudget >= minBudget;
    evaluatedRules.push({
      ruleId: "Rule_ErrorBudget_Sufficient",
      ruleName: "Minimum Error Budget Guarantee",
      passed: errorBudgetPassed,
      severity: "CRITICAL",
      reason: errorBudgetPassed
        ? `Remaining error budget (${errorBudget.toFixed(2)}%) meets or exceeds safety minimum of ${minBudget.toFixed(2)}%.`
        : `SRE Error Budget is depleted (${errorBudget.toFixed(2)}% remaining), failing safety threshold of ${minBudget.toFixed(2)}%.`,
    });

    // 2. Active Outage Gate
    const isOutageActive = context.governanceData.safetyGatesActive;
    const outagePassed = !(policy.blockOnActiveOutages && isOutageActive);
    evaluatedRules.push({
      ruleId: "Rule_BlockOnActiveOutages",
      ruleName: "No Concurrent Outages Allowed",
      passed: outagePassed,
      severity: "CRITICAL",
      reason: outagePassed
        ? "No concurrent platform outages or active safety gate locks detected."
        : "Releases are blocked because active outages/safety gates are engaged.",
    });

    // 3. Rollback Plan Obligation
    const rollbackPassed = !policy.requiresRollbackPlan || definition.hasRollbackPlan;
    evaluatedRules.push({
      ruleId: "Rule_RollbackPlan_Obligation",
      ruleName: "Rollback Plan Verification",
      passed: rollbackPassed,
      severity: "CRITICAL",
      reason: rollbackPassed
        ? "Rollback contingency plan is defined and integrated with release package."
        : "No rollback strategy is provided in the release definition.",
    });

    // 4. Release Freeze Window Check
    const currentHour = context.governanceData.currentHour;
    const isWithinFreeze = policy.releaseFreezeWindows.includes(currentHour);
    const requesterRole = definition.requester.role;
    const isLeadOrLeadNotReq = !isWithinFreeze || requesterRole === "SRE_LEAD";

    evaluatedRules.push({
      ruleId: "Rule_FreezeWindow_Check",
      ruleName: "Release Freeze Maintenance Check",
      passed: !isWithinFreeze || isLeadOrLeadNotReq,
      severity: isWithinFreeze && requesterRole !== "SRE_LEAD" ? "WARNING" : "INFO",
      reason: isWithinFreeze
        ? isLeadOrLeadNotReq
          ? `Operating inside a release freeze window (Hour ${currentHour} UTC), but override permission granted to "${requesterRole}".`
          : `Release scheduled inside freeze window (Hour ${currentHour} UTC), which requires a manual "SRE_LEAD" override.`
        : "Current execution time is outside all scheduled release freeze windows.",
    });

    // 5. Emergency SRE Role Verification
    const isEmergency = definition.complexity === "HIGH";
    const emergencyPassed = !isEmergency || !policy.emergencyRequiresLead || requesterRole === "SRE_LEAD" || requesterRole === "SRE_OPERATOR";
    evaluatedRules.push({
      ruleId: "Rule_EmergencyRole_Check",
      ruleName: "High Complexity Requester Role Authorization",
      passed: emergencyPassed,
      severity: "CRITICAL",
      reason: emergencyPassed
        ? "Requester role is authorized to execute this release complexity tier."
        : `High complexity release requested by "${requesterRole}". SRE Lead or SRE Operator authorized permissions required.`,
    });

    // 6. Minimum Readiness Score Verification
    const readinessPassed = validation.readinessScore >= policy.minReadinessScore;
    evaluatedRules.push({
      ruleId: "Rule_MinReadinessScore_Check",
      ruleName: "Minimum SRE Release Readiness Score",
      passed: readinessPassed,
      severity: "CRITICAL",
      reason: readinessPassed
        ? `Readiness score of ${validation.readinessScore}/100 exceeds the policy minimum of ${policy.minReadinessScore}/100.`
        : `Release readiness score of ${validation.readinessScore}/100 does not meet policy minimum of ${policy.minReadinessScore}/100.`,
    });

    // Evaluate final state
    const hasCriticalFailures = evaluatedRules.some((r) => r.severity === "CRITICAL" && !r.passed);
    const hasWarningFailures = evaluatedRules.some((r) => r.severity === "WARNING" && !r.passed);

    let status: ApprovalStatus = "AUTO_APPROVED";
    let decisionReason = "All safety gates and policy compliance checks passed successfully. Auto-approving release.";
    let requiredOverrideRole: "SRE_LEAD" | "SRE_OPERATOR" | undefined = undefined;

    if (hasCriticalFailures) {
      status = "REJECTED";
      decisionReason = "Release request rejected due to active critical policy gate failures.";
    } else if (hasWarningFailures) {
      status = "PENDING_APPROVAL";
      decisionReason = "Release request is pending approval due to execution inside a freeze window or suboptimal readiness scores.";
      requiredOverrideRole = "SRE_LEAD";
    } else if (validation.readinessScore < 90) {
      status = "PENDING_APPROVAL";
      decisionReason = "Readiness score is acceptable but falls below 90/100, requiring manual SRE review.";
      requiredOverrideRole = "SRE_OPERATOR";
    }

    return Object.freeze({
      status,
      evaluatedRules: Object.freeze(evaluatedRules),
      decisionReason,
      requiredOverrideRole,
      timestamp,
    });
  }
}
