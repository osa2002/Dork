import { OutboxRecord } from "../reliability/OutboxManager";
import { outboxRepository } from "../../../src/repositories/outboxRepository";
import { LeaseManager } from "./LeaseManager";

export interface AbandonedRecoveryReport {
  scannedCount: number;
  recoveredCount: number;
  deadLetterEscalatedCount: number;
  staleLeasesCleaned: number;
  recoveredRecordIds: string[];
  timestamp: string;
}

/**
 * Enterprise Service for automatic recovery of abandoned PROCESSING events and stale leases.
 * Protects system against Cloud Run container crashes, abrupt terminations, and worker hangs.
 */
export class AbandonedEventRecoveryService {
  private leaseManager: LeaseManager;
  private static defaultStuckThresholdMs = 60000; // 60 seconds stuck timeout

  constructor(leaseManager?: LeaseManager) {
    this.leaseManager = leaseManager || new LeaseManager();
  }

  /**
   * Scans outbox queue for events stranded in 'PROCESSING' state beyond threshold,
   * releases their abandoned leases, and resets status to 'PENDING' for re-dispatch.
   */
  public async recoverAbandonedEvents(
    stuckThresholdMs: number = AbandonedEventRecoveryService.defaultStuckThresholdMs
  ): Promise<AbandonedRecoveryReport> {
    const report: AbandonedRecoveryReport = {
      scannedCount: 0,
      recoveredCount: 0,
      deadLetterEscalatedCount: 0,
      staleLeasesCleaned: 0,
      recoveredRecordIds: [],
      timestamp: new Date().toISOString(),
    };

    const processingRecords = await outboxRepository.getRecordsByStatus("PROCESSING");
    report.scannedCount = processingRecords.length;

    const now = Date.now();

    for (const record of processingRecords) {
      const lastAttemptMs = record.lastAttemptAt
        ? new Date(record.lastAttemptAt).getTime()
        : new Date(record.createdAt).getTime();

      const elapsedMs = now - lastAttemptMs;

      if (elapsedMs >= stuckThresholdMs) {
        // Event is abandoned
        const partitionKey = record.shopId || record.tenantId || "global";
        const leaseKey = `outbox_partition_${partitionKey}`;

        // Attempt lease cleanup if held
        const leaseInfo = await this.leaseManager.getLeaseInfo(leaseKey);
        if (leaseInfo && leaseInfo.holderId) {
          await this.leaseManager.releaseLease(leaseKey, leaseInfo.holderId);
          report.staleLeasesCleaned++;
        }

        if (record.retryCount >= record.maxRetries) {
          // Escalate to DEAD_LETTER if retries exhausted
          await outboxRepository.updateRecordStatus(
            record.id,
            "DEAD_LETTER",
            `Abandoned event exceeded max retries (${record.retryCount}/${record.maxRetries})`
          );
          report.deadLetterEscalatedCount++;
        } else {
          // Reset to PENDING for re-dispatch
          await outboxRepository.updateRecordStatus(
            record.id,
            "PENDING",
            `Auto-recovered abandoned event after ${Math.round(elapsedMs / 1000)}s stall`
          );
          report.recoveredCount++;
          report.recoveredRecordIds.push(record.id);
        }
      }
    }

    return report;
  }
}
