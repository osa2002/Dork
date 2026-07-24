import { create } from "zustand";

export interface UiState {
  isDarkMode: boolean;
  showCancelConfirm: boolean;
  showLimitModal: boolean;
  copied: boolean;
  showShareModal: boolean;
  showPwaModal: boolean;
  showFeedbackForm: boolean;
  showInstallBanner: boolean;
  deferredPrompt: any;
  isStandalone: boolean;
  activeDashboardTab: "queue" | "services" | "qr" | "reports" | "displays" | "billing" | "webhooks";
  confirmModal: {
    title: string;
    message: string;
    onConfirm: () => void;
  } | null;

  // Actions
  setIsDarkMode: (dark: boolean) => void;
  setShowCancelConfirm: (show: boolean) => void;
  setShowLimitModal: (show: boolean) => void;
  setCopied: (copied: boolean) => void;
  setShowShareModal: (show: boolean) => void;
  setShowPwaModal: (show: boolean) => void;
  setShowFeedbackForm: (show: boolean) => void;
  setShowInstallBanner: (show: boolean) => void;
  setDeferredPrompt: (prompt: any) => void;
  setIsStandalone: (standalone: boolean) => void;
  setActiveDashboardTab: (tab: "queue" | "services" | "qr" | "reports" | "displays" | "billing" | "webhooks") => void;
  setConfirmModal: (modal: { title: string; message: string; onConfirm: () => void } | null) => void;
  resetUiStore: () => void;
}

const getInitialDarkMode = (): boolean => {
  if (typeof window !== "undefined") {
    const isDark = localStorage.getItem("dork_global_dark_mode") === "true";
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    return isDark;
  }
  return false;
};

export const useUiStore = create<UiState>((set) => ({
  isDarkMode: getInitialDarkMode(),
  showCancelConfirm: false,
  showLimitModal: false,
  copied: false,
  showShareModal: false,
  showPwaModal: false,
  showFeedbackForm: false,
  showInstallBanner: false,
  deferredPrompt: null,
  isStandalone: false,
  activeDashboardTab: "queue",
  confirmModal: null,

  setIsDarkMode: (isDarkMode) => {
    localStorage.setItem("dork_global_dark_mode", String(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    set({ isDarkMode });
  },
  setShowCancelConfirm: (showCancelConfirm) => set({ showCancelConfirm }),
  setShowLimitModal: (showLimitModal) => set({ showLimitModal }),
  setCopied: (copied) => set({ copied }),
  setShowShareModal: (showShareModal) => set({ showShareModal }),
  setShowPwaModal: (showPwaModal) => set({ showPwaModal }),
  setShowFeedbackForm: (showFeedbackForm) => set({ showFeedbackForm }),
  setShowInstallBanner: (showInstallBanner) => set({ showInstallBanner }),
  setDeferredPrompt: (deferredPrompt) => set({ deferredPrompt }),
  setIsStandalone: (isStandalone) => set({ isStandalone }),
  setActiveDashboardTab: (activeDashboardTab) => set({ activeDashboardTab }),
  setConfirmModal: (confirmModal) => set({ confirmModal }),
  resetUiStore: () => set({
    isDarkMode: getInitialDarkMode(),
    showCancelConfirm: false,
    showLimitModal: false,
    copied: false,
    showShareModal: false,
    showPwaModal: false,
    showFeedbackForm: false,
    showInstallBanner: false,
    deferredPrompt: null,
    isStandalone: false,
    activeDashboardTab: "queue",
    confirmModal: null,
  }),
}));

