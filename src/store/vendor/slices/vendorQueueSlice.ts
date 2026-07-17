import { StateCreator } from "zustand";
import { VendorState, VendorQueueSlice } from "../types";
import { Ticket } from "../../../types";
import { handleFirestoreError, OperationType } from "../../../lib/firebase";
import { vendorQueueRepository } from "../../../repositories/vendorQueueRepository";
import { playNewTicketSound, playStatusUpdateSound } from "../../../lib/audio";

let isInitialTicketsLoad = true;
let ticketsUnsubscribe: (() => void) | null = null;

export const createVendorQueueSlice: StateCreator<
  VendorState,
  [],
  [],
  VendorQueueSlice
> = (set, get) => ({
  // State
  tickets: [],
  allTickets: [],
  selectedQueueServiceId: "all",
  activeCounterNumber: "1",
  ticketsLoading: false,
  selectedTicket: null,
  waitingTickets: [],
  calledTickets: [],
  completedTickets: [],
  cancelledTickets: [],
  queueStats: {
    waitingCount: 0,
    callingCount: 0,
    completedCount: 0,
    cancelledCount: 0
  },
  callProgress: null,
  isRefreshing: false,

  // Setters
  setTickets: (tickets) => set({ tickets }),
  setAllTickets: (allTickets) => set({ allTickets }),
  setSelectedQueueServiceId: (selectedQueueServiceId) => set({ selectedQueueServiceId }),
  setActiveCounterNumber: (activeCounterNumber) => set({ activeCounterNumber }),

  // Subscriptions & Operations
  subscribeToTickets: (
    shopId,
    timezone,
    getClientStartOfTodayInTimezone,
    options
  ) => {
    if (ticketsUnsubscribe) {
      ticketsUnsubscribe();
      ticketsUnsubscribe = null;
    }

    isInitialTicketsLoad = true;
    set({ ticketsLoading: true });

    ticketsUnsubscribe = vendorQueueRepository.subscribeToTickets(
      shopId,
      (ticketsList, changes) => {
        const startOfToday = getClientStartOfTodayInTimezone(timezone);
        const startOfTodayISO = startOfToday.toISOString();

        const filteredTicketsList: Ticket[] = [];
        const allList: Ticket[] = [];
        ticketsList.forEach((ticket) => {
          allList.push(ticket);
          if (ticket.createdAt >= startOfTodayISO) {
            filteredTicketsList.push(ticket);
          }
        });

        filteredTicketsList.sort((a, b) => {
          if (a.status === "waiting" && b.status === "waiting") {
            const aPriority = a.isPriority || false;
            const bPriority = b.isPriority || false;
            if (aPriority && !bPriority) return -1;
            if (!aPriority && bPriority) return 1;
          }
          return a.ticketNumber - b.ticketNumber;
        });

        // Handle alerts on changes
        if (!isInitialTicketsLoad) {
          changes.forEach((change) => {
            const ticket = change.ticket;
            if (ticket.createdAt < startOfTodayISO) return;
            if (change.type === "added") {
              if (options.getSoundEnabled()) {
                playNewTicketSound();
              }
              if (options.getBrowserNotificationsEnabled()) {
                options.sendBrowserNotification(
                  options.t("vend_new_customer_notif_title", "New Customer Joined! 👤"),
                  options.t("vend_new_customer_notif_body", "Customer {{name}} holds ticket #{{number}} for {{service}}.")
                    .replace("{{name}}", ticket.customerName)
                    .replace("{{number}}", String(ticket.ticketNumber))
                    .replace("{{service}}", ticket.serviceName)
                );
              }
            } else if (change.type === "modified") {
              if (options.getSoundEnabled()) {
                playStatusUpdateSound();
              }
            }
          });
        } else {
          isInitialTicketsLoad = false;
        }

        const waitingTickets = filteredTicketsList.filter(t => t.status === "waiting");
        const calledTickets = filteredTicketsList.filter(t => t.status === "calling");
        const completedTickets = filteredTicketsList.filter(t => t.status === "completed");
        const cancelledTickets = filteredTicketsList.filter(t => t.status === "cancelled" || t.status === "no_show");

        set({
          tickets: filteredTicketsList,
          allTickets: allList,
          waitingTickets,
          calledTickets,
          completedTickets,
          cancelledTickets,
          ticketsLoading: false,
          queueStats: {
            waitingCount: waitingTickets.length,
            callingCount: calledTickets.length,
            completedCount: completedTickets.length,
            cancelledCount: cancelledTickets.length
          }
        });
      },
      (error) => {
        console.error("Error listening to tickets in store:", error);
        set({ ticketsLoading: false });
        handleFirestoreError(error, OperationType.GET, `tickets`);
      }
    );

    return () => {
      if (ticketsUnsubscribe) {
        ticketsUnsubscribe();
        ticketsUnsubscribe = null;
      }
    };
  },

  callNextTicket: async (selectedQueueServiceId, activeCounterNumber, announceCallingTicket, t) => {
    set({ callProgress: "calling_next" });
    const { tickets } = get();
    const currentCalling = tickets.find(
      tItem => tItem.status === "calling" && (selectedQueueServiceId === "all" || tItem.serviceId === selectedQueueServiceId)
    );
    if (currentCalling) {
      try {
        await vendorQueueRepository.updateTicket(currentCalling.id, { status: "completed", completedAt: new Date().toISOString() });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${currentCalling.id}`);
      }
    }

    const nextWaiting = tickets.find(
      tItem => tItem.status === "waiting" && (selectedQueueServiceId === "all" || tItem.serviceId === selectedQueueServiceId)
    );
    if (nextWaiting) {
      try {
        await vendorQueueRepository.updateTicket(nextWaiting.id, { 
          status: "calling", 
          calledAt: new Date().toISOString(),
          counterNumber: activeCounterNumber
        });
        announceCallingTicket(String(nextWaiting.ticketNumber), activeCounterNumber, nextWaiting.serviceName);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${nextWaiting.id}`);
      }
    } else {
      alert(t("vend_no_waiting_customers_dept", { defaultValue: "There are no waiting customers in this department currently." }));
    }
    set({ callProgress: null });
  },

  handleCallTicket: async (ticket, activeCounterNumber, announceCallingTicket) => {
    set({ callProgress: `calling_${ticket.id}` });
    const { tickets } = get();
    const currentCalling = tickets.find(tItem => tItem.status === "calling" && tItem.id !== ticket.id);
    if (currentCalling) {
      try {
        await vendorQueueRepository.updateTicket(currentCalling.id, { status: "completed", completedAt: new Date().toISOString() });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${currentCalling.id}`);
      }
    }

    try {
      await vendorQueueRepository.updateTicket(ticket.id, { 
        status: "calling", 
        calledAt: new Date().toISOString(),
        counterNumber: activeCounterNumber
      });
      announceCallingTicket(String(ticket.ticketNumber), activeCounterNumber, ticket.serviceName);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `ticket/${ticket.id}`);
    }
    set({ callProgress: null });
  },

  handleUpdateTicketStatus: async (ticketId, status) => {
    const updates: any = { status };
    if (status === "completed") {
      updates.completedAt = new Date().toISOString();
    }
    try {
      await vendorQueueRepository.updateTicket(ticketId, updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
    }
  },

  handleTogglePriority: async (ticketId, currentPriority) => {
    try {
      await vendorQueueRepository.updateTicket(ticketId, { isPriority: !currentPriority });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
    }
  },

  // Aliases for comprehensive Phase 3 implementation
  callTicket: async (ticket, activeCounterNumber, announceCallingTicket) => {
    const { handleCallTicket } = get();
    await handleCallTicket(ticket, activeCounterNumber, announceCallingTicket);
  },

  completeTicket: async (ticketId) => {
    const { handleUpdateTicketStatus } = get();
    await handleUpdateTicketStatus(ticketId, "completed");
  },

  cancelTicket: async (ticketId) => {
    const { handleUpdateTicketStatus } = get();
    await handleUpdateTicketStatus(ticketId, "cancelled");
  },

  recallTicket: async (ticket, activeCounterNumber, announceCallingTicket) => {
    set({ callProgress: `recalling_${ticket.id}` });
    try {
      await vendorQueueRepository.updateTicket(ticket.id, {
        calledAt: new Date().toISOString(),
        counterNumber: activeCounterNumber
      });
      announceCallingTicket(String(ticket.ticketNumber), activeCounterNumber, ticket.serviceName);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticket.id}`);
    }
    set({ callProgress: null });
  },

  updateTicketPriority: async (ticketId, currentPriority) => {
    const { handleTogglePriority } = get();
    await handleTogglePriority(ticketId, currentPriority);
  },

  refreshQueue: () => {
    set({ isRefreshing: true });
    setTimeout(() => {
      set({ isRefreshing: false });
    }, 800);
  }
});
