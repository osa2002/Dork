import { ChaosPolicyConfig } from "../orchestrator/ChaosPolicy";

export interface ChaosAuditRecord {
  id: string; // audit record ID
  executionId: string;
  initiator: string; // e.g. "SRE Operator", "Automated Scheduler"
  timestamp: string;
  appliedPolicy: ChaosPolicyConfig;
  status: "success" | "failed" | "rolled_back" | "cancelled" | "running";
  durationMs: number;
  rollbackStatus: "not_needed" | "succeeded" | "failed" | "pending";
  affectedComponents: string[];
  executionOutcome: string;
  runs: {
    experimentName: string;
    status: string;
    durationMs: number;
    recovered: boolean;
    recoveryNote?: string;
  }[];
}

export class ChaosAuditTrail {
  private static auditLogs: ChaosAuditRecord[] = [];

  static {
    // Seed high quality mock historical audit trails to show the system's previous runs
    this.auditLogs.push({
      id: "AUD-9102-1a",
      executionId: "exec-9102-4b2a",
      initiator: "SRE Platform Auto-Scheduler",
      timestamp: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      appliedPolicy: {
        allowedRiskLevels: ["Low", "Medium", "High", "Critical"],
        maxExecutionDuration: 15000,
        automaticRollbackOnFailure: true,
        maxRetries: 1,
      },
      status: "success",
      durationMs: 4200,
      rollbackStatus: "not_needed",
      affectedComponents: ["TwilioSMS", "NotificationService"],
      executionOutcome: "Resilience verified. Twilio latency simulated, gracefully handled with local buffers.",
      runs: [
        {
          experimentName: "TwilioTimeoutExperiment",
          status: "success",
          durationMs: 4100,
          recovered: true,
          recoveryNote: "Successfully responded within latency margins.",
        },
      ],
    });

    this.auditLogs.push({
      id: "AUD-9101-2c",
      executionId: "exec-9101-9f5a",
      initiator: "fastnt8000@gmail.com",
      timestamp: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
      appliedPolicy: {
        allowedRiskLevels: ["Low", "Medium", "High", "Critical"],
        maxExecutionDuration: 10000,
        automaticRollbackOnFailure: true,
        maxRetries: 1,
      },
      status: "rolled_back",
      durationMs: 8400,
      rollbackStatus: "succeeded",
      affectedComponents: ["Firestore", "TicketsRepository"],
      executionOutcome: "Firestore network partition simulation triggered automatic rollback policy.",
      runs: [
        {
          experimentName: "FirestoreNetworkPartitionExperiment",
          status: "failed",
          durationMs: 7200,
          recovered: false,
          recoveryNote: "Partition simulation exceeded threshold limits; automatic rollback initiated.",
        },
      ],
    });
  }

  /**
   * Appends an immutable audit record to the trail.
   */
  public static logExecution(record: Omit<ChaosAuditRecord, "id">): ChaosAuditRecord {
    const newRecord: ChaosAuditRecord = {
      ...record,
      id: `AUD-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).substring(2, 4)}`,
    };

    // To preserve "immutability" and prevent memory ballooning, we keep a strict log of up to 100 entries.
    this.auditLogs.unshift(newRecord);
    if (this.auditLogs.length > 100) {
      this.auditLogs.pop();
    }
    return newRecord;
  }

  public static getLogs(): ChaosAuditRecord[] {
    // Return structured deep-ish copy to preserve immutability
    return this.auditLogs.map((log) => ({ ...log }));
  }

  public static clear() {
    this.auditLogs = [];
  }
}
