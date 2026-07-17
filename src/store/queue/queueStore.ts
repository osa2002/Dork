import { create } from "zustand";
import { QueueState } from "./types";
import { createQueueDataSlice } from "./slices/queueDataSlice";
import { createQueueUiSlice } from "./slices/queueUiSlice";
import { createQueueSubscriptionSlice } from "./slices/queueSubscriptionSlice";
import { createQueueSyncSlice } from "./slices/queueSyncSlice";
import { createQueueActionsSlice } from "./slices/queueActionsSlice";

/**
 * useQueueStore
 * 
 * Main orchestrator store for the customer queue system.
 * Synthesizes several sub-slices following the modular Zustand Slice Pattern:
 * - queueDataSlice: Core business models and tickets cache
 * - queueUiSlice: UI alerts, error states, and operation loaders
 * - queueSubscriptionSlice: Firestore real-time listener hooks
 * - queueSyncSlice: Offline cache synchronization
 * - queueActionsSlice: Main queue join, leave, and cancellation operations
 */
export const useQueueStore = create<QueueState>()((...args) => ({
  ...createQueueDataSlice(...args),
  ...createQueueUiSlice(...args),
  ...createQueueSubscriptionSlice(...args),
  ...createQueueSyncSlice(...args),
  ...createQueueActionsSlice(...args),
}));

export * from "./types";
export * from "./services/audioService";
export * from "./services/vibrationService";
export * from "./services/notificationService";
export * from "./services/storageService";
export * from "./utils/queueHelpers";
