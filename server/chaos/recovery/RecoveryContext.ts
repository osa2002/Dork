import { RecoveryPolicyConfig } from "./RecoveryPolicy";

export interface RecoveryTimelineEvent {
  timestamp: string;
  message: string;
}

export class RecoveryContext {
  public readonly recoveryId: string;
  public readonly decisionId: string;
  public readonly correlationId: string;
  public readonly startTime: number;
  public readonly policy: RecoveryPolicyConfig;
  public readonly logs: string[] = [];
  public readonly timeline: RecoveryTimelineEvent[] = [];
  
  public isCancelled = false;
  public isTimedOut = false;

  private activeTimers = new Set<NodeJS.Timeout>();

  constructor(decisionId: string, correlationId: string, policy: RecoveryPolicyConfig) {
    this.recoveryId = `rec-${Math.random().toString(36).substring(2, 15)}`;
    this.decisionId = decisionId;
    this.correlationId = correlationId;
    this.startTime = Date.now();
    this.policy = policy;

    this.log(`Recovery context initialized for Decision: ${decisionId}`);
    this.addTimelineEvent("RECOVERY_STARTED", `Autonomous Recovery initialized.`);
  }

  /**
   * Appends an SRE runtime execution log.
   */
  public log(message: string) {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${this.recoveryId}] ${message}`;
    this.logs.push(formatted);
    // Console log in non-prod or standard server stdout
    if (process.env.NODE_ENV !== "production") {
      console.log(`\x1b[36m[RECOVERY]\x1b[0m ${message}`);
    }
  }

  /**
   * Appends an operational event to the recovery timeline.
   */
  public addTimelineEvent(stage: string, message: string) {
    const timestamp = new Date().toISOString();
    this.timeline.push({
      timestamp,
      message: `[${stage}] ${message}`,
    });
    this.log(`Timeline: [${stage}] ${message}`);
  }

  /**
   * Registers an execution timer for safety cleanup.
   */
  public registerTimer(timer: NodeJS.Timeout): NodeJS.Timeout {
    this.activeTimers.add(timer);
    return timer;
  }

  /**
   * Clears a registered timer.
   */
  public clearTimer(timer: NodeJS.Timeout) {
    clearTimeout(timer);
    this.activeTimers.delete(timer);
  }

  /**
   * Rigorously cleans all registered timers to avoid memory leaks.
   */
  public clearTimers() {
    for (const timer of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
  }

  /**
   * Signals cancellation of the active recovery workflow.
   */
  public cancel() {
    this.isCancelled = true;
    this.log("Cancellation signal received by recovery context.");
    this.addTimelineEvent("RECOVERY_CANCELLED", "Workflow cancelled by safety gate.");
  }

  /**
   * Signals a timeout event has breached.
   */
  public triggerTimeout() {
    this.isTimedOut = true;
    this.log("Timeout signal triggered for recovery context.");
    this.addTimelineEvent("RECOVERY_TIMEOUT", "Workflow execution exceeded maximum safety window.");
  }
}
