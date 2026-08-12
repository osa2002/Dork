import { useEffect, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db, listenToForegroundFcmMessages } from "../lib/firebase";
import { Ticket, Shop } from "../types";
import { useNotificationStore } from "../store/notificationStore";
import { playChime } from "../lib/audio";

export function useCustomerNotifications(myTicket: Ticket | null, shop: Shop | null, isRtl: boolean) {
  const pushPermission = useNotificationStore((s) => s.pushPermission);
  const setPushPermission = useNotificationStore((s) => s.setPushPermission);
  
  const hasShownApproachingPush = useNotificationStore((s) => s.hasShownApproachingPush);
  const setHasShownApproachingPush = useNotificationStore((s) => s.setHasShownApproachingPush);
  
  const hasShownOneInFrontFcm = useNotificationStore((s) => s.hasShownOneInFrontFcm);
  const setHasShownOneInFrontFcm = useNotificationStore((s) => s.setHasShownOneInFrontFcm);
  
  const fcmToken = useNotificationStore((s) => s.fcmToken);
  
  const inAppAlert = useNotificationStore((s) => s.inAppAlert);
  const setInAppAlert = useNotificationStore((s) => s.setInAppAlert);
  
  const openTroubleshootBrand = useNotificationStore((s) => s.openTroubleshootBrand);
  const setOpenTroubleshootBrand = useNotificationStore((s) => s.setOpenTroubleshootBrand);
  
  const showDiagnosticsPanel = useNotificationStore((s) => s.showDiagnosticsPanel);
  const setShowDiagnosticsPanel = useNotificationStore((s) => s.setShowDiagnosticsPanel);
  
  const soundEnabled = useNotificationStore((s) => s.soundEnabled);
  
  const handleToggleSound = useNotificationStore((s) => s.handleToggleSound);
  const handleRequestPushPermissionAction = useNotificationStore((s) => s.handleRequestPushPermission);
  const handleSendTestNotificationAction = useNotificationStore((s) => s.handleSendTestNotification);
  const fetchFcmToken = useNotificationStore((s) => s.fetchFcmToken);

  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const handleRequestPushPermission = async () => {
    await handleRequestPushPermissionAction(isRtl, myTicket);
  };

  const handleSendTestNotification = () => {
    handleSendTestNotificationAction(isRtl, shop?.name || "");
  };

  // Automatically fetch FCM token and sync to Firestore ticket if already granted permission
  useEffect(() => {
    if (myTicket && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted" && !fcmToken) {
      fetchFcmToken().then((token) => {
        if (token && myTicket) {
          const ticketRef = doc(db, "tickets", myTicket.id);
          updateDoc(ticketRef, { fcmToken: token }).catch((err) => {
            console.error("[FCM] Error auto-updating FCM token on ticket:", err);
          });
        }
      });
    }
  }, [myTicket?.id, fcmToken, fetchFcmToken]);

  // Listen for foreground FCM push notifications
  useEffect(() => {
    let unsub: (() => void) | undefined;
    listenToForegroundFcmMessages((payload) => {
      if (soundEnabledRef.current) {
        playChime();
      }
      if (payload?.notification) {
        const title = payload.notification.title || (isRtl ? "تنبيه دورك! 🔔" : "Queue Alert! 🔔");
        const message = payload.notification.body || "";
        
        setInAppAlert({
          show: true,
          title,
          message,
          type: "next"
        });

        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(title, { body: message, tag: "dork-fcm-foreground" });
          } catch (e) {
            console.warn("Foreground notification display fallback:", e);
          }
        }
      }
    }).then((unsubscribeFn) => {
      unsub = unsubscribeFn;
    });

    return () => {
      if (unsub) unsub();
    };
  }, [isRtl, setInAppAlert]);

  return {
    pushPermission,
    setPushPermission,
    hasShownApproachingPush,
    setHasShownApproachingPush,
    hasShownOneInFrontFcm,
    setHasShownOneInFrontFcm,
    fcmToken,
    inAppAlert,
    setInAppAlert,
    openTroubleshootBrand,
    setOpenTroubleshootBrand,
    showDiagnosticsPanel,
    setShowDiagnosticsPanel,
    soundEnabled,
    soundEnabledRef,
    handleToggleSound,
    handleRequestPushPermission,
    handleSendTestNotification,
    fetchFcmToken
  };
}
