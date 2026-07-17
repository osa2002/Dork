import { describe, it, expect, vi, beforeEach } from "vitest";
import { useNotificationStore } from "./notificationStore";
import { audioService } from "./queue/services/audioService";
import { notificationService } from "./queue/services/notificationService";
import { storageService } from "./queue/services/storageService";
import { notificationRepository } from "../repositories/notificationRepository";

// Mock the services
vi.mock("./queue/services/audioService", () => ({
  audioService: {
    playChimeSound: vi.fn(),
  },
}));

vi.mock("./queue/services/notificationService", () => ({
  notificationService: {
    getPermission: vi.fn(() => "default" as NotificationPermission),
    isSupported: vi.fn(() => true),
    requestPermission: vi.fn(() => Promise.resolve("granted" as NotificationPermission)),
    showNotification: vi.fn(),
  },
}));

vi.mock("./queue/services/storageService", () => ({
  storageService: {
    getSoundEnabled: vi.fn(() => true),
    setSoundEnabled: vi.fn(),
  },
}));

vi.mock("../repositories/notificationRepository", () => ({
  notificationRepository: {
    updateFcmToken: vi.fn(() => Promise.resolve()),
  },
}));

// Mock firebase functions called during token fetch
vi.mock("../lib/firebase", () => ({
  getFirebaseMessaging: vi.fn().mockResolvedValue({}),
}));

vi.mock("firebase/messaging", () => ({
  getToken: vi.fn().mockResolvedValue("mocked-fcm-token-12345"),
}));

describe("Notification Store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificationService.getPermission).mockReturnValue("default");
    useNotificationStore.getState().resetNotifications();
  });

  it("should initialize with correct default states from services", () => {
    const state = useNotificationStore.getState();
    
    expect(state.pushPermission).toBe("default");
    expect(state.soundEnabled).toBe(true);
    expect(state.hasShownApproachingPush).toBe(false);
    expect(state.hasShownOneInFrontFcm).toBe(false);
    expect(state.fcmToken).toBeNull();
    expect(state.inAppAlert.show).toBe(false);
  });

  it("should toggle sound and play chime sound when enabled", () => {
    const store = useNotificationStore.getState();
    
    // Initial sound is enabled (true)
    expect(store.soundEnabled).toBe(true);

    // Toggle 1: disable sound
    actToggleSound();
    expect(useNotificationStore.getState().soundEnabled).toBe(false);
    expect(storageService.setSoundEnabled).toHaveBeenCalledWith(false);
    expect(audioService.playChimeSound).not.toHaveBeenCalled();

    // Toggle 2: enable sound
    actToggleSound();
    expect(useNotificationStore.getState().soundEnabled).toBe(true);
    expect(storageService.setSoundEnabled).toHaveBeenCalledWith(true);
    expect(audioService.playChimeSound).toHaveBeenCalledTimes(1);
  });

  it("should request push permission, update store state, and display notification on success", async () => {
    vi.mocked(notificationService.getPermission)
      .mockReturnValueOnce("default")
      .mockReturnValue("granted");
    const store = useNotificationStore.getState();
    const mockTicket = { id: "ticket-789", fcmToken: null } as any;

    await store.handleRequestPushPermission(false, mockTicket);

    const updatedState = useNotificationStore.getState();
    expect(updatedState.pushPermission).toBe("granted");
    expect(notificationService.requestPermission).toHaveBeenCalled();
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      "Notifications enabled successfully! 🔔",
      "We will alert you once your turn is approaching."
    );
    expect(notificationRepository.updateFcmToken).toHaveBeenCalledWith("ticket-789", "mocked-fcm-token-12345");
  });

  it("should use arabic translation if request is flagged as RTL", async () => {
    const store = useNotificationStore.getState();
    await store.handleRequestPushPermission(true, null);

    expect(notificationService.showNotification).toHaveBeenCalledWith(
      "تم تفعيل الإشعارات بنجاح! 🔔",
      "سنقوم بتنبيهك فور اقتراب دورك في الطابور."
    );
  });

  it("should send a test browser notification when requested and permission is granted", () => {
    vi.mocked(notificationService.getPermission).mockReturnValue("granted");
    
    const store = useNotificationStore.getState();
    store.handleSendTestNotification(false, "Coffee Shop");

    expect(notificationService.showNotification).toHaveBeenCalledWith(
      "Test Notification from Dork 🔔",
      "This is how you will receive instant alerts from your browser when your turn approaches at Coffee Shop."
    );
  });

  it("should reset all notification related states to their clean defaults", () => {
    const store = useNotificationStore.getState();
    
    // Mutate state
    store.setHasShownApproachingPush(true);
    store.setFcmToken("stale-token");
    store.setShowDiagnosticsPanel(true);

    expect(useNotificationStore.getState().hasShownApproachingPush).toBe(true);
    expect(useNotificationStore.getState().fcmToken).toBe("stale-token");

    // Reset
    store.resetNotifications();

    const resetState = useNotificationStore.getState();
    expect(resetState.hasShownApproachingPush).toBe(false);
    expect(resetState.fcmToken).toBeNull();
    expect(resetState.showDiagnosticsPanel).toBe(false);
  });
});

// Helper to trigger handleToggleSound inside Zustand store
function actToggleSound() {
  useNotificationStore.getState().handleToggleSound();
}
