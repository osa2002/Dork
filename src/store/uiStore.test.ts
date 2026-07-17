import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "./uiStore";

describe("useUiStore (Zustand)", () => {
  beforeEach(() => {
    // Reset Zustand store to default values before each test
    useUiStore.getState().resetUiStore();
  });

  it("should initialize with default states", () => {
    const state = useUiStore.getState();
    expect(state.isDarkMode).toBe(false);
    expect(state.showCancelConfirm).toBe(false);
    expect(state.showLimitModal).toBe(false);
    expect(state.copied).toBe(false);
    expect(state.showShareModal).toBe(false);
    expect(state.showPwaModal).toBe(false);
    expect(state.showFeedbackForm).toBe(false);
    expect(state.showInstallBanner).toBe(false);
    expect(state.deferredPrompt).toBeNull();
    expect(state.isStandalone).toBe(false);
    expect(state.activeDashboardTab).toBe("queue");
    expect(state.confirmModal).toBeNull();
  });

  it("should correctly update dark mode state", () => {
    const store = useUiStore.getState();
    store.setIsDarkMode(true);
    expect(useUiStore.getState().isDarkMode).toBe(true);
    expect(localStorage.getItem("dork_global_dark_mode")).toBe("true");

    useUiStore.getState().setIsDarkMode(false);
    expect(useUiStore.getState().isDarkMode).toBe(false);
    expect(localStorage.getItem("dork_global_dark_mode")).toBe("false");
  });

  it("should toggle boolean ui visibility states", () => {
    const store = useUiStore.getState();
    
    store.setShowCancelConfirm(true);
    expect(useUiStore.getState().showCancelConfirm).toBe(true);

    store.setShowLimitModal(true);
    expect(useUiStore.getState().showLimitModal).toBe(true);

    store.setCopied(true);
    expect(useUiStore.getState().copied).toBe(true);

    store.setShowShareModal(true);
    expect(useUiStore.getState().showShareModal).toBe(true);

    store.setShowPwaModal(true);
    expect(useUiStore.getState().showPwaModal).toBe(true);

    store.setShowFeedbackForm(true);
    expect(useUiStore.getState().showFeedbackForm).toBe(true);

    store.setShowInstallBanner(true);
    expect(useUiStore.getState().showInstallBanner).toBe(true);
  });

  it("should handle deferredPrompt and standalone states", () => {
    const store = useUiStore.getState();
    const dummyPrompt = { prompt: () => Promise.resolve() };
    
    store.setDeferredPrompt(dummyPrompt);
    expect(useUiStore.getState().deferredPrompt).toBe(dummyPrompt);

    store.setIsStandalone(true);
    expect(useUiStore.getState().isStandalone).toBe(true);
  });

  it("should update active dashboard tab", () => {
    const store = useUiStore.getState();
    store.setActiveDashboardTab("reports");
    expect(useUiStore.getState().activeDashboardTab).toBe("reports");
  });

  it("should manage confirmation modal state", () => {
    const store = useUiStore.getState();
    const callback = () => {};
    const modalPayload = {
      title: "Confirm Action",
      message: "Are you sure?",
      onConfirm: callback,
    };

    store.setConfirmModal(modalPayload);
    expect(useUiStore.getState().confirmModal).toEqual(modalPayload);

    store.setConfirmModal(null);
    expect(useUiStore.getState().confirmModal).toBeNull();
  });
});
