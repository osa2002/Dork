import { collection, doc, query, where, getDocs, onSnapshot, updateDoc, runTransaction, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Ticket, Shop } from "../types";
import { getClientStartOfTodayInTimezone } from "../lib/shopUtils";

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
    const ticketsQuery = query(collection(db, "tickets"), where("shopId", "==", shopId));

    return onSnapshot(
      ticketsQuery,
      (snap) => {
        const ticketsList: Ticket[] = [];
        snap.forEach((d) => {
          const ticketVal = d.data() as Ticket;
          if (ticketVal.createdAt >= startOfToday.toISOString()) {
            ticketsList.push(ticketVal);
          }
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
   * Updates a ticket status (e.g., leaving the queue, cancelling, etc.).
   */
  async updateTicketStatus(ticketId: string, status: "waiting" | "calling" | "completed" | "cancelled"): Promise<void> {
    const ticketRef = doc(db, "tickets", ticketId);
    await updateDoc(ticketRef, { status });
  },

  /**
   * Updates multiple notification fields on a ticket atomically.
   */
  async updateTicketNotificationStatus(
    ticketId: string,
    fields: Partial<Pick<Ticket, "emailNotified" | "smsNotified" | "whatsappNotified" | "fcmToken">>
  ): Promise<void> {
    const ticketRef = doc(db, "tickets", ticketId);
    await updateDoc(ticketRef, fields);
  },

  /**
   * Executes transactional local counter calculations and creates a ticket in Firestore.
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
    const shopDocRef = doc(db, "shops", params.shop.id);
    let nextTicketNumber = 1;

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
    } catch (txErr: any) {
      if (txErr?.message === "FREE_PLAN_LIMIT_REACHED") {
        const err = new Error("FREE_PLAN_LIMIT_REACHED") as any;
        err.status = 403;
        throw err;
      }
      throw txErr;
    }

    const tempId = doc(collection(db, "tickets")).id;
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
      ticketNumber: nextTicketNumber,
      status: params.isScheduled ? "scheduled" : "waiting",
      isScheduled: params.isScheduled,
      scheduledDate: params.isScheduled ? params.scheduledDate : "",
      scheduledTime: params.isScheduled ? params.scheduledTime : "",
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, "tickets", tempId), newTicket);
    return newTicket;
  },

  /**
   * Persists an offline ticket payload inside IndexedDB or custom pending queue.
   */
  async persistOfflineTicket(tempId: string, newTicket: Ticket): Promise<void> {
    await setDoc(doc(db, "pending_tickets", tempId), newTicket);
  },

  /**
   * Atomically registers a completed ticket from offline sync into the real tickets feed.
   */
  async syncSingleOfflineTicket(newTicketId: string, cleanTicket: Ticket): Promise<void> {
    await setDoc(doc(db, "tickets", newTicketId), cleanTicket);
  }
};
