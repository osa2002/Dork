import { TransactionStoreAdapter } from "../reliability/TransactionCoordinator";
import { InMemoryStoreAdapter } from "../reliability/TransactionEngine";

export interface LeaseRecord {
  leaseKey: string;
  holderId: string;
  acquiredAt: string;
  expiresAt: string;
  lastHeartbeatAt: string;
  ttlMs: number;
}

export interface LeaseResult {
  acquired: boolean;
  lease?: LeaseRecord;
  existingHolder?: string;
  reason?: string;
}

/**
 * Distributed Lease Manager for Cloud Run horizontal multi-instance orchestration.
 * Guarantees single-worker execution across stateless instances using TTL lease locks.
 */
export class LeaseManager {
  private store: TransactionStoreAdapter;
  private static defaultTtlMs = 30000; // 30 seconds default lease TTL

  constructor(storeAdapter?: TransactionStoreAdapter) {
    this.store = storeAdapter || new InMemoryStoreAdapter();
  }

  /**
   * Attempts to acquire a distributed lease for a given resource or partition key
   */
  public async acquireLease(
    leaseKey: string,
    holderId: string,
    ttlMs: number = LeaseManager.defaultTtlMs
  ): Promise<LeaseResult> {
    const targetPath = `leases/${leaseKey}`;
    const now = new Date();
    const existing = await this.store.get<LeaseRecord>(targetPath);

    // If existing lease is valid and held by another instance, reject
    if (existing && existing.holderId !== holderId) {
      const expiresAtDate = new Date(existing.expiresAt);
      if (expiresAtDate.getTime() > now.getTime()) {
        return {
          acquired: false,
          existingHolder: existing.holderId,
          reason: `Lease '${leaseKey}' currently held by instance '${existing.holderId}' until ${existing.expiresAt}`,
        };
      }
    }

    // Acquire or re-grant lease
    const newExpiresAt = new Date(now.getTime() + ttlMs).toISOString();
    const leaseRecord: LeaseRecord = {
      leaseKey,
      holderId,
      acquiredAt: now.toISOString(),
      expiresAt: newExpiresAt,
      lastHeartbeatAt: now.toISOString(),
      ttlMs,
    };

    await this.store.update(targetPath, leaseRecord);

    return {
      acquired: true,
      lease: leaseRecord,
    };
  }

  /**
   * Extends active lease duration (heartbeat)
   */
  public async renewLease(
    leaseKey: string,
    holderId: string,
    ttlMs: number = LeaseManager.defaultTtlMs
  ): Promise<boolean> {
    const targetPath = `leases/${leaseKey}`;
    const existing = await this.store.get<LeaseRecord>(targetPath);

    if (!existing || existing.holderId !== holderId) {
      return false;
    }

    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + ttlMs).toISOString();

    await this.store.update(targetPath, {
      expiresAt: newExpiresAt,
      lastHeartbeatAt: now.toISOString(),
    });

    return true;
  }

  /**
   * Explicitly releases a lease
   */
  public async releaseLease(leaseKey: string, holderId: string): Promise<boolean> {
    const targetPath = `leases/${leaseKey}`;
    const existing = await this.store.get<LeaseRecord>(targetPath);

    if (!existing || existing.holderId !== holderId) {
      return false;
    }

    // Mark expired
    await this.store.update(targetPath, {
      expiresAt: new Date(0).toISOString(),
    });

    return true;
  }

  /**
   * Checks if a lease is active
   */
  public async isLeaseActive(leaseKey: string): Promise<boolean> {
    const targetPath = `leases/${leaseKey}`;
    const lease = await this.store.get<LeaseRecord>(targetPath);
    if (!lease) return false;
    return new Date(lease.expiresAt).getTime() > Date.now();
  }

  /**
   * Retrieves current lease info
   */
  public async getLeaseInfo(leaseKey: string): Promise<LeaseRecord | null> {
    const targetPath = `leases/${leaseKey}`;
    return (await this.store.get<LeaseRecord>(targetPath)) || null;
  }
}
