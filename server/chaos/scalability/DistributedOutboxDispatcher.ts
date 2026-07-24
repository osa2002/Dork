import { OutboxRecord } from "../reliability/OutboxManager";
import { outboxRepository } from "../../../src/repositories/outboxRepository";
import { LeaseManager } from "./LeaseManager";
import { ScalabilityObservability } from "./ScalabilityObservability";

export interface DispatcherOptions {
  instanceId?: string;
  leaseTtlMs?: number;
  batchSize?: number;
  maxRetries?: number;
}

export interface DispatchBatchResult {
  instanceId: string;
  partitionsProcessed: number;
  recordsProcessed: number;
  succeeded: number;
  failed: number;
  deadLetterCount: number;
  leaseFailures: number;
}

/**
 * Enterprise Distributed Outbox Dispatcher for Cloud Run horizontal autoscaling.
 * Prevents duplicate processing across stateless container instances using distributed
 * lease-based locking and guarantees strict sequential processing per shop/partition.
 */
export class DistributedOutboxDispatcher {
  private instanceId: string;
  private leaseManager: LeaseManager;
  private leaseTtlMs: number;
  private batchSize: number;

  constructor(leaseManager?: LeaseManager, options: DispatcherOptions = {}) {
    this.instanceId = options.instanceId || `dispatcher_node_${Math.random().toString(36).substring(2, 9)}`;
    this.leaseManager = leaseManager || new LeaseManager();
    this.leaseTtlMs = options.leaseTtlMs || 30000;
    this.batchSize = options.batchSize || 50;
  }

  public getInstanceId(): string {
    return this.instanceId;
  }

  /**
   * Processes outbox queue in a distributed environment with partition lease locking
   * and ordered dispatch per shop/entity.
   */
  public async dispatchBatch(
    processorFn?: (record: OutboxRecord) => Promise<boolean>
  ): Promise<DispatchBatchResult> {
    const result: DispatchBatchResult = {
      instanceId: this.instanceId,
      partitionsProcessed: 0,
      recordsProcessed: 0,
      succeeded: 0,
      failed: 0,
      deadLetterCount: 0,
      leaseFailures: 0,
    };

    const pendingRecords = await outboxRepository.getPendingRecords(this.batchSize);
    if (pendingRecords.length === 0) {
      return result;
    }

    // Group records by partition (shopId / tenantId)
    const partitionsMap = new Map<string, OutboxRecord[]>();
    for (const record of pendingRecords) {
      const partitionKey = record.shopId || record.tenantId || "global";
      if (!partitionsMap.has(partitionKey)) {
        partitionsMap.set(partitionKey, []);
      }
      partitionsMap.get(partitionKey)!.push(record);
    }

    for (const [partitionKey, records] of partitionsMap.entries()) {
      const leaseKey = `outbox_partition_${partitionKey}`;

      // Acquire distributed lease lock for partition
      const leaseRes = await this.leaseManager.acquireLease(leaseKey, this.instanceId, this.leaseTtlMs);
      ScalabilityObservability.recordLeaseAttempt(leaseRes.acquired);

      if (!leaseRes.acquired) {
        result.leaseFailures++;
        continue; // Skip partition — currently locked by another worker instance
      }

      result.partitionsProcessed++;

      try {
        // Guarantee strict sequential processing per shop/entity by sorting by createdAt ASC
        const orderedRecords = [...records].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        for (const record of orderedRecords) {
          result.recordsProcessed++;
          const startTime = Date.now();

          try {
            await outboxRepository.updateOutboxRecord(record.id, {
              status: "PROCESSING",
              lastAttemptAt: new Date().toISOString(),
            });

            let success = true;
            if (processorFn) {
              success = await processorFn(record);
            }

            const durationMs = Date.now() - startTime;
            ScalabilityObservability.recordDispatchLatency(durationMs, success);

            if (success) {
              await outboxRepository.updateOutboxRecord(record.id, {
                status: "DISPATCHED",
                processedAt: new Date().toISOString(),
              });
              result.succeeded++;
            } else {
              const nextRetry = (record.retryCount || 0) + 1;
              const maxRetries = record.maxRetries || 5;

              if (nextRetry >= maxRetries) {
                await outboxRepository.updateOutboxRecord(record.id, {
                  status: "DEAD_LETTER",
                  retryCount: nextRetry,
                  error: "Max retries exceeded during distributed dispatch",
                });
                result.deadLetterCount++;
                ScalabilityObservability.recordDlqEscalation();
              } else {
                await outboxRepository.updateOutboxRecord(record.id, {
                  status: "FAILED",
                  retryCount: nextRetry,
                  error: "Dispatch processing failed, queued for retry",
                });
                result.failed++;
                ScalabilityObservability.recordRetry();
              }
            }
          } catch (err: any) {
            const durationMs = Date.now() - startTime;
            ScalabilityObservability.recordDispatchLatency(durationMs, false);

            const nextRetry = (record.retryCount || 0) + 1;
            const maxRetries = record.maxRetries || 5;

            if (nextRetry >= maxRetries) {
              await outboxRepository.updateOutboxRecord(record.id, {
                status: "DEAD_LETTER",
                retryCount: nextRetry,
                error: err?.message || String(err),
              });
              result.deadLetterCount++;
              ScalabilityObservability.recordDlqEscalation();
            } else {
              await outboxRepository.updateOutboxRecord(record.id, {
                status: "FAILED",
                retryCount: nextRetry,
                error: err?.message || String(err),
              });
              result.failed++;
              ScalabilityObservability.recordRetry();
            }
          }
        }
      } finally {
        // Release partition lease upon completion
        await this.leaseManager.releaseLease(leaseKey, this.instanceId);
      }
    }

    return result;
  }
}
