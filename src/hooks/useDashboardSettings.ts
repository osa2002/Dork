import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useVendorStore } from "../store/vendor/vendorStore";
import { vendorStorageService } from "../services/vendorStorageService";
import { getAppOrigin } from "../lib/originUtils";

interface UseDashboardSettingsProps {
  shopId: string;
}

export function useDashboardSettings({ shopId }: UseDashboardSettingsProps) {
  const { t } = useTranslation();

  // Selected state from Zustand store
  const shop = useVendorStore((state) => state.shop);
  const loading = useVendorStore((state) => state.shopLoading);

  const editShopName = useVendorStore((state) => state.editShopName);
  const editShopLogoText = useVendorStore((state) => state.editShopLogoText);
  const editShopCategory = useVendorStore((state) => state.editShopCategory);
  const editShopLogoUrl = useVendorStore((state) => state.editShopLogoUrl);
  const editShopTicketColor = useVendorStore((state) => state.editShopTicketColor);
  const editDisplayBgTheme = useVendorStore((state) => state.editDisplayBgTheme);
  const editDisplayAnimatedBg = useVendorStore((state) => state.editDisplayAnimatedBg);
  const settingsSaving = useVendorStore((state) => state.settingsSaving);

  const workingHoursEnabled = useVendorStore((state) => state.workingHoursEnabled);
  const workingHoursDays = useVendorStore((state) => state.workingHoursDays);

  const counterStatus = useVendorStore((state) => state.counterStatus);

  // Selected actions from Zustand store
  const subscribeToShop = useVendorStore((state) => state.subscribeToShop);
  const setEditShopName = useVendorStore((state) => state.setEditShopName);
  const setEditShopLogoText = useVendorStore((state) => state.setEditShopLogoText);
  const setEditShopCategory = useVendorStore((state) => state.setEditShopCategory);
  const setEditShopLogoUrl = useVendorStore((state) => state.setEditShopLogoUrl);
  const setEditShopTicketColor = useVendorStore((state) => state.setEditShopTicketColor);
  const setEditDisplayBgTheme = useVendorStore((state) => state.setEditDisplayBgTheme);
  const setEditDisplayAnimatedBg = useVendorStore((state) => state.setEditDisplayAnimatedBg);
  const setWorkingHoursEnabled = useVendorStore((state) => state.setWorkingHoursEnabled);
  const setWorkingHoursDays = useVendorStore((state) => state.setWorkingHoursDays);

  const activeCounterNumber = useVendorStore((state) => state.activeCounterNumber);
  const setActiveCounterNumberStore = useVendorStore((state) => state.setActiveCounterNumber);

  const setCounterStatusStore = useVendorStore((state) => state.setCounterStatus);
  const updateCounterStatusStore = useVendorStore((state) => state.updateCounterStatus);
  const handleSaveSettings = useVendorStore((state) => state.handleSaveSettings);

  // Transient UI states
  const [dragActive, setDragActive] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync activeCounterNumber with storage on mount/change
  useEffect(() => {
    if (!shopId) return;
    const stored = vendorStorageService.getItem(`dork_active_counter_${shopId}`) || "1";
    setActiveCounterNumberStore(stored);
  }, [shopId, setActiveCounterNumberStore]);

  const setActiveCounterNumber = (val: string) => {
    setActiveCounterNumberStore(val);
    vendorStorageService.setItem(`dork_active_counter_${shopId}`, val);
  };

  // Real-time listener for Shop
  useEffect(() => {
    if (!shopId) return;
    const unsubShop = subscribeToShop(shopId);
    return () => unsubShop();
  }, [shopId, subscribeToShop]);

  // Set Counter online status on mount
  useEffect(() => {
    if (!shopId || !activeCounterNumber) return;
    const updateStatusOnMount = async () => {
      try {
        await updateCounterStatusStore(shopId, activeCounterNumber, "online");
        setCounterStatusStore("online");
      } catch (err) {
        console.error("Error setting initial counter status:", err);
      }
    };
    updateStatusOnMount();
  }, [shopId, activeCounterNumber, updateCounterStatusStore, setCounterStatusStore]);

  const updateCounterStatus = async (newStatus: "online" | "busy" | "break" | "offline") => {
    setCounterStatusStore(newStatus);
    try {
      await updateCounterStatusStore(shopId, activeCounterNumber, newStatus);
    } catch (err) {
      console.error("Error updating counter status:", err);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await handleSaveSettings(shopId);
      alert(t("vend_settings_saved_success", { defaultValue: "Shop settings saved successfully!" }));
    } catch (err: any) {
      alert(t("vend_err_saving_settings", { defaultValue: "An error occurred while saving settings." }));
    }
  };

  // Logo uploading file readers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert(t("vend_err_image_only", { defaultValue: "Please select an image file only." }));
      return;
    }
    if (file.size > 1024 * 1024) {
      alert(t("vend_err_image_too_large", { defaultValue: "Image is too large! Please select an image under 1MB." }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setEditShopLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleCopyLink = () => {
    if (!shop?.slug) return;
    const url = `${getAppOrigin()}/portal/${encodeURIComponent(shop.slug)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error("Failed to copy link:", err);
    });
  };

  const handleDownloadQR = () => {
    if (!shop?.slug) return;
    const qrImg = document.querySelector("#qr-code-element img") as HTMLImageElement;
    if (!qrImg) return;
    
    // If it's already a local base64/data URI, download it instantly without fetching
    if (qrImg.src.startsWith("data:")) {
      const link = document.createElement("a");
      link.href = qrImg.src;
      link.download = `customer_portal_qr_${shop.slug}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    
    fetch(qrImg.src)
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `customer_portal_qr_${shop.slug}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      })
      .catch(err => {
        console.error("Failed to download QR code via fetch:", err);
        const link = document.createElement("a");
        link.href = qrImg.src;
        link.target = "_blank";
        link.download = `customer_portal_qr_${shop.slug}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
  };

  return {
    shop,
    loading,
    editShopName,
    setEditShopName,
    editShopLogoText,
    setEditShopLogoText,
    editShopCategory,
    setEditShopCategory,
    editShopLogoUrl,
    setEditShopLogoUrl,
    editShopTicketColor,
    setEditShopTicketColor,
    editDisplayBgTheme,
    setEditDisplayBgTheme,
    editDisplayAnimatedBg,
    setEditDisplayAnimatedBg,
    settingsSaving,
    dragActive,
    setDragActive,
    workingHoursEnabled,
    setWorkingHoursEnabled,
    workingHoursDays,
    setWorkingHoursDays,
    activeCounterNumber,
    setActiveCounterNumber,
    counterStatus,
    updateCounterStatus,
    handleUpdateSettings,
    handleDrag,
    handleDrop,
    handleFileChange,
    copied,
    handleCopyLink,
    handleDownloadQR
  };
}
