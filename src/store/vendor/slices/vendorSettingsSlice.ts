import { StateCreator } from "zustand";
import { VendorState, VendorSettingsSlice } from "../types";
import { vendorStorageService } from "../../../services/vendorStorageService";
import { vendorNotificationService } from "../../../services/vendorNotificationService";
import { vendorSpeechService } from "../../../services/vendorSpeechService";

export const createVendorSettingsSlice: StateCreator<
  VendorState,
  [],
  [],
  VendorSettingsSlice
> = (set, get) => ({
  editShopName: "",
  editShopLogoText: "",
  editShopCategory: "other",
  editShopLogoUrl: "",
  editShopTicketColor: "#4f46e5",
  editDisplayBgTheme: "aurora",
  editDisplayAnimatedBg: true,
  workingHoursEnabled: false,
  workingHoursDays: {},
  settingsSaving: false,
  settingsSuccess: false,
  settingsError: null,
  counterStatus: "online",

  // Notification configurations loaded from vendorStorageService
  soundEnabled: vendorStorageService.getItem("vendor_sound_enabled") !== "false",
  voiceAnnouncementsEnabled: vendorStorageService.getItem("vendor_voice_enabled") !== "false",
  voiceLanguage: vendorStorageService.getItem("vendor_voice_lang") || "both",
  voiceRate: parseFloat(vendorStorageService.getItem("vendor_voice_rate") || "0.85"),
  browserNotificationsEnabled: vendorStorageService.getItem("vendor_browser_notifications") === "true",
  maxWaitTimeAlertMinutes: Number(vendorStorageService.getItem("vendor_max_wait_time") || "15"),

  setEditShopName: (editShopName) => set({ editShopName }),
  setEditShopLogoText: (editShopLogoText) => set({ editShopLogoText }),
  setEditShopCategory: (editShopCategory) => set({ editShopCategory }),
  setEditShopLogoUrl: (editShopLogoUrl) => set({ editShopLogoUrl }),
  setEditShopTicketColor: (editShopTicketColor) => set({ editShopTicketColor }),
  setEditDisplayBgTheme: (editDisplayBgTheme) => set({ editDisplayBgTheme }),
  setEditDisplayAnimatedBg: (editDisplayAnimatedBg) => set({ editDisplayAnimatedBg }),
  setWorkingHoursEnabled: (workingHoursEnabled) => set({ workingHoursEnabled }),
  setWorkingHoursDays: (workingHoursDays) => set({ workingHoursDays }),
  setSettingsSaving: (settingsSaving) => set({ settingsSaving }),
  setSettingsSuccess: (settingsSuccess) => set({ settingsSuccess }),
  setSettingsError: (settingsError) => set({ settingsError }),
  setCounterStatus: (counterStatus) => set({ counterStatus }),

  setSoundEnabled: (soundEnabled) => {
    vendorStorageService.setItem("vendor_sound_enabled", String(soundEnabled));
    set({ soundEnabled });
  },
  setVoiceAnnouncementsEnabled: (voiceAnnouncementsEnabled) => {
    vendorStorageService.setItem("vendor_voice_enabled", String(voiceAnnouncementsEnabled));
    set({ voiceAnnouncementsEnabled });
  },
  setVoiceLanguage: (voiceLanguage) => {
    vendorStorageService.setItem("vendor_voice_lang", voiceLanguage);
    set({ voiceLanguage });
  },
  setVoiceRate: (voiceRate) => {
    vendorStorageService.setItem("vendor_voice_rate", String(voiceRate));
    set({ voiceRate });
  },
  setBrowserNotificationsEnabled: (browserNotificationsEnabled) => {
    vendorStorageService.setItem("vendor_browser_notifications", String(browserNotificationsEnabled));
    set({ browserNotificationsEnabled });
  },
  setMaxWaitTimeAlertMinutes: (maxWaitTimeAlertMinutes) => {
    vendorStorageService.setItem("vendor_max_wait_time", String(maxWaitTimeAlertMinutes));
    set({ maxWaitTimeAlertMinutes });
  },

  handleToggleWorkingHoursDay: (index: string) => {
    const { workingHoursDays } = get();
    const day = workingHoursDays[index];
    if (!day) return;
    set({
      workingHoursDays: {
        ...workingHoursDays,
        [index]: {
          ...day,
          enabled: !day.enabled,
        },
      },
    });
  },

  handleWorkingHoursTimeChange: (index: string, type: "open" | "close", value: string) => {
    const { workingHoursDays } = get();
    const day = workingHoursDays[index];
    if (!day) return;
    set({
      workingHoursDays: {
        ...workingHoursDays,
        [index]: {
          ...day,
          [type]: value,
        },
      },
    });
  },

  handleSaveSettings: async (shopId: string) => {
    const {
      editShopName,
      editShopLogoText,
      editShopCategory,
      editShopLogoUrl,
      editShopTicketColor,
      editDisplayBgTheme,
      editDisplayAnimatedBg,
      workingHoursEnabled,
      workingHoursDays,
      updateShopSettings,
    } = get();

    if (!editShopName.trim()) return;

    set({ settingsSaving: true, settingsSuccess: false, settingsError: null });
    try {
      await updateShopSettings(shopId, {
        name: editShopName.trim(),
        logoText: editShopLogoText.trim(),
        category: editShopCategory,
        logoUrl: editShopLogoUrl.trim(),
        ticketColor: editShopTicketColor,
        displayBgTheme: editDisplayBgTheme,
        displayAnimatedBg: editDisplayAnimatedBg,
        workingHours: {
          enabled: workingHoursEnabled,
          days: workingHoursDays,
        },
      });
      set({ settingsSuccess: true });
      setTimeout(() => {
        set({ settingsSuccess: false });
      }, 3000);
    } catch (err: any) {
      console.error("Error in handleSaveSettings inside slice:", err);
      set({ settingsError: err.message || "Failed to save settings." });
      throw err;
    } finally {
      set({ settingsSaving: false });
    }
  },

  handleToggleBrowserNotifications: async () => {
    if (!vendorNotificationService.isSupported()) {
      throw new Error("Browser notifications are not supported on this browser.");
    }

    const { browserNotificationsEnabled } = get();
    if (browserNotificationsEnabled) {
      get().setBrowserNotificationsEnabled(false);
      return;
    }

    const permission = await vendorNotificationService.requestPermission();
    if (permission === "granted") {
      get().setBrowserNotificationsEnabled(true);
      vendorNotificationService.sendNotification(
        "Welcome! 🔔",
        "Popup notifications have been successfully enabled on this browser."
      );
    } else {
      get().setBrowserNotificationsEnabled(false);
      throw new Error("Browser notifications permission was denied.");
    }
  },

  handleSendTestNotification: () => {
    if (!vendorNotificationService.isSupported()) {
      alert("Browser notifications are not supported on this browser.");
      return;
    }
    if (vendorNotificationService.getPermission() !== "granted") {
      alert("Browser notifications permission denied or not set.");
      return;
    }
    vendorNotificationService.sendNotification(
      "Test Notification from Dork! 🔔",
      "Awesome! Notifications are working successfully and extremely fast."
    );
  },

  announceCallingTicket: (
    ticketNumber: string,
    counterNumber: string,
    serviceName: string,
    isRtl: boolean
  ) => {
    const { voiceAnnouncementsEnabled, voiceLanguage, voiceRate } = get();
    if (!voiceAnnouncementsEnabled) return;

    const arabicText = counterNumber
      ? `الرجاء من صاحب التذكرة رقم ${ticketNumber}، التوجه إلى شباك رقم ${counterNumber}`
      : `الرجاء من صاحب التذكرة رقم ${ticketNumber}، التوجه إلى كاونتر الخدمة لخدمة ${serviceName}`;

    const englishText = counterNumber
      ? `Ticket number ${ticketNumber}, please proceed to window number ${counterNumber}`
      : `Ticket number ${ticketNumber}, please proceed to service counter for ${serviceName}`;

    let textToSpeak = isRtl ? arabicText : englishText;
    if (voiceLanguage === "both") {
      textToSpeak = `${arabicText}. ${englishText}`;
    } else if (voiceLanguage === "ar") {
      textToSpeak = arabicText;
    } else if (voiceLanguage === "en") {
      textToSpeak = englishText;
    }

    vendorSpeechService.speak(textToSpeak, voiceRate, isRtl, voiceLanguage);
  },
});
