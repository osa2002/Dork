import { useEffect, useRef } from "react";
import { Ticket, Shop } from "../types";
import { useTranslation } from "react-i18next";
import { vendorQueueRepository } from "../repositories/vendorQueueRepository";
import { useVendorStore } from "../store/vendor/vendorStore";

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

  // Zustand Store Selectors (atomic)
  const tickets = useVendorStore((state) => state.tickets);
  const allTickets = useVendorStore((state) => state.allTickets);
  const subscribeToTickets = useVendorStore((state) => state.subscribeToTickets);
  const callNextTicket = useVendorStore((state) => state.callNextTicket);
  const handleCallTicket = useVendorStore((state) => state.handleCallTicket);
  const handleUpdateTicketStatus = useVendorStore((state) => state.handleUpdateTicketStatus);
  const handleTogglePriority = useVendorStore((state) => state.handleTogglePriority);

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

  // Real-time Tickets Listener delegated to store slice
  useEffect(() => {
    if (!shopId) return;

    const currentShopTimezone = shop?.timezone || "Asia/Riyadh";

    const unsubTickets = subscribeToTickets(
      shopId,
      currentShopTimezone,
      getClientStartOfTodayInTimezone,
      {
        getSoundEnabled: () => soundEnabledRef.current,
        getBrowserNotificationsEnabled: () => browserNotificationsEnabledRef.current,
        sendBrowserNotification: (title, body) => sendBrowserNotificationRef.current(title, body),
        t
      }
    );

    return () => unsubTickets();
  }, [shopId, shop?.timezone, getClientStartOfTodayInTimezone, t, subscribeToTickets]);

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
        try {
          const didNotify = await vendorQueueRepository.markEmailAsNotifiedInTransaction(ticket.id);
          if (didNotify) {
            await sendApproachingNotification(ticket, shop.name, isRtl);
          }
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

  // Delegated Ticket Handlers calling Zustand actions
  const handleCallNext = async (selectedQueueServiceId: string) => {
    await callNextTicket(
      selectedQueueServiceId,
      activeCounterNumber,
      announceCallingTicket,
      t
    );
  };

  const handleCallTicketWrapper = async (ticket: Ticket) => {
    await handleCallTicket(
      ticket,
      activeCounterNumber,
      announceCallingTicket
    );
  };

  const handleUpdateTicketStatusWrapper = async (
    ticketId: string,
    status: "completed" | "cancelled" | "no_show" | "waiting"
  ) => {
    await handleUpdateTicketStatus(ticketId, status);
  };

  const handleTogglePriorityWrapper = async (
    ticketId: string,
    currentPriority: boolean
  ) => {
    await handleTogglePriority(ticketId, currentPriority);
  };

  return {
    tickets,
    allTickets,
    handleCallNext,
    handleCallTicket: handleCallTicketWrapper,
    handleUpdateTicketStatus: handleUpdateTicketStatusWrapper,
    handleTogglePriority: handleTogglePriorityWrapper
  };
}
