import { AutonomousDecision } from "../autonomous/AutonomousDecision";
import { RecoveryPolicy, RecoveryPolicyConfig } from "./RecoveryPolicy";
import { RecoveryContext } from "./RecoveryContext";
import { RecoveryResult, RecoveryStatus } from "./RecoveryResult";
import { RecoveryHistory } from "./RecoveryHistory";
import { RecoveryExecutor } from "./RecoveryExecutor";
import {
  IRecoveryWorkflow,
  RollbackWorkflow,
  PauseExperimentsWorkflow,
  ReduceRiskWorkflow,
  OpenIncidentWorkflow,
  EscalateWorkflow,
  RequestManualApprovalWorkflow,
  ResumeOperationsWorkflow,
  NoActionWorkflow,
} from "./RecoveryWorkflow";
import { IncidentService } from "../../../src/services/IncidentService";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

export class RecoveryEngine {
  /**
   * Safe execution entrypoint. Evaluates an autonomous SRE decision, resolves safety gates,
   * handles modular recoveries, logs history, and dispatches Event Bus states.
   */
  public static async handleDecision(
    decision: AutonomousDecision,
    policyOverride?: Partial<RecoveryPolicyConfig>
  ): Promise<RecoveryResult> {
    const policy = {
      ...RecoveryPolicy.getPolicy(),
      ...(policyOverride || {}),
    };

    const correlationId = `corr-rec-${decision.id}-${Math.random().toString(36).substring(2, 9)}`;
    const context = new RecoveryContext(decision.id, correlationId, policy);

    context.log(`Evaluating recovery policy against Autonomous Decision [${decision.id}] (Status: ${decision.decision})`);

    // --- Safety Requirements checklist validation ---

    // 1. Production Safety Gate
    if (process.env.NODE_ENV === "production" && policy.isProductionSafetyEnabled) {
      context.log("CRITICAL SAFETY BLOCK: Production environment detected. Recovery execution aborted.");
      context.addTimelineEvent("SAFETY_ABORT", "Production execution barred.");

      const result = this.createSkippedResult(
        context,
        "No Action",
        "FAILED",
        "Aborted: Recovery execution is strictly prohibited in Production environments by SRE policy."
      );
      RecoveryHistory.addResult(result);
      return result;
    }

    // 2. Chaos Mode Safety Gate
    if (process.env.CHAOS_MODE !== "true" && policy.isChaosModeSafetyEnabled) {
      context.log("SAFETY GAP: CHAOS_MODE is not true. Bypassing automatic recovery execution.");
      context.addTimelineEvent("SAFETY_ABORT", "CHAOS_MODE is disabled.");

      const result = this.createSkippedResult(
        context,
        "No Action",
        "SKIPPED",
        "Bypassed: CHAOS_MODE is disabled in process environment variables."
      );
      RecoveryHistory.addResult(result);
      return result;
    }

    // 3. Confidence Safety Gate
    if (decision.confidence < policy.minConfidenceRequired) {
      context.log(`SAFETY GAP: Confidence score (${decision.confidence}%) is below policy required threshold (${policy.minConfidenceRequired}%).`);
      context.addTimelineEvent("SAFETY_ABORT", "Confidence score check failed.");

      const result = this.createSkippedResult(
        context,
        "No Action",
        "SKIPPED",
        `Bypassed: Confidence score (${decision.confidence}%) is below minimum requirement (${policy.minConfidenceRequired}%).`
      );
      RecoveryHistory.addResult(result);
      return result;
    }

    // 4. Incident Overload Guard
    const activeIncidentsCount = IncidentService.getIncidents().filter((i) => i.status !== "RESOLVED").length;
    if (activeIncidentsCount >= policy.maxAllowedIncidents && decision.decision !== "ESCALATE") {
      context.log(`SAFETY GAP: Active incident overload detected (${activeIncidentsCount} active). Redirecting to Escalation Workflow.`);
      context.addTimelineEvent("INCIDENT_OVERLOAD", "Maximum incident limit breached. Redirecting to urgent escalation.");

      // Overriding standard workflow selection to force Escalation
      const escalationWorkflow = new EscalateWorkflow();
      const result = await RecoveryExecutor.executeWorkflow(escalationWorkflow, context, decision);
      RecoveryHistory.addResult(result);
      
      this.publishRecoveryEvents(result, correlationId);
      return result;
    }

    // 5. SLO Compliance Gate
    const actualAvailability = decision.context.standardSlo.availability.actual;
    if (actualAvailability < policy.sloAvailabilityThreshold && decision.decision === "RUN_EXPERIMENT") {
      context.log(`SAFETY GAP: SLO availability (${actualAvailability}%) is below threshold (${policy.sloAvailabilityThreshold}%). Refusing to resume operations.`);
      context.addTimelineEvent("SLO_BREACH_BLOCK", "SLO degradation detected. Experiment execution cancelled.");

      const result = this.createSkippedResult(
        context,
        "Resume Operations",
        "SKIPPED",
        `Bypassed: SLO compliance of ${actualAvailability}% violates minimum threshold of ${policy.sloAvailabilityThreshold}%.`
      );
      RecoveryHistory.addResult(result);
      return result;
    }

    // --- Workflow Resolution Engine ---
    const workflow = this.resolveWorkflow(decision.decision);
    context.log(`Resolved Decision [${decision.decision}] to Workflow: [${workflow.name}]`);

    // --- Execute Workflow ---
    const result = await RecoveryExecutor.executeWorkflow(workflow, context, decision);

    // Save result into historical buffer
    RecoveryHistory.addResult(result);

    // Publish state changes on Enterprise Event Bus
    this.publishRecoveryEvents(result, correlationId);

    return result;
  }

  /**
   * Factory method to construct fallback/bypassed recovery result templates.
   */
  private static createSkippedResult(
    context: RecoveryContext,
    workflowName: string,
    status: RecoveryStatus,
    reason: string
  ): RecoveryResult {
    return {
      recoveryId: context.recoveryId,
      decisionId: context.decisionId,
      timestamp: new Date().toISOString(),
      workflowName,
      status,
      durationMs: Date.now() - context.startTime,
      rollbackDurationMs: 0,
      attempts: 0,
      logs: context.logs,
      timeline: context.timeline,
      evidence: [reason],
      policyApplied: context.policy,
      error: reason,
    };
  }

  /**
   * Publishes key events on the Enterprise Event Bus to notify observers.
   */
  private static publishRecoveryEvents(result: RecoveryResult, correlationId: string) {
    EnterpriseEventBus.publish(
      "RecoveryCompleted",
      {
        recoveryId: result.recoveryId,
        decisionId: result.decisionId,
        workflowName: result.workflowName,
        status: result.status,
        durationMs: result.durationMs,
        attempts: result.attempts,
        error: result.error,
      },
      correlationId
    );

    EnterpriseEventBus.publish(
      "SystemStateChanged",
      {
        trigger: "Autonomous Recovery Action",
        state: {
          status: "ACTIVE",
          recoveryStatus: result.status,
          workflowSelected: result.workflowName,
        },
      },
      correlationId
    );
  }

  /**
   * Resolves the corresponding workflow implementation for a given decision outcome.
   */
  private static resolveWorkflow(decisionType: string): IRecoveryWorkflow {
    switch (decisionType) {
      case "ROLLBACK":
        return new RollbackWorkflow();
      case "PAUSE_EXPERIMENTS":
        return new PauseExperimentsWorkflow();
      case "REDUCE_RISK":
        return new ReduceRiskWorkflow();
      case "OPEN_INCIDENT":
        return new OpenIncidentWorkflow();
      case "ESCALATE":
        return new EscalateWorkflow();
      case "REQUEST_APPROVAL":
        return new RequestManualApprovalWorkflow();
      case "RUN_EXPERIMENT":
      case "RESUME_OPERATIONS":
        return new ResumeOperationsWorkflow();
      case "NO_ACTION":
      case "MONITOR":
      default:
        return new NoActionWorkflow();
    }
  }
}
