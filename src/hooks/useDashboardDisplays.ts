import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useVendorStore } from "../store/vendor/vendorStore";

interface UseDashboardDisplaysProps {
  shopId: string;
  showConfirmation: (title: string, message: string, onConfirm: () => void) => void;
}

export function useDashboardDisplays({ shopId, showConfirmation }: UseDashboardDisplaysProps) {
  const { t } = useTranslation();

  // Atomic selectors for state
  const displays = useVendorStore((state) => state.displays);
  const editingDisplayId = useVendorStore((state) => state.editingDisplayId);
  const editingDisplayName = useVendorStore((state) => state.editingDisplayName);
  const refreshingDisplayId = useVendorStore((state) => state.refreshingDisplayId);

  // Atomic selectors for setters/actions
  const setEditingDisplayId = useVendorStore((state) => state.setEditingDisplayId);
  const setEditingDisplayName = useVendorStore((state) => state.setEditingDisplayName);
  const subscribeToDisplays = useVendorStore((state) => state.subscribeToDisplays);
  const handleRenameDisplay = useVendorStore((state) => state.handleRenameDisplay);
  const handleDeleteDisplayFromStore = useVendorStore((state) => state.handleDeleteDisplay);
  const handleRequestRefreshFromStore = useVendorStore((state) => state.handleRequestRefresh);

  // Real-time listener for Displays delegated to Zustand store
  useEffect(() => {
    if (!shopId) return;

    const unsubDisplays = subscribeToDisplays(shopId);
    return () => unsubDisplays();
  }, [shopId, subscribeToDisplays]);

  const handleUpdateDisplayName = async (displayId: string) => {
    await handleRenameDisplay(displayId);
  };

  const handleDeleteDisplay = async (displayId: string) => {
    showConfirmation(
      t("vend_delete_display_title", { defaultValue: "Remove Display Screen" }),
      t("vend_confirm_delete_display", { defaultValue: "Are you sure you want to delete this public display screen link?" }),
      async () => {
        await handleDeleteDisplayFromStore(displayId);
      }
    );
  };

  const handleRequestRefresh = async (displayId: string) => {
    await handleRequestRefreshFromStore(displayId);
  };

  return {
    displays,
    editingDisplayId,
    setEditingDisplayId,
    editingDisplayName,
    setEditingDisplayName,
    refreshingDisplayId,
    handleUpdateDisplayName,
    handleDeleteDisplay,
    handleRequestRefresh
  };
}
