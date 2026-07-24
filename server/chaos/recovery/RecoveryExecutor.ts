import { RecoveryContext } from "./RecoveryContext";
import { IRecoveryWorkflow } from "./RecoveryWorkflow";
import { AutonomousDecision } from "../autonomous/AutonomousDecision";
import { RecoveryResult, RecoveryStatus } from "./RecoveryResult";
import { ChaosHealthContributor } from "../intelligence/ChaosHealthContributor";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

export class RecoveryExecutor {
  /**
   * Executes a recovery workflow inside the provided context, enforcing safety policies, retries,
   * cancellations, timeout races, and rollback verifications.
   */
  public static async executeWorkflow(
    workflow: IRecoveryWorkflow,
    context: RecoveryContext,
    decision: AutonomousDecision
  ): Promise<RecoveryResult> {
    const startTime = Date.now();
    let status: RecoveryStatus = "SUCCESS";
    let attempts = 0;
    let rollbackDurationMs = 0;
    let errorMsg: string | undefined;

    // Check if safety policy mandates manual approval before executing
    const scores = decision.context.enterpriseScores;
    if (
      context.policy.requireManualApprovalForHighRisk &&
      scores.overallEnterpriseScore < context.policy.highRiskThresholdScore
    ) {
      context.log(`Safety gate triggered: enterprise score (${scores.overallEnterpriseScore}/100) is below high-risk threshold (${context.policy.highRiskThresholdScore}). Forcing manual approval.`);
      context.addTimelineEvent("SAFETY_GATE_TRIGGERED", "Awaiting manual approval due to elevated risk status.");
      
      return {
        recoveryId: context.recoveryId,
        decisionId: context.decisionId,
        timestamp: new Date().toISOString(),
        workflowName: workflow.name,
        status: "PENDING_APPROVAL",
        durationMs: Date.now() - startTime,
        rollbackDurationMs: 0,
        attempts: 0,
        logs: context.logs,
        timeline: context.timeline,
        evidence: [
          `Overall Enterprise Score of ${scores.overallEnterpriseScore}/100 is in the high-risk domain.`,
          "Manual intervention is mandated by current active SRE policy."
        ],
        policyApplied: context.policy,
      };
    }

    // Individual execution window timeout racer
    const timeoutMs = context.policy.workflowTimeouts[workflow.name] || 5000;
    let timeoutTimer: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        context.triggerTimeout();
        reject(new Error(`Recovery timeout threshold of ${timeoutMs}ms breached.`));
      }, timeoutMs);
      context.registerTimer(timeoutTimer);
    });

    const executionWork = async () => {
      const maxAttempts = context.policy.maxRetryAttempts;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        attempts = attempt;
        
        if (context.isCancelled) {
          status = "SKIPPED";
          context.log("Execution bypassed due to cancellation signal.");
          return;
        }

        context.log(`Attempt ${attempt}/${maxAttempts} - Triggering workflow execute()...`);
        try {
          await workflow.execute(context, decision);
          status = "SUCCESS";
          context.log("Workflow execution completed successfully.");
          return; // Succeeded!
        } catch (err: any) {
          context.log(`Attempt ${attempt} failed with error: ${err.message}`);
          errorMsg = err.message;
          
          if (attempt < maxAttempts) {
            context.log(`Waiting ${context.policy.retryDelayMs}ms before retrying...`);
            await new Promise<void>((res) => {
              const sleepTimer = setTimeout(res, context.policy.retryDelayMs);
              context.registerTimer(sleepTimer);
            });
          }
        }
      }
      
      // All attempts failed
      throw new Error(errorMsg || `Workflow execution failed after ${maxAttempts} attempts.`);
    };

    try {
      // Race execution work against the safety timeout
      await Promise.race([executionWork(), timeoutPromise]);
    } catch (err: any) {
      context.log(`Execution aborted: ${err.message}`);
      errorMsg = err.message;
      status = "FAILED";

      // Trigger Rollback if supported/mandatory
      const rollbackStart = Date.now();
      if (workflow.rollback) {
        context.log("Triggering workflow rollback mechanics...");
        context.addTimelineEvent("ROLLBACK_START", "Executing custom rollback steps.");
        try {
          await workflow.rollback(context);
          status = "ROLLED_BACK";
          context.log("Workflow rollback completed successfully.");
        } catch (rollErr: any) {
          context.log(`CRITICAL: Workflow rollback failed: ${rollErr.message}`);
          status = "FAILED"; // Mark failed if rollback fails
        }
      } else {
        context.log("Workflow does not declare a custom rollback mechanism.");
      }
      rollbackDurationMs = Date.now() - rollbackStart;
    } finally {
      // Rigorous cleanup of active timers to prevent node process leaks
      if (timeoutTimer) {
        context.clearTimer(timeoutTimer);
      }
      context.clearTimers();
    }

    // Rollback Verification / Health check post-execution
    let verifiedHealthy = true;
    const postHealth = ChaosHealthContributor.getHealthStatus();
    context.log(`Post-recovery Health Check: status=${postHealth.status}, impactScore=${postHealth.impactScore}`);
    
    if (status === "ROLLED_BACK") {
      // Verify rollback brought us back to a stable state or didn't degrade further
      if (postHealth.impactScore > 80) {
        verifiedHealthy = false;
        context.log("ROLLBACK VERIFICATION FAILED: Impact score remains critically high.");
        context.addTimelineEvent("VERIFICATION_FAILED", "Rollback verification failed. Platform health remains critical.");
      } else {
        context.log("ROLLBACK VERIFICATION SUCCESS: Platform metrics stabilized.");
        context.addTimelineEvent("VERIFICATION_SUCCESS", "Rollback verification successful.");
      }
    }

    const durationMs = Date.now() - startTime;
    context.addTimelineEvent("RECOVERY_FINALIZED", `Workflow execution finished with status ${status}`);

    const evidence = [
      `Completed with status ${status} in ${durationMs}ms.`,
      `Attempts executed: ${attempts}/${context.policy.maxRetryAttempts}.`,
      `Workflow selected: ${workflow.name}.`,
      `Post-recovery impact score: ${postHealth.impactScore}/100.`,
      `Post-recovery health state: ${postHealth.status}.`,
    ];
    if (errorMsg) {
      evidence.push(`Error message: ${errorMsg}`);
    }

    return {
      recoveryId: context.recoveryId,
      decisionId: context.decisionId,
      timestamp: new Date().toISOString(),
      workflowName: workflow.name,
      status,
      durationMs,
      rollbackDurationMs,
      attempts,
      logs: context.logs,
      timeline: context.timeline,
      evidence,
      policyApplied: context.policy,
      error: errorMsg,
    };
  }
}
