import { collection, doc, query, where, getDocs, onSnapshot, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Ticket, Shop } from "../types";
import { getClientStartOfTodayInTimezone } from "../lib/shopUtils";
import { counterRepository } from "./counterRepository";
import { webhookDispatcherService } from "../services/webhookDispatcherService";
import { TransactionEngine } from "../../server/chaos/reliability/TransactionEngine";
import { AtomicOperation } from "../../server/chaos/reliability/AtomicOperation";
import { TransactionPolicy } from "../../server/chaos/reliability/TransactionPolicy";
import { firestoreStoreAdapter } from "./firestoreStoreAdapter";

/**
 * queueRepository
 * 
 * Infrastructure repository encapsulating all Firestore-specific ticket queue management,
 * ticket status transitions, real-time ticket subscription feeds, and offline fallback transaction workflows.
 */
export const queueRepository = {
  /**
   * Generates a unique ID for a new ticket.
   */
  generateTicketId(): string {
    return doc(collection(db, "tickets")).id;
  },

  /**
   * Subscribes to today's tickets for a given shop.
   */
  subscribeToTodayTickets(
    shopId: string,
    timezone: string,
    onUpdate: (tickets: Ticket[]) => void,
    onError: (err: any) => void
  ): () => void {
    const timezoneVal = timezone || "Asia/Riyadh";
    const startOfToday = getClientStartOfTodayInTimezone(timezoneVal);
    const ticketsQuery = query(
      collection(db, "tickets"),
      where("shopId", "==", shopId),
      where("createdAt", ">=", startOfToday.toISOString())
    );

    return onSnapshot(
      ticketsQuery,
      (snap) => {
        const ticketsList: Ticket[] = [];
        snap.forEach((d) => {
          ticketsList.push(d.data() as Ticket);
        });
        ticketsList.sort((a, b) => a.ticketNumber - b.ticketNumber);
        onUpdate(ticketsList);
      },
      onError
    );
  },

  /**
   * Subscribes to a specific ticket details.
   */
  subscribeToTicket(
    ticketId: string,
    onUpdate: (ticket: Ticket | null) => void,
    onError: (err: any) => void
  ): () => void {
    const ticketRef = doc(db, "tickets", ticketId);

    return onSnapshot(
      ticketRef,
      (ticketSnap) => {
        if (ticketSnap.exists()) {
          onUpdate(ticketSnap.data() as Ticket);
        } else {
          onUpdate(null);
        }
      },
      onError
    );
  },

  /**
   * Fetches the snapshot of all today's tickets for offline synchronization calculations.
   */
  async getTodayTicketsSnap(shopId: string): Promise<Ticket[]> {
    const todayTicketsRef = collection(db, "tickets");
    const q = query(todayTicketsRef, where("shopId", "==", shopId));
    const snap = await getDocs(q);
    const tickets: Ticket[] = [];
    snap.forEach((docSnap) => {
      tickets.push(docSnap.data() as Ticket);
    });
    return tickets;
  },

  /**
   * Updates a ticket status (e.g., leaving the queue, cancelling, etc.) using TransactionEngine.
   */
  async updateTicketStatus(ticketId: string, status: "waiting" | "calling" | "completed" | "cancelled"): Promise<void> {
    const ticketRef = doc(db, "tickets", ticketId);
    const ticketPath = `tickets/${ticketId}`;

    try {
      await TransactionEngine.runTransaction(
        async (ctx, store) => [
          AtomicOperation.check(ticketPath, (data) => !data || data.status !== status),
          AtomicOperation.update(ticketPath, { status }, { idempotencyKey: `status_${ticketId}_${status}` })
        ],
        { storeAdapter: firestoreStoreAdapter, policy: TransactionPolicy.DEFAULT_POLICY }
      );
    } catch (err) {
      await updateDoc(ticketRef, { status });
    }
  },

  /**
   * Updates multiple notification fields on a ticket atomically using TransactionEngine.
   */
  async updateTicketNotificationStatus(
    ticketId: string,
    fields: Partial<Pick<Ticket, "emailNotified" | "smsNotified" | "whatsappNotified" | "fcmToken">>
  ): Promise<void> {
    const ticketRef = doc(db, "tickets", ticketId);
    const ticketPath = `tickets/${ticketId}`;

    try {
      await TransactionEngine.runTransaction(
        async (ctx, store) => [
          AtomicOperation.update(ticketPath, fields, { idempotencyKey: `notif_${ticketId}_${Date.now()}` })
        ],
        { storeAdapter: firestoreStoreAdapter, policy: TransactionPolicy.DEFAULT_POLICY }
      );
    } catch (err) {
      await updateDoc(ticketRef, fields);
    }
  },

  /**
   * Executes transactional local counter calculations and creates a ticket in a single atomic transaction.
   */
  async executeFirestoreFallbackJoin(params: {
    shop: Shop;
    serviceId: string;
    serviceName: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    emailNotify: boolean;
    smsNotify: boolean;
    whatsappNotify: boolean;
    isScheduled: boolean;
    scheduledDate: string;
    scheduledTime: string;
  }): Promise<Ticket> {
    const storeTimezone = params.shop.timezone || "Asia/Riyadh";
    const startOfToday = getClientStartOfTodayInTimezone(storeTimezone);
    const startOfTodayStr = startOfToday.toISOString();
    const endOfTodayStr = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();

    const todayTicketsRef = collection(db, "tickets");
    const q = query(todayTicketsRef, where("shopId", "==", params.shop.id));
    
    const snap = await getDocs(q);
    const activeTodayDocs = snap.docs.filter((docSnap) => {
      const ticket = docSnap.data() as Ticket;
      return ticket.createdAt >= startOfTodayStr && ticket.createdAt <= endOfTodayStr;
    });

    const planType = params.shop.plan || "free";
    if (planType === "free" && activeTodayDocs.length >= 5) {
      const err = new Error("FREE_PLAN_LIMIT_REACHED") as any;
      err.status = 403;
      throw err;
    }

    let maxNum = 0;
    activeTodayDocs.forEach((docSnap) => {
      const ticket = docSnap.data() as Ticket;
      if (ticket.ticketNumber > maxNum) maxNum = ticket.ticketNumber;
    });

    const dayKey = startOfTodayStr.slice(0, 10);
    const tempId = doc(collection(db, "tickets")).id;
    const shopPath = `shops/${params.shop.id}`;
    const ticketPath = `tickets/${tempId}`;

    let allocatedTicketNumber = 0;
    let createdTicket: Ticket | null = null;

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

          allocatedTicketNumber = baseCount + 1;

          const newTicket: Ticket = {
            id: tempId,
            shopId: params.shop.id,
            serviceId: params.serviceId,
            serviceName: params.serviceName,
            customerName: params.customerName.trim(),
            customerPhone: params.customerPhone.trim() || "",
            customerEmail: params.customerEmail.trim() || "",
            emailNotify: params.emailNotify,
            emailNotified: false,
            smsNotify: params.smsNotify,
            smsNotified: false,
            whatsappNotify: params.whatsappNotify,
            whatsappNotified: false,
            ticketNumber: allocatedTicketNumber,
            status: params.isScheduled ? "scheduled" : "waiting",
            isScheduled: params.isScheduled,
            scheduledDate: params.isScheduled ? params.scheduledDate : "",
            scheduledTime: params.isScheduled ? params.scheduledTime : "",
            createdAt: new Date().toISOString()
          };

          createdTicket = newTicket;

          return [
            AtomicOperation.check(shopPath, (doc) => {
              if (!doc) return true;
              const dDate = doc.date || "";
              const dCount = dDate === dayKey ? (doc.lastTicketNumber || 0) : 0;
              return dCount === currentCount;
            }),
            AtomicOperation.update(shopPath, {
              lastTicketNumber: allocatedTicketNumber,
              date: dayKey
            }, { idempotencyKey: `idem_shop_${params.shop.id}_${dayKey}_${allocatedTicketNumber}` }),
            AtomicOperation.write(ticketPath, newTicket, {
              idempotencyKey: `idem_ticket_${tempId}`
            })
          ];
        },
        {
          tenantId: params.shop.id,
          storeAdapter: firestoreStoreAdapter,
          policy: TransactionPolicy.HIGH_CONCURRENCY_POLICY
        }
      );

      if (report.committed && createdTicket) {
        webhookDispatcherService.dispatchEvent(params.shop.id, "ticket.created", {
          ticket: createdTicket,
          shop: { id: params.shop.id, name: params.shop.name }
        }).catch(err => console.error("Webhook dispatch failed:", err));

        return createdTicket;
      }
    } catch (txErr: any) {
      if (txErr?.message === "FREE_PLAN_LIMIT_REACHED") {
        const err = new Error("FREE_PLAN_LIMIT_REACHED") as any;
        err.status = 403;
        throw err;
      }
    }

    // Fallback if transaction coordinator was bypassed or mock environment
    const nextTicketNumber = await counterRepository.allocateNextTicketNumber({
      shopId: params.shop.id,
      dayKey,
      maxNum,
      planType
    });

    const fallbackTicket: Ticket = {
      id: tempId,
      shopId: params.shop.id,
      serviceId: params.serviceId,
      serviceName: params.serviceName,
      customerName: params.customerName.trim(),
      customerPhone: params.customerPhone.trim() || "",
      customerEmail: params.customerEmail.trim() || "",
      emailNotify: params.emailNotify,
      emailNotified: false,
      smsNotify: params.smsNotify,
      smsNotified: false,
      whatsappNotify: params.whatsappNotify,
      whatsappNotified: false,
      ticketNumber: nextTicketNumber,
      status: params.isScheduled ? "scheduled" : "waiting",
      isScheduled: params.isScheduled,
      scheduledDate: params.isScheduled ? params.scheduledDate : "",
      scheduledTime: params.isScheduled ? params.scheduledTime : "",
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, "tickets", tempId), fallbackTicket);

    webhookDispatcherService.dispatchEvent(params.shop.id, "ticket.created", {
      ticket: fallbackTicket,
      shop: { id: params.shop.id, name: params.shop.name }
    }).catch(err => console.error("Webhook dispatch failed:", err));

    return fallbackTicket;
  },

  /**
   * Persists an offline ticket payload inside IndexedDB or custom pending queue.
   */
  async persistOfflineTicket(tempId: string, newTicket: Ticket): Promise<void> {
    await setDoc(doc(db, "pending_tickets", tempId), newTicket);
  },

  /**
   * Atomically registers a completed ticket from offline sync into the real tickets feed using TransactionEngine.
   */
  async syncSingleOfflineTicket(newTicketId: string, cleanTicket: Ticket): Promise<void> {
    const ticketPath = `tickets/${newTicketId}`;
    try {
      await TransactionEngine.runTransaction(
        async (ctx, store) => [
          AtomicOperation.write(ticketPath, cleanTicket, { idempotencyKey: `sync_${newTicketId}` })
        ],
        { storeAdapter: firestoreStoreAdapter, policy: TransactionPolicy.STRICT_IDEMPOTENT_POLICY }
      );
    } catch (err) {
      await setDoc(doc(db, "tickets", newTicketId), cleanTicket);
    }
  }
};
