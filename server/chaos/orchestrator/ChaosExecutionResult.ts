export interface ExperimentRunSummary {
  name: string;
  status: "success" | "failed" | "rolled_back" | "skipped" | "cancelled";
  durationMs: number;
  error?: string;
  recovered: boolean;
  recoveryNote: string;
}

export class ChaosExecutionResult {
  public executionId: string;
  public successRatio: number = 0;
  public overallStatus: "success" | "degraded" | "failed" | "cancelled";
  public durationMs: number = 0;
  public runs: ExperimentRunSummary[] = [];
  public rolledBackCount: number = 0;
  public totalExecuted: number = 0;

  constructor(executionId: string) {
    this.executionId = executionId;
    this.overallStatus = "success";
  }

  public finalize(startTime: number) {
    this.durationMs = Date.now() - startTime;
    this.totalExecuted = this.runs.filter((r) => r.status !== "skipped").length;

    const successfulRuns = this.runs.filter((r) => r.status === "success").length;
    this.rolledBackCount = this.runs.filter((r) => r.status === "rolled_back").length;

    this.successRatio = this.totalExecuted > 0 ? (successfulRuns / this.totalExecuted) * 100 : 100;

    const issuesCount = this.runs.filter((r) => r.status === "failed" || r.status === "rolled_back").length;
    if (issuesCount > 0) {
      this.overallStatus = successfulRuns > 0 ? "degraded" : "failed";
    }
  }
}
