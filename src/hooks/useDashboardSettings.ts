import React, { useState, useEffect } from "react";
import { 
  doc, 
  onSnapshot, 
  updateDoc, 
  setDoc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { Shop, WorkingHoursDay } from "../types";
import { useTranslation } from "react-i18next";

interface UseDashboardSettingsProps {
  shopId: string;
}

export function useDashboardSettings({ shopId }: UseDashboardSettingsProps) {
  const { t } = useTranslation();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit Shop Settings Form States
  const [editShopName, setEditShopName] = useState("");
  const [editShopLogoText, setEditShopLogoText] = useState("");
  const [editShopCategory, setEditShopCategory] = useState("");
  const [editShopLogoUrl, setEditShopLogoUrl] = useState("");
  const [editShopTicketColor, setEditShopTicketColor] = useState("#4f46e5");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Working Hours States
  const [workingHoursEnabled, setWorkingHoursEnabled] = useState(false);
  const [workingHoursDays, setWorkingHoursDays] = useState<{ [key: string]: WorkingHoursDay }>({
    "0": { enabled: true, open: "09:00", close: "22:00" },
    "1": { enabled: true, open: "09:00", close: "22:00" },
    "2": { enabled: true, open: "09:00", close: "22:00" },
    "3": { enabled: true, open: "09:00", close: "22:00" },
    "4": { enabled: true, open: "09:00", close: "22:00" },
    "5": { enabled: false, open: "09:00", close: "22:00" },
    "6": { enabled: false, open: "09:00", close: "22:00" }
  });

  // Active Counter / Window States (with connection checks)
  const [activeCounterNumber, setActiveCounterNumber] = useState<string>(() => {
    return localStorage.getItem(`dork_active_counter_${shopId}`) || "1";
  });
  const [counterStatus, setCounterStatus] = useState<"online" | "busy" | "break" | "offline">("online");

  // Real-time listener for Shop
  useEffect(() => {
    if (!shopId) return;

    const shopDocRef = doc(db, "shops", shopId);
    const unsubShop = onSnapshot(shopDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Shop;
        setShop(data);
        setEditShopName(data.name);
        setEditShopLogoText(data.logoText || "");

        const rawCat = data.category ? String(data.category).toLowerCase() : "";
        if (rawCat.includes("barber") || rawCat.includes("salon") || rawCat.includes("حلاق") || rawCat.includes("تجميل")) {
          setEditShopCategory("barber");
        } else if (rawCat.includes("medical") || rawCat.includes("clinic") || rawCat.includes("عيادة") || rawCat.includes("طبي")) {
          setEditShopCategory("medical");
        } else if (rawCat.includes("government") || rawCat.includes("office") || rawCat.includes("حكومي") || rawCat.includes("مكتب")) {
          setEditShopCategory("government");
        } else if (rawCat.includes("telecom") || rawCat.includes("retail") || rawCat.includes("اتصالات") || rawCat.includes("تجزئة")) {
          setEditShopCategory("telecom");
        } else if (rawCat.includes("restaurant") || rawCat.includes("cafe") || rawCat.includes("café") || rawCat.includes("مطعم") || rawCat.includes("مقهى")) {
          setEditShopCategory("food");
        } else {
          setEditShopCategory("other");
        }

        setEditShopLogoUrl(data.logoUrl || "");
        setEditShopTicketColor(data.ticketColor || "#4f46e5");
        if (data.workingHours) {
          setWorkingHoursEnabled(data.workingHours.enabled);
          if (data.workingHours.days) {
            setWorkingHoursDays(data.workingHours.days);
          }
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to shop:", error);
      handleFirestoreError(error, OperationType.GET, `shops/${shopId}`);
    });

    return () => unsubShop();
  }, [shopId]);

  // Set Counter online status on mount
  useEffect(() => {
    if (!shopId || !activeCounterNumber) return;
    const updateStatusOnMount = async () => {
      try {
        const docId = `${shopId}_${activeCounterNumber}`;
        await setDoc(doc(db, "counter_statuses", docId), {
          shopId,
          counterNumber: activeCounterNumber,
          status: "online",
          updatedAt: new Date().toISOString()
        }, { merge: true });
        setCounterStatus("online");
      } catch (err) {
        console.error("Error setting initial counter status:", err);
      }
    };
    updateStatusOnMount();
  }, [shopId, activeCounterNumber]);

  const updateCounterStatus = async (newStatus: "online" | "busy" | "break" | "offline") => {
    setCounterStatus(newStatus);
    try {
      const docId = `${shopId}_${activeCounterNumber}`;
      await setDoc(doc(db, "counter_statuses", docId), {
        shopId,
        counterNumber: activeCounterNumber,
        status: newStatus,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Error updating counter status:", err);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editShopName.trim()) return;

    setSettingsSaving(true);
    try {
      const shopDocRef = doc(db, "shops", shopId);
      await updateDoc(shopDocRef, {
        name: editShopName.trim(),
        logoText: editShopLogoText.trim(),
        category: editShopCategory,
        logoUrl: editShopLogoUrl.trim(),
        ticketColor: editShopTicketColor,
        workingHours: {
          enabled: workingHoursEnabled,
          days: workingHoursDays
        }
      });
      alert(t("vend_settings_saved_success", { defaultValue: "Shop settings saved successfully!" }));
    } catch (err) {
      console.error("Error updating settings:", err);
      alert(t("vend_err_saving_settings", { defaultValue: "An error occurred while saving settings." }));
      handleFirestoreError(err, OperationType.UPDATE, `shops/${shopId}`);
    } finally {
      setSettingsSaving(false);
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

  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (!shop?.slug) return;
    const url = `${window.location.origin}/portal/${shop.slug}`;
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
    const link = document.createElement("a");
    link.href = qrImg.src;
    link.download = `customer_portal_qr_${shop.slug}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    settingsSaving,
    dragActive,
    setDragActive,
    workingHoursEnabled,
    setWorkingHoursEnabled,
    workingHoursDays,
    setWorkingHoursDays,
    activeCounterNumber,
    setActiveCounterNumber: (val: string) => {
      setActiveCounterNumber(val);
      localStorage.setItem(`dork_active_counter_${shopId}`, val);
    },
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
