import { describe, it, expect, vi, beforeEach } from "vitest";
import { useShopStore } from "./shopStore";
import { shopRepository } from "../repositories/shopRepository";
import { getCachedData, cacheData } from "../lib/offlineDb";

// Mock shopRepository
vi.mock("../repositories/shopRepository", () => ({
  shopRepository: {
    subscribeToShop: vi.fn((slug, onSuccess, onError) => {
      // Return a standard unsub function
      return vi.fn();
    }),
    fetchServices: vi.fn(() => Promise.resolve([])),
    subscribeToServices: vi.fn((shopId, onSuccess, onError) => {
      return vi.fn();
    }),
    subscribeToCounterStatuses: vi.fn((shopId, onSuccess, onError) => {
      return vi.fn();
    }),
  },
}));

// Mock offlineDb
vi.mock("../lib/offlineDb", () => ({
  getCachedData: vi.fn(() => Promise.resolve(null)),
  cacheData: vi.fn(),
}));

describe("Shop Store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useShopStore.getState().clearShopData();
  });

  it("should initialize with correct default state values", () => {
    const state = useShopStore.getState();

    expect(state.shop).toBeNull();
    expect(state.services).toEqual([]);
    expect(state.loadingShop).toBe(true);
    expect(state.selectedServiceId).toBeNull();
    expect(state.historicalAvgDuration).toBe(15);
    expect(state.counterStatuses).toEqual([]);
  });

  it("should support direct mutators and clear shop data properly", () => {
    const store = useShopStore.getState();

    store.setShop({ id: "shop-1", name: "Alpha", slug: "alpha" } as any);
    store.setServices([{ id: "srv-1", name: "Service One", price: 10 }] as any);
    store.setSelectedServiceId("srv-1");
    store.setHistoricalAvgDuration(30);
    store.setCounterStatuses([{ counterId: "ctr-1", status: "active" }]);

    let updated = useShopStore.getState();
    expect(updated.shop?.id).toBe("shop-1");
    expect(updated.services.length).toBe(1);
    expect(updated.selectedServiceId).toBe("srv-1");
    expect(updated.historicalAvgDuration).toBe(30);
    expect(updated.counterStatuses.length).toBe(1);

    // Clear data
    store.clearShopData();

    const cleared = useShopStore.getState();
    expect(cleared.shop).toBeNull();
    expect(cleared.services).toEqual([]);
    expect(cleared.loadingShop).toBe(true);
    expect(cleared.selectedServiceId).toBeNull();
    expect(cleared.historicalAvgDuration).toBe(15);
    expect(cleared.counterStatuses).toEqual([]);
  });

  it("should attempt to load cached shop and services from offline DB when subscribing", async () => {
    const mockShop = { id: "shop-123", name: "Cached Coffee", slug: "coffee" };
    const mockServices = [{ id: "srv-cached", name: "Espresso" }];

    vi.mocked(getCachedData).mockImplementation((key: string) => {
      if (key === "shop_coffee") return Promise.resolve(mockShop);
      if (key === "services_shop-123") return Promise.resolve(mockServices);
      return Promise.resolve(null);
    });

    const store = useShopStore.getState();
    
    // Subscribe
    const unsub = store.subscribeToShop("coffee");

    // Wait for microtask queue to allow promises to resolve
    await new Promise((resolve) => setTimeout(resolve, 10));

    const updated = useShopStore.getState();
    expect(getCachedData).toHaveBeenCalledWith("shop_coffee");
    expect(updated.shop).toEqual(mockShop);
    expect(updated.services).toEqual(mockServices);
    expect(updated.selectedServiceId).toBe("srv-cached");

    unsub();
  });

  it("should delegate to shopRepository.subscribeToShop during subscribeToShop call", () => {
    const store = useShopStore.getState();
    const unsub = store.subscribeToShop("barber");

    expect(shopRepository.subscribeToShop).toHaveBeenCalledWith(
      "barber",
      expect.any(Function),
      expect.any(Function)
    );

    unsub();
  });

  it("should support subscribing and unsubscribing from counter statuses", () => {
    const store = useShopStore.getState();
    const unsub = store.subscribeToCounterStatuses("shop-abc");

    expect(shopRepository.subscribeToCounterStatuses).toHaveBeenCalledWith(
      "shop-abc",
      expect.any(Function),
      expect.any(Function)
    );

    unsub();
  });
});
