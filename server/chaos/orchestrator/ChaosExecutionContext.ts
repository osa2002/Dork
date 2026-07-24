import { ChaosPolicyConfig } from "./ChaosPolicy";

export interface ChaosExecutionLog {
  timestamp: string;
  level: "info" | "warn" | "error" | "telemetry";
  message: string;
  experimentName?: string;
}

export class ChaosExecutionContext {
  public executionId: string;
  public correlationId: string;
  public startTime: number;
  public endTime?: number;
  public isCancelled: boolean = false;
  public logs: ChaosExecutionLog[] = [];
  public policy: ChaosPolicyConfig;
  public tags: string[];
  public executionMode: string; // "sequential" | "parallel"
  public emergencyStopped: boolean = false;

  constructor(options: {
    policy: ChaosPolicyConfig;
    correlationId?: string;
    tags?: string[];
    executionMode?: string;
  }) {
    this.executionId = `exec-${Math.random().toString(36).substring(2, 11)}`;
    this.correlationId = options.correlationId || `corr-${Math.random().toString(36).substring(2, 11)}`;
    this.startTime = Date.now();
    this.policy = options.policy;
    this.tags = options.tags || [];
    this.executionMode = options.executionMode || "sequential";
  }

  public log(level: "info" | "warn" | "error" | "telemetry", message: string, experimentName?: string) {
    const logItem: ChaosExecutionLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      experimentName,
    };
    this.logs.push(logItem);
    console.log(`[ChaosOrchestrator][${logItem.timestamp}][${level.toUpperCase()}] ${message}`);
  }

  public cancel() {
    this.isCancelled = true;
    this.log("warn", "Execution cancellation requested.");
  }

  public triggerEmergencyStop() {
    this.emergencyStopped = true;
    this.isCancelled = true;
    this.log("error", "EMERGENCY STOP TRIGGERED. HALTING ALL ACTIVE EXPERIMENTS IMMEDIATELY.");
  }
}
