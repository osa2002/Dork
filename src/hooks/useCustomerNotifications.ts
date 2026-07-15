import { useState, useEffect, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db, getFirebaseMessaging } from "../lib/firebase";
import { getToken } from "firebase/messaging";
import { playChime } from "../lib/audio";
import { Ticket, Shop } from "../types";

export function useCustomerNotifications(myTicket: Ticket | null, shop: Shop | null, isRtl: boolean) {
  const [pushPermission, setPushPermission] = useState<string>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });
  const [hasShownApproachingPush, setHasShownApproachingPush] = useState(false);
  const [hasShownOneInFrontFcm, setHasShownOneInFrontFcm] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [inAppAlert, setInAppAlert] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: "approaching" | "next" | null;
  }>({
    show: false,
    title: "",
    message: "",
    type: null,
  });

  const [openTroubleshootBrand, setOpenTroubleshootBrand] = useState<string | null>(null);
  const [showDiagnosticsPanel, setShowDiagnosticsPanel] = useState<boolean>(false);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("dork_sound_enabled") !== "false";
    }
    return true;
  });

  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const handleToggleSound = () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    localStorage.setItem("dork_sound_enabled", String(newVal));
    if (newVal) {
      playChime();
    }
  };

  const fetchFcmToken = async () => {
    try {
      const messaging = await getFirebaseMessaging();
      if (!messaging) {
        console.warn("FCM Messaging is not supported or failed to initialize.");
        return null;
      }

      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const token = await getToken(messaging);
        if (token) {
          console.log("FCM Token retrieved successfully:", token);
          setFcmToken(token);
          return token;
        }
      }
    } catch (err) {
      console.warn("Could not retrieve FCM token:", err);
    }
    return null;
  };

  const handleRequestPushPermission = async () => {
    if (!("Notification" in window)) {
      alert(isRtl ? "متصفحك لا يدعم الإشعارات المباشرة." : "Your browser does not support push notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    setPushPermission(permission);
    if (permission === "granted") {
      try {
        new Notification(isRtl ? "تم تفعيل الإشعارات بنجاح! 🔔" : "Notifications enabled successfully! 🔔", {
          body: isRtl ? "سنقوم بتنبيهك فور اقتراب دورك في الطابور." : "We will alert you once your turn is approaching.",
        });
      } catch (err: any) {
        console.warn("Could not instantiate Notification directly on this device:", err.message);
      }

      // Fetch FCM token and update the ticket
      const token = await fetchFcmToken();
      if (token && myTicket) {
        try {
          const ticketRef = doc(db, "tickets", myTicket.id);
          await updateDoc(ticketRef, { fcmToken: token });
          console.log("[FCM] Successfully updated ticket with FCM registration token.");
        } catch (err) {
          console.error("[FCM] Error saving FCM token to ticket:", err);
        }
      }
    }
  };

  const handleSendTestNotification = () => {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(
          isRtl ? "إشعار تجريبي من دورك 🔔" : "Test Notification from Dork 🔔",
          {
            body: isRtl
              ? `هكذا ستتلقى التنبيهات الفورية من متصفحك فور اقتراب دورك لدى ${shop?.name || ""}.`
              : `This is how you will receive instant alerts from your browser when your turn approaches at ${shop?.name || ""}.`,
            icon: "/favicon.ico",
          }
        );
      } catch (err: any) {
        console.warn("Could not instantiate test Notification:", err.message);
      }
    }
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
  }, [myTicket?.id, fcmToken]);

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
