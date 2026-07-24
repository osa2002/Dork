import React, { useState, useEffect, useRef } from "react";
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc,
  runTransaction
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { Ticket, Shop, Service } from "../types";
import { playChime } from "../lib/audio";
import { cacheData, getCachedData, getPendingTickets, deletePendingTicket } from "../lib/offlineDb";
import { getClientStartOfTodayInTimezone } from "../lib/shopUtils";
import { getAppOrigin } from "../lib/originUtils";
import { useShallow } from "zustand/react/shallow";
import { useQueueStore } from "../store";


interface UseCustomerTicketProps {
  shop: Shop | null;
  services: Service[];
  selectedServiceId: string;
  historicalAvgDuration: number | null;
  soundEnabledRef: React.MutableRefObject<boolean>;
  fcmToken: string | null;
  isRtl: boolean;
  setInAppAlert: React.Dispatch<React.SetStateAction<{
    show: boolean;
    title: string;
    message: string;
    type: "approaching" | "next" | null;
  }>>;
  hasShownApproachingPush: boolean;
  setHasShownApproachingPush: React.Dispatch<React.SetStateAction<boolean>>;
  hasShownOneInFrontFcm: boolean;
  setHasShownOneInFrontFcm: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useCustomerTicket({
  shop,
  services,
  selectedServiceId,
  historicalAvgDuration,
  soundEnabledRef,
  fcmToken,
  isRtl,
  setInAppAlert,
  hasShownApproachingPush,
  setHasShownApproachingPush,
  hasShownOneInFrontFcm,
  setHasShownOneInFrontFcm
}: UseCustomerTicketProps) {
  const {
    myTicket,
    setMyTicket,
    todayTickets,
    setTodayTickets,
    subscribeToTodayTickets,
    subscribeToMyTicket,
    unsubscribeMyTicket,
    joining,
    setJoining,
    isOnline,
    setIsOnline,
    errorMessage,
    setErrorMessage,
    showAlert,
    setShowAlert,
    aiEstimateMessage,
    setAiEstimateMessage,
    aiEstimateLoading,
    setAiEstimateLoading,
    joinQueue,
    leaveQueue,
    syncOfflineTickets
  } = useQueueStore(
    useShallow((state) => ({
      myTicket: state.myTicket,
      setMyTicket: state.setMyTicket,
      todayTickets: state.todayTickets,
      setTodayTickets: state.setTodayTickets,
      subscribeToTodayTickets: state.subscribeToTodayTickets,
      subscribeToMyTicket: state.subscribeToMyTicket,
      unsubscribeMyTicket: state.unsubscribeMyTicket,
      joining: state.joining,
      setJoining: state.setJoining,
      isOnline: state.isOnline,
      setIsOnline: state.setIsOnline,
      errorMessage: state.errorMessage,
      setErrorMessage: state.setErrorMessage,
      showAlert: state.showAlert,
      setShowAlert: state.setShowAlert,
      aiEstimateMessage: state.aiEstimateMessage,
      setAiEstimateMessage: state.setAiEstimateMessage,
      aiEstimateLoading: state.aiEstimateLoading,
      setAiEstimateLoading: state.setAiEstimateLoading,
      joinQueue: state.joinQueue,
      leaveQueue: state.leaveQueue,
      syncOfflineTickets: state.syncOfflineTickets,
    }))
  );

  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
  const [showLimitModal, setShowLimitModal] = useState<boolean>(false);

  const [initialPeopleInFront, setInitialPeopleInFront] = useState<number>(0);

  // Form states
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [emailNotify, setEmailNotify] = useState(false);
  const [smsNotify, setSmsNotify] = useState(false);
  const [whatsappNotify, setWhatsappNotify] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");

  // Future Booking / Appointment Scheduling States
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  const prevStatusRef = useRef<string | null>(null);
  const prevPeopleInFrontRef = useRef<number | null>(null);

  const unsubscribeFromTicket = () => {
    console.log("[CustomerPortal] Unsubscribing from active ticket listener.");
    unsubscribeMyTicket();
  };


  // Automatically enable SMS & WhatsApp notifications when a phone number is entered
  useEffect(() => {
    const cleaned = customerPhone.trim();
    if (cleaned.length >= 8) {
      setSmsNotify(true);
      setWhatsappNotify(true);
    } else {
      setSmsNotify(false);
      setWhatsappNotify(false);
    }
  }, [customerPhone]);

  // Restoring whatsappPhone from ticket when available
  useEffect(() => {
    if (myTicket?.customerPhone) {
      setWhatsappPhone((prev) => prev || myTicket.customerPhone || "");
    }
  }, [myTicket?.id, myTicket?.customerPhone]);

  // Listen to network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Sync basic ticket data to Service Worker for offline fallback view
  useEffect(() => {
    if (myTicket && shop && "serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "CACHE_TICKET_DATA",
        payload: {
          ...myTicket,
          shopName: shop.name,
        }
      });
    }
  }, [myTicket, shop]);

  // RESTORE TICKET & LISTEN TO TODAY'S TICKETS
  useEffect(() => {
    if (!shop) return;

    let active = true;
    let unsubMyTicket: (() => void) | null = null;
    let unsubTickets: (() => void) | null = null;

    // Restore myTicket if it exists in cache / localstorage
    const savedTicketId = localStorage.getItem(`dork_ticket_${shop.id}`);
    if (savedTicketId) {
      if (savedTicketId.startsWith("offline_")) {
        getCachedData<Ticket>(`my_ticket_${shop.id}`).then((cachedMyTicket) => {
          if (active && cachedMyTicket) {
            setMyTicket(cachedMyTicket);
          }
        });
      } else {
        unsubMyTicket = subscribeToMyTicket(
          shop.id,
          savedTicketId,
          isRtl,
          shop.name,
          soundEnabledRef.current
        );
      }
    }

    // Subscribe to today's tickets
    const timezone = shop.timezone || "Asia/Riyadh";
    unsubTickets = subscribeToTodayTickets(shop.id, timezone);

    return () => {
      active = false;
      if (unsubMyTicket) unsubMyTicket();
      if (unsubTickets) unsubTickets();
    };
  }, [shop?.id, isRtl, subscribeToMyTicket, subscribeToTodayTickets]);


  // Synchronize offline tickets when returning online
  useEffect(() => {
    if (isOnline && shop) {
      syncOfflineTickets(shop);
    }
  }, [isOnline, shop?.id, syncOfflineTickets]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine && shop) {
        syncOfflineTickets(shop);
      }
    }, 10000);

    const handleSWMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "TRIGGER_OFFLINE_SYNC" && shop) {
        console.log("[SW Message] Sync triggered from Service Worker!");
        syncOfflineTickets(shop);
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleSWMessage);
    }

    return () => {
      clearInterval(interval);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleSWMessage);
      }
    };
  }, [shop?.id, syncOfflineTickets]);

  // CALCULATE PEOPLE IN FRONT & WAIT TIME ESTIMATES
  let peopleInFront = 0;
  let estimatedWaitMinutes = 0;
  let calculatedAvgServiceTime = 15;
  let activeCountersCount = 1;
  let isUsingDynamicAverage = false;
  let isSameServiceDynamic = false;

  if (myTicket && myTicket.status === "waiting") {
    const isServedBefore = (a: Ticket, b: Ticket) => {
      const aPriority = a.isPriority || false;
      const bPriority = b.isPriority || false;
      if (aPriority && !bPriority) return true;
      if (!aPriority && bPriority) return false;
      return a.ticketNumber < b.ticketNumber;
    };

    const activeWaiting = todayTickets.filter(
      t => t.status === "waiting" && t.id !== myTicket.id && isServedBefore(t, myTicket)
    );
    peopleInFront = activeWaiting.length;

    const myService = services.find(s => s.id === myTicket.serviceId);
    const fallbackDuration = myService ? myService.avgDurationMinutes : 15;
    let avgDuration = fallbackDuration;

    const completedToday = todayTickets.filter(
      t => t.status === "completed" && t.completedAt && t.calledAt
    );
    
    if (completedToday.length > 0) {
      const sameServiceCompleted = completedToday.filter(t => t.serviceId === myTicket.serviceId);
      if (sameServiceCompleted.length > 0) {
        const totalMin = sameServiceCompleted.reduce((acc, t) => {
          const diff = (new Date(t.completedAt).getTime() - new Date(t.calledAt).getTime()) / 60000;
          return acc + Math.max(1, diff);
        }, 0);
        avgDuration = Math.round(totalMin / sameServiceCompleted.length);
        isUsingDynamicAverage = true;
        isSameServiceDynamic = true;
      } else {
        const totalMin = completedToday.reduce((acc, t) => {
          const diff = (new Date(t.completedAt).getTime() - new Date(t.calledAt).getTime()) / 60000;
          return acc + Math.max(1, diff);
        }, 0);
        avgDuration = Math.round(totalMin / completedToday.length);
        isUsingDynamicAverage = true;
        isSameServiceDynamic = false;
      }
    } else if (historicalAvgDuration !== null) {
      avgDuration = historicalAvgDuration;
      isUsingDynamicAverage = true;
      isSameServiceDynamic = false;
    }
    
    calculatedAvgServiceTime = avgDuration;

    activeCountersCount = Math.max(1, new Set(
      todayTickets
        .filter(t => (t.status === "calling" || t.status === "completed") && t.counterNumber)
        .map(t => t.counterNumber)
    ).size);

    const hasCalling = todayTickets.some(t => t.status === "calling");
    const rawWait = (peopleInFront * avgDuration) + (hasCalling ? Math.max(3, Math.floor(avgDuration / 2)) : 0);
    estimatedWaitMinutes = Math.max(1, Math.round(rawWait / activeCountersCount));
  }

  // TRIGGER AI ESTIMATES WHEN PEOPLE IN FRONT UPDATED
  useEffect(() => {
    if (myTicket?.status === "waiting" && peopleInFront !== undefined) {
      fetchAIEstimate();
    }
  }, [peopleInFront, myTicket?.status]);

  useEffect(() => {
    if (myTicket && myTicket.status === "waiting" && peopleInFront !== undefined) {
      const key = `initial_people_front_${myTicket.id}`;
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        setInitialPeopleInFront(parseInt(stored, 10));
      } else {
        localStorage.setItem(key, String(peopleInFront));
        setInitialPeopleInFront(peopleInFront);
      }
    }
  }, [myTicket?.id, myTicket?.status, peopleInFront]);

  const progressPercent = (() => {
    if (myTicket?.status !== "waiting") return 100;
    if (initialPeopleInFront <= 0) return 10;
    if (peopleInFront <= 0) return 95;
    const solved = initialPeopleInFront - peopleInFront;
    if (solved <= 0) return 15;
    return Math.min(95, Math.round((solved / initialPeopleInFront) * 100));
  })();

  const fetchAIEstimate = async () => {
    if (!shop || !myTicket || peopleInFront === undefined) return;
    setAiEstimateLoading(true);
    try {
      const recentTickets = todayTickets
        .filter((t) => t.status === "completed" && t.calledAt && t.completedAt)
        .slice(-10)
        .map((t) => ({
          durationMinutes: Math.round((new Date(t.completedAt).getTime() - new Date(t.calledAt).getTime()) / 60000),
          serviceName: t.serviceName,
        }));

      const response = await fetch("/api/estimate-wait-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: shop.name,
          serviceName: myTicket.serviceName,
          peopleInFront,
          recentTickets,
          activeCountersCount,
          avgDuration: calculatedAvgServiceTime,
          lang: isRtl ? "ar" : "en",
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setAiEstimateMessage(data.estimateMessage);
      }
    } catch (err) {
      console.error("Failed to fetch AI estimate:", err);
    } finally {
      setAiEstimateLoading(false);
    }
  };

  // HANDLERS FOR JOINING & LEAVING
  const handleJoinQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop || !customerName.trim() || !selectedServiceId) return;

    const selectedService = services.find(s => s.id === selectedServiceId);
    if (!selectedService) return;

    await joinQueue({
      shop,
      serviceId: selectedServiceId,
      serviceName: selectedService.name,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || "",
      customerEmail: customerEmail.trim() || "",
      emailNotify,
      smsNotify,
      whatsappNotify,
      isScheduled,
      scheduledDate,
      scheduledTime,
      isRtl,
      soundEnabled: soundEnabledRef.current,
      setShowLimitModal
    });
  };

  const handleLeaveQueue = async () => {
    if (!myTicket || !shop) return;
    await leaveQueue(shop.id, myTicket.id);
    setShowCancelConfirm(false);
  };

  // MULTICHANNEL APPROACHING NOTIFICATION TRIGGERS
  const sendApproachingNotification = async (ticket: Ticket, shopName: string, isRtl: boolean) => {
    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: ticket.customerEmail,
          name: ticket.customerName,
          ticketNumber: ticket.ticketNumber,
          serviceName: ticket.serviceName,
          shopName,
          lang: isRtl ? "ar" : "en",
        }),
      });
      return response.ok ? await response.json() : null;
    } catch (err) {
      console.error("Failed to send approaching turn email alert:", err);
    }
  };

  const sendApproachingSmsWhatsappNotification = async (ticket: Ticket, shopName: string, channel: "sms" | "whatsapp", isRtl: boolean) => {
    try {
      const trackingUrl = `${getAppOrigin()}/?shop=${shop?.slug}&ticketId=${ticket.id}`;
      const response = await fetch("/api/send-sms-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: ticket.customerPhone,
          messageType: "approaching",
          channel,
          name: ticket.customerName,
          ticketNumber: ticket.ticketNumber,
          serviceName: ticket.serviceName,
          shopName,
          trackingUrl,
          lang: isRtl ? "ar" : "en",
        }),
      });
      return response.ok ? await response.json() : null;
    } catch (err) {
      console.error(`Failed to send approaching turn ${channel} alert:`, err);
    }
  };

  // TRIGGER REAL-TIME PUSH/FCM/EMAIL NOTIFICATIONS WHEN ROLLING TO APPROACHING
  useEffect(() => {
    if (!shop || todayTickets.length === 0 || !myTicket) return;

    const isServedBefore = (a: Ticket, b: Ticket) => {
      const aPriority = a.isPriority || false;
      const bPriority = b.isPriority || false;
      if (aPriority && !bPriority) return true;
      if (!aPriority && bPriority) return false;
      return a.ticketNumber < b.ticketNumber;
    };

    const activeWaiting = todayTickets.filter(
      (t) => t.status === "waiting" && t.id !== myTicket.id && isServedBefore(t, myTicket)
    );

    const countAhead = activeWaiting.length;

    if (myTicket.status === "waiting") {
      // EXACTLY 2 PEOPLE AHEAD -> APPROACHING ALERT
      if (countAhead === 2 && !hasShownApproachingPush) {
        setHasShownApproachingPush(true);

        if (myTicket.customerEmail && myTicket.emailNotify && !myTicket.emailNotified) {
          sendApproachingNotification(myTicket, shop.name, isRtl).then(() => {
            updateDoc(doc(db, "tickets", myTicket.id), { emailNotified: true }).catch(() => {});
          });
        }

        if (myTicket.customerPhone && myTicket.smsNotify && !myTicket.smsNotified) {
          sendApproachingSmsWhatsappNotification(myTicket, shop.name, "sms", isRtl).then(() => {
            updateDoc(doc(db, "tickets", myTicket.id), { smsNotified: true }).catch(() => {});
          });
        }

        if (myTicket.customerPhone && myTicket.whatsappNotify && !myTicket.whatsappNotified) {
          sendApproachingSmsWhatsappNotification(myTicket, shop.name, "whatsapp", isRtl).then(() => {
            updateDoc(doc(db, "tickets", myTicket.id), { whatsappNotified: true }).catch(() => {});
          });
        }

        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(
              isRtl ? "اقترب دورك في الطابور! ⏳" : "Your turn is approaching! ⏳",
              {
                body: isRtl
                  ? `يتبقى شخصان فقط أمامك في طابور الانتظار لدى ${shop.name}. يرجى التواجد بالقرب.`
                  : `There are only 2 people ahead of you in the queue at ${shop.name}. Please stay close.`,
                tag: "dork-turn-approaching",
                requireInteraction: false
              }
            );
          } catch (err: any) {
            console.warn("Could not instantiate Notification directly on this device:", err.message);
          }
        }

        setInAppAlert({
          show: true,
          title: isRtl ? "اقترب دورك في الطابور! ⏳" : "Your turn is approaching! ⏳",
          message: isRtl 
            ? `بقي شخصان فقط أمامك لدى ${shop.name}. يرجى التواجد بالقرب لتفادي فوات دورك.`
            : `Only 2 people left ahead of you at ${shop.name}. Please stay close to avoid missing your turn.`,
          type: "approaching"
        });
      }

      // EXACTLY 1 PERSON AHEAD -> NEXT IN LINE ALERT
      if (countAhead === 1 && !hasShownOneInFrontFcm) {
        setHasShownOneInFrontFcm(true);

        if (myTicket.customerEmail && myTicket.emailNotify && !myTicket.emailNotified) {
          sendApproachingNotification(myTicket, shop.name, isRtl).then(() => {
            updateDoc(doc(db, "tickets", myTicket.id), { emailNotified: true }).catch(() => {});
          });
        }

        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(
              isRtl ? "أنت التالي في الطابور! 🚨" : "You are next in line! 🚨",
              {
                body: isRtl
                  ? `يتبقى شخص واحد فقط أمامك في طابور الانتظار لدى ${shop.name}.`
                  : `There is only 1 person ahead of you in the queue at ${shop.name}.`,
                tag: "dork-turn-one-ahead",
                requireInteraction: true
              }
            );
          } catch (err: any) {
            console.warn("Could not instantiate Notification directly on this device:", err.message);
          }
        }

        setInAppAlert({
          show: true,
          title: isRtl ? "أنت التالي في الطابور! 🚨" : "You are next in line! 🚨",
          message: isRtl 
            ? `بقي شخص واحد فقط أمامك لدى ${shop.name}. يرجى التواجد قريباً جداً من كاونتر الخدمة.`
            : `Only 1 person left ahead of you at ${shop.name}. Please stay very close to the service counter.`,
          type: "next"
        });
      }
    }
  }, [todayTickets, myTicket, shop, isRtl, hasShownApproachingPush, hasShownOneInFrontFcm]);

  return {
    myTicket,
    setMyTicket,
    todayTickets,
    joining,
    showCancelConfirm,
    setShowCancelConfirm,
    showLimitModal,
    setShowLimitModal,
    errorMessage,
    setErrorMessage,
    showAlert,
    setShowAlert,
    isOnline,
    initialPeopleInFront,
    aiEstimateMessage,
    aiEstimateLoading,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    customerEmail,
    setCustomerEmail,
    emailNotify,
    setEmailNotify,
    smsNotify,
    setSmsNotify,
    whatsappNotify,
    setWhatsappNotify,
    whatsappPhone,
    setWhatsappPhone,
    isScheduled,
    setIsScheduled,
    scheduledDate,
    setScheduledDate,
    scheduledTime,
    setScheduledTime,
    peopleInFront,
    estimatedWaitMinutes,
    progressPercent,
    calculatedAvgServiceTime,
    activeCountersCount,
    isUsingDynamicAverage,
    isSameServiceDynamic,
    handleJoinQueue,
    handleLeaveQueue,
    unsubscribeFromTicket,
    fetchAIEstimate
  };
}
