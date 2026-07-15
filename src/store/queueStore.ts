import { create } from "zustand";
import { Ticket, Shop } from "../types";
import { collection, doc, onSnapshot, query, where, setDoc, getDocs, updateDoc, runTransaction } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { cacheData, getCachedData, getPendingTickets, deletePendingTicket } from "../lib/offlineDb";
import { getClientStartOfTodayInTimezone } from "../lib/shopUtils";
import { playChime } from "../lib/audio";

export interface QueueState {
  myTicket: Ticket | null;
  todayTickets: Ticket[];
  joining: boolean;
  isOnline: boolean;
  estimatedWaitMinutes: number;
  peopleInFront: number;
  progressPercent: number;
  calculatedAvgServiceTime: number;
  activeCountersCount: number;
  aiEstimateLoading: boolean;
  aiEstimateMessage: string;
  errorMessage: string | null;
  showAlert: boolean;

  // Actions
  setMyTicket: (ticket: Ticket | null) => void;
  setTodayTickets: (tickets: Ticket[]) => void;
  setJoining: (joining: boolean) => void;
  setIsOnline: (online: boolean) => void;
  setEstimatedWaitMinutes: (minutes: number) => void;
  setPeopleInFront: (people: number) => void;
  setProgressPercent: (percent: number) => void;
  setCalculatedAvgServiceTime: (time: number) => void;
  setActiveCountersCount: (count: number) => void;
  setAiEstimateLoading: (loading: boolean) => void;
  setAiEstimateMessage: (message: string) => void;
  setErrorMessage: (error: string | null) => void;
  setShowAlert: (show: boolean) => void;
  clearQueueState: () => void;

  // Queue Business Actions
  joinQueue: (params: {
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
    isRtl: boolean;
    soundEnabled: boolean;
    setShowLimitModal: (show: boolean) => void;
  }) => Promise<void>;
  leaveQueue: (shopId: string, ticketId: string) => Promise<void>;
  cancelQueue: (shopId: string, ticketId: string) => Promise<void>;
  syncOfflineTickets: (shop: Shop) => Promise<void>;

  // Subscription Actions
  subscribeToTodayTickets: (shopId: string, timezone: string) => () => void;
  subscribeToMyTicket: (shopId: string, ticketId: string, isRtl: boolean, shopName: string, soundEnabled: boolean) => () => void;
  unsubscribeMyTicket: () => void;
  unsubscribeQueue: () => void;
}


let todayTicketsUnsubscribe: (() => void) | null = null;
let myTicketUnsubscribe: (() => void) | null = null;

export const useQueueStore = create<QueueState>((set) => ({
  myTicket: null,
  todayTickets: [],
  joining: false,
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  estimatedWaitMinutes: 0,
  peopleInFront: 0,
  progressPercent: 0,
  calculatedAvgServiceTime: 0,
  activeCountersCount: 0,
  aiEstimateLoading: false,
  aiEstimateMessage: "",
  errorMessage: null,
  showAlert: false,

  setMyTicket: (myTicket) => set({ myTicket }),
  setTodayTickets: (todayTickets) => set({ todayTickets }),
  setJoining: (joining) => set({ joining }),
  setIsOnline: (isOnline) => set({ isOnline }),
  setEstimatedWaitMinutes: (estimatedWaitMinutes) => set({ estimatedWaitMinutes }),
  setPeopleInFront: (peopleInFront) => set({ peopleInFront }),
  setProgressPercent: (progressPercent) => set({ progressPercent }),
  setCalculatedAvgServiceTime: (calculatedAvgServiceTime) => set({ calculatedAvgServiceTime }),
  setActiveCountersCount: (activeCountersCount) => set({ activeCountersCount }),
  setAiEstimateLoading: (aiEstimateLoading) => set({ aiEstimateLoading }),
  setAiEstimateMessage: (aiEstimateMessage) => set({ aiEstimateMessage }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setShowAlert: (showAlert) => set({ showAlert }),
  clearQueueState: () => {
    if (todayTicketsUnsubscribe) { todayTicketsUnsubscribe(); todayTicketsUnsubscribe = null; }
    if (myTicketUnsubscribe) { myTicketUnsubscribe(); myTicketUnsubscribe = null; }

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
  },

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
    set({ joining: true });
    let nextTicketNumber = 1;
    let offlineMode = !navigator.onLine;
    let tempId = "";
    let newTicket: Ticket;

    if (!offlineMode) {
      try {
        const response = await fetch("/api/tickets/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopId: shop.id,
            serviceId,
            serviceName,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim() || "",
            customerEmail: customerEmail.trim() || "",
            emailNotify,
            smsNotify,
            whatsappNotify,
            lang: isRtl ? "ar" : "en"
          })
        });

        if (!response.ok) {
          if (response.status === 403) {
            setShowLimitModal(true);
            set({ joining: false });
            return;
          }
          const errData = await response.json().catch(() => ({ error: "Server error" }));
          const errMsg = errData.message || errData.error || (response.status === 403 ? (isRtl ? "عذراً، الباقة المجانية قد انتهت، يرجى الترقية" : "Sorry, the free plan has ended. Please upgrade.") : "Server error");
          
          set({ errorMessage: errMsg, showAlert: true, joining: false });
          return;
        }

        const resData = await response.json();
        newTicket = resData.ticket;
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
          const storeTimezone = shop.timezone || "Asia/Riyadh";
          const startOfToday = getClientStartOfTodayInTimezone(storeTimezone);
          const startOfTodayStr = startOfToday.toISOString();
          const endOfTodayStr = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();

          const todayTicketsRef = collection(db, "tickets");
          const q = query(
            todayTicketsRef,
            where("shopId", "==", shop.id)
          );
          
          const snap = await getDocs(q);
          const activeTodayDocs = snap.docs.filter((docSnap) => {
            const ticket = docSnap.data() as Ticket;
            return ticket.createdAt >= startOfTodayStr && ticket.createdAt <= endOfTodayStr;
          });

          const planType = shop.plan || "free";
          if (planType === "free" && activeTodayDocs.length >= 5) {
            setShowLimitModal(true);
            set({ joining: false });
            return;
          }

          let maxNum = 0;
          activeTodayDocs.forEach((docSnap) => {
            const ticket = docSnap.data() as Ticket;
            if (ticket.ticketNumber > maxNum) maxNum = ticket.ticketNumber;
          });

          const dayKey = startOfTodayStr.slice(0, 10);
          const shopDocRef = doc(db, "shops", shop.id);

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
              setShowLimitModal(true);
              set({ joining: false });
              return;
            }
            throw txErr;
          }

          tempId = doc(collection(db, "tickets")).id;
          newTicket = {
            id: tempId,
            shopId: shop.id,
            serviceId,
            serviceName,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim() || "",
            customerEmail: customerEmail.trim() || "",
            emailNotify,
            emailNotified: false,
            smsNotify,
            smsNotified: false,
            whatsappNotify,
            whatsappNotified: false,
            ticketNumber: nextTicketNumber,
            status: isScheduled ? "scheduled" : "waiting",
            isScheduled: isScheduled,
            scheduledDate: isScheduled ? scheduledDate : "",
            scheduledTime: isScheduled ? scheduledTime : "",
            createdAt: new Date().toISOString()
          };

          await setDoc(doc(db, "tickets", tempId), newTicket);
        } catch (firestoreErr: any) {
          console.error("Critical Firestore Fallback Failure:", firestoreErr);
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
      const { todayTickets } = useQueueStore.getState();
      todayTickets.forEach((ticket) => {
        if (ticket.ticketNumber > maxNum) maxNum = ticket.ticketNumber;
      });
      nextTicketNumber = maxNum + 1;
      tempId = `offline_${Date.now()}`;
      newTicket = {
        id: tempId,
        shopId: shop.id,
        serviceId,
        serviceName,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || "",
        customerEmail: customerEmail.trim() || "",
        emailNotify,
        emailNotified: false,
        smsNotify,
        smsNotified: false,
        whatsappNotify,
        whatsappNotified: false,
        ticketNumber: nextTicketNumber,
        status: isScheduled ? "scheduled" : "waiting",
        isScheduled,
        scheduledDate: isScheduled ? scheduledDate : "",
        scheduledTime: isScheduled ? scheduledTime : "",
        createdAt: new Date().toISOString()
      };
    }

    try {
      const { subscribeToMyTicket } = useQueueStore.getState();
      if (!offlineMode) {
        subscribeToMyTicket(
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
        
        await setDoc(doc(db, "pending_tickets", tempId), newTicket);
      }

      set({ myTicket: newTicket });
      await cacheData(`my_ticket_${shop.id}`, newTicket);
      localStorage.setItem(`dork_ticket_${shop.id}`, tempId);

    } catch (finalErr) {
      console.error("Critical error saving new ticket state:", finalErr);
    } finally {
      set({ joining: false });
    }
  },

  leaveQueue: async (shopId: string, ticketId: string) => {
    try {
      const ticketRef = doc(db, "tickets", ticketId);
      try {
        await updateDoc(ticketRef, { status: "cancelled" });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
      }
      
      const { unsubscribeMyTicket } = useQueueStore.getState();
      unsubscribeMyTicket();
      localStorage.removeItem(`dork_ticket_${shopId}`);
      set({ myTicket: null });
    } catch (err) {
      console.error("Error leaving queue:", err);
    }
  },

  cancelQueue: async (shopId: string, ticketId: string) => {
    const { leaveQueue } = useQueueStore.getState();
    await leaveQueue(shopId, ticketId);
  },

  syncOfflineTickets: async (shop: Shop) => {
    if (!navigator.onLine || !shop) return;
    
    try {
      const pending = await getPendingTickets();
      if (pending.length === 0) return;
      
      console.log(`[Offline Sync] Found ${pending.length} pending ticket(s) to synchronize.`);
      
      for (const ticket of pending) {
        if (ticket.shopId !== shop.id) continue;
        
        const timezone = shop.timezone || "Asia/Riyadh";
        const startOfToday = getClientStartOfTodayInTimezone(timezone);
        
        const todayTicketsRef = collection(db, "tickets");
        const q = query(
          todayTicketsRef,
          where("shopId", "==", shop.id)
        );
        
        const snap = await getDocs(q);
        let maxNum = 0;
        snap.forEach((docSnap) => {
          const t = docSnap.data() as Ticket;
          if (t.createdAt >= startOfToday.toISOString()) {
            if (t.ticketNumber > maxNum) {
              maxNum = t.ticketNumber;
            }
          }
        });
        
        const nextTicketNumber = maxNum + 1;
        const newTicketRef = doc(collection(db, "tickets"));
        const cleanTicket: Ticket = {
          ...ticket,
          id: newTicketRef.id,
          ticketNumber: nextTicketNumber,
          createdAt: new Date().toISOString()
        };
        
        await setDoc(newTicketRef, cleanTicket);
        
        const savedId = localStorage.getItem(`dork_ticket_${shop.id}`);
        if (savedId === ticket.id) {
          localStorage.setItem(`dork_ticket_${shop.id}`, newTicketRef.id);
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
    const startOfToday = getClientStartOfTodayInTimezone(timezoneVal);
    const ticketsQuery = query(
      collection(db, "tickets"),
      where("shopId", "==", shopId)
    );

    todayTicketsUnsubscribe = onSnapshot(ticketsQuery, (snap) => {
      if (!active) return;
      const ticketsList: Ticket[] = [];
      snap.forEach((d) => {
        const ticketVal = d.data() as Ticket;
        if (ticketVal.createdAt >= startOfToday.toISOString()) {
          ticketsList.push(ticketVal);
        }
      });
      ticketsList.sort((a, b) => a.ticketNumber - b.ticketNumber);
      set({ todayTickets: ticketsList });
      cacheData(`tickets_${shopId}`, ticketsList);
    }, (err) => {
      if (active) {
        if (!navigator.onLine) {
          console.log("Offline: Using cached today tickets");
        } else {
          handleFirestoreError(err, OperationType.GET, `tickets`);
        }
      }
    });

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

    const ticketRef = doc(db, "tickets", ticketId);

    myTicketUnsubscribe = onSnapshot(ticketRef, (ticketSnap) => {
      if (!active) return;
      if (ticketSnap.exists()) {
        const ticketData = ticketSnap.data() as Ticket;
        set({ myTicket: ticketData });
        cacheData(`my_ticket_${shopId}`, ticketData);

        if (ticketData.status === "calling" && prevStatus !== "calling") {
          if ("vibrate" in navigator) {
            navigator.vibrate([200, 100, 200, 100, 300]);
          }

          if ("Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(
                isRtl ? `حان دورك الآن! 🔔` : `It's your turn! 🔔`,
                {
                  body: isRtl 
                    ? (ticketData.counterNumber 
                      ? `تفضل بالتوجه إلى شباك / طاولة رقم ${ticketData.counterNumber} في ${shopName} فوراً.`
                      : `تفضل بالتوجه إلى كاونتر تقديم الخدمة في ${shopName} فوراً.`)
                    : (ticketData.counterNumber
                      ? `Please proceed to window / table number ${ticketData.counterNumber} at ${shopName} immediately.`
                      : `Please proceed to the service counter at ${shopName} immediately.`),
                  tag: "dork-turn-calling",
                  requireInteraction: true
                }
              );
            } catch (err: any) {
              console.warn("Could not instantiate Notification directly on this device:", err.message);
            }
          }
        }
        
        if (prevStatus !== null && prevStatus !== ticketData.status && ticketData.status !== "calling") {
          if (soundEnabled) {
            playChime();
          }
        }

        prevStatus = ticketData.status;
      } else {
        if (myTicketUnsubscribe) {
          myTicketUnsubscribe();
          myTicketUnsubscribe = null;
        }
        set({ myTicket: null });
        localStorage.removeItem(`dork_ticket_${shopId}`);
      }
    }, (err) => {
      if (active) {
        if (!navigator.onLine) {
          console.log("Offline: Using cached ticket details");
        } else {
          handleFirestoreError(err, OperationType.GET, `tickets/${ticketId}`);
        }
      }
    });

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
}));

