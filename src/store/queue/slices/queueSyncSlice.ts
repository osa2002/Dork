import { StateCreator } from "zustand";
import { QueueState, QueueSyncSlice } from "../types";
import { Ticket, Shop } from "../../../types";
import { getPendingTickets, deletePendingTicket, cacheData } from "../../../lib/offlineDb";
import { getClientStartOfTodayInTimezone } from "../../../lib/shopUtils";
import { storageService } from "../services/storageService";
import { queueRepository } from "../../../repositories/queueRepository";

/**
 * queueSyncSlice
 * 
 * Responsibility: Manages offline queue syncing when returning online.
 * Detects pending offline tickets and securely migrates/saves them to Firestore
 * while preserving appropriate local ticket sequence mappings.
 */
export const createQueueSyncSlice: StateCreator<
  QueueState,
  [],
  [],
  QueueSyncSlice
> = (set) => ({
  syncOfflineTickets: async (shop: Shop) => {
    if (!storageService.getOnlineStatus() || !shop) return;
    
    try {
      const pending = await getPendingTickets();
      if (pending.length === 0) return;
      
      console.log(`[Offline Sync] Found ${pending.length} pending ticket(s) to synchronize.`);
      
      for (const ticket of pending) {
        if (ticket.shopId !== shop.id) continue;
        
        const timezone = shop.timezone || "Asia/Riyadh";
        const startOfToday = getClientStartOfTodayInTimezone(timezone);
        
        const tickets = await queueRepository.getTodayTicketsSnap(shop.id);
        let maxNum = 0;
        tickets.forEach((t) => {
          if (t.createdAt >= startOfToday.toISOString()) {
            if (t.ticketNumber > maxNum) {
              maxNum = t.ticketNumber;
            }
          }
        });
        
        const nextTicketNumber = maxNum + 1;
        const newTicketId = queueRepository.generateTicketId();
        const cleanTicket: Ticket = {
          ...ticket,
          id: newTicketId,
          ticketNumber: nextTicketNumber,
          createdAt: new Date().toISOString()
        };
        
        await queueRepository.syncSingleOfflineTicket(newTicketId, cleanTicket);
        
        const savedId = storageService.getSavedTicketId(shop.id);
        if (savedId === ticket.id) {
          storageService.setSavedTicketId(shop.id, newTicketId);
          set({ myTicket: cleanTicket });
          await cacheData(`my_ticket_${shop.id}`, cleanTicket);
        }
        
        await deletePendingTicket(ticket.id);
        console.log(`[Offline Sync] Ticket synced successfully: #${cleanTicket.ticketNumber} (Firestore ID: ${cleanTicket.id})`);
      }
    } catch (syncErr) {
      console.error("[Offline Sync] Error during ticket synchronization:", syncErr);
    }
  },
});
