import { StateCreator } from "zustand";
import { QueueState, QueueActionsSlice } from "../types";
import { Ticket } from "../../../types";
import { handleFirestoreError, OperationType } from "../../../lib/firebase";
import { cacheData, getCachedData } from "../../../lib/offlineDb";
import { storageService } from "../services/storageService";
import { queueRepository } from "../../../repositories/queueRepository";
import { 
  validateJoinRequest, 
  prepareOfflinePayload, 
  executeBackendJoin, 
  executeFirestoreFallback, 
  persistOfflineTicket 
} from "../utils/queueHelpers";

/**
 * queueActionsSlice
 * 
 * Responsibility: Orchestrates high-level asynchronous business flows for joining,
 * leaving, cancelling, and resetting queues. Delegates specific implementations
 * to services (e.g. storageService) and pure utility helpers (e.g. executeFirestoreFallback).
 */
export const createQueueActionsSlice: StateCreator<
  QueueState,
  [],
  [],
  QueueActionsSlice
> = (set, get) => ({
  joinQueue: async ({
    shop,
    serviceId,
    serviceName,
    customerName,
    customerPhone,
    customerEmail,
    emailNotify,
    smsNotify,
    whatsappNotify,
    isScheduled,
    scheduledDate,
    scheduledTime,
    isRtl,
    soundEnabled,
    setShowLimitModal,
  }) => {
    // Validate request first
    if (!validateJoinRequest(customerName, serviceId)) return;

    set({ joining: true });
    let nextTicketNumber = 1;
    let offlineMode = !storageService.getOnlineStatus();
    let tempId = "";
    let newTicket: Ticket;

    if (!offlineMode) {
      try {
        newTicket = await executeBackendJoin({
          shopId: shop.id,
          serviceId,
          serviceName,
          customerName,
          customerPhone,
          customerEmail,
          emailNotify,
          smsNotify,
          whatsappNotify,
          isRtl
        });
        tempId = newTicket.id;
        nextTicketNumber = newTicket.ticketNumber;

      } catch (apiErr: any) {
        console.warn("API failed, falling back to client-side Firestore calculation.", apiErr);
        
        const is403 = apiErr?.status === 403 || 
                      apiErr?.response?.status === 403 || 
                      String(apiErr?.message || "").includes("403") ||
                      String(apiErr?.message || "").toLowerCase().includes("limit");
        
        if (is403) {
          setShowLimitModal(true);
          set({ joining: false });
          return;
        }

        try {
          newTicket = await executeFirestoreFallback({
            shop,
            serviceId,
            serviceName,
            customerName,
            customerPhone,
            customerEmail,
            emailNotify,
            smsNotify,
            whatsappNotify,
            isScheduled,
            scheduledDate,
            scheduledTime
          });
          tempId = newTicket.id;
          nextTicketNumber = newTicket.ticketNumber;
        } catch (firestoreErr: any) {
          console.error("Critical Firestore Fallback Failure:", firestoreErr);
          
          const isFs403 = firestoreErr?.status === 403 || String(firestoreErr?.message || "").includes("FREE_PLAN_LIMIT_REACHED");
          if (isFs403) {
            setShowLimitModal(true);
            set({ joining: false });
            return;
          }

          set({ 
            errorMessage: firestoreErr?.message || (isRtl ? "فشل الانضمام إلى قائمة الانتظار" : "Failed to join queue"),
            showAlert: true,
            joining: false
          });
          return;
        }
      }
    } else {
      let maxNum = 0;
      const todayTickets = get().todayTickets;
      todayTickets.forEach((ticket) => {
        if (ticket.ticketNumber > maxNum) maxNum = ticket.ticketNumber;
      });
      nextTicketNumber = maxNum + 1;
      tempId = `offline_${Date.now()}`;
      
      newTicket = prepareOfflinePayload({
        shopId: shop.id,
        serviceId,
        serviceName,
        customerName,
        customerPhone,
        customerEmail,
        emailNotify,
        smsNotify,
        whatsappNotify,
        isScheduled,
        scheduledDate,
        scheduledTime,
        nextTicketNumber,
        tempId
      });
    }

    try {
      if (!offlineMode) {
        get().subscribeToMyTicket(
          shop.id,
          tempId,
          isRtl,
          shop.name,
          soundEnabled
        );
      } else {
        const cachedTickets = await getCachedData<Ticket[]>(`tickets_${shop.id}`) || [];
        const updatedList = [...cachedTickets, newTicket].sort((a, b) => a.ticketNumber - b.ticketNumber);
        set({ todayTickets: updatedList });
        await cacheData(`tickets_${shop.id}`, updatedList);
        
        await persistOfflineTicket(tempId, newTicket);
      }

      set({ myTicket: newTicket });
      await cacheData(`my_ticket_${shop.id}`, newTicket);
      storageService.setSavedTicketId(shop.id, tempId);

    } catch (finalErr) {
      console.error("Critical error saving new ticket state:", finalErr);
    } finally {
      set({ joining: false });
    }
  },

  leaveQueue: async (shopId: string, ticketId: string) => {
    try {
      try {
        await queueRepository.updateTicketStatus(ticketId, "cancelled");
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
      }
      
      get().unsubscribeMyTicket();
      storageService.removeSavedTicketId(shopId);
      set({ myTicket: null });
    } catch (err) {
      console.error("Error leaving queue:", err);
    }
  },

  cancelQueue: async (shopId: string, ticketId: string) => {
    await get().leaveQueue(shopId, ticketId);
  },

  clearQueueState: () => {
    get().unsubscribeQueue();

    set({
      myTicket: null,
      todayTickets: [],
      joining: false,
      estimatedWaitMinutes: 0,
      peopleInFront: 0,
      progressPercent: 0,
      calculatedAvgServiceTime: 0,
      activeCountersCount: 0,
      aiEstimateLoading: false,
      aiEstimateMessage: "",
      errorMessage: null,
      showAlert: false,
    });
  }
});
