import { useState, useEffect, useRef } from "react";
import { 
  collection, 
  doc, 
  onSnapshot, 
  updateDoc, 
  query, 
  where,
  runTransaction
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { Ticket, Shop } from "../types";
import { playNewTicketSound, playStatusUpdateSound } from "../lib/audio";
import { useTranslation } from "react-i18next";

interface UseDashboardTicketsProps {
  shopId: string;
  shop: Shop | null;
  activeCounterNumber: string;
  soundEnabled: boolean;
  browserNotificationsEnabled: boolean;
  maxWaitTimeAlertMinutes: number;
  sendBrowserNotification: (title: string, body: string) => void;
  announceCallingTicket: (ticketNumber: string, counterNumber: string, serviceName: string) => void;
  getClientStartOfTodayInTimezone: (timezone: string) => Date;
  isRtl: boolean;
}

export function useDashboardTickets({
  shopId,
  shop,
  activeCounterNumber,
  soundEnabled,
  browserNotificationsEnabled,
  maxWaitTimeAlertMinutes,
  sendBrowserNotification,
  announceCallingTicket,
  getClientStartOfTodayInTimezone,
  isRtl
}: UseDashboardTicketsProps) {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const isInitialTicketsLoad = useRef(true);
  const soundEnabledRef = useRef(soundEnabled);
  const browserNotificationsEnabledRef = useRef(browserNotificationsEnabled);
  const sendBrowserNotificationRef = useRef(sendBrowserNotification);
  const notifiedWaitLimitTicketIds = useRef<Set<string>>(new Set());

  // Keep refs up-to-date
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    browserNotificationsEnabledRef.current = browserNotificationsEnabled;
  }, [browserNotificationsEnabled]);

  useEffect(() => {
    sendBrowserNotificationRef.current = sendBrowserNotification;
  }, [sendBrowserNotification]);

  // Real-time Tickets Listener
  useEffect(() => {
    if (!shopId) return;

    const currentShopTimezone = shop?.timezone || "Asia/Riyadh";
    isInitialTicketsLoad.current = true;

    const ticketsQuery = query(
      collection(db, "tickets"),
      where("shopId", "==", shopId)
    );

    const unsubTickets = onSnapshot(ticketsQuery, (snapshot) => {
      const startOfToday = getClientStartOfTodayInTimezone(currentShopTimezone);
      const startOfTodayISO = startOfToday.toISOString();
      
      const ticketsList: Ticket[] = [];
      const allList: Ticket[] = [];
      snapshot.forEach((docSnap) => {
        const ticket = docSnap.data() as Ticket;
        allList.push(ticket);
        if (ticket.createdAt >= startOfTodayISO) {
          ticketsList.push(ticket);
        }
      });
      ticketsList.sort((a, b) => {
        if (a.status === "waiting" && b.status === "waiting") {
          const aPriority = a.isPriority || false;
          const bPriority = b.isPriority || false;
          if (aPriority && !bPriority) return -1;
          if (!aPriority && bPriority) return 1;
        }
        return a.ticketNumber - b.ticketNumber;
      });

      // Handle alerts on changes
      if (!isInitialTicketsLoad.current) {
        snapshot.docChanges().forEach((change) => {
          const ticket = change.doc.data() as Ticket;
          if (ticket.createdAt < startOfTodayISO) return;
          if (change.type === "added") {
            if (soundEnabledRef.current) {
              playNewTicketSound();
            }
            if (browserNotificationsEnabledRef.current) {
              sendBrowserNotificationRef.current(
                t("vend_new_customer_notif_title", "New Customer Joined! 👤"),
                t("vend_new_customer_notif_body", "Customer {{name}} holds ticket #{{number}} for {{service}}.")
                  .replace("{{name}}", ticket.customerName)
                  .replace("{{number}}", String(ticket.ticketNumber))
                  .replace("{{service}}", ticket.serviceName)
              );
            }
          } else if (change.type === "modified") {
            if (soundEnabledRef.current) {
              playStatusUpdateSound();
            }
          }
        });
      } else {
        isInitialTicketsLoad.current = false;
      }

      setTickets(ticketsList);
      setAllTickets(allList);
    }, (error) => {
      console.error("Error listening to tickets:", error);
      handleFirestoreError(error, OperationType.GET, `tickets`);
    });

    return () => unsubTickets();
  }, [shopId, shop?.timezone, getClientStartOfTodayInTimezone, t]);

  // Helper to trigger approaching turn email
  const sendApproachingNotification = async (ticket: Ticket, shopName: string, isRtl: boolean) => {
    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: ticket.customerEmail,
          name: ticket.customerName,
          ticketNumber: ticket.ticketNumber,
          serviceName: ticket.serviceName,
          shopName: shopName,
          lang: isRtl ? "ar" : "en",
        }),
      });

      if (!response.ok) {
        throw new Error(`Email alert API failed with status ${response.status}`);
      }

      const result = await response.json();
      console.log("Email notification dispatched from vendor dashboard:", result);
      return result;
    } catch (err) {
      console.error("Failed to send approaching turn email alert from vendor dashboard:", err);
    }
  };

  // Monitor tickets for turn approaching email notifications
  useEffect(() => {
    if (!shop || tickets.length === 0) return;

    const pendingTickets = tickets.filter(
      tItem => tItem.status === "waiting" && tItem.emailNotify && !tItem.emailNotified && tItem.customerEmail
    );

    if (pendingTickets.length === 0) return;

    pendingTickets.forEach(async (ticket) => {
      const waitingAhead = tickets.filter(
        tItem => tItem.status === "waiting" && tItem.ticketNumber < ticket.ticketNumber
      );
      const peopleAheadCount = waitingAhead.length;

      if (peopleAheadCount === 2) {
        const ticketRef = doc(db, "tickets", ticket.id);
        try {
          await runTransaction(db, async (transaction) => {
            const freshSnap = await transaction.get(ticketRef);
            if (!freshSnap.exists()) return;
            const freshData = freshSnap.data() as Ticket;

            if (freshData.emailNotify && !freshData.emailNotified) {
              transaction.update(ticketRef, { emailNotified: true });
              await sendApproachingNotification(ticket, shop.name, isRtl);
            }
          });
        } catch (err) {
          console.error(`Error processing email alert for ticket #${ticket.ticketNumber}:`, err);
        }
      }
    });
  }, [tickets, shop, isRtl]);

  // Periodic wait time alerts
  useEffect(() => {
    if (!browserNotificationsEnabled) return;

    const checkWaitTimes = () => {
      const now = Date.now();
      tickets.forEach((ticket) => {
        if (ticket.status === "waiting") {
          const createdTime = new Date(ticket.createdAt).getTime();
          const minutesWaiting = (now - createdTime) / 60000;
          
          if (minutesWaiting >= maxWaitTimeAlertMinutes) {
            if (!notifiedWaitLimitTicketIds.current.has(ticket.id)) {
              notifiedWaitLimitTicketIds.current.add(ticket.id);
              sendBrowserNotification(
                t("vend_wait_limit_notif_title", "⚠️ Wait Time Limit Exceeded!"),
                t("vend_wait_limit_notif_body", "Customer {{name}} (Ticket #{{number}}) has been waiting for more than {{minutes}} minutes without being served!")
                  .replace("{{name}}", ticket.customerName)
                  .replace("{{number}}", String(ticket.ticketNumber))
                  .replace("{{minutes}}", String(Math.round(minutesWaiting)))
              );
            }
          }
        }
      });
    };

    checkWaitTimes();
    const interval = setInterval(checkWaitTimes, 10000);

    return () => clearInterval(interval);
  }, [tickets, browserNotificationsEnabled, maxWaitTimeAlertMinutes, sendBrowserNotification, t]);

  // Clean up notified list
  useEffect(() => {
    const activeWaitingIds = new Set(
      tickets.filter(tItem => tItem.status === "waiting").map(tItem => tItem.id)
    );
    const notifiedIds = notifiedWaitLimitTicketIds.current;
    notifiedIds.forEach(id => {
      if (!activeWaitingIds.has(id)) {
        notifiedIds.delete(id);
      }
    });
  }, [tickets]);

  // Ticket handlers
  const handleCallNext = async (selectedQueueServiceId: string) => {
    const currentCalling = tickets.find(
      tItem => tItem.status === "calling" && (selectedQueueServiceId === "all" || tItem.serviceId === selectedQueueServiceId)
    );
    if (currentCalling) {
      const docRef = doc(db, "tickets", currentCalling.id);
      try {
        await updateDoc(docRef, { status: "completed", completedAt: new Date().toISOString() });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${currentCalling.id}`);
      }
    }

    const nextWaiting = tickets.find(
      tItem => tItem.status === "waiting" && (selectedQueueServiceId === "all" || tItem.serviceId === selectedQueueServiceId)
    );
    if (nextWaiting) {
      const docRef = doc(db, "tickets", nextWaiting.id);
      try {
        await updateDoc(docRef, { 
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
  };

  const handleCallTicket = async (ticket: Ticket) => {
    const currentCalling = tickets.find(tItem => tItem.status === "calling" && tItem.id !== ticket.id);
    if (currentCalling) {
      const docRef = doc(db, "tickets", currentCalling.id);
      try {
        await updateDoc(docRef, { status: "completed", completedAt: new Date().toISOString() });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${currentCalling.id}`);
      }
    }

    const docRef = doc(db, "tickets", ticket.id);
    try {
      await updateDoc(docRef, { 
        status: "calling", 
        calledAt: new Date().toISOString(),
        counterNumber: activeCounterNumber
      });
      announceCallingTicket(String(ticket.ticketNumber), activeCounterNumber, ticket.serviceName);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticket.id}`);
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: "completed" | "cancelled" | "no_show" | "waiting") => {
    const docRef = doc(db, "tickets", ticketId);
    const updates: any = { status };
    if (status === "completed") {
      updates.completedAt = new Date().toISOString();
    }
    try {
      await updateDoc(docRef, updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
    }
  };

  const handleTogglePriority = async (ticketId: string, currentPriority: boolean) => {
    const docRef = doc(db, "tickets", ticketId);
    try {
      await updateDoc(docRef, { isPriority: !currentPriority });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
    }
  };

  return {
    tickets,
    allTickets,
    handleCallNext,
    handleCallTicket,
    handleUpdateTicketStatus,
    handleTogglePriority
  };
}
