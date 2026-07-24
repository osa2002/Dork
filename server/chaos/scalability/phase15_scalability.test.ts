import { describe, it, expect, beforeEach, vi } from "vitest";
import { EnterpriseEventBus, OperationalEvent } from "../governance/EnterpriseEventBus";
import { PersistentPubSubDriver } from "./PersistentPubSubDriver";
import { LeaseManager } from "./LeaseManager";
import { DistributedOutboxDispatcher } from "./DistributedOutboxDispatcher";
import { AbandonedEventRecoveryService } from "./AbandonedEventRecoveryService";
import { ScalabilityObservability } from "./ScalabilityObservability";
import { OutboxManager, OutboxRecord } from "../webhooks/OutboxManager";
import { outboxRepository } from "../../../src/repositories/outboxRepository";
import { InMemoryStoreAdapter } from "../reliability/TransactionEngine";

describe("Phase 15 — Enterprise Scalability & Distributed Systems", () => {
  beforeEach(() => {
    outboxRepository.clearMemoryCache();
    EnterpriseEventBus.clear();
    ScalabilityObservability.reset();
  });

  describe("1. Persistent Enterprise Event Bus (Cloud Pub/Sub Compatible Abstraction)", () => {
    it("should publish and receive messages using PersistentPubSubDriver", async () => {
      const store = new InMemoryStoreAdapter();
      const driver = new PersistentPubSubDriver(store);
      EnterpriseEventBus.setDriver(driver);

      const received: OperationalEvent[] = [];
      await driver.subscribe("OrderServiceSub", "HealthChanged", (event) => {
        received.push(event);
      });

      const eventId = EnterpriseEventBus.publish("HealthChanged", { status: "DEGRADED" }, "corr-ps-101");
      expect(eventId).toBeDefined();

      await new Promise((r) => setTimeout(r, 15));

      expect(received.length).toBe(1);
      expect(received[0].type).toBe("HealthChanged");
      expect(received[0].correlationId).toBe("corr-ps-101");

      const metrics = driver.getMetrics();
      expect(metrics.totalPublished).toBe(1);
      expect(metrics.activeSubscriptions).toBe(1);
    });

    it("should support message acknowledgment and durable event replay", async () => {
      const driver = new PersistentPubSubDriver();
      const startTime = new Date().toISOString();

      await driver.publish({
        id: "evt-ps-1",
        type: "SystemStateChanged",
        timestamp: new Date().toISOString(),
        correlationId: "corr-ps-1",
        payload: { state: "MAINTENANCE" },
      });

      await driver.publish({
        id: "evt-ps-2",
        type: "IncidentCreated",
        timestamp: new Date().toISOString(),
        correlationId: "corr-ps-2",
        payload: { incidentId: "inc-99" },
      });

      const replayed = await driver.replay(startTime);
      expect(replayed.length).toBe(2);
      expect(replayed.map((e) => e.type)).toEqual(["SystemStateChanged", "IncidentCreated"]);
    });
  });

  describe("2. Lease-Based Lock Management & Multi-Instance Coordination", () => {
    it("should acquire lease for an instance and block competing instance", async () => {
      const store = new InMemoryStoreAdapter();
      const leaseMgr = new LeaseManager(store);

      const lease1 = await leaseMgr.acquireLease("outbox_partition_shop_100", "node_A", 10000);
      expect(lease1.acquired).toBe(true);
      expect(lease1.lease?.holderId).toBe("node_A");

      const lease2 = await leaseMgr.acquireLease("outbox_partition_shop_100", "node_B", 10000);
      expect(lease2.acquired).toBe(false);
      expect(lease2.existingHolder).toBe("node_A");

      // Release lease from node_A
      await leaseMgr.releaseLease("outbox_partition_shop_100", "node_A");

      // Now node_B can acquire
      const lease3 = await leaseMgr.acquireLease("outbox_partition_shop_100", "node_B", 10000);
      expect(lease3.acquired).toBe(true);
      expect(lease3.lease?.holderId).toBe("node_B");
    });
  });

  describe("3. Distributed Outbox Dispatcher & Ordered Partition Processing", () => {
    it("should process outbox records and prevent duplicate execution across instances", async () => {
      const store = new InMemoryStoreAdapter();
      const leaseMgr = new LeaseManager(store);

      const dispatcherA = new DistributedOutboxDispatcher(leaseMgr, { instanceId: "worker_node_A" });
      const dispatcherB = new DistributedOutboxDispatcher(leaseMgr, { instanceId: "worker_node_B" });

      // Enqueue record for shop_alpha
      await OutboxManager.enqueue("shop_alpha", "ticket.called", { ticketNo: "A-01" });

      const processedEvents: string[] = [];
      const mockProcessor = vi.fn().mockImplementation(async (rec: OutboxRecord) => {
        processedEvents.push(rec.id);
        return true;
      });

      // Node A dispatches
      const resultA = await dispatcherA.dispatchBatch(mockProcessor);
      expect(resultA.succeeded).toBe(1);
      expect(resultA.leaseFailures).toBe(0);

      // Node B runs immediately after — queue is already DISPATCHED
      const resultB = await dispatcherB.dispatchBatch(mockProcessor);
      expect(resultB.recordsProcessed).toBe(0);
      expect(mockProcessor).toHaveBeenCalledTimes(1);
    });

    it("should process records for the same shop in strict sequential order", async () => {
      const shopId = "shop_ordered_999";

      // Create 3 records with explicit timestamp progression
      const r1 = OutboxManager.createRecord("ticket.step1", { step: 1 }, { shopId });
      r1.createdAt = new Date(Date.now() - 3000).toISOString();
      await outboxRepository.saveOutboxRecord(r1);

      const r2 = OutboxManager.createRecord("ticket.step2", { step: 2 }, { shopId });
      r2.createdAt = new Date(Date.now() - 2000).toISOString();
      await outboxRepository.saveOutboxRecord(r2);

      const r3 = OutboxManager.createRecord("ticket.step3", { step: 3 }, { shopId });
      r3.createdAt = new Date(Date.now() - 1000).toISOString();
      await outboxRepository.saveOutboxRecord(r3);

      const executedSteps: number[] = [];
      const dispatcher = new DistributedOutboxDispatcher();

      await dispatcher.dispatchBatch(async (rec) => {
        executedSteps.push(rec.payload.step);
        return true;
      });

      expect(executedSteps).toEqual([1, 2, 3]);
    });
  });

  describe("4. Automatic Recovery of Abandoned PROCESSING Events", () => {
    it("should identify abandoned PROCESSING records, release stale lease, and reset to PENDING", async () => {
      const store = new InMemoryStoreAdapter();
      const leaseMgr = new LeaseManager(store);
      const recoveryService = new AbandonedEventRecoveryService(leaseMgr);

      // Create a record stuck in PROCESSING for 90 seconds
      const record = OutboxManager.createRecord("order.created", { orderId: "ord-777" }, { shopId: "shop_crash" });
      record.status = "PROCESSING";
      record.lastAttemptAt = new Date(Date.now() - 90000).toISOString();
      await outboxRepository.saveOutboxRecord(record);

      // Simulate active lease held by crashed instance
      await leaseMgr.acquireLease("outbox_partition_shop_crash", "crashed_instance_9", 30000);

      const report = await recoveryService.recoverAbandonedEvents(60000); // 60s threshold

      expect(report.scannedCount).toBe(1);
      expect(report.recoveredCount).toBe(1);
      expect(report.staleLeasesCleaned).toBe(1);

      const updatedRecord = await outboxRepository.getRecord(record.id);
      expect(updatedRecord?.status).toBe("PENDING");
    });

    it("should escalate abandoned event to DEAD_LETTER if retries are exhausted", async () => {
      const recoveryService = new AbandonedEventRecoveryService();

      const record = OutboxManager.createRecord("payment.failed", {}, { shopId: "shop_dlq" });
      record.status = "PROCESSING";
      record.retryCount = 5;
      record.maxRetries = 5;
      record.lastAttemptAt = new Date(Date.now() - 90000).toISOString();
      await outboxRepository.saveOutboxRecord(record);

      const report = await recoveryService.recoverAbandonedEvents(60000);

      expect(report.deadLetterEscalatedCount).toBe(1);

      const updatedRecord = await outboxRepository.getRecord(record.id);
      expect(updatedRecord?.status).toBe("DEAD_LETTER");
    });
  });

  describe("5. Enterprise Observability & Telemetry Metrics", () => {
    it("should capture dispatch latency, retry rates, and lease contention metrics accurately", () => {
      ScalabilityObservability.recordDispatchLatency(25, true);
      ScalabilityObservability.recordDispatchLatency(45, true);
      ScalabilityObservability.recordDispatchLatency(120, false);
      ScalabilityObservability.recordRetry();
      ScalabilityObservability.recordDlqEscalation();
      ScalabilityObservability.recordLeaseAttempt(true);
      ScalabilityObservability.recordLeaseAttempt(false);

      const snapshot = ScalabilityObservability.getSnapshot({
        pending: 5,
        processing: 1,
        failed: 2,
        deadLetter: 1,
      });

      expect(snapshot.queueDepth.total).toBe(9);
      expect(snapshot.performance.avgLatencyMs).toBeGreaterThan(0);
      expect(snapshot.performance.p95LatencyMs).toBe(120);
      expect(snapshot.performance.dlqGrowthCount).toBe(1);
      expect(snapshot.performance.leaseContentionRatePercent).toBe(50); // 1 out of 2 blocked
    });
  });
});
