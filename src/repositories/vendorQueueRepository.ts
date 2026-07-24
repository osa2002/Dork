import { collection, doc, onSnapshot, query, where, updateDoc, runTransaction, getDocs, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Ticket, WebhookEvent } from "../types";
import { getClientStartOfTodayInTimezone } from "../lib/shopUtils";
import { webhookDispatcherService } from "../services/webhookDispatcherService";
import { TransactionEngine } from "../../server/chaos/reliability/TransactionEngine";
import { AtomicOperation } from "../../server/chaos/reliability/AtomicOperation";
import { TransactionPolicy } from "../../server/chaos/reliability/TransactionPolicy";
import { firestoreStoreAdapter } from "./firestoreStoreAdapter";

/**
  * vendorQueueRepository
  * 
  * Infrastructure repository encapsulating all Firestore-specific database queries,
  * listeners, updates, and atomicity transactions for the Vendor's ticket queues.
  */
export const vendorQueueRepository = {
  /**
    * Subscribes to real-time changes of today's tickets associated with a specific shop.
    */
  subscribeToTickets(
    shopId: string,
    timezone: string = "Asia/Riyadh",
    onUpdate: (
      tickets: Ticket[],
      changes: Array<{ type: "added" | "modified" | "removed"; ticket: Ticket }>
    ) => void,
    onError?: (err: any) => void
  ): () => void {
    const startOfToday = getClientStartOfTodayInTimezone(timezone);
    const ticketsQuery = query(
      collection(db, "tickets"),
      where("shopId", "==", shopId),
      where("createdAt", ">=", startOfToday.toISOString())
    );

    return onSnapshot(
      ticketsQuery,
      (snapshot) => {
        const ticketsList: Ticket[] = [];
        snapshot.forEach((docSnap) => {
          ticketsList.push(docSnap.data() as Ticket);
        });

        const changes = snapshot.docChanges().map((change) => ({
          type: change.type,
          ticket: change.doc.data() as Ticket,
        }));

        onUpdate(ticketsList, changes);
      },
      onError || (() => {})
    );
  },

  /**
    * Performs a one-time fetch of tickets within a specific date range for reporting or historical analysis.
    */
  async getTicketsByDateRange(
    shopId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Ticket[]> {
    const ticketsQuery = query(
      collection(db, "tickets"),
      where("shopId", "==", shopId),
      where("createdAt", ">=", startDate.toISOString()),
      where("createdAt", "<=", endDate.toISOString())
    );

    const snap = await getDocs(ticketsQuery);
    const ticketsList: Ticket[] = [];
    snap.forEach((docSnap) => {
      ticketsList.push(docSnap.data() as Ticket);
    });
    return ticketsList;
  },

  /**
    * Updates general fields (e.g. status, calledAt, completedAt, counterNumber, isPriority) on a Ticket using TransactionEngine.
    */
  async updateTicket(ticketId: string, updates: Partial<Ticket>): Promise<void> {
    const docRef = doc(db, "tickets", ticketId);
    const ticketPath = `tickets/${ticketId}`;

    let previousTicket: Ticket | null = null;
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        previousTicket = snap.data() as Ticket;
      }
    } catch (e) {
      // Pre-update fetch failure non-fatal
    }

    try {
      await TransactionEngine.runTransaction(
        async (ctx, store) => {
          const ops: AtomicOperation[] = [];

          if (updates.status) {
            ops.push(
              AtomicOperation.check(ticketPath, (data) => {
                if (!data) return true;
                if (updates.status === "calling" && data.status === "completed") {
                  return false;
                }
                return true;
              })
            );
          }

          ops.push(
            AtomicOperation.update(ticketPath, updates, {
              idempotencyKey: `upd_ticket_${ticketId}_${Date.now()}`
            })
          );

          return ops;
        },
        { storeAdapter: firestoreStoreAdapter, policy: TransactionPolicy.DEFAULT_POLICY }
      );
    } catch (engineErr) {
      await updateDoc(docRef, updates);
    }

    if (updates.status && previousTicket) {
      const updatedTicket: Ticket = {
        ...previousTicket,
        ...updates
      };

      let webhookEvent: WebhookEvent | null = null;
      if (updates.status === "calling") webhookEvent = "ticket.calling";
      else if (updates.status === "completed") webhookEvent = "ticket.completed";
      else if (updates.status === "cancelled") webhookEvent = "ticket.cancelled";
      else if (updates.status === "no_show") webhookEvent = "ticket.no_show";

      if (webhookEvent && updatedTicket.shopId) {
        webhookDispatcherService.dispatchEvent(updatedTicket.shopId, webhookEvent, {
          ticket: updatedTicket,
          previousStatus: previousTicket.status,
          updatedAt: new Date().toISOString()
        }).catch(err => console.error("Webhook dispatch on ticket update failed:", err));
      }
    }
  },

  /**
   * Atomically completes current calling ticket and updates next ticket to 'calling' with optimistic concurrency.
   */
  async callNextTicketAtomically(params: {
    shopId: string;
    selectedServiceId: string;
    activeCounterNumber: string | number;
    currentCallingTicketId?: string;
    nextWaitingTicketId: string;
  }): Promise<{ success: boolean }> {
    const { currentCallingTicketId, nextWaitingTicketId, activeCounterNumber } = params;

    const report = await TransactionEngine.runTransaction(
      async (ctx, store) => {
        const ops: AtomicOperation[] = [];

        if (currentCallingTicketId) {
          const callingPath = `tickets/${currentCallingTicketId}`;
          ops.push(
            AtomicOperation.check(callingPath, (doc) => !doc || doc.status === "calling"),
            AtomicOperation.update(callingPath, {
              status: "completed",
              completedAt: new Date().toISOString()
            }, { idempotencyKey: `comp_${currentCallingTicketId}_${Date.now()}` })
          );
        }

        const nextPath = `tickets/${nextWaitingTicketId}`;
        ops.push(
          AtomicOperation.check(nextPath, (doc) => doc && doc.status === "waiting"),
          AtomicOperation.update(nextPath, {
            status: "calling",
            calledAt: new Date().toISOString(),
            counterNumber: String(activeCounterNumber)
          }, { idempotencyKey: `call_${nextWaitingTicketId}_${Date.now()}` })
        );

        return ops;
      },
      {
        tenantId: params.shopId,
        storeAdapter: firestoreStoreAdapter,
        policy: TransactionPolicy.HIGH_CONCURRENCY_POLICY
      }
    );

    if (!report.committed) {
      // Fallback sequentially if offline/standalone
      if (currentCallingTicketId) {
        await this.updateTicket(currentCallingTicketId, { status: "completed", completedAt: new Date().toISOString() });
      }
      await this.updateTicket(nextWaitingTicketId, {
        status: "calling",
        calledAt: new Date().toISOString(),
        counterNumber: String(activeCounterNumber)
      });
      return { success: true };
    }

    return { success: report.committed };
  },

  /**
   * Atomically transitions a specific ticket to 'calling' while completing any existing calling ticket.
   */
  async callTicketAtomically(params: {
    ticketId: string;
    activeCounterNumber: string | number;
    currentCallingTicketId?: string;
  }): Promise<{ success: boolean }> {
    const { ticketId, activeCounterNumber, currentCallingTicketId } = params;

    const report = await TransactionEngine.runTransaction(
      async (ctx, store) => {
        const ops: AtomicOperation[] = [];

        if (currentCallingTicketId && currentCallingTicketId !== ticketId) {
          const callingPath = `tickets/${currentCallingTicketId}`;
          ops.push(
            AtomicOperation.check(callingPath, (doc) => !doc || doc.status === "calling"),
            AtomicOperation.update(callingPath, {
              status: "completed",
              completedAt: new Date().toISOString()
            }, { idempotencyKey: `comp_${currentCallingTicketId}_${Date.now()}` })
          );
        }

        const targetPath = `tickets/${ticketId}`;
        ops.push(
          AtomicOperation.check(targetPath, (doc) => doc && (doc.status === "waiting" || doc.status === "scheduled" || doc.status === "calling")),
          AtomicOperation.update(targetPath, {
            status: "calling",
            calledAt: new Date().toISOString(),
            counterNumber: String(activeCounterNumber)
          }, { idempotencyKey: `call_${ticketId}_${Date.now()}` })
        );

        return ops;
      },
      {
        storeAdapter: firestoreStoreAdapter,
        policy: TransactionPolicy.HIGH_CONCURRENCY_POLICY
      }
    );

    if (!report.committed) {
      if (currentCallingTicketId && currentCallingTicketId !== ticketId) {
        await this.updateTicket(currentCallingTicketId, { status: "completed", completedAt: new Date().toISOString() });
      }
      await this.updateTicket(ticketId, {
        status: "calling",
        calledAt: new Date().toISOString(),
        counterNumber: String(activeCounterNumber)
      });
      return { success: true };
    }

    return { success: report.committed };
  },

  /**
    * Runs a transaction to atomically update emailNotified to true if not already notified.
    * Returns boolean indicating if the status was successfully marked as notified.
    */
  async markEmailAsNotifiedInTransaction(ticketId: string): Promise<boolean> {
    const ticketPath = `tickets/${ticketId}`;
    let didUpdate = false;

    try {
      const report = await TransactionEngine.runTransaction(
        async (ctx, store) => {
          const freshData = await store.get(ticketPath);
          if (freshData && freshData.emailNotify && !freshData.emailNotified) {
            didUpdate = true;
            return [
              AtomicOperation.check(ticketPath, (data) => data && data.emailNotify && !data.emailNotified),
              AtomicOperation.update(ticketPath, { emailNotified: true }, { idempotencyKey: `email_notify_${ticketId}` })
            ];
          }
          return [];
        },
        { storeAdapter: firestoreStoreAdapter, policy: TransactionPolicy.STRICT_IDEMPOTENT_POLICY }
      );

      if (report.committed) {
        return didUpdate;
      }
    } catch (e) {
      // Fallback to Firestore runTransaction
    }

    const ticketRef = doc(db, "tickets", ticketId);
    await runTransaction(db, async (transaction) => {
      const freshSnap = await transaction.get(ticketRef);
      if (!freshSnap.exists()) return;
      const freshData = freshSnap.data() as Ticket;

      if (freshData.emailNotify && !freshData.emailNotified) {
        transaction.update(ticketRef, { emailNotified: true });
        didUpdate = true;
      }
    });
    return didUpdate;
  }
};

