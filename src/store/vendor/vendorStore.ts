import { create } from "zustand";
import { VendorState } from "./types";
import { createVendorShopSlice } from "./slices/vendorShopSlice";
import { createVendorQueueSlice } from "./slices/vendorQueueSlice";
import { createVendorServiceSlice } from "./slices/vendorServiceSlice";
import { createVendorDisplaySlice } from "./slices/vendorDisplaySlice";
import { createVendorBillingSlice } from "./slices/vendorBillingSlice";
import { createVendorAnalyticsSlice } from "./slices/vendorAnalyticsSlice";
import { createVendorSettingsSlice } from "./slices/vendorSettingsSlice";

/**
 * useVendorStore
 * 
 * Main orchestrator store for the vendor/business portal system.
 * Synthesizes several sub-slices following the modular Zustand Slice Pattern:
 * - vendorShopSlice: Shop configuration state, real-time metadata syncing.
 * - vendorQueueSlice: Live ticketing list, calling lists, status transitions.
 * - vendorServiceSlice: Departments, active services management.
 * - vendorDisplaySlice: Screen configurations, refresh states.
 * - vendorBillingSlice: Stripe connections, subscription models, mock logs.
 * - vendorAnalyticsSlice: Daily queue metrics, diagnostic models, AI reports.
 * - vendorSettingsSlice: Complete system, working schedules, audio/voice notification setups.
 */
export const useVendorStore = create<VendorState>()((...args) => ({
  ...createVendorShopSlice(...args),
  ...createVendorQueueSlice(...args),
  ...createVendorServiceSlice(...args),
  ...createVendorDisplaySlice(...args),
  ...createVendorBillingSlice(...args),
  ...createVendorAnalyticsSlice(...args),
  ...createVendorSettingsSlice(...args),
}));

export * from "./types";
