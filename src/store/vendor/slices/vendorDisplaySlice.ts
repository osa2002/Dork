import { StateCreator } from "zustand";
import { VendorState, VendorDisplaySlice } from "../types";
import { handleFirestoreError, OperationType } from "../../../lib/firebase";
import { vendorDisplayRepository } from "../../../repositories/vendorDisplayRepository";

let displaysUnsubscribe: (() => void) | null = null;

export const createVendorDisplaySlice: StateCreator<
  VendorState,
  [],
  [],
  VendorDisplaySlice
> = (set, get) => ({
  displays: [],
  editingDisplayId: null,
  editingDisplayName: "",
  refreshingDisplayId: null,

  setDisplays: (displays) => set({ displays }),
  setEditingDisplayId: (editingDisplayId) => set({ editingDisplayId }),
  setEditingDisplayName: (editingDisplayName) => set({ editingDisplayName }),
  setRefreshingDisplayId: (refreshingDisplayId) => set({ refreshingDisplayId }),

  subscribeToDisplays: (shopId: string) => {
    if (displaysUnsubscribe) {
      displaysUnsubscribe();
      displaysUnsubscribe = null;
    }

    displaysUnsubscribe = vendorDisplayRepository.subscribeToDisplays(
      shopId,
      (displaysList) => {
        set({ displays: displaysList });
      },
      (error) => {
        console.error("Error listening to displays in store:", error);
        handleFirestoreError(error, OperationType.GET, `displays`);
      }
    );

    return () => {
      if (displaysUnsubscribe) {
        displaysUnsubscribe();
        displaysUnsubscribe = null;
      }
    };
  },

  handleRenameDisplay: async (displayId: string) => {
    const { editingDisplayName } = get();
    if (!editingDisplayName.trim()) return;

    try {
      await vendorDisplayRepository.updateDisplayName(displayId, editingDisplayName.trim());
      set({ editingDisplayId: null, editingDisplayName: "" });
    } catch (err) {
      console.error("Error renaming display:", err);
      handleFirestoreError(err, OperationType.UPDATE, `displays/${displayId}`);
    }
  },

  handleDeleteDisplay: async (displayId: string) => {
    try {
      await vendorDisplayRepository.deleteDisplay(displayId);
    } catch (err) {
      console.error("Error deleting display:", err);
      handleFirestoreError(err, OperationType.DELETE, `displays/${displayId}`);
    }
  },

  handleRequestRefresh: async (displayId: string) => {
    set({ refreshingDisplayId: displayId });
    try {
      await vendorDisplayRepository.requestDisplayRefresh(displayId);
      setTimeout(() => {
        set({ refreshingDisplayId: null });
      }, 1000);
    } catch (err) {
      console.error("Error triggering display refresh:", err);
      set({ refreshingDisplayId: null });
      handleFirestoreError(err, OperationType.UPDATE, `displays/${displayId}`);
    }
  }
});
