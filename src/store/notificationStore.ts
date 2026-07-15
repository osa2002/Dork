import { create } from "zustand";

export interface InAppAlert {
  show: boolean;
  type?: string;
  title?: string;
  message?: string;
}

export interface NotificationState {
  pushPermission: NotificationPermission;
  fcmToken: string | null;
  soundEnabled: boolean;
  inAppAlert: InAppAlert;
  openTroubleshootBrand: boolean;
  showDiagnosticsPanel: boolean;

  // Actions
  setPushPermission: (permission: NotificationPermission) => void;
  setFcmToken: (token: string | null) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setInAppAlert: (alert: InAppAlert) => void;
  setOpenTroubleshootBrand: (open: boolean) => void;
  setShowDiagnosticsPanel: (show: boolean) => void;
  resetNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  pushPermission: typeof Notification !== "undefined" ? Notification.permission : "default",
  fcmToken: null,
  soundEnabled: true,
  inAppAlert: { show: false },
  openTroubleshootBrand: false,
  showDiagnosticsPanel: false,

  setPushPermission: (pushPermission) => set({ pushPermission }),
  setFcmToken: (fcmToken) => set({ fcmToken }),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setInAppAlert: (inAppAlert) => set({ inAppAlert }),
  setOpenTroubleshootBrand: (openTroubleshootBrand) => set({ openTroubleshootBrand }),
  setShowDiagnosticsPanel: (showDiagnosticsPanel) => set({ showDiagnosticsPanel }),
  resetNotifications: () => set({
    pushPermission: typeof Notification !== "undefined" ? Notification.permission : "default",
    fcmToken: null,
    soundEnabled: true,
    inAppAlert: { show: false },
    openTroubleshootBrand: false,
    showDiagnosticsPanel: false,
  }),
}));
