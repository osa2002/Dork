import { StateCreator } from "zustand";
import { VendorState, VendorServiceSlice } from "../types";
import { handleFirestoreError, OperationType } from "../../../lib/firebase";
import { vendorServiceRepository } from "../../../repositories/vendorServiceRepository";

let servicesUnsubscribe: (() => void) | null = null;

export const createVendorServiceSlice: StateCreator<
  VendorState,
  [],
  [],
  VendorServiceSlice
> = (set, get) => ({
  // Initial state
  services: [],
  serviceActionLoading: false,
  newServiceName: "",
  newServiceDuration: 15,

  // Setters
  setServices: (services) => set({ services }),
  setServiceActionLoading: (serviceActionLoading) => set({ serviceActionLoading }),
  setNewServiceName: (newServiceName) => set({ newServiceName }),
  setNewServiceDuration: (newServiceDuration) => set({ newServiceDuration }),

  // Actions
  subscribeToServices: (shopId: string) => {
    // Prevent duplicate subscriptions
    if (servicesUnsubscribe) {
      servicesUnsubscribe();
      servicesUnsubscribe = null;
    }

    set({ serviceActionLoading: true });

    servicesUnsubscribe = vendorServiceRepository.subscribeToServices(
      shopId,
      (servicesList) => {
        // Sort services if needed (e.g., by creation date or name to keep it consistent)
        const sorted = [...servicesList].sort((a, b) => {
          const dateA = a.createdAt || "";
          const dateB = b.createdAt || "";
          return dateA.localeCompare(dateB);
        });
        set({ services: sorted, serviceActionLoading: false });
      },
      (error) => {
        console.error("Error listening to services in store:", error);
        set({ serviceActionLoading: false });
        handleFirestoreError(error, OperationType.GET, `services`);
      }
    );

    return () => {
      if (servicesUnsubscribe) {
        servicesUnsubscribe();
        servicesUnsubscribe = null;
      }
    };
  },

  addService: async (shopId: string) => {
    const { newServiceName, newServiceDuration } = get();
    const nameTrimmed = newServiceName.trim();
    if (!nameTrimmed) return;

    set({ serviceActionLoading: true });
    try {
      await vendorServiceRepository.addService(shopId, nameTrimmed, Number(newServiceDuration));
      set({
        newServiceName: "",
        newServiceDuration: 15
      });
    } catch (err) {
      console.error("Error adding service inside store slice:", err);
      handleFirestoreError(err, OperationType.WRITE, `services`);
    } finally {
      set({ serviceActionLoading: false });
    }
  },

  handleToggleService: async (serviceId: string, currentStatus: boolean) => {
    try {
      await vendorServiceRepository.toggleServiceStatus(serviceId, !currentStatus);
    } catch (err) {
      console.error("Error toggling service status inside store slice:", err);
      handleFirestoreError(err, OperationType.UPDATE, `services/${serviceId}`);
    }
  },

  handleDeleteService: async (serviceId: string) => {
    try {
      await vendorServiceRepository.deleteService(serviceId);
    } catch (err) {
      console.error("Error deleting service inside store slice:", err);
      handleFirestoreError(err, OperationType.DELETE, `services/${serviceId}`);
    }
  }
});
