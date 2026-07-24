import { GovernanceContextData } from "./GovernanceContext";
import { SreGovernancePolicyConfig } from "./GovernancePolicy";
import { GovernanceDecision, GovernanceDecisionPayload, GovernanceDecisionStatus } from "./GovernanceDecision";
import { CompliancePolicyConfig } from "./CompliancePolicy";
import { ComplianceEngine } from "./ComplianceEngine";
import { RiskAssessment } from "./RiskAssessment";
import { ApprovalWorkflow } from "./ApprovalWorkflow";
import { EnterpriseEventBus } from "./EnterpriseEventBus";

export interface GovernanceEngineResult {
  readonly status: GovernanceDecisionStatus;
  readonly passedRules: readonly string[];
  readonly failedRules: readonly string[];
  readonly requiredApprovals: readonly string[];
  readonly reasoning: string;
}

export class GovernanceEngine {
  // In-memory governance decision audit trail
  private static readonly decisionAuditTrail: GovernanceDecisionPayload[] = [];

  /**
   * Evaluates a Governance Request context against SRE Governance Policies.
   */
  public static evaluate(
    context: GovernanceContextData,
    policy: SreGovernancePolicyConfig
  ): GovernanceEngineResult {
    const passed: string[] = [];
    const failed: string[] = [];
    const requiredApprovals: string[] = [];
    let status: GovernanceDecisionStatus = "APPROVED";
    const reasons: string[] = [];

    // 1. Error Budget Policy Evaluation
    if (context.errorBudgetRemaining < policy.minErrorBudgetRemaining) {
      failed.push("Rule_ErrorBudget_Depleted");
      reasons.push(
        `Error budget remaining (${context.errorBudgetRemaining}%) is below the policy safety floor (${policy.minErrorBudgetRemaining}%).`
      );
      status = "REJECTED";
    } else {
      passed.push("Rule_ErrorBudget_Healthy");
    }

    // 2. SLO Policy Evaluation
    if (context.availabilityActual < policy.minSloAvailability) {
      failed.push("Rule_SLO_Threshold_Violation");
      reasons.push(
        `Uptime Availability (${context.availabilityActual}%) falls below policy requirements (${policy.minSloAvailability}%).`
      );
      status = "REJECTED";
    } else {
      passed.push("Rule_SLO_Threshold_Compliant");
    }

    // 3. Maintenance Window Policy Evaluation
    if (policy.allowedMaintenanceHoursOnly && !context.isWithinMaintenanceWindow) {
      failed.push("Rule_Outside_Maintenance_Window");
      reasons.push(
        `Chaos execution requested at hour ${context.currentHour} UTC, which is outside the authorized SRE maintenance window (02:00 - 05:00 UTC).`
      );
      if (status !== "REJECTED") {
        status = "PENDING_APPROVAL";
        requiredApprovals.push("SRE_LEAD");
      }
    } else {
      passed.push("Rule_Maintenance_Window_Valid");
    }

    // 4. Production Environment Restrictions
    if (context.environment === "production") {
      if (!policy.allowProductionChaos) {
        failed.push("Rule_Production_Chaos_Forbidden");
        reasons.push("Policy strictly forbids running chaos experiments in production.");
        status = "REJECTED";
      } else if (policy.productionRequiresSreLead && context.requester.role !== "SRE_LEAD") {
        failed.push("Rule_Production_Requires_SRE_Lead");
        reasons.push(
          `Production execution requires 'SRE_LEAD' role; requested by '${context.requester.role}' (Team: ${context.requester.team}).`
        );
        if (status !== "REJECTED") {
          status = "PENDING_APPROVAL";
          requiredApprovals.push("SRE_LEAD");
        }
      } else {
        passed.push("Rule_Production_Authorization_Valid");
      }
    } else {
      passed.push("Rule_Non_Production_Environment");
    }

    // 5. Live Risk Thresholds check
    if (context.liveRiskScore > policy.maxAllowedLiveRiskScore) {
      failed.push("Rule_Live_Risk_Too_High");
      reasons.push(
        `Active SRE system risk score (${context.liveRiskScore}) exceeds policy threshold of (${policy.maxAllowedLiveRiskScore}).`
      );
      status = "REJECTED";
    } else {
      passed.push("Rule_Live_Risk_Acceptable");
    }

    // 6. Chaos Safety Gates (Degraded Control Plane or active incidents)
    if (policy.blockChaosOnSafetyGateActive && context.safetyGatesActive) {
      failed.push("Rule_Chaos_Safety_Gate_Active");
      reasons.push("Safety gates are active. Active service outages or high predictions of crash detected.");
      status = "REJECTED";
    } else {
      passed.push("Rule_Chaos_Safety_Gate_Compliant");
    }

    // 7. Team SRE Permission checks
    if (!policy.allowedTeams.includes(context.requester.team)) {
      failed.push("Rule_Unauthorized_Team");
      reasons.push(
        `Requesting team '${context.requester.team}' is not in the list of authorized SRE core groups (${policy.allowedTeams.join(", ")}).`
      );
      status = "REJECTED";
    } else {
      passed.push("Rule_Authorized_Team_Compliant");
    }

    // Compile reasoning
    let reasoning = "";
    if (status === "APPROVED") {
      reasoning = `Governance approval GRANTED under policy '${policy.name}'. All primary SRE safety and budget rules successfully satisfied.`;
    } else if (status === "PENDING_APPROVAL") {
      reasoning = `Governance state PENDING human authorization. The request violated soft guardrails: ${reasons.join(" ")}`;
    } else {
      reasoning = `Governance approval REJECTED due to SRE rule violations: ${reasons.join(" ")}`;
    }

    return {
      status,
      passedRules: passed,
      failedRules: failed,
      requiredApprovals,
      reasoning,
    };
  }

  /**
   * Orchestrates the multi-layered evaluation: Governance + Compliance + Risk + Approvals.
   * Logs decisions to the audit trail and dispatches events.
   */
  public static evaluateRequest(
    context: GovernanceContextData,
    govPolicy: SreGovernancePolicyConfig,
    compPolicy: CompliancePolicyConfig,
    activeInjectsCount = 0
  ): GovernanceDecisionPayload {
    const id = `dec-${Math.random().toString(36).substring(2, 9)}`;

    // 1. Run Risk Assessment
    const risk = RiskAssessment.assess(context);

    // 2. Evaluate SRE Governance Rules
    const govResult = this.evaluate(context, govPolicy);

    // 3. Evaluate Compliance Standards
    const compResult = ComplianceEngine.evaluate(context, compPolicy, activeInjectsCount);

    // Combine Statuses
    let finalStatus: GovernanceDecisionStatus = "APPROVED";
    if (govResult.status === "REJECTED" || compResult.status === "REJECTED") {
      finalStatus = "REJECTED";
    } else if (govResult.status === "PENDING_APPROVAL" || compResult.status === "PENDING_APPROVAL") {
      finalStatus = "PENDING_APPROVAL";
    }

    // Generate step-by-step Approval Workflow if pending or high risk
    const unionApprovals = Array.from(
      new Set([...govResult.requiredApprovals, ...compResult.requiredApprovals])
    );
    const workflow = ApprovalWorkflow.generateWorkflow(risk.riskScore, context.environment, unionApprovals);

    if (finalStatus === "APPROVED" && workflow.status === "PENDING_APPROVAL") {
      finalStatus = "PENDING_APPROVAL";
    }

    const reasoning = `${govResult.reasoning} | ${compResult.reasoning}`;

    const decision: GovernanceDecisionPayload = {
      id,
      timestamp: new Date().toISOString(),
      status: finalStatus,
      policyId: govPolicy.id,
      compliancePolicyId: compPolicy.id,
      riskScore: risk.riskScore,
      complianceScore: compResult.complianceScore,
      reasoning,
      passedRules: [...govResult.passedRules, ...compResult.passedRules],
      failedRules: [...govResult.failedRules, ...compResult.failedRules],
      requiredApprovals: unionApprovals,
      environment: context.environment,
    };

    // Store in audit history
    this.decisionAuditTrail.push(decision);

    // Publish to Enterprise Event Bus
    const correlationId = `corr-gov-${id}`;
    EnterpriseEventBus.publish(
      "GovernanceDecisionCreated",
      {
        decisionId: id,
        status: finalStatus,
        riskScore: risk.riskScore,
        complianceScore: compResult.complianceScore,
        reasoning,
      },
      correlationId
    );

    EnterpriseEventBus.publish(
      "ComplianceCheckCompleted",
      {
        decisionId: id,
        standard: compPolicy.standard,
        score: compResult.complianceScore,
        failedCount: compResult.failedRules.length,
      },
      correlationId
    );

    return GovernanceDecision.deepFreeze(decision);
  }

  /**
   * Returns a copy of the governance decision audit trail.
   */
  public static getAuditTrail(): readonly GovernanceDecisionPayload[] {
    return this.decisionAuditTrail;
  }

  /**
   * Clears the governance decision history (mainly for unit tests).
   */
  public static clearAuditTrail(): void {
    this.decisionAuditTrail.length = 0;
  }
}
