import { create } from "zustand";
import { getFirebaseMessaging } from "../lib/firebase";
import { getToken } from "firebase/messaging";
import { Ticket } from "../types";
import { audioService } from "./queue/services/audioService";
import { notificationService } from "./queue/services/notificationService";
import { storageService } from "./queue/services/storageService";
import { notificationRepository } from "../repositories/notificationRepository";

export interface InAppAlert {
  show: boolean;
  title: string;
  message: string;
  type: "approaching" | "next" | null;
}

export type StateOrUpdater<T> = T | ((prev: T) => T);

const resolveVal = <T>(valOrFn: StateOrUpdater<T>, current: T): T => {
  return typeof valOrFn === "function" ? (valOrFn as (prev: T) => T)(current) : valOrFn;
};

export interface NotificationState {
  pushPermission: NotificationPermission;
  hasShownApproachingPush: boolean;
  hasShownOneInFrontFcm: boolean;
  fcmToken: string | null;
  inAppAlert: InAppAlert;
  openTroubleshootBrand: string | null;
  showDiagnosticsPanel: boolean;
  soundEnabled: boolean;

  // Actions
  setPushPermission: (permission: StateOrUpdater<NotificationPermission>) => void;
  setHasShownApproachingPush: (shown: StateOrUpdater<boolean>) => void;
  setHasShownOneInFrontFcm: (shown: StateOrUpdater<boolean>) => void;
  setFcmToken: (token: StateOrUpdater<string | null>) => void;
  setInAppAlert: (alert: StateOrUpdater<InAppAlert>) => void;
  setOpenTroubleshootBrand: (brand: StateOrUpdater<string | null>) => void;
  setShowDiagnosticsPanel: (show: StateOrUpdater<boolean>) => void;
  setSoundEnabled: (enabled: StateOrUpdater<boolean>) => void;
  handleToggleSound: () => void;
  handleRequestPushPermission: (isRtl: boolean, myTicket: Ticket | null) => Promise<void>;
  handleSendTestNotification: (isRtl: boolean, shopName: string) => void;
  fetchFcmToken: () => Promise<string | null>;
  resetNotifications: () => void;
}

let isFetchingFcmToken = false;

/**
 * useNotificationStore
 * 
 * Single source of truth for notifications, sound preferences,
 * and FCM/browser push integration. Purely manages State and delegates 
 * side-effects to clean services (audioService, notificationService, storageService).
 */
export const useNotificationStore = create<NotificationState>((set, get) => ({
  pushPermission: notificationService.getPermission(),
  hasShownApproachingPush: false,
  hasShownOneInFrontFcm: false,
  fcmToken: null,
  inAppAlert: {
    show: false,
    title: "",
    message: "",
    type: null,
  },
  openTroubleshootBrand: null,
  showDiagnosticsPanel: false,
  soundEnabled: storageService.getSoundEnabled(),

  setPushPermission: (pushPermission) => set((s) => ({ pushPermission: resolveVal(pushPermission, s.pushPermission) })),
  setHasShownApproachingPush: (hasShownApproachingPush) => set((s) => ({ hasShownApproachingPush: resolveVal(hasShownApproachingPush, s.hasShownApproachingPush) })),
  setHasShownOneInFrontFcm: (hasShownOneInFrontFcm) => set((s) => ({ hasShownOneInFrontFcm: resolveVal(hasShownOneInFrontFcm, s.hasShownOneInFrontFcm) })),
  setFcmToken: (fcmToken) => set((s) => ({ fcmToken: resolveVal(fcmToken, s.fcmToken) })),
  setInAppAlert: (inAppAlert) => set((s) => ({ inAppAlert: resolveVal(inAppAlert, s.inAppAlert) })),
  setOpenTroubleshootBrand: (openTroubleshootBrand) => set((s) => ({ openTroubleshootBrand: resolveVal(openTroubleshootBrand, s.openTroubleshootBrand) })),
  setShowDiagnosticsPanel: (showDiagnosticsPanel) => set((s) => ({ showDiagnosticsPanel: resolveVal(showDiagnosticsPanel, s.showDiagnosticsPanel) })),
  setSoundEnabled: (soundEnabled) => {
    set((s) => {
      const resolved = resolveVal(soundEnabled, s.soundEnabled);
      storageService.setSoundEnabled(resolved);
      return { soundEnabled: resolved };
    });
  },

  handleToggleSound: () => {
    const newVal = !get().soundEnabled;
    set({ soundEnabled: newVal });
    storageService.setSoundEnabled(newVal);
    if (newVal) {
      audioService.playChimeSound();
    }
  },

  fetchFcmToken: async () => {
    if (get().fcmToken) return get().fcmToken;
    if (isFetchingFcmToken) return null;
    isFetchingFcmToken = true;

    try {
      const messaging = await getFirebaseMessaging();
      if (!messaging) {
        console.warn("FCM Messaging is not supported or failed to initialize.");
        return null;
      }

      const permission = notificationService.getPermission();
      if (permission === "granted") {
        const token = await getToken(messaging);
        if (token) {
          console.log("FCM Token retrieved successfully:", token);
          set({ fcmToken: token });
          return token;
        }
      }
    } catch (err) {
      console.warn("Could not retrieve FCM token:", err);
    } finally {
      isFetchingFcmToken = false;
    }
    return null;
  },

  handleRequestPushPermission: async (isRtl, myTicket) => {
    if (!notificationService.isSupported()) {
      alert(isRtl ? "متصفحك لا يدعم الإشعارات المباشرة." : "Your browser does not support push notifications.");
      return;
    }

    const currentPermission = notificationService.getPermission();
    if (currentPermission === "granted") {
      console.log("Notification permission already granted.");
      return;
    }

    const permission = await notificationService.requestPermission();
    set({ pushPermission: permission });

    if (permission === "granted") {
      notificationService.showNotification(
        isRtl ? "تم تفعيل الإشعارات بنجاح! 🔔" : "Notifications enabled successfully! 🔔",
        isRtl ? "سنقوم بتنبيهك فور اقتراب دورك في الطابور." : "We will alert you once your turn is approaching."
      );

      // Fetch FCM token and update the ticket
      const token = await get().fetchFcmToken();
      if (token && myTicket) {
        try {
          await notificationRepository.updateFcmToken(myTicket.id, token);
          console.log("[FCM] Successfully updated ticket with FCM registration token.");
        } catch (err) {
          console.error("[FCM] Error saving FCM token to ticket:", err);
        }
      }
    }
  },

  handleSendTestNotification: (isRtl, shopName) => {
    if (notificationService.getPermission() === "granted") {
      notificationService.showNotification(
        isRtl ? "إشعار تجريبي من دورك 🔔" : "Test Notification from Dork 🔔",
        isRtl
          ? `هكذا ستتلقى التنبيهات الفورية من متصفحك فور اقتراب دورك لدى ${shopName || ""}.`
          : `This is how you will receive instant alerts from your browser when your turn approaches at ${shopName || ""}.`
      );
    }
  },

  resetNotifications: () => set({
    pushPermission: notificationService.getPermission(),
    hasShownApproachingPush: false,
    hasShownOneInFrontFcm: false,
    fcmToken: null,
    inAppAlert: {
      show: false,
      title: "",
      message: "",
      type: null,
    },
    openTroubleshootBrand: null,
    showDiagnosticsPanel: false,
    soundEnabled: storageService.getSoundEnabled(),
  }),
}));
