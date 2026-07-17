import { describe, it, expect, vi, beforeEach } from "vitest";
import { shopRepository } from "./shopRepository";
import { getDocs, query } from "firebase/firestore";

// Mock Firebase APIs
vi.mock("firebase/firestore", () => {
  const getDocsMock = vi.fn();
  const onSnapshotMock = vi.fn((q, onNext, onError) => {
    // Return a mock unsubscribe function
    return vi.fn();
  });
  return {
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    limit: vi.fn((val) => val),
    onSnapshot: onSnapshotMock,
    getDocs: getDocsMock,
    doc: vi.fn(),
  };
});

// Mock database instance to avoid initialization errors
vi.mock("../lib/firebase", () => ({
  db: {},
}));

describe("shopRepository Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchServices", () => {
    it("should fetch and parse active services from Firestore", async () => {
      const mockServices = [
        { id: "s1", name: "Billing Support", isActive: true, shopId: "shop_abc" },
        { id: "s2", name: "Technical Support", isActive: true, shopId: "shop_abc" },
      ];

      // Setup the mock result of getDocs
      const mockSnap = {
        forEach: (cb: any) => {
          mockServices.forEach((service) => {
            cb({
              id: service.id,
              data: () => service,
            });
          });
        },
      };

      const getDocsMock = getDocs as any;
      getDocsMock.mockResolvedValueOnce(mockSnap);

      const result = await shopRepository.fetchServices("shop_abc");

      expect(getDocsMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockServices);
    });
  });

  describe("getHistoricalAvgDuration", () => {
    it("should return null if there are no completed tickets", async () => {
      const mockSnap = {
        docs: [],
      };
      const getDocsMock = getDocs as any;
      getDocsMock.mockResolvedValueOnce(mockSnap);

      const duration = await shopRepository.getHistoricalAvgDuration("shop_abc");
      expect(duration).toBeNull();
    });

    it("should calculate and return average duration for completed tickets", async () => {
      const completedAt1 = new Date("2026-07-10T11:00:00Z");
      const calledAt1 = new Date("2026-07-10T10:50:00Z"); // 10 mins

      const completedAt2 = new Date("2026-07-10T11:30:00Z");
      const calledAt2 = new Date("2026-07-10T11:10:00Z"); // 20 mins

      const mockTicketsDocs = [
        {
          data: () => ({
            status: "completed",
            shopId: "shop_abc",
            calledAt: calledAt1.toISOString(),
            completedAt: completedAt1.toISOString(),
          }),
        },
        {
          data: () => ({
            status: "completed",
            shopId: "shop_abc",
            calledAt: calledAt2.toISOString(),
            completedAt: completedAt2.toISOString(),
          }),
        },
      ];

      const mockSnap = {
        docs: mockTicketsDocs,
      };

      const getDocsMock = getDocs as any;
      getDocsMock.mockResolvedValueOnce(mockSnap);

      const duration = await shopRepository.getHistoricalAvgDuration("shop_abc");
      // Total duration = 10 + 20 = 30 mins. Count = 2. Avg = 15.
      expect(duration).toBe(15);
    });
  });
});
