import { ChaosExecutionResult } from "./ChaosExecutionResult";

export interface ChaosHistoryRecord {
  executionId: string;
  timestamp: string;
  successRatio: number;
  overallStatus: string;
  durationMs: number;
  totalExecuted: number;
  tags: string[];
}

export class ChaosHistory {
  private static records: ChaosHistoryRecord[] = [];
  private static readonly MAX_RECORDS = 100;

  public static addRecord(result: ChaosExecutionResult, tags: string[] = []) {
    const record: ChaosHistoryRecord = {
      executionId: result.executionId,
      timestamp: new Date().toISOString(),
      successRatio: result.successRatio,
      overallStatus: result.overallStatus,
      durationMs: result.durationMs,
      totalExecuted: result.totalExecuted,
      tags,
    };

    this.records.unshift(record);

    // Prune history to limit size
    if (this.records.length > this.MAX_RECORDS) {
      this.records = this.records.slice(0, this.MAX_RECORDS);
    }
  }

  public static getHistory(): ChaosHistoryRecord[] {
    return [...this.records];
  }

  public static clearHistory() {
    this.records = [];
  }
}
