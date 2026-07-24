import { IChaosExperiment, isChaosAllowed } from "../experiments/IChaosExperiment";
import { ChaosPolicy, ChaosPolicyConfig } from "./ChaosPolicy";
import { ChaosExecutionContext } from "./ChaosExecutionContext";
import { ChaosExecutionResult, ExperimentRunSummary } from "./ChaosExecutionResult";
import { ChaosExecutionPlan, ChaosExecutionStep } from "./ChaosExecutionPlan";
import { ChaosHistory } from "./ChaosHistory";
import { ChaosCoverageAnalyzer } from "../intelligence/ChaosCoverageAnalyzer";
import { ChaosSLOIntegration } from "../intelligence/ChaosSLOIntegration";
import { BaselineSnapshotManager } from "../governance/BaselineSnapshot";
import { ChaosAuditTrail } from "../governance/ChaosAuditTrail";
import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";

// Statically import all 20 experiments for maximum compatibility and rock-solid bundler discovery
import { CloudRunInstanceKillExperiment } from "../experiments/01-cloud-run-instance-kill";
import { FirestoreNetworkPartitionExperiment } from "../experiments/02-firestore-network-partition";
import { FirestoreContentionExperiment } from "../experiments/03-firestore-contention";
import { FirestoreHighLatencyExperiment } from "../experiments/04-firestore-high-latency";
import { ExpressEventLoopDelayExperiment } from "../experiments/05-express-event-loop-delay";
import { MemoryPressureExperiment } from "../experiments/06-memory-pressure";
import { CPUPressureExperiment } from "../experiments/07-cpu-pressure";
import { GeminiTimeoutExperiment } from "../experiments/08-gemini-timeout";
import { StripeTimeoutExperiment } from "../experiments/09-stripe-timeout";
import { TwilioTimeoutExperiment } from "../experiments/10-twilio-timeout";
import { AuthFailureExperiment } from "../experiments/11-auth-failure";
import { CleanupJobFailureExperiment } from "../experiments/12-cleanup-job-failure";
import { SchedulerDelayExperiment } from "../experiments/13-scheduler-delay";
import { SSEDisconnectExperiment } from "../experiments/14-sse-disconnect";
import { RateLimitStormExperiment } from "../experiments/15-rate-limit-storm";
import { PartialServiceDegradationExperiment } from "../experiments/16-partial-service-degradation";
import { RetryExhaustionExperiment } from "../experiments/17-retry-exhaustion";
import { RandomFailureExperiment } from "../experiments/18-random-failure";
import { CloudRunColdStartExperiment } from "../experiments/19-cloud-run-cold-start";
import { FullDependencyBlackoutExperiment } from "../experiments/20-full-dependency-blackout";

export class ChaosOrchestrator {
  private static registeredExperiments: IChaosExperiment[] = [];

  static {
    // Automatically register the full suite of 20 catalogued experiments
    this.register(new CloudRunInstanceKillExperiment());
    this.register(new FirestoreNetworkPartitionExperiment());
    this.register(new FirestoreContentionExperiment());
    this.register(new FirestoreHighLatencyExperiment());
    this.register(new ExpressEventLoopDelayExperiment());
    this.register(new MemoryPressureExperiment());
    this.register(new CPUPressureExperiment());
    this.register(new GeminiTimeoutExperiment());
    this.register(new StripeTimeoutExperiment());
    this.register(new TwilioTimeoutExperiment());
    this.register(new AuthFailureExperiment());
    this.register(new CleanupJobFailureExperiment());
    this.register(new SchedulerDelayExperiment());
    this.register(new SSEDisconnectExperiment());
    this.register(new RateLimitStormExperiment());
    this.register(new PartialServiceDegradationExperiment());
    this.register(new RetryExhaustionExperiment());
    this.register(new RandomFailureExperiment());
    this.register(new CloudRunColdStartExperiment());
    this.register(new FullDependencyBlackoutExperiment());
  }

  public static register(experiment: IChaosExperiment) {
    if (!this.registeredExperiments.some((e) => e.name === experiment.name)) {
      this.registeredExperiments.push(experiment);
    }
  }

  public static getRegisteredExperiments(): IChaosExperiment[] {
    return [...this.registeredExperiments];
  }

  /**
   * Safe execution entrypoint. Enforces environment controls before booting the engine.
   */
  public static async executePlan(
    plan: ChaosExecutionPlan,
    policy: ChaosPolicyConfig = ChaosPolicy.DEFAULT_POLICY,
    options: {
      correlationId?: string;
      tags?: string[];
      executionMode?: "sequential" | "parallel";
    } = {}
  ): Promise<{ context: ChaosExecutionContext; result: ChaosExecutionResult }> {
    // 1. Strict Gate Condition
    if (!isChaosAllowed()) {
      throw new Error("SECURE EXCEPTION: Chaos orchestration is strictly barred outside staging/sandbox or when CHAOS_MODE is false.");
    }

    const mode = options.executionMode || "sequential";
    const context = new ChaosExecutionContext({
      policy,
      correlationId: options.correlationId,
      tags: options.tags || [],
      executionMode: mode,
    });

    const result = new ChaosExecutionResult(context.executionId);
    context.log("info", `Starting Chaos Orchestration. Execution Mode: ${mode.toUpperCase()}. Plan steps: ${plan.steps.length}`);

    const initiator = options.tags?.find((t) => t.startsWith("initiator:"))?.substring(10) || "SRE Operator";
    EnterpriseEventBus.publish("ChaosStarted", {
      executionId: result.executionId,
      scenarios: plan.steps.map((s) => s.experiment.name),
      initiator,
      policy,
    }, options.correlationId);

    const executionStartTime = Date.now();

    // Capture baseline snapshot before any chaos is injected
    BaselineSnapshotManager.captureSnapshot(result.executionId);

    // 2. Resolve Topological Order
    let resolvedSteps: ChaosExecutionStep[] = [];
    try {
      resolvedSteps = plan.resolveExecutionOrder();
      context.log("info", "Dependency graph parsed and resolved successfully.");
    } catch (err: any) {
      context.log("error", `Failed to resolve execution dependencies: ${err.message}`);
      result.finalize(executionStartTime);
      return { context, result };
    }

    // Check plan timeout wrapper
    const planTimeoutPromise = new Promise<void>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Orchestration plan exceeded maximum allowed policy execution window of ${policy.maxExecutionDuration}ms`));
      }, policy.maxExecutionDuration);

      // Keep reference to clear
      (context as any)._planTimeoutId = timeoutId;
    });

    const executeWork = async () => {
      if (mode === "parallel") {
        // Execute steps in parallel
        const promises = resolvedSteps.map((step) => this.runSingleStep(step, context, policy));
        const summaries = await Promise.all(promises);
        result.runs.push(...summaries);
      } else {
        // Execute steps sequentially
        for (const step of resolvedSteps) {
          if (context.isCancelled || context.emergencyStopped) {
            context.log("warn", `Bypassing remaining experiments due to orchestration cancel state.`);
            result.runs.push({
              name: step.experiment.name,
              status: "cancelled",
              durationMs: 0,
              recovered: true,
              recoveryNote: "Experiment skipped due to cancellation signal.",
            });
            continue;
          }

          const summary = await this.runSingleStep(step, context, policy);
          result.runs.push(summary);
        }
      }
    };

    try {
      // Race execution work against overall policy timeout
      await Promise.race([executeWork(), planTimeoutPromise]);
    } catch (err: any) {
      context.log("error", `Orchestration plan interrupted: ${err.message}`);
      context.triggerEmergencyStop();

      // Trigger automatic rollbacks for any incomplete or active states
      for (const step of resolvedSteps) {
        context.log("info", `Triggering emergency fallback rollback for: ${step.experiment.name}`);
        try {
          await step.experiment.rollback();
          await step.experiment.cleanup();
        } catch (rollErr: any) {
          context.log("error", `Rollback failure for ${step.experiment.name}: ${rollErr.message}`);
        }
      }
    } finally {
      // Clear overall plan timeout timer
      if ((context as any)._planTimeoutId) {
        clearTimeout((context as any)._planTimeoutId);
      }
    }

    result.finalize(executionStartTime);
    ChaosHistory.addRecord(result, context.tags);

    // Determine rollback status for audit trail logging
    let rollbackStatus: "not_needed" | "succeeded" | "failed" | "pending" = "not_needed";
    const failedRuns = result.runs.filter((run) => run.status === "failed" || run.status === "rolled_back");
    if (failedRuns.length > 0) {
      const rolledBackRuns = result.runs.filter((run) => run.status === "rolled_back");
      rollbackStatus = rolledBackRuns.length === failedRuns.length ? "succeeded" : "failed";
    }

    const affectedComponents = resolvedSteps.flatMap((step) => {
      const name = step.experiment.name.toLowerCase();
      if (name.includes("firestore") || name.includes("database")) return ["Firestore"];
      if (name.includes("stripe") || name.includes("billing")) return ["StripeAPI"];
      if (name.includes("gemini") || name.includes("ai")) return ["GeminiAI"];
      if (name.includes("twilio") || name.includes("sms")) return ["TwilioSMS"];
      return ["ExpressServer"];
    });

    ChaosAuditTrail.logExecution({
      executionId: result.executionId,
      initiator,
      timestamp: new Date(executionStartTime).toISOString(),
      appliedPolicy: policy,
      status: result.overallStatus as any,
      durationMs: result.durationMs,
      rollbackStatus,
      affectedComponents: Array.from(new Set(affectedComponents)),
      executionOutcome: result.overallStatus === "success" 
        ? "Resilience verification completed successfully." 
        : `Execution resulted in failures: ${result.runs.map((r) => `${r.name}: ${r.status}`).join(", ")}`,
      runs: result.runs.map((r) => ({
        experimentName: r.name,
        status: r.status,
        durationMs: r.durationMs,
        recovered: r.recovered,
        recoveryNote: r.recoveryNote,
      })),
    });

    context.log("info", `Chaos Orchestration finalized. Success Ratio: ${result.successRatio.toFixed(1)}%. Overall status: ${result.overallStatus.toUpperCase()}`);

    EnterpriseEventBus.publish("ChaosCompleted", {
      executionId: result.executionId,
      status: result.overallStatus,
      durationMs: result.durationMs,
      successRatio: result.successRatio,
    }, options.correlationId);

    return { context, result };
  }

  /**
   * Runs a single plan step, executing lifecycle hooks: prepare -> execute -> verify -> rollback -> cleanup
   */
  private static async runSingleStep(
    step: ChaosExecutionStep,
    context: ChaosExecutionContext,
    policy: ChaosPolicyConfig
  ): Promise<ExperimentRunSummary> {
    const experiment = step.experiment;
    const stepStartTime = Date.now();

    // Check policy filters
    if (!ChaosPolicy.isAllowed(experiment, policy)) {
      context.log("warn", `Experiment '${experiment.name}' blocked by active compliance policy rules. Skipping.`, experiment.name);
      return {
        name: experiment.name,
        status: "skipped",
        durationMs: 0,
        recovered: true,
        recoveryNote: "Skipped due to risk compliance policy restrictions.",
      };
    }

    context.log("info", `Running lifecycle hooks for: ${experiment.name}`, experiment.name);

    // Record coverage execution
    ChaosCoverageAnalyzer.recordExecution(experiment.name);

    let status: "success" | "failed" | "rolled_back" | "cancelled" = "success";
    let errorMsg: string | undefined = undefined;
    let verified = false;

    // Retry loop
    const attempts = step.retryCount || 1;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        if (context.isCancelled || context.emergencyStopped) {
          status = "cancelled";
          break;
        }

        context.log("info", `Attempt ${attempt}/${attempts} - Executing prepare()...`, experiment.name);
        await experiment.prepare();

        context.log("info", `Attempt ${attempt}/${attempts} - Executing execute()...`, experiment.name);
        await experiment.execute();

        context.log("info", `Attempt ${attempt}/${attempts} - Executing verify()...`, experiment.name);
        verified = await experiment.verify();

        if (verified) {
          context.log("info", `Experiment verification succeeded. Target is in expected degraded state.`, experiment.name);
          status = "success";
          break; // Succeeded, exit retry loop
        } else {
          throw new Error("Verification step failed. Target state did not reflect expected chaos configuration.");
        }
      } catch (err: any) {
        context.log("warn", `Attempt ${attempt} failed: ${err.message}`, experiment.name);
        errorMsg = err.message;
        status = "failed";

        EnterpriseEventBus.publish("ExperimentFailed", {
          executionId: context.executionId,
          experimentName: experiment.name,
          error: err.message,
          recoveryAttempted: !!(policy.automaticRollbackOnFailure || experiment.automaticRollback),
        }, context.correlationId);

        // If automated rollback is requested by policy or experiment
        if (policy.automaticRollbackOnFailure || experiment.automaticRollback) {
          context.log("info", `Initiating automatic rollback...`, experiment.name);
          const rollbackStart = Date.now();
          let rollbackSuccess = true;
          try {
            await experiment.rollback();
            status = "rolled_back";
          } catch (rollErr: any) {
            context.log("error", `Automatic rollback failed: ${rollErr.message}`, experiment.name);
            rollbackSuccess = false;
          }
          const rollbackDuration = Date.now() - rollbackStart;
          const recoveryDuration = Date.now() - stepStartTime;
          ChaosSLOIntegration.recordRecovery(experiment.name, rollbackSuccess, rollbackDuration, recoveryDuration);

          EnterpriseEventBus.publish("RecoveryCompleted", {
            recoveryId: `rec-${Math.random().toString(36).substring(2, 9)}`,
            component: experiment.name,
            durationMs: rollbackDuration,
            success: rollbackSuccess,
          }, context.correlationId);
        } else {
          // No automatic rollback needed but we still record standard successful recovery metrics
          const recoveryDuration = Date.now() - stepStartTime;
          ChaosSLOIntegration.recordRecovery(experiment.name, true, 0, recoveryDuration);

          EnterpriseEventBus.publish("RecoveryCompleted", {
            recoveryId: `rec-${Math.random().toString(36).substring(2, 9)}`,
            component: experiment.name,
            durationMs: 0,
            success: true,
          }, context.correlationId);
        }
      }
    }

    // Execute cleanup
    try {
      context.log("info", "Executing cleanup()...", experiment.name);
      await experiment.cleanup();
    } catch (cleanErr: any) {
      context.log("error", `Cleanup phase failed: ${cleanErr.message}`, experiment.name);
    }

    const durationMs = Date.now() - stepStartTime;

    return {
      name: experiment.name,
      status,
      durationMs,
      error: errorMsg,
      recovered: status !== "failed",
      recoveryNote: experiment.expectedRecovery,
    };
  }
}
