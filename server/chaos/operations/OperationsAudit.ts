import { EnterpriseEventBus } from "../governance/EnterpriseEventBus";
import { ChaosAuditTrail } from "../governance/ChaosAuditTrail";
import { KnowledgeRepository } from "../knowledge/KnowledgeRepository";

export interface UnifiedAuditEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly source: "EVENT_BUS" | "CHAOS_AUDIT" | "KNOWLEDGE_BASE";
  readonly type: string;
  readonly description: string;
  readonly correlationId: string;
  readonly details: any;
}

export class OperationsAudit {
  /**
   * Helper to deeply freeze any object to ensure strict immutability.
   */
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

  /**
   * Builds and returns a unified, chronologically sorted, completely frozen operational audit history.
   */
  public static getUnifiedAuditTrail(): readonly UnifiedAuditEntry[] {
    const entries: UnifiedAuditEntry[] = [];

    // 1. Process Event Bus History
    const eventHistory = EnterpriseEventBus.getHistory();
    for (const evt of eventHistory) {
      entries.push({
        id: evt.id,
        timestamp: evt.timestamp,
        source: "EVENT_BUS",
        type: evt.type,
        description: `Operational event of type ${evt.type} dispatched.`,
        correlationId: evt.correlationId || "N/A",
        details: evt.payload,
      });
    }

    // 2. Process Chaos Audit Trail
    const chaosLogs = ChaosAuditTrail.getLogs();
    for (const log of chaosLogs) {
      entries.push({
        id: log.id,
        timestamp: log.timestamp,
        source: "CHAOS_AUDIT",
        type: `CHAOS_${log.status.toUpperCase()}`,
        description: `Chaos experiment execution plan finished with status: ${log.status}. Initiator: ${log.initiator}.`,
        correlationId: log.executionId,
        details: {
          appliedPolicy: log.appliedPolicy,
          durationMs: log.durationMs,
          rollbackStatus: log.rollbackStatus,
          affectedComponents: log.affectedComponents,
          executionOutcome: log.executionOutcome,
          runs: log.runs,
        },
      });
    }

    // 3. Process Knowledge Base Repository Records
    const knowledgeRecords = KnowledgeRepository.getAll();
    for (const record of knowledgeRecords) {
      entries.push({
        id: record.id,
        timestamp: record.timestamp,
        source: "KNOWLEDGE_BASE",
        type: "KNOWLEDGE_RECORD_CREATED",
        description: `Knowledge Record created for experiment: ${record.experimentName}. Status: ${record.status}.`,
        correlationId: record.correlationId,
        details: {
          experimentId: record.experimentId,
          tags: record.tags,
          recoveryWorkflow: record.recovery?.workflowName,
          recoveryStatus: record.recovery?.status,
          scoreSnapshot: record.enterpriseScore,
        },
      });
    }

    // Sort chronologically descending (newest first)
    const sortedEntries = entries.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Deep freeze the array and all entries
    return this.deepFreeze(sortedEntries);
  }
}
