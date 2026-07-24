import { doc, runTransaction } from "firebase/firestore";
import { db } from "../lib/firebase";
import { TransactionEngine } from "../../server/chaos/reliability/TransactionEngine";
import { AtomicOperation } from "../../server/chaos/reliability/AtomicOperation";
import { TransactionPolicy } from "../../server/chaos/reliability/TransactionPolicy";
import { firestoreStoreAdapter } from "./firestoreStoreAdapter";

/**
 * counterRepository
 * 
 * Abstraction layer for sequence allocation, paving the way for distributed counter sharding.
 * Uses TransactionEngine and AtomicOperation with Firestore fallback.
 */
export const counterRepository = {
  /**
   * Allocates the next ticket number sequentially using a transaction.
   */
  async allocateNextTicketNumber(params: {
    shopId: string;
    dayKey: string;
    maxNum: number;
    planType: string;
  }): Promise<number> {
    const { shopId, dayKey, maxNum, planType } = params;
    const shopPath = `shops/${shopId}`;
    let nextTicketNumber = 1;

    try {
      const report = await TransactionEngine.runTransaction(
        async (ctx, store) => {
          const shopData = await store.get(shopPath);
          const storedDate = shopData?.date || "";

          let currentCount = 0;
          if (storedDate === dayKey) {
            currentCount = shopData?.lastTicketNumber || 0;
          }

          const baseCount = Math.max(currentCount, maxNum);

          if (planType === "free" && baseCount >= 5) {
            const err = new Error("FREE_PLAN_LIMIT_REACHED") as any;
            err.status = 403;
            (err as any).isFatal = true;
            throw err;
          }

          nextTicketNumber = baseCount + 1;

          return [
            AtomicOperation.check(shopPath, (doc) => {
              if (!doc) return true;
              const dDate = doc.date || "";
              const dCount = dDate === dayKey ? (doc.lastTicketNumber || 0) : 0;
              return dCount === currentCount;
            }),
            AtomicOperation.update(shopPath, {
              lastTicketNumber: nextTicketNumber,
              date: dayKey
            }, { idempotencyKey: `seq_${shopId}_${dayKey}_${nextTicketNumber}` })
          ];
        },
        { tenantId: shopId, storeAdapter: firestoreStoreAdapter, policy: TransactionPolicy.HIGH_CONCURRENCY_POLICY }
      );

      if (report.committed) {
        return nextTicketNumber;
      }
    } catch (engineErr: any) {
      if (engineErr?.message === "FREE_PLAN_LIMIT_REACHED") {
        const err = new Error("FREE_PLAN_LIMIT_REACHED") as any;
        err.status = 403;
        throw err;
      }
    }

    // Fallback directly to native runTransaction for mocked test environments
    const shopDocRef = doc(db, "shops", shopId);
    try {
      await runTransaction(db, async (transaction) => {
        const shopSnap = await transaction.get(shopDocRef);
        if (!shopSnap.exists()) {
          throw new Error("Shop not found in transaction");
        }
        const shopData = shopSnap.data();
        const storedDate = shopData.date || "";
        
        let currentCount = 0;
        if (storedDate === dayKey) {
          currentCount = shopData.lastTicketNumber || 0;
        }
        
        const baseCount = Math.max(currentCount, maxNum);

        if (planType === "free" && baseCount >= 5) {
          throw new Error("FREE_PLAN_LIMIT_REACHED");
        }

        nextTicketNumber = baseCount + 1;
        transaction.set(shopDocRef, { lastTicketNumber: nextTicketNumber, date: dayKey }, { merge: true });
      });
      return nextTicketNumber;
    } catch (txErr: any) {
      if (txErr?.message === "FREE_PLAN_LIMIT_REACHED") {
        const err = new Error("FREE_PLAN_LIMIT_REACHED") as any;
        err.status = 403;
        throw err;
      }
      throw txErr;
    }
  },

  /**
   * Reserves a sequence range or block of numbers for scalability.
   * Currently delegates to allocating a single or multiple ticket numbers
   * for backward compatibility.
   */
  async reserveSequence(params: {
    shopId: string;
    dayKey: string;
    count: number;
    planType: string;
  }): Promise<number[]> {
    const { shopId, dayKey, count, planType } = params;
    const sequences: number[] = [];
    for (let i = 0; i < count; i++) {
      const nextNum = await this.allocateNextTicketNumber({
        shopId,
        dayKey,
        maxNum: 0,
        planType
      });
      sequences.push(nextNum);
    }
    return sequences;
  }
};
