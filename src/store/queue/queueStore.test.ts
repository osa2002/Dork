import { describe, it, expect, vi, beforeEach } from "vitest";
import { useQueueStore } from "./queueStore";
import { storageService } from "./services/storageService";

// Mock the storage service used in the slice
vi.mock("./services/storageService", () => ({
  storageService: {
    getOnlineStatus: vi.fn(() => true),
    getMyTicketId: vi.fn(() => null),
    setMyTicketId: vi.fn(),
  },
}));

describe("Queue Store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with correct default values across multiple slices", () => {
    const state = useQueueStore.getState();

    // Data slice assertions
    expect(state.myTicket).toBeNull();
    expect(state.todayTickets).toEqual([]);
    expect(state.estimatedWaitMinutes).toBe(0);
    expect(state.peopleInFront).toBe(0);
    expect(state.progressPercent).toBe(0);

    // UI slice assertions
    expect(state.joining).toBe(false);
    expect(state.isOnline).toBe(true);
    expect(state.errorMessage).toBeNull();
    expect(state.showAlert).toBe(false);
    expect(state.aiEstimateLoading).toBe(false);
    expect(state.aiEstimateMessage).toBe("");
  });

  it("should successfully update and mutate UI slice properties", () => {
    const store = useQueueStore.getState();

    store.setJoining(true);
    store.setIsOnline(false);
    store.setErrorMessage("Failed to join queue");
    store.setShowAlert(true);
    store.setAiEstimateLoading(true);
    store.setAiEstimateMessage("AI is calculating...");

    const updated = useQueueStore.getState();
    expect(updated.joining).toBe(true);
    expect(updated.isOnline).toBe(false);
    expect(updated.errorMessage).toBe("Failed to join queue");
    expect(updated.showAlert).toBe(true);
    expect(updated.aiEstimateLoading).toBe(true);
    expect(updated.aiEstimateMessage).toBe("AI is calculating...");
  });

  it("should successfully update and mutate Data slice properties", () => {
    const store = useQueueStore.getState();
    const mockTicket = {
      id: "tkt-123",
      ticketNumber: "A-101",
      customerName: "Alice",
      status: "waiting",
    } as any;

    store.setMyTicket(mockTicket);
    store.setTodayTickets([mockTicket]);
    store.setEstimatedWaitMinutes(20);
    store.setPeopleInFront(3);
    store.setProgressPercent(25);
    store.setCalculatedAvgServiceTime(12);
    store.setActiveCountersCount(2);

    const updated = useQueueStore.getState();
    expect(updated.myTicket).toEqual(mockTicket);
    expect(updated.todayTickets).toEqual([mockTicket]);
    expect(updated.estimatedWaitMinutes).toBe(20);
    expect(updated.peopleInFront).toBe(3);
    expect(updated.progressPercent).toBe(25);
    expect(updated.calculatedAvgServiceTime).toBe(12);
    expect(updated.activeCountersCount).toBe(2);
  });
});
