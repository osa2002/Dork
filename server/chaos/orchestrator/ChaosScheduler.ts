import { ChaosScheduleType } from "./ChaosPolicy";
import { ChaosState } from "../ChaosState";

export interface ScheduledJob {
  id: string;
  type: ChaosScheduleType;
  intervalMs?: number;
  timerId?: NodeJS.Timeout;
  lastRun?: string;
  nextRun?: string;
}

export class ChaosScheduler {
  private static activeJobs = new Map<string, ScheduledJob>();

  /**
   * Schedules a recurring chaos orchestration pipeline.
   * Leverages ChaosState's central timer system for automatic platform-wide cleanup.
   */
  public static schedule(type: ChaosScheduleType, intervalMs: number, triggerCallback: () => Promise<void>): string {
    const jobId = `job-${type}-${Math.random().toString(36).substring(2, 7)}`;

    // Clear any existing job of the same schedule type to avoid duplication
    this.unscheduleByType(type);

    const timerId = setInterval(async () => {
      console.log(`[ChaosScheduler] Running scheduled orchestration job of type: ${type}`);
      try {
        await triggerCallback();
      } catch (err) {
        console.error(`[ChaosScheduler] Scheduled job ${jobId} execution failed:`, err);
      }
    }, intervalMs);

    // Track internally
    const job: ScheduledJob = {
      id: jobId,
      type,
      intervalMs,
      timerId,
      lastRun: undefined,
      nextRun: new Date(Date.now() + intervalMs).toISOString(),
    };

    this.activeJobs.set(jobId, job);

    // Register with ChaosState so a registry shutdown flushes this timer gracefully
    ChaosState.registerTimer(timerId);

    return jobId;
  }

  public static unschedule(jobId: string) {
    const job = this.activeJobs.get(jobId);
    if (job && job.timerId) {
      clearInterval(job.timerId);
      ChaosState.clearTimer(job.timerId);
      this.activeJobs.delete(jobId);
    }
  }

  public static unscheduleByType(type: ChaosScheduleType) {
    for (const [id, job] of this.activeJobs.entries()) {
      if (job.type === type) {
        this.unschedule(id);
      }
    }
  }

  public static getActiveJobs(): ScheduledJob[] {
    return Array.from(this.activeJobs.values());
  }

  public static clearAllJobs() {
    for (const jobId of this.activeJobs.keys()) {
      this.unschedule(jobId);
    }
  }
}
