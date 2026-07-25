import { Firestore } from "firebase-admin/firestore";
import { getAdminFirestoreDb } from "../db/FirestoreClient";
import { DistributedLockException } from "../exceptions/InfrastructureExceptions";

export interface DistributedLock {
  lockKey: string;
  ownerId: string;
  fencingToken: number;
  acquiredAt: string;
  expiresAt: string;
}

export class FirestoreDistributedLockService {
  private readonly db: Firestore;
  private readonly collectionName = "distributed_locks";

  constructor(db?: Firestore) {
    this.db = db || getAdminFirestoreDb();
  }

  /**
   * Acquires a distributed lock on lockKey for ttlMs milliseconds.
   * Returns a Lock handle if successful, or throws DistributedLockException.
   */
  public async acquireLock(
    lockKey: string,
    ownerId: string = `worker_${crypto.randomUUID()}`,
    ttlMs: number = 30000
  ): Promise<DistributedLock> {
    const docRef = this.db.collection(this.collectionName).doc(lockKey);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    const acquiredLock = await this.db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);

      if (snap.exists) {
        const current = snap.data() as DistributedLock;
        const currentExpiry = new Date(current.expiresAt).getTime();

        // If lock is active and owned by another worker, fail
        if (currentExpiry > now.getTime() && current.ownerId !== ownerId) {
          throw new DistributedLockException(
            lockKey,
            `Lock is currently held by owner '${current.ownerId}' until ${current.expiresAt}`
          );
        }

        // Lock expired or owned by us: renew with incremented fencing token
        const newFencingToken = (current.fencingToken || 0) + 1;
        const updatedLock: DistributedLock = {
          lockKey,
          ownerId,
          fencingToken: newFencingToken,
          acquiredAt: now.toISOString(),
          expiresAt: expiresAt.toISOString()
        };

        transaction.set(docRef, updatedLock);
        return updatedLock;
      }

      // First time lock creation
      const newLock: DistributedLock = {
        lockKey,
        ownerId,
        fencingToken: 1,
        acquiredAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      };

      transaction.set(docRef, newLock);
      return newLock;
    });

    return acquiredLock;
  }

  /**
   * Releases a lock safely if owned by the ownerId with matching fencingToken.
   */
  public async releaseLock(lockKey: string, ownerId: string, fencingToken?: number): Promise<boolean> {
    const docRef = this.db.collection(this.collectionName).doc(lockKey);

    return await this.db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists) return true;

      const current = snap.data() as DistributedLock;
      if (current.ownerId !== ownerId) {
        return false;
      }

      if (fencingToken !== undefined && current.fencingToken !== fencingToken) {
        return false;
      }

      transaction.delete(docRef);
      return true;
    });
  }

  /**
   * Runs a critical code block inside an acquired lock.
   */
  public async withLock<T>(
    lockKey: string,
    operation: (fencingToken: number) => Promise<T>,
    ttlMs: number = 30000,
    ownerId: string = `worker_${crypto.randomUUID()}`
  ): Promise<T> {
    const lock = await this.acquireLock(lockKey, ownerId, ttlMs);
    try {
      return await operation(lock.fencingToken);
    } finally {
      await this.releaseLock(lockKey, ownerId, lock.fencingToken).catch(() => {});
    }
  }
}
