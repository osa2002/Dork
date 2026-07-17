import { StateCreator } from "zustand";
import { QueueState, QueueSubscriptionSlice } from "../types";
import { Ticket } from "../../../types";
import { handleFirestoreError, OperationType } from "../../../lib/firebase";
import { cacheData, getCachedData } from "../../../lib/offlineDb";
import { audioService } from "../services/audioService";
import { vibrationService } from "../services/vibrationService";
import { notificationService } from "../services/notificationService";
import { storageService } from "../services/storageService";
import { queueRepository } from "../../../repositories/queueRepository";

let todayTicketsUnsubscribe: (() => void) | null = null;
let myTicketUnsubscribe: (() => void) | null = null;

/**
 * queueSubscriptionSlice
 * 
 * Responsibility: Manages Firestore real-time snapshot listeners.
 * Orchestrates live data updates, and coordinates turn calls with device feedback 
 * (notifications, sounds, vibrations) via decoupled services.
 */
export const createQueueSubscriptionSlice: StateCreator<
  QueueState,
  [],
  [],
  QueueSubscriptionSlice
> = (set, get) => ({
  subscribeToTodayTickets: (shopId, timezone) => {
    if (todayTicketsUnsubscribe) {
      todayTicketsUnsubscribe();
      todayTicketsUnsubscribe = null;
    }

    let active = true;

    // Load todayTickets cache
    getCachedData<Ticket[]>(`tickets_${shopId}`).then((cachedTickets) => {
      if (active && cachedTickets) {
        set({ todayTickets: cachedTickets });
      }
    });

    const timezoneVal = timezone || "Asia/Riyadh";

    todayTicketsUnsubscribe = queueRepository.subscribeToTodayTickets(
      shopId,
      timezoneVal,
      (ticketsList) => {
        if (!active) return;
        set({ todayTickets: ticketsList });
        cacheData(`tickets_${shopId}`, ticketsList);
      },
      (err) => {
        if (active) {
          if (!storageService.getOnlineStatus()) {
            console.log("Offline: Using cached today tickets");
          } else {
            handleFirestoreError(err, OperationType.GET, `tickets`);
          }
        }
      }
    );

    return () => {
      active = false;
      if (todayTicketsUnsubscribe) {
        todayTicketsUnsubscribe();
        todayTicketsUnsubscribe = null;
      }
    };
  },

  subscribeToMyTicket: (shopId, ticketId, isRtl, shopName, soundEnabled) => {
    if (myTicketUnsubscribe) {
      myTicketUnsubscribe();
      myTicketUnsubscribe = null;
    }

    let active = true;
    let prevStatus: string | null = null;

    // Load cached active ticket first
    getCachedData<Ticket>(`my_ticket_${shopId}`).then((cachedMyTicket) => {
      if (active && cachedMyTicket && cachedMyTicket.id === ticketId) {
        set({ myTicket: cachedMyTicket });
        prevStatus = cachedMyTicket.status;
      }
    });

    myTicketUnsubscribe = queueRepository.subscribeToTicket(
      ticketId,
      (ticketData) => {
        if (!active) return;
        if (ticketData) {
          set({ myTicket: ticketData });
          cacheData(`my_ticket_${shopId}`, ticketData);

          // Turn calling side-effects delegated to separate service layers
          if (ticketData.status === "calling" && prevStatus !== "calling") {
            vibrationService.vibrate([200, 100, 200, 100, 300]);
            notificationService.showTurnNotification(isRtl, ticketData.counterNumber, shopName);
          }
          
          if (prevStatus !== null && prevStatus !== ticketData.status && ticketData.status !== "calling") {
            if (soundEnabled) {
              audioService.playChimeSound();
            }
          }

          prevStatus = ticketData.status;
        } else {
          if (myTicketUnsubscribe) {
            myTicketUnsubscribe();
            myTicketUnsubscribe = null;
          }
          set({ myTicket: null });
          storageService.removeSavedTicketId(shopId);
        }
      },
      (err) => {
        if (active) {
          if (!storageService.getOnlineStatus()) {
            console.log("Offline: Using cached ticket details");
          } else {
            handleFirestoreError(err, OperationType.GET, `tickets/${ticketId}`);
          }
        }
      }
    );

    return () => {
      active = false;
      if (myTicketUnsubscribe) {
        myTicketUnsubscribe();
        myTicketUnsubscribe = null;
      }
    };
  },

  unsubscribeMyTicket: () => {
    if (myTicketUnsubscribe) {
      myTicketUnsubscribe();
      myTicketUnsubscribe = null;
    }
  },

  unsubscribeQueue: () => {
    if (todayTicketsUnsubscribe) {
      todayTicketsUnsubscribe();
      todayTicketsUnsubscribe = null;
    }
    if (myTicketUnsubscribe) {
      myTicketUnsubscribe();
      myTicketUnsubscribe = null;
    }
  }
});
