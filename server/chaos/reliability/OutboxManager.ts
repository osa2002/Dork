import type { OutboxRecord, OutboxStatus } from "../../../src/types";
import { outboxRepository } from "../../../src/repositories/outboxRepository";

export type { OutboxRecord, OutboxStatus };

export class OutboxManager {
  public static createRecord(
    topicOrType: string,
    payload: any,
    options: {
      id?: string;
      idempotencyKey?: string;
      partitionKey?: string;
      shopId?: string;
      tenantId?: string;
      status?: OutboxStatus;
      maxRetries?: number;
      nextAttemptAt?: string;
      lastAttemptAt?: string;
      createdAt?: string;
      retryCount?: number;
    } = {}
  ): OutboxRecord {
    const id = options.id || `outbox-${Math.random().toString(36).substring(2, 9)}`;
    const shopId = options.shopId;
    const tenantId = options.tenantId;
    const partitionKey = options.partitionKey || shopId || tenantId || "global";

    return {
      id,
      topic: topicOrType,
      eventType: topicOrType,
      event: topicOrType,
      payload,
      status: options.status || "PENDING",
      retryCount: options.retryCount || 0,
      maxRetries: options.maxRetries || 5,
      createdAt: options.createdAt || new Date().toISOString(),
      nextAttemptAt: options.nextAttemptAt,
      lastAttemptAt: options.lastAttemptAt,
      idempotencyKey: options.idempotencyKey,
      partitionKey,
      shopId,
      tenantId,
    };
  }

  public static async enqueue(
    recordOrShopId: string | Partial<OutboxRecord>,
    eventType?: string,
    payload?: any
  ): Promise<OutboxRecord> {
    let fullRecord: OutboxRecord;

    if (typeof recordOrShopId === "string") {
      fullRecord = this.createRecord(eventType || "default", payload, { shopId: recordOrShopId });
    } else {
      const record = recordOrShopId;
      fullRecord = this.createRecord(record.eventType || record.topic || "default", record.payload, {
        id: record.id,
        shopId: record.shopId,
        tenantId: record.tenantId,
        partitionKey: record.partitionKey,
        status: record.status,
        retryCount: record.retryCount,
        maxRetries: record.maxRetries,
        nextAttemptAt: record.nextAttemptAt,
        lastAttemptAt: record.lastAttemptAt,
        idempotencyKey: record.idempotencyKey,
        createdAt: record.createdAt,
      });
    }

    return await outboxRepository.enqueue(fullRecord);
  }

  public static async getPending(limit = 50): Promise<OutboxRecord[]> {
    return await outboxRepository.getPendingRecords(limit);
  }

  public static async updateStatus(id: string, updates: Partial<OutboxRecord>): Promise<void> {
    await outboxRepository.updateStatus(id, updates);
  }
}
