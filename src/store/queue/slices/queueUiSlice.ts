import { StateCreator } from "zustand";
import { QueueState, QueueUiSlice } from "../types";
import { storageService } from "../services/storageService";

/**
 * queueUiSlice
 * 
 * Responsibility: Manages user interface states, such as operation loaders
 * (joining), error banners (errorMessage, showAlert), and AI estimate feedback
 * states (aiEstimateLoading, aiEstimateMessage). Isolating these from data slice
 * prevents unnecessary UI rerenders of core business entities.
 */
export const createQueueUiSlice: StateCreator<
  QueueState,
  [],
  [],
  QueueUiSlice
> = (set) => ({
  joining: false,
  isOnline: storageService.getOnlineStatus(),
  errorMessage: null,
  showAlert: false,
  aiEstimateLoading: false,
  aiEstimateMessage: "",

  setJoining: (joining) => set({ joining }),
  setIsOnline: (isOnline) => set({ isOnline }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setShowAlert: (showAlert) => set({ showAlert }),
  setAiEstimateLoading: (aiEstimateLoading) => set({ aiEstimateLoading }),
  setAiEstimateMessage: (aiEstimateMessage) => set({ aiEstimateMessage }),
});
