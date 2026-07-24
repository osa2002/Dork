import { ReleaseDefinitionPayload } from "./ReleaseDefinition";
import { ReleaseApprovalPayload } from "./ReleaseApproval";
import { ReleaseValidationPayload } from "./ReleaseValidator";

export interface ReleaseAuditRecord {
  readonly auditId: string;
  readonly timestamp: string;
  readonly releaseId: string;
  readonly version: string;
  readonly requesterId: string;
  readonly strategy: string;
  readonly readinessScore: number;
  readonly isEligible: boolean;
  readonly approvalStatus: string;
  readonly decisionReason: string;
  readonly targets: readonly string[];
  readonly payloadSnapshot: ReleaseDefinitionPayload;
  readonly validationSnapshot: ReleaseValidationPayload;
  readonly approvalSnapshot: ReleaseApprovalPayload;
}

export class ReleaseAudit {
  private static auditLogs: ReleaseAuditRecord[] = [];
  private static readonly MAX_AUDITS_LIMIT = 50;

  /**
   * Records an immutable session audit log.
   */
  public static log(
    definition: ReleaseDefinitionPayload,
    validation: ReleaseValidationPayload,
    approval: ReleaseApprovalPayload
  ): ReleaseAuditRecord {
    const auditId = `aud-rel-${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();

    const record: ReleaseAuditRecord = {
      auditId,
      timestamp,
      releaseId: definition.id,
      version: definition.version,
      requesterId: definition.requester.id,
      strategy: definition.strategy,
      readinessScore: validation.readinessScore,
      isEligible: validation.isEligible,
      approvalStatus: approval.status,
      decisionReason: approval.decisionReason,
      targets: Object.freeze([...definition.targetSubsystems]),
      payloadSnapshot: definition,
      validationSnapshot: validation,
      approvalSnapshot: approval,
    };

    const frozenRecord = Object.freeze(record);
    this.auditLogs.unshift(frozenRecord);

    // Limit log size for SRE safety
    if (this.auditLogs.length > this.MAX_AUDITS_LIMIT) {
      this.auditLogs.pop();
    }

    return frozenRecord;
  }

  /**
   * Retrieves all logged session release audit records.
   */
  public static getLogs(): readonly ReleaseAuditRecord[] {
    return this.auditLogs;
  }

  /**
   * Clears the static audit logs.
   */
  public static clear(): void {
    this.auditLogs = [];
  }
}
