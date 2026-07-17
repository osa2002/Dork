import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useVendorStore } from "../store/vendor/vendorStore";

interface UseDashboardServicesProps {
  shopId: string;
  showConfirmation: (title: string, message: string, onConfirm: () => void) => void;
}

export function useDashboardServices({ shopId, showConfirmation }: UseDashboardServicesProps) {
  const { t } = useTranslation();

  // Atomic Zustand Store Selectors
  const services = useVendorStore((state) => state.services);
  const newServiceName = useVendorStore((state) => state.newServiceName);
  const newServiceDuration = useVendorStore((state) => state.newServiceDuration);
  const serviceActionLoading = useVendorStore((state) => state.serviceActionLoading);

  // Atomic Action Selectors
  const setNewServiceName = useVendorStore((state) => state.setNewServiceName);
  const setNewServiceDuration = useVendorStore((state) => state.setNewServiceDuration);
  const subscribeToServices = useVendorStore((state) => state.subscribeToServices);
  const addService = useVendorStore((state) => state.addService);
  const storeHandleToggleService = useVendorStore((state) => state.handleToggleService);
  const storeHandleDeleteService = useVendorStore((state) => state.handleDeleteService);

  // Real-time listener for Services delegated to Zustand store
  useEffect(() => {
    if (!shopId) return;

    const unsubServices = subscribeToServices(shopId);
    return () => unsubServices();
  }, [shopId, subscribeToServices]);

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    await addService(shopId);
  };

  const handleToggleService = async (serviceId: string, currentStatus: boolean) => {
    await storeHandleToggleService(serviceId, currentStatus);
  };

  const handleDeleteService = async (serviceId: string) => {
    showConfirmation(
      t("vend_delete_service_title", { defaultValue: "Delete Service" }),
      t("vend_confirm_delete_service", { defaultValue: "Are you sure you want to delete this service?" }),
      async () => {
        await storeHandleDeleteService(serviceId);
      }
    );
  };

  return {
    services,
    newServiceName,
    setNewServiceName,
    newServiceDuration,
    setNewServiceDuration,
    serviceActionLoading,
    handleAddService,
    handleToggleService,
    handleDeleteService
  };
}
