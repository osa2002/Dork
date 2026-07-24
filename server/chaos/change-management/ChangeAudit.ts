import { ChangeRequestPayload } from "./ChangeRequest";
import { ImpactAnalysisPayload } from "./ImpactAnalyzer";
import { RiskEvaluationPayload } from "./RiskEvaluator";
import { ChangeApprovalPayload } from "./ApprovalEngine";
import { ExecutionSimulationPayload } from "./ChangeExecutor";

export interface ChangeAuditRecord {
  readonly id: string;
  readonly timestamp: string;
  readonly request: ChangeRequestPayload;
  readonly impact: ImpactAnalysisPayload;
  readonly risk: RiskEvaluationPayload;
  readonly approval: ChangeApprovalPayload;
  readonly simulation?: ExecutionSimulationPayload;
}

export class ChangeAudit {
  private static readonly records: ChangeAuditRecord[] = [];

  /**
   * Appends an immutable change execution record to the SRE Session Audit Trail.
   */
  public static log(
    request: ChangeRequestPayload,
    impact: ImpactAnalysisPayload,
    risk: RiskEvaluationPayload,
    approval: ChangeApprovalPayload,
    simulation?: ExecutionSimulationPayload
  ): ChangeAuditRecord {
    const record: ChangeAuditRecord = {
      id: `aud-chg-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      request,
      impact,
      risk,
      approval,
      simulation,
    };

    // Deep freeze
    this.deepFreeze(record);
    this.records.push(record);
    return record;
  }

  /**
   * Retrieves all logs recorded during the active server session.
   */
  public static getLogs(): readonly ChangeAuditRecord[] {
    return this.records;
  }

  /**
   * Resets active session logs (mainly for SRE unit testing).
   */
  public static clearLogs(): void {
    this.records.length = 0;
  }

  private static deepFreeze<T>(obj: T): T {
    if (obj && typeof obj === "object") {
      Object.freeze(obj);
      Object.getOwnPropertyNames(obj).forEach((prop) => {
        const val = (obj as any)[prop];
        if (
          val !== null &&
          (typeof val === "object" || typeof val === "function") &&
          !Object.isFrozen(val)
        ) {
          this.deepFreeze(val);
        }
      });
    }
    return obj;
  }
}
