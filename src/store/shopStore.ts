import { create } from "zustand";
import { Shop, Service } from "../types";
import { shopRepository } from "../repositories/shopRepository";
import { handleFirestoreError, OperationType } from "../lib/firebase";
import { cacheData, getCachedData } from "../lib/offlineDb";

export interface ShopState {
  shop: Shop | null;
  services: Service[];
  loadingShop: boolean;
  selectedServiceId: string | null;
  historicalAvgDuration: number;
  counterStatuses: any[];

  // Actions
  setShop: (shop: Shop | null) => void;
  setServices: (services: Service[]) => void;
  setLoadingShop: (loadingShop: boolean) => void;
  setSelectedServiceId: (id: string | null) => void;
  setHistoricalAvgDuration: (duration: number) => void;
  setCounterStatuses: (statuses: any[]) => void;
  clearShopData: () => void;

  // Subscription Actions
  subscribeToShop: (shopSlug: string) => () => void;
  unsubscribeShop: () => void;
  subscribeToServices: (shopId: string) => () => void;
  unsubscribeServices: () => void;
  subscribeToCounterStatuses: (shopId: string) => () => void;
  unsubscribeCounterStatuses: () => void;
}

let shopUnsubscribe: (() => void) | null = null;
let servicesUnsubscribe: (() => void) | null = null;
let counterStatusesUnsubscribe: (() => void) | null = null;

export const useShopStore = create<ShopState>((set, get) => ({
  shop: null,
  services: [],
  loadingShop: true,
  selectedServiceId: null,
  historicalAvgDuration: 15, // Default average duration fallback
  counterStatuses: [],

  setShop: (shop) => set({ shop }),
  setServices: (services) => set({ services }),
  setLoadingShop: (loadingShop) => set({ loadingShop }),
  setSelectedServiceId: (selectedServiceId) => set({ selectedServiceId }),
  setHistoricalAvgDuration: (historicalAvgDuration) => set({ historicalAvgDuration }),
  setCounterStatuses: (counterStatuses) => set({ counterStatuses }),
  clearShopData: () => {
    // Also unsubscribe everything
    if (shopUnsubscribe) { shopUnsubscribe(); shopUnsubscribe = null; }
    if (servicesUnsubscribe) { servicesUnsubscribe(); servicesUnsubscribe = null; }
    if (counterStatusesUnsubscribe) { counterStatusesUnsubscribe(); counterStatusesUnsubscribe = null; }

    set({
      shop: null,
      services: [],
      loadingShop: true,
      selectedServiceId: null,
      historicalAvgDuration: 15,
      counterStatuses: [],
    });
  },

  subscribeToShop: (shopSlug) => {
    if (shopUnsubscribe) {
      shopUnsubscribe();
      shopUnsubscribe = null;
    }

    set({ loadingShop: true });
    let active = true;

    // Load from IndexedDB cache immediately for instant render and offline support
    getCachedData<Shop>(`shop_${shopSlug}`).then((cachedShop) => {
      if (!active) return;
      if (cachedShop) {
        set({ shop: cachedShop, loadingShop: false });
        
        getCachedData<Service[]>(`services_${cachedShop.id}`).then((cachedServices) => {
          if (!active) return;
          if (cachedServices) {
            set({ services: cachedServices });
            if (cachedServices.length > 0 && !get().selectedServiceId) {
              set({ selectedServiceId: cachedServices[0].id });
            }
          }
        });
      }
    });

    shopUnsubscribe = shopRepository.subscribeToShop(
      shopSlug,
      (shopData) => {
        if (!active) return;

        if (!shopData) {
          set({ shop: null, loadingShop: false });
          return;
        }

        set({ shop: shopData, loadingShop: false });
        cacheData(`shop_${shopSlug}`, shopData); // Cache in IndexedDB

        // Fetch services for this shop once
        shopRepository.fetchServices(shopData.id)
          .then((servicesList) => {
            if (!active) return;
            set({ services: servicesList });
            cacheData(`services_${shopData.id}`, servicesList); // Cache in IndexedDB
            if (servicesList.length > 0 && !get().selectedServiceId) {
              set({ selectedServiceId: servicesList[0].id });
            }
          })
          .catch((err) => {
            if (active) {
              if (!navigator.onLine) {
                console.log("Offline: Using cached services");
              } else {
                handleFirestoreError(err, OperationType.GET, `services`);
              }
            }
          });
      },
      (err) => {
        if (active) {
          if (!navigator.onLine) {
            console.log("Offline: Using cached shop details");
            set({ loadingShop: false });
          } else {
            console.error("Error loading customer portal shop sub:", err);
            set({ loadingShop: false });
            handleFirestoreError(err, OperationType.GET, `shops`);
          }
        }
      }
    );

    return () => {
      active = false;
      if (shopUnsubscribe) {
        shopUnsubscribe();
        shopUnsubscribe = null;
      }
    };
  },

  unsubscribeShop: () => {
    if (shopUnsubscribe) {
      shopUnsubscribe();
      shopUnsubscribe = null;
    }
  },

  subscribeToServices: (shopId) => {
    if (servicesUnsubscribe) {
      servicesUnsubscribe();
      servicesUnsubscribe = null;
    }

    let active = true;

    servicesUnsubscribe = shopRepository.subscribeToServices(
      shopId,
      (servicesList) => {
        if (!active) return;
        set({ services: servicesList });
        cacheData(`services_${shopId}`, servicesList);
      },
      (err) => {
        console.error("Error in services real-time subscription:", err);
      }
    );

    return () => {
      active = false;
      if (servicesUnsubscribe) {
        servicesUnsubscribe();
        servicesUnsubscribe = null;
      }
    };
  },

  unsubscribeServices: () => {
    if (servicesUnsubscribe) {
      servicesUnsubscribe();
      servicesUnsubscribe = null;
    }
  },

  subscribeToCounterStatuses: (shopId) => {
    if (counterStatusesUnsubscribe) {
      counterStatusesUnsubscribe();
      counterStatusesUnsubscribe = null;
    }

    let active = true;

    counterStatusesUnsubscribe = shopRepository.subscribeToCounterStatuses(
      shopId,
      (list) => {
        if (!active) return;
        set({ counterStatuses: list });
      },
      (err) => {
        console.error("Error fetching counter statuses:", err);
      }
    );

    return () => {
      active = false;
      if (counterStatusesUnsubscribe) {
        counterStatusesUnsubscribe();
        counterStatusesUnsubscribe = null;
      }
    };
  },

  unsubscribeCounterStatuses: () => {
    if (counterStatusesUnsubscribe) {
      counterStatusesUnsubscribe();
      counterStatusesUnsubscribe = null;
    }
  }
}));

