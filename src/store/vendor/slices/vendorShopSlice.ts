import { StateCreator } from "zustand";
import { VendorState, VendorShopSlice } from "../types";
import { vendorShopRepository } from "../../../repositories/vendorShopRepository";
import { Shop } from "../../../types";

export const createVendorShopSlice: StateCreator<
  VendorState,
  [],
  [],
  VendorShopSlice
> = (set) => ({
  shop: null,
  shopLoading: true,
  shopError: null,

  setShop: (shop) => set({ shop }),
  setShopLoading: (shopLoading) => set({ shopLoading }),
  setShopError: (shopError) => set({ shopError }),

  subscribeToShop: (shopId: string) => {
    set({ shopLoading: true, shopError: null });
    const unsub = vendorShopRepository.subscribeToShop(
      shopId,
      (data) => {
        let category = "other";
        const rawCat = data.category ? String(data.category).toLowerCase() : "";
        if (
          rawCat.includes("barber") ||
          rawCat.includes("salon") ||
          rawCat.includes("حلاق") ||
          rawCat.includes("تجميل")
        ) {
          category = "barber";
        } else if (
          rawCat.includes("medical") ||
          rawCat.includes("clinic") ||
          rawCat.includes("عيادة") ||
          rawCat.includes("طبي")
        ) {
          category = "medical";
        } else if (
          rawCat.includes("government") ||
          rawCat.includes("office") ||
          rawCat.includes("حكومي") ||
          rawCat.includes("مكتب")
        ) {
          category = "government";
        } else if (
          rawCat.includes("telecom") ||
          rawCat.includes("retail") ||
          rawCat.includes("اتصالات") ||
          rawCat.includes("تجزئة")
        ) {
          category = "telecom";
        } else if (
          rawCat.includes("restaurant") ||
          rawCat.includes("cafe") ||
          rawCat.includes("café") ||
          rawCat.includes("مطعم") ||
          rawCat.includes("مقهى")
        ) {
          category = "food";
        }

        set({
          shop: data,
          shopLoading: false,
          editShopName: data.name || "",
          editShopLogoText: data.logoText || "",
          editShopCategory: category,
          editShopLogoUrl: data.logoUrl || "",
          editShopTicketColor: data.ticketColor || "#4f46e5",
          workingHoursEnabled: data.workingHours?.enabled || false,
          workingHoursDays: data.workingHours?.days || {
            "0": { enabled: true, open: "09:00", close: "22:00" },
            "1": { enabled: true, open: "09:00", close: "22:00" },
            "2": { enabled: true, open: "09:00", close: "22:00" },
            "3": { enabled: true, open: "09:00", close: "22:00" },
            "4": { enabled: true, open: "09:00", close: "22:00" },
            "5": { enabled: false, open: "09:00", close: "22:00" },
            "6": { enabled: false, open: "09:00", close: "22:00" },
          },
        });
      },
      (error) => {
        console.error("Error in subscribeToShop inside slice:", error);
        set({ shopLoading: false, shopError: error.message || "Failed to load shop." });
      }
    );
    return unsub;
  },

  updateShopSettings: async (shopId: string, updates: Partial<Shop>) => {
    try {
      await vendorShopRepository.updateShopSettings(shopId, updates);
    } catch (error: any) {
      console.error("Error in updateShopSettings inside slice:", error);
      throw error;
    }
  },

  updateCounterStatus: async (
    shopId: string,
    counterNumber: string,
    status: "online" | "busy" | "break" | "offline"
  ) => {
    try {
      await vendorShopRepository.updateCounterStatus(shopId, counterNumber, status);
    } catch (error: any) {
      console.error("Error in updateCounterStatus inside slice:", error);
      throw error;
    }
  },
});

