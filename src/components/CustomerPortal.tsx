import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc,
  runTransaction, orderBy, limit
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType, getFirebaseMessaging } from "../lib/firebase";
import { getToken } from "firebase/messaging";
import { Shop, Service, Ticket } from "../types";
import { playChime } from "../lib/audio";
import { cacheData, getCachedData, addPendingTicket, getPendingTickets, deletePendingTicket } from "../lib/offlineDb";
import { 
  Users, 
  Clock, 
  WifiOff, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Volume2,
  VolumeX,
  Ticket as TicketIcon,
  Smile,
  Loader2,
  Smartphone,
  Download,
  Bell,
  Sun,
  Moon,
  Calendar,
  Star,
  ArrowUp,
  Share2,
  Copy,
  Check,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  Wrench,
  Battery
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import LanguageSwitcher from "./LanguageSwitcher";
import { LimitAlertDialog } from "./LimitAlertDialog";

const isShopClosed = (shop: Shop | null) => {
  if (!shop || !shop.workingHours || !shop.workingHours.enabled) return false;

  const now = new Date();
  const dayIndex = String(now.getDay()); // "0" to "6"
  const dayConfig = shop.workingHours.days?.[dayIndex];

  if (!dayConfig || !dayConfig.enabled) {
    return true;
  }

  // Parse open and close times
  const [openH, openM] = dayConfig.open.split(":").map(Number);
  const [closeH, closeM] = dayConfig.close.split(":").map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  if (closeMinutes < openMinutes) {
    // Overnight hours e.g. 18:00 to 02:00
    return currentMinutes < openMinutes && currentMinutes > closeMinutes;
  }

  return currentMinutes < openMinutes || currentMinutes > closeMinutes;
};

function getClientStartOfTodayInTimezone(timezone: string): Date {
  try {
    const tzParts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).formatToParts(new Date());

    const year = parseInt(tzParts.find(p => p.type === 'year')!.value, 10);
    const month = parseInt(tzParts.find(p => p.type === 'month')!.value, 10) - 1;
    const day = parseInt(tzParts.find(p => p.type === 'day')!.value, 10);

    const testDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
    const testParts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false
    }).formatToParts(testDate);

    const tYear = parseInt(testParts.find(p => p.type === 'year')!.value, 10);
    const tMonth = parseInt(testParts.find(p => p.type === 'month')!.value, 10) - 1;
    const tDay = parseInt(testParts.find(p => p.type === 'day')!.value, 10);
    const tHour = parseInt(testParts.find(p => p.type === 'hour')!.value, 10);
    const tMinute = parseInt(testParts.find(p => p.type === 'minute')!.value, 10);

    const localTimeMs = Date.UTC(tYear, tMonth, tDay, tHour, tMinute, 0);
    const utcTimeMs = testDate.getTime();
    const offsetMs = localTimeMs - utcTimeMs;

    const localMidnightMs = Date.UTC(year, month, day, 0, 0, 0);
    const utcMidnightMs = localMidnightMs - offsetMs;

    return new Date(utcMidnightMs);
  } catch (err) {
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
}

interface CounterStatus {
  id: string;
  shopId: string;
  counterNumber: string;
  status: "online" | "busy" | "break" | "offline";
  updatedAt: string;
}

interface CustomerPortalProps {
  shopSlug: string;
  onBackToHome: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
}

export default function CustomerPortal({ shopSlug, onBackToHome, isDarkMode, setIsDarkMode }: CustomerPortalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  const translateCategory = (cat: string): string => {
    if (!cat) return "";
    const lower = cat.toLowerCase();
    if (lower.includes("barber") || lower.includes("salon") || lower.includes("حلاق") || lower.includes("تجميل")) {
      return t("vend_business_category_barber", { defaultValue: "Barbershop / Salon" });
    }
    if (lower.includes("medical") || lower.includes("clinic") || lower.includes("عيادة") || lower.includes("طبي")) {
      return t("vend_business_category_medical", { defaultValue: "Medical Clinic" });
    }
    if (lower.includes("government") || lower.includes("office") || lower.includes("حكومي") || lower.includes("مكتب")) {
      return t("vend_business_category_government", { defaultValue: "Government / Offices" });
    }
    if (lower.includes("telecom") || lower.includes("retail") || lower.includes("اتصالات") || lower.includes("تجزئة")) {
      return t("vend_business_category_telecom", { defaultValue: "Telecom & Retail" });
    }
    if (lower.includes("restaurant") || lower.includes("cafe") || lower.includes("café") || lower.includes("مطعم") || lower.includes("مقهى")) {
      return t("vend_business_category_food", { defaultValue: "Restaurant / Café" });
    }
    if (lower.includes("library") || lower.includes("مكتبة")) {
      return t("vend_business_category_other", { defaultValue: "Other Services" });
    }
    return cat;
  };

  const [shop, setShop] = useState<Shop | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [counterStatuses, setCounterStatuses] = useState<CounterStatus[]>([]);
  const [myTicket, setMyTicket] = useState<Ticket | null>(null);
  const [todayTickets, setTodayTickets] = useState<Ticket[]>([]);
  const [historicalAvgDuration, setHistoricalAvgDuration] = useState<number | null>(null);
  const [aiEstimateMessage, setAiEstimateMessage] = useState<string | null>(null);
  const [aiEstimateLoading, setAiEstimateLoading] = useState(false);
  const [initialPeopleInFront, setInitialPeopleInFront] = useState<number>(0);

  
  // Loading states
  const [loadingShop, setLoadingShop] = useState(true);
  const [joining, setJoining] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showAlert, setShowAlert] = useState(false);

  // Connection status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Form states
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [emailNotify, setEmailNotify] = useState(false);
  const [smsNotify, setSmsNotify] = useState(false);
  const [whatsappNotify, setWhatsappNotify] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");

  // Future Booking / Appointment Scheduling States
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  // Automatically enable SMS & WhatsApp notifications when a phone number is entered
  useEffect(() => {
    const cleaned = customerPhone.trim();
    if (cleaned.length >= 8) {
      setSmsNotify(true);
      setWhatsappNotify(true);
    } else {
      setSmsNotify(false);
      setWhatsappNotify(false);
    }
  }, [customerPhone]);

  // Customer Feedback / Rating states
  const [rating, setRating] = useState<number>(0);
  const [ratingHover, setRatingHover] = useState<number>(0);
  const [ratingSpeed, setRatingSpeed] = useState<number>(0);
  const [ratingSpeedHover, setRatingSpeedHover] = useState<number>(0);
  const [ratingQuality, setRatingQuality] = useState<number>(0);
  const [ratingQualityHover, setRatingQualityHover] = useState<number>(0);
  const [showFeedbackForm, setShowFeedbackForm] = useState<boolean>(false);
  const [ratingComment, setRatingComment] = useState<string>("");
  const [submittingRating, setSubmittingRating] = useState<boolean>(false);
  const [ratingSuccess, setRatingSuccess] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [showPwaModal, setShowPwaModal] = useState<boolean>(false);

  const getDirectTicketUrl = () => {
    if (!myTicket || !shop) return "";
    return `${window.location.origin}/?shop=${shop.slug}&ticketId=${myTicket.id}`;
  };

  const handleCopyLink = () => {
    const url = getDirectTicketUrl();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch((err) => {
      console.error("Failed to copy direct url:", err);
    });
  };

  const handleShareLink = () => {
    setShowShareModal(true);
  };

  // Track previous status to detect "calling" transition
  const prevStatusRef = useRef<string | null>(null);
  const prevPeopleInFrontRef = useRef<number | null>(null);

  // Keep track of the active ticket real-time listener to prevent memory leaks and state overriding
  const unsubTicketRef = useRef<(() => void) | null>(null);

  const unsubscribeFromTicket = () => {
    if (unsubTicketRef.current) {
      console.log("[CustomerPortal] Unsubscribing from active ticket listener.");
      unsubTicketRef.current();
      unsubTicketRef.current = null;
    }
  };

  // Browser Push Notification state
  const [pushPermission, setPushPermission] = useState<string>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });
  const [hasShownApproachingPush, setHasShownApproachingPush] = useState(false);
  const [hasShownOneInFrontFcm, setHasShownOneInFrontFcm] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [inAppAlert, setInAppAlert] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: "approaching" | "next" | null;
  }>({
    show: false,
    title: "",
    message: "",
    type: null,
  });

  const [openTroubleshootBrand, setOpenTroubleshootBrand] = useState<string | null>(null);
  const [showDiagnosticsPanel, setShowDiagnosticsPanel] = useState<boolean>(false);

  const fetchFcmToken = async () => {
    try {
      const messaging = await getFirebaseMessaging();
      if (!messaging) {
        console.warn("FCM Messaging is not supported or failed to initialize.");
        return null;
      }

      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        // Standard Web Push requires service workers, we register token
        const token = await getToken(messaging);
        if (token) {
          console.log("FCM Token retrieved successfully:", token);
          setFcmToken(token);
          return token;
        }
      }
    } catch (err) {
      console.warn("Could not retrieve FCM token:", err);
    }
    return null;
  };

  // Sound alerts configuration
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("dork_sound_enabled") !== "false";
    }
    return true;
  });

  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const [showScrollFab, setShowScrollFab] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 200 && myTicket) {
        setShowScrollFab(true);
      } else {
        setShowScrollFab(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [myTicket]);

  const handleToggleSound = () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    localStorage.setItem("dork_sound_enabled", String(newVal));
    if (newVal) {
      playChime();
    }
  };

  const handleRequestPushPermission = async () => {
    if (!("Notification" in window)) {
      alert(isRtl ? "متصفحك لا يدعم الإشعارات المباشرة." : "Your browser does not support push notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    setPushPermission(permission);
    if (permission === "granted") {
      try {
        new Notification(isRtl ? "تم تفعيل الإشعارات بنجاح! 🔔" : "Notifications enabled successfully! 🔔", {
          body: isRtl ? "سنقوم بتنبيهك فور اقتراب دورك في الطابور." : "We will alert you once your turn is approaching.",
        });
      } catch (err: any) {
        console.warn("Could not instantiate Notification directly on this device:", err.message);
      }

      // Fetch FCM token and update the ticket
      const token = await fetchFcmToken();
      if (token && myTicket) {
        try {
          const ticketRef = doc(db, "tickets", myTicket.id);
          await updateDoc(ticketRef, { fcmToken: token });
          console.log("[FCM] Successfully updated ticket with FCM registration token.");
        } catch (err) {
          console.error("[FCM] Error saving FCM token to ticket:", err);
        }
      }
    }
  };

  const handleSendTestNotification = () => {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(
          isRtl ? "إشعار تجريبي من دورك 🔔" : "Test Notification from Dork 🔔",
          {
            body: isRtl
              ? `هكذا ستتلقى التنبيهات الفورية من متصفحك فور اقتراب دورك لدى ${shop?.name || ""}.`
              : `This is how you will receive instant alerts from your browser when your turn approaches at ${shop?.name || ""}.`,
            icon: "/favicon.ico",
          }
        );
      } catch (err: any) {
        console.warn("Could not instantiate test Notification:", err.message);
      }
    }
  };

  // Automatically fetch FCM token and sync to Firestore ticket if already granted permission
  useEffect(() => {
    if (myTicket && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted" && !fcmToken) {
      fetchFcmToken().then((token) => {
        if (token && myTicket) {
          const ticketRef = doc(db, "tickets", myTicket.id);
          updateDoc(ticketRef, { fcmToken: token }).catch((err) => {
            console.error("[FCM] Error auto-updating FCM token on ticket:", err);
          });
        }
      });
    }
  }, [myTicket?.id, fcmToken]);

  // Sync basic ticket data to Service Worker for offline fallback view
  useEffect(() => {
    if (myTicket && shop && "serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "CACHE_TICKET_DATA",
        payload: {
          ...myTicket,
          shopName: shop.name,
        }
      });
    }
  }, [myTicket, shop]);

  // Listen to network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Dynamically inject custom brand primary color styles
  useEffect(() => {
    if (shop && shop.ticketColor) {
      const brandColor = shop.ticketColor;
      const styleId = "shop-custom-brand-styles";
      let styleEl = document.getElementById(styleId) as HTMLStyleElement;
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.innerHTML = `
        :root {
          --brand-primary: ${brandColor};
          --brand-primary-hover: ${brandColor}dd;
          --brand-primary-light: ${brandColor}12;
        }
        
        /* Background overrides */
        .brand-bg-primary {
          background-color: var(--brand-primary) !important;
        }
        .brand-bg-primary:hover {
          background-color: var(--brand-primary-hover) !important;
        }
        .brand-bg-light {
          background-color: var(--brand-primary-light) !important;
        }
        
        /* Text overrides */
        .brand-text-primary {
          color: var(--brand-primary) !important;
        }
        .brand-text-primary-hover:hover {
          color: var(--brand-primary) !important;
        }
        
        /* Border overrides */
        .brand-border-primary {
          border-color: var(--brand-primary) !important;
        }
        .brand-focus:focus {
          border-color: var(--brand-primary) !important;
        }
        
        /* Ring / Outline overrides */
        .brand-ring-primary:focus {
          --tw-ring-color: var(--brand-primary) !important;
        }
      `;
      return () => {
        const el = document.getElementById(styleId);
        if (el) el.remove();
      };
    }
  }, [shop]);

  // Listen to PWA installation events
  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches || 
                               (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
      if (!isStandaloneMode) {
        setShowInstallBanner(true);
      }
    };

    checkStandalone();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("User accepted PWA installation");
    }
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  // Fetch historical average duration from past completed tickets for this shop
  useEffect(() => {
    if (!shop?.id) return;
    let isMounted = true;
    const fetchHistoricalAvg = async () => {
      try {
        const q = query(
          collection(db, "tickets"),
          where("shopId", "==", shop.id),
          where("status", "==", "completed"),
          orderBy("createdAt", "desc"),
          limit(10)
        );
        const snap = await getDocs(q);
        const completedTickets = snap.docs.map(d => d.data() as Ticket).filter(t => t.completedAt && t.calledAt);
        if (completedTickets.length > 0 && isMounted) {
          const totalMin = completedTickets.reduce((acc, t) => {
            const diff = (new Date(t.completedAt).getTime() - new Date(t.calledAt).getTime()) / 60000;
            return acc + Math.max(1, diff);
          }, 0);
          setHistoricalAvgDuration(Math.round(totalMin / completedTickets.length));
        }
      } catch (err) {}
    };
    fetchHistoricalAvg();
    return () => { isMounted = false; };
  }, [shop?.id]);

  // 1. Resolve Shop from Slug
  useEffect(() => {
    if (!shopSlug) return;

    setLoadingShop(true);
    let unsubShop: (() => void) | null = null;
    let unsubTickets: (() => void) | null = null;
    let active = true;

    // Load from IndexedDB cache immediately for instant render and offline support
    getCachedData<Shop>(`shop_${shopSlug}`).then((cachedShop) => {
      if (!active) return;
      if (cachedShop) {
        setShop(cachedShop);
        setLoadingShop(false);
        
        getCachedData<Service[]>(`services_${cachedShop.id}`).then((cachedServices) => {
          if (!active) return;
          if (cachedServices) {
            setServices(cachedServices);
            if (cachedServices.length > 0 && !selectedServiceId) {
              setSelectedServiceId(cachedServices[0].id);
            }
          }
        });

        const savedTicketId = localStorage.getItem(`dork_ticket_${cachedShop.id}`);
        if (savedTicketId) {
          getCachedData<Ticket>(`my_ticket_${cachedShop.id}`).then((cachedMyTicket) => {
            if (!active) return;
            if (cachedMyTicket) {
              setMyTicket(cachedMyTicket);
            }
          });
        }

        getCachedData<Ticket[]>(`tickets_${cachedShop.id}`).then((cachedTickets) => {
          if (!active) return;
          if (cachedTickets) {
            setTodayTickets(cachedTickets);
          }
        });
      }
    });

    const shopsRef = collection(db, "shops");
    const q = query(shopsRef, where("slug", "==", shopSlug));

    unsubShop = onSnapshot(q, (querySnapshot) => {
      if (!active) return;

      if (querySnapshot.empty) {
        setShop(null);
        setLoadingShop(false);
        return;
      }

      const shopDoc = querySnapshot.docs[0];
      const shopData = shopDoc.data() as Shop;
      setShop(shopData);
      cacheData(`shop_${shopSlug}`, shopData); // Cache in IndexedDB

      // Fetch services for this shop
      const servicesQuery = query(
        collection(db, "services"), 
        where("shopId", "==", shopData.id),
        where("isActive", "==", true)
      );

      getDocs(servicesQuery).then((servSnap) => {
        if (!active) return;
        const servicesList: Service[] = [];
        servSnap.forEach((docSnap) => {
          servicesList.push(docSnap.data() as Service);
        });
        setServices(servicesList);
        cacheData(`services_${shopData.id}`, servicesList); // Cache in IndexedDB
        if (servicesList.length > 0 && !selectedServiceId) {
          setSelectedServiceId(servicesList[0].id);
        }
      }).catch((err) => {
        if (active) {
          if (!navigator.onLine) {
            console.log("Offline: Using cached services");
          } else {
            handleFirestoreError(err, OperationType.GET, `services`);
          }
        }
      });

      // Check if local ticket exists for this shop
      if (!unsubTicketRef.current) {
        const savedTicketId = localStorage.getItem(`dork_ticket_${shopData.id}`);
        if (savedTicketId) {
          if (savedTicketId.startsWith("offline_")) {
            getCachedData<Ticket>(`my_ticket_${shopData.id}`).then((cachedMyTicket) => {
              if (active && cachedMyTicket) {
                setMyTicket(cachedMyTicket);
              }
            });
          } else {
            // Subscribe to my ticket in real-time
            unsubscribeFromTicket();
            const ticketRef = doc(db, "tickets", savedTicketId);
            const unsub = onSnapshot(ticketRef, (ticketSnap) => {
              if (!active) return;
              if (ticketSnap.exists()) {
                const ticketData = ticketSnap.data() as Ticket;
                setMyTicket(ticketData);
                cacheData(`my_ticket_${shopData.id}`, ticketData); // Cache in IndexedDB

                // Detect transition to "calling" to fire sound and haptics!
                if (ticketData.status === "calling" && prevStatusRef.current !== "calling") {
                  // Trigger chime if sound is enabled
                  
                  // Trigger vibration pattern if supported
                  if ("vibrate" in navigator) {
                    navigator.vibrate([200, 100, 200, 100, 300]);
                  }

                  // Trigger browser push notification
                  if ("Notification" in window && Notification.permission === "granted") {
                    try {
                      new Notification(
                        isRtl ? `حان دورك الآن! 🔔` : `It's your turn! 🔔`,
                        {
                          body: isRtl 
                            ? (ticketData.counterNumber 
                              ? `تفضل بالتوجه إلى شباك / طاولة رقم ${ticketData.counterNumber} في ${shopData.name} فوراً.`
                              : `تفضل بالتوجه إلى كاونتر تقديم الخدمة في ${shopData.name} فوراً.`)
                            : (ticketData.counterNumber
                              ? `Please proceed to window / table number ${ticketData.counterNumber} at ${shopData.name} immediately.`
                              : `Please proceed to the service counter at ${shopData.name} immediately.`),
                          tag: "dork-turn-calling",
                          requireInteraction: true
                        }
                      );
                    } catch (err: any) {
                      console.warn("Could not instantiate Notification directly on this device:", err.message);
                    }
                  }
                }
                if (prevStatusRef.current !== null && prevStatusRef.current !== ticketData.status && ticketData.status !== "calling") {
                  if (soundEnabledRef.current) playChime();
                }

                prevStatusRef.current = ticketData.status;
              } else {
                // Ticket was deleted or doesn't exist anymore
                unsubscribeFromTicket();
                setMyTicket(null);
                localStorage.removeItem(`dork_ticket_${shopData.id}`);
              }
            }, (err) => {
              if (active) {
                if (!navigator.onLine) {
                  console.log("Offline: Using cached ticket details");
                } else {
                  handleFirestoreError(err, OperationType.GET, `tickets/${savedTicketId}`);
                }
              }
            });
            unsubTicketRef.current = unsub;
          }
        }
      }

      // Subscribe to today's tickets for queue estimations
      if (!unsubTickets) {
        const timezone = shopData.timezone || "Asia/Riyadh";
        const startOfToday = getClientStartOfTodayInTimezone(timezone);
        const ticketsQuery = query(
          collection(db, "tickets"),
          where("shopId", "==", shopData.id)
        );

        unsubTickets = onSnapshot(ticketsQuery, (snap) => {
          if (!active) return;
          const ticketsList: Ticket[] = [];
          snap.forEach((d) => {
            const ticketVal = d.data() as Ticket;
            if (ticketVal.createdAt >= startOfToday.toISOString()) {
              ticketsList.push(ticketVal);
            }
          });
          ticketsList.sort((a, b) => a.ticketNumber - b.ticketNumber);
          setTodayTickets(ticketsList);
          cacheData(`tickets_${shopData.id}`, ticketsList); // Cache in IndexedDB
          setLoadingShop(false);
        }, (err) => {
          if (active) {
            if (!navigator.onLine) {
              console.log("Offline: Using cached today tickets");
              setLoadingShop(false);
            } else {
              handleFirestoreError(err, OperationType.GET, `tickets`);
              setLoadingShop(false);
            }
          }
        });
      }

    }, (err) => {
      if (active) {
        if (!navigator.onLine) {
          console.log("Offline: Using cached shop details");
          setLoadingShop(false);
        } else {
          console.error("Error loading customer portal shop sub:", err);
          setLoadingShop(false);
          handleFirestoreError(err, OperationType.GET, `shops`);
        }
      }
    });

    return () => {
      active = false;
      if (unsubShop) unsubShop();
      unsubscribeFromTicket();
      if (unsubTickets) unsubTickets();
    };
  }, [shopSlug]);

  // Listen to Counter Statuses
  useEffect(() => {
    if (!shop) return;

    const statusesQuery = query(
      collection(db, "counter_statuses"),
      where("shopId", "==", shop.id)
    );

    const unsubStatuses = onSnapshot(statusesQuery, (snapshot) => {
      const list: CounterStatus[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as any);
      });
      // Sort by counterNumber
      list.sort((a, b) => a.counterNumber.localeCompare(b.counterNumber, undefined, { numeric: true, sensitivity: 'base' }));
      setCounterStatuses(list);
    }, (err) => {
      console.error("Error fetching counter statuses:", err);
    });

    return () => unsubStatuses();
  }, [shop]);

  // Sync offline pending tickets from IndexedDB to Firestore
  const syncOfflineTickets = async () => {
    if (!navigator.onLine || !shop) return;
    
    try {
      const pending = await getPendingTickets();
      if (pending.length === 0) return;
      
      console.log(`[Offline Sync] Found ${pending.length} pending ticket(s) to synchronize.`);
      
      for (const ticket of pending) {
        if (ticket.shopId !== shop.id) continue;
        
        // 1. Calculate next ticket number online to avoid conflicts
        const timezone = shop.timezone || "Asia/Riyadh";
        const startOfToday = getClientStartOfTodayInTimezone(timezone);
        
        const todayTicketsRef = collection(db, "tickets");
        const q = query(
          todayTicketsRef,
          where("shopId", "==", shop.id)
        );
        
        const snap = await getDocs(q);
        let maxNum = 0;
        snap.forEach((docSnap) => {
          const t = docSnap.data() as Ticket;
          if (t.createdAt >= startOfToday.toISOString()) {
            if (t.ticketNumber > maxNum) {
              maxNum = t.ticketNumber;
            }
          }
        });
        
        const nextTicketNumber = maxNum + 1;
        
        // 2. Create actual Firestore document
        const newTicketRef = doc(collection(db, "tickets"));
        const cleanTicket: Ticket = {
          ...ticket,
          id: newTicketRef.id,
          ticketNumber: nextTicketNumber,
          createdAt: new Date().toISOString() // Refresh date
        };
        
        await setDoc(newTicketRef, cleanTicket);
        
        // 3. Update localStorage and cached ticket
        const savedId = localStorage.getItem(`dork_ticket_${shop.id}`);
        if (savedId === ticket.id) {
          localStorage.setItem(`dork_ticket_${shop.id}`, newTicketRef.id);
          setMyTicket(cleanTicket);
          await cacheData(`my_ticket_${shop.id}`, cleanTicket);
        }
        
        // 4. Delete from pending in IndexedDB
        await deletePendingTicket(ticket.id);
        console.log(`[Offline Sync] Ticket synced successfully: #${cleanTicket.ticketNumber} (Firestore ID: ${cleanTicket.id})`);
      }
    } catch (syncErr) {
      console.error("[Offline Sync] Error during ticket synchronization:", syncErr);
    }
  };

  // Synchronize offline tickets when returning online
  useEffect(() => {
    if (isOnline) {
      syncOfflineTickets();
    }
  }, [isOnline, shop?.id]);

  useEffect(() => {
    // Sync periodically
    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncOfflineTickets();
      }
    }, 10000);

    // Sync on message from Service Worker
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "TRIGGER_OFFLINE_SYNC") {
        console.log("[SW Message] Sync triggered from Service Worker!");
        syncOfflineTickets();
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleSWMessage);
    }

    return () => {
      clearInterval(interval);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleSWMessage);
      }
    };
  }, [shop?.id]);

  // Join Queue Action Handler
  const handleJoinQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop || !customerName.trim() || !selectedServiceId) return;

    setJoining(true);
    
    // تعريف المتغيرات مسبقاً لتكون متاحة في النطاق بالكامل
    const selectedService = services.find(s => s.id === selectedServiceId);
    if (!selectedService) {
      setJoining(false);
      return;
    }

    let nextTicketNumber = 1;
    let offlineMode = !navigator.onLine;
    let tempId = "";
    let newTicket: Ticket;

    // 1️⃣ مرحلة الاتصال بالسيرفر (Online Mode)
    if (!offlineMode) {
      try {
        const response = await fetch("/api/tickets/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopId: shop.id,
            serviceId: selectedServiceId,
            serviceName: selectedService.name,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim() || "",
            customerEmail: customerEmail.trim() || "",
            emailNotify: emailNotify,
            smsNotify: smsNotify,
            whatsappNotify: whatsappNotify,
            lang: isRtl ? "ar" : "en"
          })
        });

        // 🎯 معالجة فورية ومباشرة للـ 403 وأي كود خطأ آخر دون لف ودوران
        if (!response.ok) {
          if (response.status === 403) {
            setShowLimitModal(true);
            setJoining(false);
            return;
          }
          const errData = await response.json().catch(() => ({ error: "Server error" }));
          const errMsg = errData.message || errData.error || (response.status === 403 ? (isRtl ? "عذراً، الباقة المجانية قد انتهت، يرجى الترقية" : "Sorry, the free plan has ended. Please upgrade.") : "Server error");
          
          setErrorMessage(errMsg);
          setShowAlert(true);
          setJoining(false);
          return; // الخروج الفوري وتجنب تجميد الواجهة والـ Fallback غير المرغوب
        }

        const resData = await response.json();
        newTicket = resData.ticket;
        tempId = newTicket.id;
        nextTicketNumber = newTicket.ticketNumber;

      } catch (apiErr: any) {
        console.warn("API failed, falling back to client-side Firestore calculation.", apiErr);
        
        // Check if the error contains status 403 or limit messages
        const is403 = apiErr?.status === 403 || 
                      apiErr?.response?.status === 403 || 
                      String(apiErr?.message || "").includes("403") ||
                      String(apiErr?.message || "").toLowerCase().includes("limit");
        if (is403) {
          setShowLimitModal(true);
          setJoining(false);
          return;
        }
        
        // في حال فشل السيرفر تماماً، يتم الانتقال للحساب المحلي عبر الـ الفايرستور هنا
        try {
          const storeTimezone = shop.timezone || "Asia/Riyadh";
          const startOfToday = getClientStartOfTodayInTimezone(storeTimezone);
          const startOfTodayStr = startOfToday.toISOString();
          const endOfTodayStr = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();

          const todayTicketsRef = collection(db, "tickets");
          const q = query(
            todayTicketsRef,
            where("shopId", "==", shop.id)
          );
          
          const snap = await getDocs(q);
          const activeTodayDocs = snap.docs.filter((docSnap) => {
            const ticket = docSnap.data() as Ticket;
            return ticket.createdAt >= startOfTodayStr && ticket.createdAt <= endOfTodayStr;
          });

          const planType = shop.plan || "free";
          if (planType === "free" && activeTodayDocs.length >= 5) {
            setShowLimitModal(true);
            setJoining(false);
            return;
          }

          let maxNum = 0;
          activeTodayDocs.forEach((docSnap) => {
            const ticket = docSnap.data() as Ticket;
            if (ticket.ticketNumber > maxNum) maxNum = ticket.ticketNumber;
          });

          const dayKey = startOfTodayStr.slice(0, 10);
          const shopDocRef = doc(db, "shops", shop.id);

          try {
            await runTransaction(db, async (transaction) => {
              const shopSnap = await transaction.get(shopDocRef);
              if (!shopSnap.exists()) {
                throw new Error("Shop not found in transaction");
              }
              const shopData = shopSnap.data();
              const storedDate = shopData.date || "";
              
              let currentCount = 0;
              if (storedDate === dayKey) {
                currentCount = shopData.lastTicketNumber || 0;
              }
              
              const baseCount = Math.max(currentCount, maxNum);

              if (planType === "free" && baseCount >= 5) {
                throw new Error("FREE_PLAN_LIMIT_REACHED");
              }

              nextTicketNumber = baseCount + 1;
              transaction.set(shopDocRef, { lastTicketNumber: nextTicketNumber, date: dayKey }, { merge: true });
            });
          } catch (txErr: any) {
            if (txErr?.message === "FREE_PLAN_LIMIT_REACHED") {
              setShowLimitModal(true);
              setJoining(false);
              return;
            }
            throw txErr;
          }

          tempId = doc(collection(db, "tickets")).id;
          newTicket = {
            id: tempId,
            shopId: shop.id,
            serviceId: selectedServiceId,
            serviceName: selectedService.name,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim() || "",
            customerEmail: customerEmail.trim() || "",
            emailNotify: emailNotify,
            emailNotified: false,
            smsNotify: smsNotify,
            smsNotified: false,
            whatsappNotify: whatsappNotify,
            whatsappNotified: false,
            ticketNumber: nextTicketNumber,
            status: isScheduled ? "scheduled" : "waiting",
            isScheduled: isScheduled,
            scheduledDate: isScheduled ? scheduledDate : "",
            scheduledTime: isScheduled ? scheduledTime : "",
            createdAt: new Date().toISOString()
          };

          await setDoc(doc(db, "tickets", tempId), newTicket);
        } catch (firestoreErr: any) {
          console.error("Critical Firestore Fallback Failure:", firestoreErr);
          setErrorMessage(firestoreErr?.message || (isRtl ? "فشل الانضمام إلى قائمة الانتظار" : "Failed to join queue"));
          setShowAlert(true);
          setJoining(false);
          return;
        }
      }
    } else {
      // 2️⃣ مرحلة العمل دون إنترنت (Offline Mode)
      let maxNum = 0;
      todayTickets.forEach((ticket) => {
        if (ticket.ticketNumber > maxNum) maxNum = ticket.ticketNumber;
      });
      nextTicketNumber = maxNum + 1;
      tempId = `offline_${Date.now()}`;
      newTicket = {
        id: tempId,
        shopId: shop.id,
        serviceId: selectedServiceId,
        serviceName: selectedService.name,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || "",
        customerEmail: customerEmail.trim() || "",
        emailNotify: emailNotify,
        emailNotified: false,
        smsNotify: smsNotify,
        smsNotified: false,
        whatsappNotify: whatsappNotify,
        whatsappNotified: false,
        ticketNumber: nextTicketNumber,
        status: isScheduled ? "scheduled" : "waiting",
        isScheduled: isScheduled,
        scheduledDate: isScheduled ? scheduledDate : "",
        scheduledTime: isScheduled ? scheduledTime : "",
        createdAt: new Date().toISOString()
      };
    }

    // 3️⃣ مرحلة حفظ البيانات النهائية وتشغيل التنبيهات اللحظية
    try {
      if (!offlineMode) {
        unsubscribeFromTicket();
        const newTicketRef = doc(db, "tickets", tempId);
        const unsub = onSnapshot(newTicketRef, (snapShot) => {
          if (snapShot.exists()) {
            const tData = snapShot.data() as Ticket;
            setMyTicket(tData);
            cacheData(`my_ticket_${shop.id}`, tData);
            
            // Real-time sound/vibration trigger on calling
            if (tData.status === "calling" && prevStatusRef.current !== "calling") {
              if ("vibrate" in navigator) {
                navigator.vibrate([200, 100, 200, 100, 300]);
              }

              // Trigger browser push notification
              if ("Notification" in window && Notification.permission === "granted") {
                try {
                  new Notification(
                    isRtl ? `حان دورك الآن! 🔔` : `It's your turn! 🔔`,
                    {
                      body: isRtl 
                        ? (tData.counterNumber 
                          ? `تفضل بالتوجه إلى شباك / طاولة رقم ${tData.counterNumber} في ${shop.name} فوراً.`
                          : `تفضل بالتوجه إلى كاونتر تقديم الخدمة في ${shop.name} فوراً.`)
                        : (tData.counterNumber
                          ? `Please proceed to window / table number ${tData.counterNumber} at ${shop.name} immediately.`
                          : `Please proceed to the service counter at ${shop.name} immediately.`),
                      tag: "dork-turn-calling",
                      requireInteraction: true
                    }
                  );
                } catch (err: any) {
                  console.warn("Could not instantiate Notification directly on this device:", err.message);
                }
              }
            }
            if (prevStatusRef.current !== null && prevStatusRef.current !== tData.status && tData.status !== "calling") {
              if (soundEnabledRef.current) playChime();
            }

            prevStatusRef.current = tData.status;
          } else {
            unsubscribeFromTicket();
            setMyTicket(null);
            localStorage.removeItem(`dork_ticket_${shop.id}`);
          }
        });
        unsubTicketRef.current = unsub;
      } else {
        await addPendingTicket(newTicket);
        await cacheData(`my_ticket_${shop.id}`, newTicket);
      }

      localStorage.setItem(`dork_ticket_${shop.id}`, tempId);
      setMyTicket(newTicket);
      prevStatusRef.current = "waiting";

      // Register background sync if available
      if (offlineMode && "serviceWorker" in navigator && "SyncManager" in window) {
        try {
          const reg = await navigator.serviceWorker.ready;
          await (reg as any).sync.register("sync-tickets");
          console.log("Background sync registered for sync-tickets!");
        } catch (syncErr) {
          console.warn("Background sync registration failed:", syncErr);
        }
      }
    } catch (finalErr) {
      console.error("Error in final state mapping:", finalErr);
    } finally {
      setJoining(false);
    }
  };

  // Calculate stats for active ticket
  let peopleInFront = 0;
  let estimatedWaitMinutes = 0;
  let calculatedAvgServiceTime = 15;
  let isUsingDynamicAverage = false;
  let isSameServiceDynamic = false;
  let activeCountersCount = 1;

  if (myTicket && shop) {
    const isServedBefore = (a: Ticket, b: Ticket) => {
      const aPriority = a.isPriority || false;
      const bPriority = b.isPriority || false;
      if (aPriority && !bPriority) return true;
      if (!aPriority && bPriority) return false;
      return a.ticketNumber < b.ticketNumber;
    };

    // Filter active tickets today that are served before myTicket
    const activeWaiting = todayTickets.filter(
      t => t.status === "waiting" && t.id !== myTicket.id && isServedBefore(t, myTicket)
    );
    peopleInFront = activeWaiting.length;

    // Estimate based on average service duration
    const myService = services.find(s => s.id === myTicket.serviceId);
    const fallbackDuration = myService ? myService.avgDurationMinutes : 15;
    
    let avgDuration = fallbackDuration;
    
    // Filter completed tickets today that have timestamps
    const completedToday = todayTickets.filter(
      t => t.status === "completed" && t.completedAt && t.calledAt
    );
    
    if (completedToday.length > 0) {
      // Try to find completed tickets of the same service first
      const sameServiceCompleted = completedToday.filter(t => t.serviceId === myTicket.serviceId);
      if (sameServiceCompleted.length > 0) {
        const totalMin = sameServiceCompleted.reduce((acc, t) => {
          const diff = (new Date(t.completedAt).getTime() - new Date(t.calledAt).getTime()) / 60000;
          return acc + Math.max(1, diff);
        }, 0);
        avgDuration = Math.round(totalMin / sameServiceCompleted.length);
        isUsingDynamicAverage = true;
        isSameServiceDynamic = true;
      } else {
        // Fallback to overall completed tickets today
        const totalMin = completedToday.reduce((acc, t) => {
          const diff = (new Date(t.completedAt).getTime() - new Date(t.calledAt).getTime()) / 60000;
          return acc + Math.max(1, diff);
        }, 0);
        avgDuration = Math.round(totalMin / completedToday.length);
        isUsingDynamicAverage = true;
        isSameServiceDynamic = false;
      }
    } else if (historicalAvgDuration !== null) {
      // Fallback to historical average from shop history
      avgDuration = historicalAvgDuration;
      isUsingDynamicAverage = true;
      isSameServiceDynamic = false;
    }
    
    calculatedAvgServiceTime = avgDuration;

    activeCountersCount = Math.max(1, new Set(
      todayTickets
        .filter(t => (t.status === "calling" || t.status === "completed") && t.counterNumber)
        .map(t => t.counterNumber)
    ).size);

    // Total wait time = (people in front) * avgDuration + (if there is someone calling, add a buffer based on remaining service speed)
    const hasCalling = todayTickets.some(t => t.status === "calling");
    const rawWait = (peopleInFront * avgDuration) + (hasCalling ? Math.max(3, Math.floor(avgDuration / 2)) : 0);
    estimatedWaitMinutes = Math.max(1, Math.round(rawWait / activeCountersCount));
  }

  // Leave Queue / Cancel Ticket Handler
  useEffect(() => {
    if (myTicket?.status === "waiting" && peopleInFront !== undefined) {
      fetchAIEstimate();
    }
  }, [peopleInFront, myTicket?.status]);

  useEffect(() => {
    if (myTicket && myTicket.status === "waiting" && peopleInFront !== undefined) {
      const key = `initial_people_front_${myTicket.id}`;
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        setInitialPeopleInFront(parseInt(stored, 10));
      } else {
        localStorage.setItem(key, String(peopleInFront));
        setInitialPeopleInFront(peopleInFront);
      }
    }
  }, [myTicket?.id, myTicket?.status, peopleInFront]);

  const progressPercent = (() => {
    if (myTicket?.status !== "waiting") return 100;
    if (initialPeopleInFront <= 0) return 10;
    if (peopleInFront <= 0) return 95;
    const solved = initialPeopleInFront - peopleInFront;
    if (solved <= 0) return 15;
    return Math.min(95, Math.round((solved / initialPeopleInFront) * 100));
  })();

  const fetchAIEstimate = async () => {
    if (!shop || !myTicket || peopleInFront === undefined) return;
    setAiEstimateLoading(true);
    try {
      const recentTickets = todayTickets
        .filter((t) => t.status === "completed" && t.calledAt && t.completedAt)
        .slice(-10)
        .map((t) => ({
          durationMinutes: Math.round((new Date(t.completedAt).getTime() - new Date(t.calledAt).getTime()) / 60000),
          serviceName: t.serviceName,
        }));

      const activeCountersCount = Math.max(1, new Set(
        todayTickets
          .filter(t => (t.status === "calling" || t.status === "completed") && t.counterNumber)
          .map(t => t.counterNumber)
      ).size);

      const response = await fetch("/api/estimate-wait-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: shop.name,
          serviceName: myTicket.serviceName,
          peopleInFront,
          recentTickets,
          activeCountersCount,
          avgDuration: calculatedAvgServiceTime,
          lang: i18n.language,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setAiEstimateMessage(data.estimateMessage);
      }
    } catch (err) {
      console.error("Failed to fetch AI estimate:", err);
    } finally {
      setAiEstimateLoading(false);
    }
  };

  const handleLeaveQueue = async () => {
    if (!myTicket || !shop) return;

    try {
      const ticketRef = doc(db, "tickets", myTicket.id);
      try {
        await updateDoc(ticketRef, { status: "cancelled" });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${myTicket.id}`);
      }
      
      // Remove from state & local storage
      unsubscribeFromTicket();
      localStorage.removeItem(`dork_ticket_${shop.id}`);
      setMyTicket(null);
      setShowCancelConfirm(false);
    } catch (err) {
      console.error("Error leaving queue:", err);
    }
  };

  // Submit customer rating feedback
  const handleSubmitRating = async () => {
    if (!myTicket || ratingSpeed === 0 || ratingQuality === 0) return;
    setSubmittingRating(true);
    const overallRating = Math.round((ratingSpeed + ratingQuality) / 2);
    try {
      const ticketRef = doc(db, "tickets", myTicket.id);
      await updateDoc(ticketRef, {
        rating: overallRating,
        ratingSpeed: ratingSpeed,
        ratingQuality: ratingQuality,
        ratingComment: ratingComment.trim(),
        ratedAt: new Date().toISOString()
      });
      setRating(overallRating);
      setRatingSuccess(true);
    } catch (err) {
      console.error("Error submitting rating: ", err);
      alert(isRtl ? "حدث خطأ أثناء إرسال التقييم." : "An error occurred while submitting your rating.");
    } finally {
      setSubmittingRating(false);
    }
  };

  // Helper to trigger the server-side email send
  const sendApproachingNotification = async (ticket: Ticket, shopName: string, isRtl: boolean) => {
    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: ticket.customerEmail,
          name: ticket.customerName,
          ticketNumber: ticket.ticketNumber,
          serviceName: ticket.serviceName,
          shopName: shopName,
          lang: isRtl ? "ar" : "en",
        }),
      });

      if (!response.ok) {
        throw new Error(`Email alert API failed with status ${response.status}`);
      }

      const result = await response.json();
      console.log("Email notification dispatched:", result);
      return result;
    } catch (err) {
      console.error("Failed to send approaching turn email alert:", err);
    }
  };

  // Helper to trigger the server-side SMS/WhatsApp send
  const sendApproachingSmsWhatsappNotification = async (ticket: Ticket, shopName: string, channel: "sms" | "whatsapp", isRtl: boolean) => {
    try {
      const trackingUrl = `${window.location.origin}/?shop=${shop?.slug}&ticketId=${ticket.id}`;
      const response = await fetch("/api/send-sms-whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: ticket.customerPhone,
          messageType: "approaching",
          channel: channel,
          name: ticket.customerName,
          ticketNumber: ticket.ticketNumber,
          serviceName: ticket.serviceName,
          shopName: shopName,
          trackingUrl: trackingUrl,
          lang: isRtl ? "ar" : "en",
        }),
      });

      if (!response.ok) {
        throw new Error(`Omnichannel Alert API failed with status ${response.status}`);
      }

      const result = await response.json();
      console.log(`${channel.toUpperCase()} notification dispatched:`, result);
      return result;
    } catch (err) {
      console.error(`Failed to send approaching turn ${channel} alert:`, err);
    }
  };

  // Monitor tickets in real-time to detect when the current customer is approaching their turn (exactly 2 people ahead)
  useEffect(() => {
    if (!shop || todayTickets.length === 0 || !myTicket) return;

    const freshTicket = todayTickets.find(t => t.id === myTicket.id);
    if (!freshTicket || freshTicket.status !== "waiting") return;

    // Calculate how many waiting people are ahead of this ticket
    const waitingAhead = todayTickets.filter(
      t => t.status === "waiting" && t.ticketNumber < freshTicket.ticketNumber
    );
    const peopleAheadCount = waitingAhead.length;

    // Send when exactly 2 people are left ahead in the queue
    if (peopleAheadCount === 2) {
      const triggerAlerts = async () => {
        const ticketRef = doc(db, "tickets", freshTicket.id);
        
        // 1. Process email alert
        if (freshTicket.emailNotify && !freshTicket.emailNotified && freshTicket.customerEmail) {
          try {
            await runTransaction(db, async (transaction) => {
              const snap = await transaction.get(ticketRef);
              if (!snap.exists()) return;
              const data = snap.data() as Ticket;
              if (data.emailNotify && !data.emailNotified) {
                transaction.update(ticketRef, { emailNotified: true });
                await sendApproachingNotification(data, shop.name, isRtl);
              }
            });
          } catch (err) {
            console.error("Error sending approaching email:", err);
          }
        }

        // 2. Process SMS alert
        if (freshTicket.smsNotify && !freshTicket.smsNotified && freshTicket.customerPhone) {
          try {
            await runTransaction(db, async (transaction) => {
              const snap = await transaction.get(ticketRef);
              if (!snap.exists()) return;
              const data = snap.data() as Ticket;
              if (data.smsNotify && !data.smsNotified) {
                transaction.update(ticketRef, { smsNotified: true });
                await sendApproachingSmsWhatsappNotification(data, shop.name, "sms", isRtl);
              }
            });
          } catch (err) {
            console.error("Error sending approaching SMS:", err);
          }
        }

        // 3. Process WhatsApp alert
        if (freshTicket.whatsappNotify && !freshTicket.whatsappNotified && freshTicket.customerPhone) {
          try {
            await runTransaction(db, async (transaction) => {
              const snap = await transaction.get(ticketRef);
              if (!snap.exists()) return;
              const data = snap.data() as Ticket;
              if (data.whatsappNotify && !data.whatsappNotified) {
                transaction.update(ticketRef, { whatsappNotified: true });
                await sendApproachingSmsWhatsappNotification(data, shop.name, "whatsapp", isRtl);
              }
            });
          } catch (err) {
            console.error("Error sending approaching WhatsApp:", err);
          }
        }
      };

      triggerAlerts();
    }
  }, [todayTickets, shop, isRtl, myTicket]);

  // Monitor the current customer's wait position in real-time to trigger alerts when it is almost their turn
  useEffect(() => {
    if (!myTicket || !shop || todayTickets.length === 0) return;

    if (myTicket.status === "waiting") {
      const activeWaiting = todayTickets.filter(t => t.status === "waiting" || t.status === "calling");
      const currentPeopleInFront = activeWaiting.filter(t => t.createdAt < myTicket.createdAt && t.status === "waiting").length;

      // When there are exactly 2 people in front
      if (currentPeopleInFront === 2 && !hasShownApproachingPush) {
        setHasShownApproachingPush(true);
        
        // Play chime
        if (soundEnabledRef.current) {
          playChime();
        }
        
        // Vibrate
        if ("vibrate" in navigator) {
          navigator.vibrate([150, 100, 150]);
        }

        // HTML5 notification
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(
              isRtl ? "اقترب دورك في الطابور! 🔔" : "Your turn is approaching! 🔔",
              {
                body: isRtl 
                  ? `بقي شخصان فقط أمامك في ${shop.name}. يرجى الاستعداد.`
                  : `Only 2 people ahead of you at ${shop.name}. Please get ready.`,
                tag: "dork-turn-approaching",
                requireInteraction: true
              }
            );
          } catch (err: any) {
            console.warn("Could not fire notification:", err.message);
          }
        }
        
        // Also show in-app modal alert
        setInAppAlert({
          show: true,
          title: isRtl ? "اقترب دورك! 🔔" : "Almost your turn! 🔔",
          message: isRtl 
            ? `بقي شخصان فقط أمامك في الطابور لدى ${shop.name}. يرجى الاستعداد لتقديم الخدمة.`
            : `Only 2 people ahead of you in the queue at ${shop.name}. Please prepare for service.`,
          type: "approaching"
        });
      }

      // When there is exactly 1 person in front
      if (currentPeopleInFront === 1 && !hasShownOneInFrontFcm) {
        setHasShownOneInFrontFcm(true);

        // Play chime
        if (soundEnabledRef.current) {
          playChime();
        }
        
        // Vibrate
        if ("vibrate" in navigator) {
          navigator.vibrate([200, 100, 200, 100, 200]);
        }

        // HTML5 notification
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(
              isRtl ? "أنت التالي في الطابور! 🚨" : "You are next in line! 🚨",
              {
                body: isRtl 
                  ? `بقي شخص واحد فقط أمامك في ${shop.name}. يرجى التقدم نحو صالة الخدمة.`
                  : `Only 1 person ahead of you at ${shop.name}. Please move closer to the service counter.`,
                tag: "dork-turn-next",
                requireInteraction: true
              }
            );
          } catch (err: any) {
            console.warn("Could not fire notification:", err.message);
          }
        }

        // Also show in-app modal alert
        setInAppAlert({
          show: true,
          title: isRtl ? "أنت التالي في الطابور! 🚨" : "You are next in line! 🚨",
          message: isRtl 
            ? `بقي شخص واحد فقط أمامك لدى ${shop.name}. يرجى التواجد قريباً جداً من كاونتر الخدمة.`
            : `Only 1 person left ahead of you at ${shop.name}. Please stay very close to the service counter.`,
          type: "next"
        });
      }
    }
  }, [todayTickets, myTicket, shop, isRtl, hasShownApproachingPush, hasShownOneInFrontFcm]);

  // Trigger test chime manually for users to allow audio gestures
  const handleTestAudio = () => {
    playChime();
    if ("vibrate" in navigator) {
      navigator.vibrate([100]);
    }
  };

  // Pre-fill whatsapp phone from myTicket when it is available
  useEffect(() => {
    if (myTicket?.customerPhone) {
      setWhatsappPhone((prev) => prev || myTicket.customerPhone || "");
    }
  }, [myTicket?.id, myTicket?.customerPhone]);

  // Generate dynamic WhatsApp Click-to-Chat URL
  const getWhatsAppUrl = () => {
    if (!myTicket || !shop) return "#";
    
    const trackingUrl = `${window.location.origin}/?shop=${shop.slug}&ticketId=${myTicket.id}`;
    
    let msg = t("customer_whatsapp_msg_template", {
      shopName: shop.name,
      ticketNumber: String(myTicket.ticketNumber).padStart(2, "0"),
      serviceName: myTicket.serviceName,
      trackingUrl: trackingUrl
    });
    
    // Manual fallback replacement if i18next does not replace
    msg = msg
      .replace("{{shopName}}", shop.name)
      .replace("{{ticketNumber}}", String(myTicket.ticketNumber).padStart(2, "0"))
      .replace("{{serviceName}}", myTicket.serviceName)
      .replace("{{trackingUrl}}", trackingUrl);
      
    const encodedMsg = encodeURIComponent(msg);
    
    let phone = whatsappPhone.trim();
    if (phone) {
      // Keep only digits
      phone = phone.replace(/[^\d]/g, "");
      // Remove leading double zero or plus
      if (phone.startsWith("00")) {
        phone = phone.substring(2);
      }
      return `https://api.whatsapp.com/send?phone=${phone}&text=${encodedMsg}`;
    }
    
    return `https://api.whatsapp.com/send?text=${encodedMsg}`;
  };

  

  const getGoogleCalendarUrl = () => {
    if (!myTicket || !shop) return "";

    const title = encodeURIComponent(
      isRtl
        ? `تذكرة دورك #${myTicket.ticketNumber} - ${shop.name}`
        : `Dork Ticket #${myTicket.ticketNumber} - ${shop.name}`
    );

    const startDate = new Date();
    if (myTicket.status === "waiting" && estimatedWaitMinutes > 0) {
      startDate.setMinutes(startDate.getMinutes() + estimatedWaitMinutes);
    }
    
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);

    const formatCalDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    const dates = `${formatCalDate(startDate)}/${formatCalDate(endDate)}`;

    const detailsText = isRtl
      ? `مرحباً ${myTicket.customerName}،\n\nلقد حجزت تذكرة في طابور الانتظار لدى ${shop.name}:\n- رقم التذكرة: #${myTicket.ticketNumber}\n- الخدمة المطلوبة: ${myTicket.serviceName}\n- وقت الانتظار التقريبي عند الحجز: ${estimatedWaitMinutes} دقيقة\n- رابط متابعة دورك مباشرة في أي وقت: ${window.location.origin}/?shop=${shop.slug}&ticketId=${myTicket.id}\n\nشكراً لاستخدامك نظام دورك!`
      : `Hello ${myTicket.customerName},\n\nYou have joined the waitlist queue at ${shop.name}:\n- Ticket Number: #${myTicket.ticketNumber}\n- Service Requested: ${myTicket.serviceName}\n- Estimated Wait: ${estimatedWaitMinutes} minutes\n- Track your live status anytime: ${window.location.origin}/?shop=${shop.slug}&ticketId=${myTicket.id}\n\nThank you for using Dork!`;

    const details = encodeURIComponent(detailsText);
    const location = encodeURIComponent(shop.name);

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  };

  // Trigger local web notification when queue advances
  useEffect(() => {
    if (myTicket && myTicket.status === "waiting" && peopleInFront !== undefined && peopleInFront !== null) {
      if (prevPeopleInFrontRef.current !== null && peopleInFront < prevPeopleInFrontRef.current) {
        // The queue has advanced! Let's notify the user if notifications are enabled.
        // Play light chime on queue advance regardless of native notification permission
        if (soundEnabledRef.current) {
          playChime();
        }

        if ("Notification" in window && Notification.permission === "granted") {
          try {
            let title = "";
            let body = "";

            if (peopleInFront === 0) {
              title = isRtl ? "أنت التالي مباشرة! ⚡" : "You are next up! ⚡";
              body = isRtl
                ? `لم يعد هناك أحد أمامك في طابور الانتظار لدى ${shop?.name || ""}. يرجى الاستعداد!`
                : `There is no one ahead of you in the queue at ${shop?.name || ""}. Please get ready!`;
            } else if (peopleInFront === 1) {
              title = isRtl ? "اقترب دورك جداً! 🚨" : "Your turn is very close! 🚨";
              body = isRtl
                ? `يتبقى شخص واحد فقط أمامك في طابور الانتظار لدى ${shop?.name || ""}.`
                : `There is only 1 person ahead of you in the queue at ${shop?.name || ""}.`;
            } else if (peopleInFront === 2) {
              title = isRtl ? "اقترب دورك! ⏳" : "Your turn is approaching! ⏳";
              body = isRtl
                ? `يتبقى شخصان فقط أمامك في طابور الانتظار لدى ${shop?.name || ""}.`
                : `There are only 2 people ahead of you in the queue at ${shop?.name || ""}.`;
            } else {
              title = isRtl ? "تقدمت في الطابور! 🏃‍♂️" : "Queue Advanced! 🏃‍♂️";
              body = isRtl
                ? `لقد تقدمت في طابور الانتظار لدى ${shop?.name || ""}. يتبقى الآن ${peopleInFront} شخصاً أمامك.`
                : `You moved forward in the queue at ${shop?.name || ""}. There are now ${peopleInFront} people ahead of you.`;
            }

            new Notification(title, {
              body,
              tag: "dork-queue-advance",
              requireInteraction: false,
            });
            
          } catch (err: any) {
            console.warn("Could not instantiate Notification directly on this device:", err.message);
          }
        }
      }
      prevPeopleInFrontRef.current = peopleInFront;
    } else if (myTicket && myTicket.status === "waiting" && (peopleInFront !== undefined && peopleInFront !== null)) {
      prevPeopleInFrontRef.current = peopleInFront;
    }
  }, [peopleInFront, myTicket, shop, isRtl]);

  // Trigger FCM and local push alert when exactly 1 person is ahead of this customer
  useEffect(() => {
    const tokenToSend = fcmToken || (myTicket as any)?.fcmToken;
    if (myTicket && myTicket.status === "waiting" && peopleInFront === 1 && !hasShownOneInFrontFcm) {
      setHasShownOneInFrontFcm(true);
      
      // Trigger native browser notification immediately as a reliable local fallback
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(
            isRtl ? "اقترب دورك جداً! 🚨" : "Your turn is very close! 🚨",
            {
              body: isRtl
                ? `يتبقى شخص واحد فقط أمامك في طابور الانتظار لدى ${shop?.name || ""}.`
                : `There is only 1 person ahead of you in the queue at ${shop?.name || ""}.`,
              tag: "dork-turn-one-ahead",
              requireInteraction: true
            }
          );
        } catch (err: any) {
          console.warn("Could not instantiate Notification directly on this device:", err.message);
        }
      }

      // Trigger Firebase Cloud Messaging via our API server
      if (tokenToSend) {
        fetch("/api/send-fcm-alert", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fcmToken: tokenToSend,
            shopName: shop?.name || "",
            ticketNumber: myTicket.ticketNumber,
            lang: isRtl ? "ar" : "en"
          })
        })
          .then((res) => res.json())
          .then((data) => {
            console.log("[FCM] FCM push notification triggered via server successfully:", data);
          })
          .catch((err) => {
            console.error("[FCM] Failed to trigger FCM push notification via server:", err);
          });
      }
    } else if (myTicket && myTicket.status === "waiting" && peopleInFront > 1) {
      setHasShownOneInFrontFcm(false);
    }
  }, [peopleInFront, myTicket, hasShownOneInFrontFcm, fcmToken, shop, isRtl]);

  // Loading shop details
  if (loadingShop) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <h3 className="text-lg font-bold text-slate-800">{t("customer_loading_shop")}</h3>
        <p className="text-slate-500 text-xs mt-1">{t("customer_loading_subtitle")}</p>
      </div>
    );
  }

  // Shop not found
  if (!shop) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <XCircle className="w-16 h-16 text-rose-500 mb-4" />
        <h3 className="text-xl font-bold text-slate-900">{t("customer_shop_not_found")}</h3>
        <p className="text-slate-500 text-sm mt-1 max-w-sm">
          {t("customer_shop_not_found_desc")}
        </p>
        <button
          onClick={onBackToHome}
          className="mt-6 bg-indigo-600 text-white font-bold text-sm px-6 py-3 rounded-2xl hover:bg-indigo-700 transition-all cursor-pointer"
        >
          {t("back_to_home")}
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDarkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"} pb-12 flex flex-col items-center justify-start p-4 relative overflow-hidden ${isRtl ? "text-right" : "text-left"}`}>
      
      {/* Offline connectivity warning banner */}
      {!isOnline && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-rose-500 text-white p-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-2 text-xs font-bold animate-bounce border border-rose-600">
          <WifiOff className="w-4 h-4" />
          <span>{isRtl ? "انقطع الاتصال بالإنترنت! جاري إعادة الاتصال بالطابور..." : "Connection lost! Reconnecting to waitlist..."}</span>
        </div>
      )}

      {/* Decorative Blur BG */}
      <div className={`absolute -top-40 -right-40 w-96 h-96 ${isDarkMode ? "bg-indigo-900/10" : "bg-indigo-100 opacity-60"} rounded-full blur-3xl pointer-events-none`} />
      <div className={`absolute -bottom-40 -left-40 w-96 h-96 ${isDarkMode ? "bg-emerald-900/10" : "bg-emerald-100 opacity-40"} rounded-full blur-3xl pointer-events-none`} />

      {/* Header section with Shop details */}
      <div className="w-full max-w-md flex items-center justify-between mb-6 z-10">
        <div className="flex items-center gap-3">
          {shop.logoUrl ? (
            <img 
              src={shop.logoUrl} 
              alt={shop.name} 
              className="w-10 h-10 rounded-xl object-cover border border-slate-200/80 bg-white shadow-sm"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow shadow-indigo-100">
              <Users className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="text-base font-black text-slate-900 leading-none">{shop.name}</h1>
            <span className="text-[10px] text-indigo-600 font-bold mt-0.5 block">{translateCategory(shop.category)}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <LanguageSwitcher />

          {/* Add to Home Screen PWA Button */}
          {!isStandalone && (
            <button
              onClick={() => {
                if (deferredPrompt) {
                  handleInstallPWA();
                } else {
                  setShowPwaModal(true);
                }
              }}
              className={`p-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                isDarkMode
                  ? "bg-emerald-950/40 border-emerald-900/50 text-emerald-400 hover:bg-emerald-900/60"
                  : "bg-emerald-50 border-emerald-100 text-emerald-800 hover:bg-emerald-100 hover:scale-[1.03] active:scale-97 shadow-sm"
              }`}
              title={isRtl ? "إضافة للشاشة الرئيسية" : "Add to Home Screen"}
            >
              <Smartphone className="w-4 h-4 text-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black hidden xs:inline">
                {isRtl ? "تثبيت" : "Install"}
              </span>
            </button>
          )}

          {/* Dark Mode Toggle Button */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
              isDarkMode 
                ? "bg-slate-800 text-amber-400 hover:bg-slate-700" 
                : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200/80 shadow-sm"
            }`}
            title={isDarkMode ? (isRtl ? "تفعيل الوضع المضيء" : "Enable Light Mode") : (isRtl ? "تفعيل الوضع الداكن" : "Enable Dark Mode")}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={onBackToHome}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
          >
            {t("home")}
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER: Switch between "Join Queue Form" and "Ticket Board" */}
      <div className="w-full max-w-md z-10">
        <AnimatePresence mode="wait">
          {!myTicket ? (
            shop && shop.isPaused ? (
              /* SERVICE PAUSED SCREEN */
              <motion.div 
                key="paused"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                id="service-paused-card" 
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl overflow-hidden p-6 sm:p-8 text-center space-y-6"
              >
              <div className="w-16 h-16 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center text-amber-500 mx-auto animate-pulse">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-black text-slate-900">{t("cust_service_paused_title")}</h2>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">{t("cust_service_paused_desc")}</p>
                <div className="text-[11px] text-slate-400 leading-relaxed font-bold bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                  {t("cust_service_paused_sub")}
                </div>
              </div>
              
              <div className="pt-2">
                <button
                  id="paused-back-btn"
                  onClick={onBackToHome}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-4 rounded-2xl transition-all cursor-pointer border border-slate-200"
                >
                  {t("back_to_home")}
                </button>
              </div>
            </motion.div>
          ) : shop && isShopClosed(shop) ? (
            /* SHOP CLOSED SCREEN */
            <motion.div 
              key="closed"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              id="shop-closed-card" 
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl overflow-hidden p-6 sm:p-8 text-center space-y-6"
            >
              <div className="w-16 h-16 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center text-rose-500 mx-auto">
                <Clock className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-black text-slate-900">{t("cust_shop_closed_title")}</h2>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">{t("cust_shop_closed_desc")}</p>
                
                {/* Visual Schedule Table for current working hours */}
                <div className="text-[11px] text-slate-600 leading-relaxed font-semibold bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-2 text-right">
                  <div className="border-b border-slate-200 pb-1.5 mb-1.5 text-center font-bold text-slate-700 flex items-center justify-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{t("vend_working_hours_settings")}</span>
                  </div>
                  {["0", "1", "2", "3", "4", "5", "6"].map((dayIndex) => {
                    const dayConfig = shop.workingHours?.days?.[dayIndex];
                    const isToday = new Date().getDay() === Number(dayIndex);
                    return (
                      <div 
                        key={dayIndex} 
                        className={`flex justify-between items-center py-0.5 ${
                          isToday ? "text-indigo-600 font-extrabold" : "text-slate-500"
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          {isToday && <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>}
                          {t(`day_${dayIndex}`)}
                        </span>
                        <span>
                          {dayConfig?.enabled ? (
                            `${dayConfig.open} - ${dayConfig.close}`
                          ) : (
                            isRtl ? "مغلق" : "Closed"
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="text-[11px] text-slate-400 leading-relaxed font-bold bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                  {t("cust_shop_closed_sub")}
                </div>
              </div>
              
              <div className="pt-2">
                <button
                  id="closed-back-btn"
                  onClick={onBackToHome}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-4 rounded-2xl transition-all cursor-pointer border border-slate-200"
                >
                  {t("back_to_home")}
                </button>
              </div>
            </motion.div>
          ) : (
            /* STEP 1: Join Queue Form */
            <motion.div 
              key="join-form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl overflow-hidden p-6 sm:p-8"
            >
              <div className="text-center mb-6">
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100/50 dark:bg-indigo-950/40 dark:border-indigo-900/40 px-3 py-1 rounded-full uppercase tracking-wider brand-text-primary brand-bg-light">
                  {t("customer_instant_join")}
                </span>
                <h2 className="text-xl font-black text-slate-900 dark:text-white mt-3">{t("customer_join_title")}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t("customer_join_subtitle")}</p>
              </div>

              {/* Free Plan / Quota Remaining Component */}
              {(() => {
                const planType = shop?.plan || "free";
                const isPro = planType === "pro";
                const totalToday = todayTickets.length;
                const maxAllowed = 5;
                const remaining = Math.max(0, maxAllowed - totalToday);
                const percent = Math.min(100, (totalToday / maxAllowed) * 100);

                if (isPro) {
                  return (
                    <div className="mb-6 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 border border-violet-100 dark:border-violet-900/40 rounded-2xl p-4 flex items-center gap-3 shadow-sm animate-fadeIn">
                      <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0 shadow shadow-violet-200 dark:shadow-none">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                      </div>
                      <div className={isRtl ? "text-right" : "text-left"}>
                        <h4 className="text-[11px] font-black text-violet-950 dark:text-violet-200 uppercase tracking-wide">
                          {t("customer_active_pro_plan")}
                        </h4>
                        <p className="text-[10px] text-violet-700 dark:text-violet-450 font-bold mt-0.5 leading-relaxed">
                          {t("customer_pro_capacity_desc")}
                        </p>
                      </div>
                    </div>
                  );
                }

                // If Free Plan
                return (
                  <div className={`mb-6 rounded-2xl p-4 border transition-all animate-fadeIn ${
                    remaining === 0 
                      ? "bg-rose-50/50 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/40 text-rose-900 dark:text-rose-200" 
                      : remaining === 1 
                        ? "bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/40 text-amber-900 dark:text-amber-200" 
                        : "bg-slate-50/60 dark:bg-slate-950/20 border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                  }`}>
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-start gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          remaining === 0 
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400" 
                            : remaining === 1 
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" 
                              : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400"
                        }`}>
                          <TicketIcon className="w-4 h-4" />
                        </div>
                        <div className={isRtl ? "text-right" : "text-left"}>
                          <h4 className={`text-[11px] font-black ${
                            remaining === 0 
                              ? "text-rose-950 dark:text-rose-200" 
                              : remaining === 1 
                                ? "text-amber-950 dark:text-amber-200" 
                                : "text-slate-900 dark:text-slate-100"
                          }`}>
                            {t("customer_today_quota")}
                          </h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5 leading-tight">
                            {t("customer_free_plan_quota_desc", { maxAllowed })}
                          </p>
                        </div>
                      </div>

                      {/* Remaining Indicator Badge */}
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                        remaining === 0 
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800" 
                          : remaining === 1 
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800" 
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800"
                      }`}>
                        {remaining === 0 ? t("customer_quota_full") : t("customer_quota_remaining", { remaining })}
                      </span>
                    </div>

                    {/* Simple Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          remaining === 0 
                            ? "bg-rose-600" 
                            : remaining === 1 
                              ? "bg-amber-500 animate-pulse" 
                              : "bg-gradient-to-r from-emerald-500 to-indigo-500"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    {/* Progress Detail description text */}
                    <div className={`flex justify-between items-center text-[10px] font-black ${
                      remaining === 0 
                        ? "text-rose-750 dark:text-rose-400" 
                        : remaining === 1 
                          ? "text-amber-750 dark:text-amber-400" 
                          : "text-slate-500 dark:text-slate-400"
                    }`}>
                      <span>
                        {t("customer_booked_count_desc", { totalToday, maxAllowed })}
                      </span>
                      <span>
                        {remaining === 0 
                          ? t("customer_booking_closed_msg") 
                          : remaining === 1 
                            ? t("customer_booking_urgent_msg") 
                            : t("customer_booking_open_msg")}
                      </span>
                    </div>
                  </div>
                );
              })()}

            <form onSubmit={handleJoinQueue} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5 px-1">{t("customer_field_name")}</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t("customer_name_placeholder")}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white text-slate-900 text-sm font-semibold px-4 py-3.5 rounded-2xl outline-none transition-all placeholder:text-slate-300 brand-focus"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5 px-1">{t("customer_field_phone")}</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={t("customer_phone_placeholder")}
                  dir="ltr"
                  className={`w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white text-slate-900 text-sm font-semibold px-4 py-3.5 rounded-2xl outline-none transition-all placeholder:text-slate-300 brand-focus ${isRtl ? "text-right" : "text-left"}`}
                />
              </div>

              {customerPhone.trim() && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-indigo-50/40 border border-indigo-100/50 p-4 rounded-2xl transition-all dark:bg-indigo-950/20 dark:border-indigo-900/40 animate-fadeIn">
                  <div className="flex items-start gap-2.5">
                    <div className="flex items-center h-5">
                      <input
                        id="smsNotify"
                        type="checkbox"
                        checked={smsNotify}
                        onChange={(e) => setSmsNotify(e.target.checked)}
                        className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer brand-text-primary brand-ring-primary"
                      />
                    </div>
                    <label htmlFor="smsNotify" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none leading-normal">
                      {t("customer_sms_notify_label")}
                    </label>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="flex items-center h-5">
                      <input
                        id="whatsappNotify"
                        type="checkbox"
                        checked={whatsappNotify}
                        onChange={(e) => setWhatsappNotify(e.target.checked)}
                        className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer brand-text-primary brand-ring-primary"
                      />
                    </div>
                    <label htmlFor="whatsappNotify" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none leading-normal">
                      {t("customer_whatsapp_notify_label")}
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5 px-1">{t("customer_field_email")}</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => {
                    setCustomerEmail(e.target.value);
                    if (!e.target.value.trim()) {
                      setEmailNotify(false);
                    }
                  }}
                  placeholder={t("customer_email_placeholder")}
                  dir="ltr"
                  className={`w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white text-slate-900 text-sm font-semibold px-4 py-3.5 rounded-2xl outline-none transition-all placeholder:text-slate-300 brand-focus ${isRtl ? "text-right" : "text-left"}`}
                />
              </div>

              {customerEmail.trim() && (
                <div className="flex items-start gap-3 bg-indigo-50/50 border border-indigo-100/50 p-4 rounded-2xl transition-all brand-bg-light">
                  <div className="flex items-center h-5">
                    <input
                      id="emailNotify"
                      type="checkbox"
                      checked={emailNotify}
                      onChange={(e) => setEmailNotify(e.target.checked)}
                      className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer brand-text-primary brand-ring-primary"
                    />
                  </div>
                  <label htmlFor="emailNotify" className="text-xs font-bold text-indigo-950 cursor-pointer select-none leading-relaxed">
                    {t("customer_email_notify")}
                  </label>
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5 px-1">{t("customer_field_service")}</label>
                <div className="space-y-2">
                  {services.length > 0 ? (
                    services.map((service) => (
                      <label 
                        key={service.id} 
                        className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                          selectedServiceId === service.id
                            ? "bg-indigo-50/50 border-indigo-600 text-indigo-900 shadow-sm brand-bg-light brand-border-primary"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="selectedService"
                            value={service.id}
                            checked={selectedServiceId === service.id}
                            onChange={() => setSelectedServiceId(service.id)}
                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer brand-text-primary brand-ring-primary"
                          />
                          <div>
                            <span className="text-sm font-bold block">{service.name}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                              {t("customer_wait_time_estimate", { minutes: service.avgDurationMinutes })}
                            </span>
                          </div>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs font-semibold">
                      {t("customer_service_not_added")}
                    </div>
                  )}
                </div>
              </div>

              {/* Future Scheduling Section */}
              <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200/60 space-y-3">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => {
                  const val = !isScheduled;
                  setIsScheduled(val);
                  if (val) {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    setScheduledDate(todayStr);
                    setScheduledTime("10:00");
                  }
                }}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-black text-slate-800">{t("customer_schedule_later")}</span>
                    <span className="text-[10px] text-slate-500">{t("customer_schedule_later_desc")}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isScheduled}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setIsScheduled(val);
                      if (val) {
                        const todayStr = new Date().toISOString().slice(0, 10);
                        setScheduledDate(todayStr);
                        setScheduledTime("10:00");
                      }
                    }}
                    className="accent-indigo-600 w-4.5 h-4.5 cursor-pointer"
                  />
                </div>

                {isScheduled && (
                  <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-200/40 animate-fade-in animate-duration-200">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">{t("customer_appointment_date")}</label>
                      <input
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        required={isScheduled}
                        className="w-full bg-white border border-slate-200 px-3 py-2.5 rounded-2xl text-xs font-bold text-slate-800 focus:border-indigo-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">{t("customer_appointment_time")}</label>
                      <select
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        required={isScheduled}
                        className="w-full bg-white border border-slate-200 px-3 py-2.5 rounded-2xl text-xs font-bold text-slate-800 focus:border-indigo-500 outline-none cursor-pointer"
                      >
                        <option value="08:00">08:00 AM</option>
                        <option value="08:30">08:30 AM</option>
                        <option value="09:00">09:00 AM</option>
                        <option value="09:30">09:30 AM</option>
                        <option value="10:00">10:00 AM</option>
                        <option value="10:30">10:30 AM</option>
                        <option value="11:00">11:00 AM</option>
                        <option value="11:30">11:30 AM</option>
                        <option value="12:00">12:00 PM</option>
                        <option value="12:30">12:30 PM</option>
                        <option value="13:00">01:00 PM</option>
                        <option value="13:30">01:30 PM</option>
                        <option value="14:00">02:00 PM</option>
                        <option value="14:30">02:30 PM</option>
                        <option value="15:00">03:00 PM</option>
                        <option value="15:30">03:30 PM</option>
                        <option value="16:00">04:00 PM</option>
                        <option value="16:30">04:30 PM</option>
                        <option value="17:00">05:00 PM</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={joining || services.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm py-4 rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-6 shadow-md shadow-indigo-100 cursor-pointer brand-bg-primary"
              >
                {joining ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <TicketIcon className="w-5 h-5" />
                    <span>{isScheduled ? t("customer_confirm_scheduled_booking") : t("customer_btn_join")}</span>
                  </>
                )}
              </button>
            </form>

            <div className="text-center mt-6">
              <button
                type="button"
                onClick={handleTestAudio}
                className="text-[10px] font-black text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1.5 mx-auto py-1 px-3 bg-slate-50 border border-slate-200 rounded-full hover:scale-102 active:scale-98 transition-all cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{t("customer_audio_test_btn")}</span>
              </button>
            </div>

            {/* Premium PWA Installation Card (Join Screen) */}
            {!isStandalone && (
              <div className="mt-6 bg-slate-50/50 dark:bg-slate-900 border-2 border-dashed border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div className={isRtl ? "text-right" : "text-left"}>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">
                      {t("customer_pin_to_home_title")}
                    </h4>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-1">
                      {t("customer_pin_to_home_desc")}
                    </p>
                  </div>
                </div>

                {deferredPrompt ? (
                  <button
                    type="button"
                    onClick={handleInstallPWA}
                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black text-xs py-3 rounded-2xl transition-all shadow-md shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4 animate-bounce" />
                    <span>{t("customer_install_now_btn")}</span>
                  </button>
                ) : (
                  <div className="bg-white dark:bg-slate-950/25 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800/60 text-slate-700 dark:text-slate-300 space-y-2">
                    <div className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      {t("customer_quick_install_steps")}
                    </div>
                    {/iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent) ? (
                      <p className="text-[10.5px] leading-relaxed font-semibold">
                        {t("customer_install_safari_step")}
                      </p>
                    ) : (
                      <p className="text-[10.5px] leading-relaxed font-semibold">
                        {t("customer_install_chrome_step")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
          )
        ) : (
          /* STEP 2: The Ticket Board (Boarding Pass UI!) */
          <motion.div 
            key="ticket-board"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="space-y-4"
          >
            
            {/* Real boarding pass card layout */}
            <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden relative ticket-notch">
              
              {/* Card top stripe */}
              <div 
                className="text-white p-5 flex items-center justify-between border-b border-dashed"
                style={{ 
                  backgroundColor: shop.ticketColor || "#1e1b4b",
                  borderBottomColor: shop.ticketColor ? `${shop.ticketColor}33` : "#1e1b4b"
                }}
              >
                <div className="flex items-center gap-3">
                  {shop.logoUrl ? (
                    <img 
                      src={shop.logoUrl} 
                      alt="Logo" 
                      className="w-10 h-10 rounded-xl object-cover bg-white p-0.5 border border-white/20 shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/85">
                      <TicketIcon className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] font-extrabold opacity-70 block tracking-wider uppercase">
                      {t("customer_boarding_gate")}
                    </span>
                    <h3 className="text-base font-black tracking-tight">{shop.name}</h3>
                  </div>
                </div>
              </div>

              {/* Status Header Block */}
              <div className="p-6 text-center space-y-6">
                
                {myTicket.id.startsWith("offline_") && (
                  <div className="mx-auto max-w-sm bg-amber-50/85 border border-amber-200/80 text-amber-800 text-xs font-semibold py-3 px-4 rounded-2xl flex flex-col items-center gap-1.5 text-center shadow-sm">
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                      <span>{t("customer_offline_ticket")}</span>
                    </div>
                    <span className="text-[10px] text-amber-700 leading-normal font-medium">
                      {t("customer_offline_ticket_desc")}
                    </span>
                  </div>
                )}
                
                {/* Dynamic Status Display Banners */}
                {myTicket.status === "waiting" && (
                  <div 
                    className="bg-blue-50/50 border text-xs font-bold py-2.5 px-4 rounded-full inline-flex items-center justify-center gap-2"
                    style={{ 
                      color: shop.ticketColor || "#1e1b4b",
                      borderColor: shop.ticketColor ? `${shop.ticketColor}22` : "#bfdbfe",
                      backgroundColor: shop.ticketColor ? `${shop.ticketColor}08` : "#f0f9ff"
                    }}
                  >
                    <span 
                      className="w-2 h-2 rounded-full animate-ping"
                      style={{ backgroundColor: shop.ticketColor || "#3b82f6" }}
                    />
                    <span>{t("ticket_status_waiting")}</span>
                  </div>
                )}

                {myTicket.status === "waiting" && pushPermission !== "granted" && (
                  <div className="mx-auto max-w-sm bg-indigo-50/50 dark:bg-indigo-950/25 border border-indigo-100/50 dark:border-indigo-900/40 rounded-2xl p-4 text-center flex flex-col items-center gap-2.5">
                    <div className="flex items-center gap-1.5 font-extrabold text-indigo-950 dark:text-indigo-200 text-xs">
                      <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-bounce" />
                      <span>{t("customer_enable_live_notifications")}</span>
                    </div>
                    <p className="text-[10px] text-indigo-700/85 dark:text-indigo-400/95 font-semibold leading-relaxed">
                      {t("customer_enable_notifications_desc")}
                    </p>
                    <button
                      type="button"
                      onClick={handleRequestPushPermission}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] py-2.5 rounded-xl transition-all shadow-md active:scale-97 cursor-pointer"
                    >
                      {t("customer_enable_notifications_now")}
                    </button>
                  </div>
                )}

                {myTicket.status === "calling" && (
                  <div 
                    className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold py-4 px-5 rounded-2xl flex flex-col items-center justify-center gap-2 animate-bounce shadow-md"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-sm font-black">{t("ticket_status_calling")} 🔔</span>
                    </div>
                    <span className="text-[11px] font-semibold opacity-90">{t("ticket_status_calling_sub")}</span>
                    
                    {myTicket.counterNumber && (
                      <div className="mt-1 bg-emerald-600 text-white font-extrabold text-xs px-4 py-1.5 rounded-xl shadow-sm border border-emerald-500/50">
                        {t("customer_proceed_to_counter", { counterNumber: myTicket.counterNumber })}
                      </div>
                    )}

                    <button
                      onClick={handleTestAudio}
                      className="mt-2 inline-flex items-center gap-1 bg-white border border-emerald-200 text-emerald-800 text-[10px] font-black py-1.5 px-3 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>{t("customer_audio_retest_btn")}</span>
                    </button>
                  </div>
                )}

                {myTicket.status === "completed" && (
                  <div className="space-y-4 w-full">
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold py-3.5 px-5 rounded-2xl flex flex-col items-center justify-center gap-1.5">
                      <CheckCircle className="w-8 h-8 text-emerald-600 mb-1" />
                      <span className="text-sm font-black">{t("ticket_status_completed_customer")} 🎉</span>
                      <span className="text-[11px] font-semibold opacity-85">{t("ticket_status_completed_sub")}</span>
                    </div>

                    {/* Customer Service Rating & Feedback */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-5 rounded-2xl text-center space-y-4 shadow-sm">
                      <div className="space-y-1">
                        <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center justify-center gap-1.5">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                          <span>{t("customer_rate_service_title")}</span>
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold leading-relaxed">
                          {t("customer_rate_service_desc")}
                        </p>
                      </div>

                      {myTicket.rating || ratingSuccess ? (
                        /* Submitted Feedback / Read-only state */
                        <div className="space-y-4 pt-1 text-left">
                          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-100/50 dark:border-emerald-900/30 text-center">
                            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-black block">
                              {t("cust_rating_success_msg")}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3.5 pt-2.5">
                            {/* Speed Rating Summary */}
                            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-3 rounded-xl flex flex-col items-center justify-center gap-1.5">
                              <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">
                                {t("customer_rate_service_speed")}
                              </span>
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, idx) => {
                                  const starVal = idx + 1;
                                  const actualSpeedRating = myTicket.ratingSpeed || ratingSpeed || myTicket.rating || rating;
                                  return (
                                    <Star
                                      key={starVal}
                                      className={`w-3.5 h-3.5 ${
                                        starVal <= actualSpeedRating
                                          ? "text-amber-400 fill-amber-400"
                                          : "text-slate-200 dark:text-slate-800"
                                      }`}
                                    />
                                  );
                                })}
                              </div>
                            </div>

                            {/* Quality Rating Summary */}
                            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-3 rounded-xl flex flex-col items-center justify-center gap-1.5">
                              <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">
                                {t("customer_rate_service_quality")}
                              </span>
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, idx) => {
                                  const starVal = idx + 1;
                                  const actualQualityRating = myTicket.ratingQuality || ratingQuality || myTicket.rating || rating;
                                  return (
                                    <Star
                                      key={starVal}
                                      className={`w-3.5 h-3.5 ${
                                        starVal <= actualQualityRating
                                          ? "text-amber-400 fill-amber-400"
                                          : "text-slate-200 dark:text-slate-800"
                                      }`}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          
                          {(myTicket.ratingComment || ratingComment) && (
                            <div className="bg-slate-50 dark:bg-slate-800/20 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                              <span className="text-[9px] text-slate-400 font-extrabold block mb-1">
                                {t("customer_rate_service_comments")}
                              </span>
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 italic">
                                "{myTicket.ratingComment || ratingComment}"
                              </p>
                            </div>
                          )}
                        </div>
                      ) : !showFeedbackForm ? (
                        /* Initial Expand/Open Rating Button */
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setShowFeedbackForm(true)}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs py-3.5 px-5 rounded-xl shadow-md shadow-indigo-100 dark:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 hover:scale-[1.01]"
                            style={{ backgroundColor: shop.ticketColor || undefined }}
                          >
                            <Star className="w-4 h-4 fill-current animate-pulse" />
                            <span>{t("customer_rate_service_start")}</span>
                          </button>
                        </div>
                      ) : (
                        /* Dual Feedback Selection form */
                        <div className="space-y-4 pt-2.5 animate-fade-in animate-duration-300">
                          
                          {/* 1. Service Speed Category */}
                          <div className="bg-slate-50 dark:bg-slate-800/20 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-2 text-center">
                            <div className="space-y-0.5">
                              <span className="text-[11px] font-black text-slate-800 dark:text-white block">
                                {t("customer_rate_speed_question")}
                              </span>
                              <span className="text-[9px] text-slate-400">
                                {t("customer_rate_stars_hint")}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-center gap-2">
                              {Array.from({ length: 5 }).map((_, idx) => {
                                const starValue = idx + 1;
                                return (
                                  <button
                                    key={starValue}
                                    type="button"
                                    onClick={() => setRatingSpeed(starValue)}
                                    onMouseEnter={() => setRatingSpeedHover(starValue)}
                                    onMouseLeave={() => setRatingSpeedHover(0)}
                                    className="p-1 focus:outline-none hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                                  >
                                    <Star
                                      className={`w-7 h-7 transition-colors ${
                                        starValue <= (ratingSpeedHover || ratingSpeed)
                                          ? "text-amber-400 fill-amber-400"
                                          : "text-slate-300 dark:text-slate-700"
                                      }`}
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* 2. Service Quality Category */}
                          <div className="bg-slate-50 dark:bg-slate-800/20 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-2 text-center">
                            <div className="space-y-0.5">
                              <span className="text-[11px] font-black text-slate-800 dark:text-white block">
                                {t("customer_rate_quality_question")}
                              </span>
                              <span className="text-[9px] text-slate-400">
                                {t("customer_rate_stars_hint")}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-center gap-2">
                              {Array.from({ length: 5 }).map((_, idx) => {
                                const starValue = idx + 1;
                                return (
                                  <button
                                    key={starValue}
                                    type="button"
                                    onClick={() => setRatingQuality(starValue)}
                                    onMouseEnter={() => setRatingQualityHover(starValue)}
                                    onMouseLeave={() => setRatingQualityHover(0)}
                                    className="p-1 focus:outline-none hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                                  >
                                    <Star
                                      className={`w-7 h-7 transition-colors ${
                                        starValue <= (ratingQualityHover || ratingQuality)
                                          ? "text-amber-400 fill-amber-400"
                                          : "text-slate-300 dark:text-slate-700"
                                      }`}
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Comment & Submit Section */}
                          {ratingSpeed > 0 && ratingQuality > 0 && (
                            <div className="space-y-3 pt-1">
                              <textarea
                                value={ratingComment}
                                onChange={(e) => setRatingComment(e.target.value)}
                                placeholder={t("cust_rating_comment_placeholder")}
                                maxLength={300}
                                rows={3}
                                className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none text-slate-700 dark:text-slate-200"
                              />

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setShowFeedbackForm(false)}
                                  className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer"
                                >
                                  {t("customer_rate_cancel")}
                                </button>

                                <button
                                  type="button"
                                  onClick={handleSubmitRating}
                                  disabled={submittingRating}
                                  className="flex-[2] bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black text-xs py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                                  style={{ backgroundColor: shop.ticketColor || undefined }}
                                >
                                  {submittingRating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <span>{t("cust_rating_submit_btn")}</span>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {myTicket.status === "cancelled" && (
                  <div className="bg-slate-50 border border-slate-100 text-slate-500 text-xs font-bold py-3.5 px-5 rounded-2xl flex flex-col items-center justify-center gap-1.5">
                    <XCircle className="w-8 h-8 text-slate-400 mb-1" />
                    <span className="text-sm font-black">{t("ticket_status_cancelled_customer")}</span>
                    <span className="text-[11px] font-semibold opacity-85">{t("ticket_status_cancelled_sub")}</span>
                  </div>
                )}

                {myTicket.status === "no_show" && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-800 text-xs font-bold py-3.5 px-5 rounded-2xl flex flex-col items-center justify-center gap-1.5">
                    <AlertCircle className="w-8 h-8 text-rose-600 mb-1" />
                    <span className="text-sm font-black">{t("ticket_status_noshow_customer")} ⚠️</span>
                    <span className="text-[11px] font-semibold opacity-85">{t("ticket_status_noshow_sub")}</span>
                  </div>
                )}

                {/* Big Boarding Queue Number */}
                <div className="py-4 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-slate-400 font-extrabold block uppercase tracking-wider mb-1">{t("ticket_number_label")}</span>
                  <div className="flex items-center gap-2 justify-center">
                    <motion.div 
                      key={myTicket.ticketNumber}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 12 }}
                      className="text-7xl font-black tracking-tight font-mono"
                      style={{ color: shop.ticketColor || "#4f46e5" }}
                    >
                      {String(myTicket.ticketNumber).padStart(2, "0")}
                    </motion.div>
                    {myTicket.isPriority && (
                      <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm animate-pulse shrink-0">
                        <Sparkles className="w-3 h-3" />
                        <span>VIP / {t("customer_priority_badge")}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 font-semibold mt-1 block">{t("customer_field_name")}: {myTicket.customerName}</span>
                </div>

                {/* Visual Queue Progress Tracker */}
                {myTicket.status === "waiting" && (
                  <div className="w-full bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3 mt-2 mb-4">
                    <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                        <span>{t("customer_progress_tracker")}</span>
                      </span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-mono font-black">{progressPercent}%</span>
                    </div>

                    {/* Progress Bar Container */}
                    <div className="relative h-2.5 w-full bg-slate-200 dark:bg-slate-850 rounded-full overflow-visible">
                      {/* Active Progress Filler */}
                      <div 
                        className="absolute h-full rounded-full transition-all duration-1000 ease-out bg-indigo-600"
                        style={{ 
                          width: `${progressPercent}%`,
                          backgroundColor: shop.ticketColor || undefined 
                        }}
                      >
                        {/* Glow effect on progress tip */}
                        <span 
                          className="absolute -right-2 -top-1 w-4.5 h-4.5 rounded-full bg-white dark:bg-slate-950 border-2 border-indigo-500 flex items-center justify-center shadow-md animate-pulse"
                          style={{ borderColor: shop.ticketColor || undefined }}
                        >
                          <span 
                            className="w-1.5 h-1.5 rounded-full bg-indigo-600"
                            style={{ backgroundColor: shop.ticketColor || undefined }}
                          />
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-slate-400 dark:text-slate-500 font-bold">
                      <span>{t("customer_progress_start")}</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-extrabold animate-pulse">
                        {t("customer_expected_turn", {
                          time: (() => {
                            const et = new Date();
                            et.setMinutes(et.getMinutes() + estimatedWaitMinutes);
                            return et.toLocaleTimeString(isRtl ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" });
                          })()
                        })}
                      </span>
                      <span>{t("customer_progress_counter")}</span>
                    </div>
                  </div>
                )}

                {/* Queue Stats grid */}
                <div className="grid grid-cols-2 gap-4 border-t border-dashed border-slate-200 pt-6">
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 font-bold block mb-1">{t("customer_waitlist_ahead")}</span>
                    <div className="flex items-center justify-center gap-1.5">
                      <Users className="w-4 h-4 text-slate-400" />
                      <motion.span 
                        key={peopleInFront}
                        initial={{ scale: 0.8, opacity: 0.5 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 15 }}
                        className="text-lg font-black text-slate-800 dark:text-slate-100 block"
                      >
                        {myTicket.status === "waiting" ? t("customer_waiting_people", { count: peopleInFront }) : "0"}
                      </motion.span>
                    </div>
                  </div>

                  <div className={`text-center ${isRtl ? "border-r" : "border-l"} border-slate-100`}>
                    <span className="text-[10px] text-slate-400 font-bold block mb-1">{t("customer_approx_wait_time")}</span>
                    <div className="flex items-center justify-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <motion.span 
                        key={estimatedWaitMinutes}
                        initial={{ scale: 0.8, opacity: 0.5 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 15 }}
                        className="text-lg font-black text-slate-800 dark:text-slate-100 block"
                      >
                        {myTicket.status === "waiting" ? t("customer_wait_minutes", { minutes: estimatedWaitMinutes }) : t("customer_now")}
                      </motion.span>
                    </div>
                  </div>
                </div>

                {/* AI-Powered Estimate */}
                {myTicket.status === "waiting" && (
                  <div className="mt-5 text-center">
                    <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/20 dark:to-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 w-full shadow-sm">
                      <div className="flex items-center justify-between w-full border-b border-indigo-100 dark:border-indigo-950/40 pb-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-black text-indigo-800 dark:text-indigo-200">
                          <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse shrink-0" />
                          <span>{t("customer_ai_predictor_title")}</span>
                        </div>
                        <span className="text-[9px] bg-indigo-200/55 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {t("customer_ai_predictor_active")}
                        </span>
                      </div>

                      {/* AI Response Text */}
                      <div className="w-full text-start py-1">
                        {aiEstimateLoading ? (
                          <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                            <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                            <span className="text-[10px] text-indigo-500/70 font-semibold animate-pulse">
                              {t("customer_ai_analyzing_msg")}
                            </span>
                          </div>
                        ) : aiEstimateMessage ? (
                          <p className="text-[11px] font-semibold leading-relaxed text-indigo-900 dark:text-indigo-200 text-center">
                            {aiEstimateMessage}
                          </p>
                        ) : (
                          <p className="text-[11px] font-semibold leading-relaxed text-indigo-900 dark:text-indigo-200 text-center">
                            {t("customer_ai_default_response", { minutes: estimatedWaitMinutes })}
                          </p>
                        )}
                      </div>

                      {/* Telemetry Grid / Smart Analytics Breakdown */}
                      <div className="grid grid-cols-3 gap-2 w-full pt-2 border-t border-indigo-100 dark:border-indigo-950/30 text-center">
                        <div className="bg-white/60 dark:bg-slate-900/40 p-2 rounded-xl border border-indigo-50 dark:border-indigo-950/20">
                          <span className="text-[8px] text-indigo-400 dark:text-indigo-500 font-extrabold block uppercase tracking-wider">
                            {t("customer_ai_service_rate")}
                          </span>
                          <span className="text-[11px] font-black text-indigo-900 dark:text-indigo-200 mt-0.5 block">
                            {t("customer_ai_service_rate_val", { minutes: calculatedAvgServiceTime })}
                          </span>
                        </div>
                        <div className="bg-white/60 dark:bg-slate-900/40 p-2 rounded-xl border border-indigo-50 dark:border-indigo-950/20">
                          <span className="text-[8px] text-indigo-400 dark:text-indigo-500 font-extrabold block uppercase tracking-wider">
                            {t("customer_ai_active_windows")}
                          </span>
                          <span className="text-[11px] font-black text-indigo-900 dark:text-indigo-200 mt-0.5 block">
                            {t("customer_ai_active_windows_val", { count: activeCountersCount })}
                          </span>
                        </div>
                        <div className="bg-white/60 dark:bg-slate-900/40 p-2 rounded-xl border border-indigo-50 dark:border-indigo-950/20">
                          <span className="text-[8px] text-indigo-400 dark:text-indigo-500 font-extrabold block uppercase tracking-wider">
                            {t("customer_ai_congestion")}
                          </span>
                          <span className="text-[11px] font-black text-indigo-900 dark:text-indigo-200 mt-0.5 block">
                            {peopleInFront > 5 
                              ? t("customer_ai_congestion_high") 
                              : peopleInFront > 2 
                                ? t("customer_ai_congestion_medium") 
                                : t("customer_ai_congestion_low")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}


                {/* Integration Options (WhatsApp & Google Calendar) */}
                {myTicket.status === "waiting" && (
                  <div className="mt-6 pt-5 border-t border-dashed border-slate-200 space-y-4">
                    
                    {/* WhatsApp ticket sending option */}
                    <div className="bg-emerald-50/40 dark:bg-emerald-950/20 rounded-2xl p-4 w-full border border-emerald-100/30 dark:border-emerald-800/20 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
                          {t("customer_whatsapp_section_title")}
                        </h4>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-3 leading-relaxed">
                        {t("customer_whatsapp_section_desc")}
                      </p>
                      
                      <div className="space-y-3 max-w-sm mx-auto">
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 mb-1 px-1">
                            {t("customer_whatsapp_input_label")}
                          </label>
                          <input
                            type="tel"
                            value={whatsappPhone}
                            onChange={(e) => setWhatsappPhone(e.target.value)}
                            placeholder={t("customer_whatsapp_input_placeholder")}
                            dir="ltr"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-semibold px-3 py-2.5 rounded-xl outline-none focus:border-emerald-500 transition-all text-center brand-focus"
                          />
                        </div>
                        
                        <a
                          href={getWhatsAppUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3 px-4 rounded-xl transition-all shadow-md shadow-emerald-100/50 dark:shadow-none hover:scale-[1.01] active:scale-99 cursor-pointer"
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.864.002-2.637-1.03-5.114-2.905-6.99C16.546 1.88 14.078.845 11.442.844c-5.441 0-9.865 4.422-9.87 9.865-.001 1.802.495 3.56 1.438 5.114L1.93 21.567l5.881-1.542zm11.365-5.393c-.313-.156-1.85-.913-2.128-1.015-.279-.1-.482-.15-.683.15-.202.3-.777.979-.953 1.18-.176.2-.352.226-.665.07-1.298-.65-2.118-1.12-2.952-2.558-.231-.4-.084-.617.073-.773.14-.14.313-.365.469-.548.156-.182.209-.313.313-.522.105-.209.052-.391-.026-.547-.078-.156-.683-1.644-.936-2.251-.247-.593-.498-.513-.683-.522-.176-.008-.377-.01-.578-.01-.202 0-.53.075-.808.377-.279.301-1.063 1.041-1.063 2.537 0 1.497 1.088 2.943 1.24 3.144.151.202 2.141 3.27 5.19 4.584.724.312 1.29.499 1.731.639.728.231 1.39.198 1.912.12.583-.087 1.85-.756 2.11-1.448.261-.692.261-1.285.183-1.411-.078-.125-.285-.201-.599-.356z"/>
                          </svg>
                          <span>{t("customer_whatsapp_btn_send")}</span>
                        </a>
                      </div>
                    </div>
 
                     {/* Google Calendar Box */}
                     <div className="bg-indigo-50/40 dark:bg-slate-900/40 rounded-2xl p-4 w-full border border-indigo-100/30 dark:border-slate-800/50 text-center">
                       <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mb-3">
                         {t("customer_add_to_calendar_desc")}
                       </p>
                       <a
                         href={getGoogleCalendarUrl()}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-5 py-3 rounded-xl transition-all shadow-md shadow-indigo-100/80 hover:scale-[1.02] active:scale-98 cursor-pointer"
                         style={{
                           backgroundColor: shop.ticketColor || undefined,
                           boxShadow: shop.ticketColor ? `0 4px 12px ${shop.ticketColor}25` : undefined
                         }}
                       >
                         <Calendar className="w-4 h-4" />
                         <span>{t("customer_add_to_calendar")}</span>
                       </a>
                     </div>
                   </div>
                 )}

                {/* Bottom Barcode Decorative Element */}
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800/80 flex flex-col items-center justify-center">
                  <div className="text-xs font-bold text-slate-400 mb-2">{t("ticket_link_label")}</div>
                  <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 px-4 py-2 rounded-xl text-[10px] text-indigo-600 dark:text-indigo-400 font-bold dir-ltr block truncate max-w-full">
                    {window.location.origin}/?shop={shop.slug}&ticketId={myTicket.id}
                  </div>
                  
                  {/* Share and Copy Action Buttons */}
                  <div className="flex gap-2.5 w-full max-w-xs mt-3 mb-1">
                    <button
                      id="btn-copy-ticket-link"
                      type="button"
                      onClick={handleCopyLink}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs py-2.5 px-3 rounded-xl transition-all active:scale-98 cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>{t("customer_copied_msg")}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{t("customer_copy_link_btn")}</span>
                        </>
                      )}
                    </button>

                    <button
                      id="btn-share-ticket-link"
                      type="button"
                      onClick={handleShareLink}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 font-black text-xs py-2.5 px-3 rounded-xl border border-indigo-100/30 dark:border-indigo-900/30 transition-all active:scale-98 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{t("customer_share_link_btn")}</span>
                    </button>
                  </div>

                  <div className="flex gap-1 items-center justify-center h-8 mt-4 w-48 opacity-40">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <div 
                        key={i} 
                        className="bg-slate-900 dark:bg-slate-100 h-full" 
                        style={{ width: `${(i % 3 === 0 ? 3 : i % 2 === 0 ? 1 : 2)}px` }} 
                      />
                    ))}
                  </div>
                </div>

              </div>

            </div>

            {/* Live Counter/Table Status Card */}
            {counterStatuses.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    {t("customer_live_counters_status")}
                  </h4>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {counterStatuses.map((counter) => {
                    const statusColors = {
                      online: "bg-emerald-500",
                      busy: "bg-amber-500",
                      break: "bg-orange-500",
                      offline: "bg-slate-500"
                    };
                    const statusLabel = t(`customer_status_${counter.status}` as any);
                    
                    return (
                      <div 
                        key={counter.id} 
                        className="bg-slate-50/60 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60 p-3 rounded-2xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${statusColors[counter.status] || "bg-slate-500"} animate-pulse`} />
                          <span className="font-extrabold text-slate-800 dark:text-slate-200 truncate">
                            {t("customer_counter_window_label", { number: counter.counterNumber })}
                          </span>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          counter.status === "online" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" :
                          counter.status === "busy" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" :
                          counter.status === "break" ? "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400" :
                          "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}>
                          {statusLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sound Alerts Setting Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 brand-bg-light brand-text-primary">
                    {soundEnabled ? (
                      <Volume2 className="w-5 h-5 animate-pulse" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                    )}
                  </div>
                  <div className={isRtl ? "text-right" : "text-left"}>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">
                      {t("customer_sound_alerts")}
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-normal mt-0.5">
                      {t("customer_sound_alerts_desc")}
                    </p>
                  </div>
                </div>

                {/* Styled iOS-like Switch Button */}
                <button
                  type="button"
                  onClick={handleToggleSound}
                  className={`w-11 h-6 rounded-full p-0.5 transition-all duration-200 cursor-pointer outline-none shrink-0 flex items-center ${
                    soundEnabled ? "bg-indigo-600 justify-end brand-bg-primary" : "bg-slate-200 dark:bg-slate-800 justify-start"
                  }`}
                  aria-label={soundEnabled ? t("customer_sound_enabled") : t("customer_sound_disabled")}
                >
                  <div className="bg-white w-5 h-5 rounded-full shadow-md transition-all duration-200" />
                </button>
              </div>

              {/* Quick test button */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                  {soundEnabled ? t("customer_sound_enabled") : t("customer_sound_disabled")}
                </span>
                <button
                  type="button"
                  onClick={handleTestAudio}
                  className="text-[10px] font-black text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/60 rounded-lg px-2.5 py-1.5 transition-all active:scale-97 cursor-pointer brand-text-primary-hover"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{t("customer_audio_test_btn")}</span>
                </button>
              </div>
            </div>

            {/* Live Browser Push Notification Card */}
            {pushPermission !== "granted" ? (
              <div className="bg-white border-2 border-dashed border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className={isRtl ? "text-right" : "text-left"}>
                    <h4 className="text-xs font-black text-slate-900">
                      {t("customer_push_notify_btn")}
                    </h4>
                    <p className="text-[10.5px] text-slate-500 font-semibold leading-relaxed mt-1">
                      {t("customer_push_notify_desc")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRequestPushPermission}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs py-3 rounded-2xl transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer brand-bg-primary"
                >
                  <Bell className="w-4 h-4" />
                  <span>{t("customer_push_notify_btn")}</span>
                </button>
              </div>
            ) : (
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-3xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Bell className="w-4.5 h-4.5" />
                  </div>
                  <div className={isRtl ? "text-right" : "text-left"}>
                    <h4 className="text-[11px] font-black text-emerald-950">
                      {t("customer_push_notify_enabled")}
                    </h4>
                    <p className="text-[10px] text-emerald-700/80 font-bold mt-0.5 leading-none">
                      {t("customer_pwa_pop_alerts_msg")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSendTestNotification}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] py-1.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5 animate-pulse" />
                  <span>{t("vend_browser_notifications_test", "Send Test Notification 🧪")}</span>
                </button>
              </div>
            )}

            {/* Notification Diagnostics Widget */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
              <button
                type="button"
                onClick={() => setShowDiagnosticsPanel(!showDiagnosticsPanel)}
                className="w-full flex items-center justify-between group cursor-pointer outline-none"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/40 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    <Wrench className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className={isRtl ? "text-right" : "text-left"}>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      {t("diag_tool_title", "Notification Diagnostic Tool")}
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-normal mt-0.5">
                      {t("diag_tool_subtitle", "Diagnose alert delivery on Samsung, Xiaomi, and iOS.")}
                    </p>
                  </div>
                </div>
                <div className="text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {showDiagnosticsPanel ? (
                    <span className="text-xs font-bold">▲</span>
                  ) : (
                    <span className="text-xs font-bold">▼</span>
                  )}
                </div>
              </button>

              {showDiagnosticsPanel && (
                <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 space-y-4">
                  {/* Active Alerts Check */}
                  {pushPermission === "denied" && (
                    <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 p-3 rounded-2xl flex gap-2.5 items-start">
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div className={`text-[10px] font-bold text-rose-800 dark:text-rose-300 leading-relaxed ${isRtl ? "text-right" : "text-left"}`}>
                        <strong>{t("diag_blocked_warning", "Warning: Notifications Blocked!")}</strong>
                        <p className="mt-0.5 font-medium">
                          {t("diag_blocked_desc", "You have blocked notifications. Please click the lock icon 🔒 next to the address bar to reset the permissions.")}
                        </p>
                      </div>
                    </div>
                  )}

                  {!isStandalone && /iPhone|iPad|iPod/i.test(navigator.userAgent) && (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-150 dark:border-amber-900/40 p-3 rounded-2xl flex gap-2.5 items-start">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className={`text-[10px] font-bold text-amber-800 dark:text-amber-300 leading-relaxed ${isRtl ? "text-right" : "text-left"}`}>
                        <strong>{t("diag_ios_warning", "Crucial for iOS (iPhone):")}</strong>
                        <p className="mt-0.5 font-medium">
                          {t("diag_ios_desc", "Apple iOS restricts notifications to Home Screen apps. Tap the Share button 📤, then select 'Add to Home Screen' 📲, and launch it from there.")}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Checklist of diagnostics */}
                  <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60 p-3.5 rounded-2xl space-y-2.5">
                    <div className={`text-[10px] font-black text-slate-400 uppercase tracking-wider ${isRtl ? "text-right" : "text-left"}`}>
                      {t("diag_results_title", "Diagnostic Check Results")}
                    </div>

                    {/* 1. Browser API Support */}
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span className="text-slate-600 dark:text-slate-400">{t("diag_browser_support", "Browser Notification Support")}</span>
                      {"Notification" in window ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> {t("diag_supported", "Supported")}
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 font-extrabold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5 text-rose-500" /> {t("diag_unsupported", "Unsupported")}
                        </span>
                      )}
                    </div>

                    {/* 2. Permission Status */}
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span className="text-slate-600 dark:text-slate-400">{t("diag_permission_status", "Browser Permission Status")}</span>
                      {pushPermission === "granted" ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> {t("diag_granted", "Granted")}
                        </span>
                      ) : pushPermission === "denied" ? (
                        <span className="text-rose-600 dark:text-rose-400 font-extrabold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5 text-rose-500" /> {t("diag_denied", "Denied")}
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-extrabold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> {t("diag_default", "Default / Unset")}
                        </span>
                      )}
                    </div>

                    {/* 3. Standalone Mode */}
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span className="text-slate-600 dark:text-slate-400">{t("diag_standalone_mode", "PWA App Installation Mode")}</span>
                      {isStandalone ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> {t("diag_standalone_yes", "Yes (PWA Standalone)")}
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-500 font-extrabold flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400" /> {t("diag_standalone_no", "Browser Tab")}
                        </span>
                      )}
                    </div>

                    {/* 4. Background Service worker */}
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span className="text-slate-600 dark:text-slate-400">{t("diag_sw_engine", "Service Worker Engine")}</span>
                      {"serviceWorker" in navigator && navigator.serviceWorker.controller ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> {t("diag_sw_active", "Active & Running")}
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-extrabold flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> {t("diag_sw_idle", "Initializing / Idle")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Brand specific guides */}
                  <div className="space-y-2">
                    <div className={`text-[10px] font-black text-slate-400 uppercase tracking-wider ${isRtl ? "text-right" : "text-left"}`}>
                      {t("diag_guides_title", "Brand Troubleshooting & Configuration Guides")}
                    </div>

                    {/* Xiaomi */}
                    <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                      <button
                        type="button"
                        onClick={() => setOpenTroubleshootBrand(openTroubleshootBrand === "xiaomi" ? null : "xiaomi")}
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-850/40 text-xs font-extrabold transition-colors cursor-pointer outline-none"
                      >
                        <span className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                          <Smartphone className="w-4 h-4 text-orange-500" />
                          <span>{t("diag_guide_xiaomi", "Xiaomi / POCO / Redmi Devices")}</span>
                        </span>
                        <span className="text-slate-400 dark:text-slate-500">{openTroubleshootBrand === "xiaomi" ? "▲" : "▼"}</span>
                      </button>
                      {openTroubleshootBrand === "xiaomi" && (
                        <div className="p-3.5 bg-slate-50/50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 text-[10.5px] leading-relaxed text-slate-600 dark:text-slate-300 space-y-2">
                          <div className="flex gap-2 items-start">
                            <span className="w-4 h-4 bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</span>
                            <p>{t("diag_xiaomi_step1", "Long press your browser icon (e.g. Chrome) and select 'App Info'.")}</p>
                          </div>
                          <div className="flex gap-2 items-start">
                            <span className="w-4 h-4 bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</span>
                            <p>{t("diag_xiaomi_step2", "Go to 'Battery saver' and select 'No restrictions' to keep it active.")}</p>
                          </div>
                          <div className="flex gap-2 items-start">
                            <span className="w-4 h-4 bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">3</span>
                            <p>{t("diag_xiaomi_step3", "Toggle 'Autostart' on to ensure alerts arrive even when you aren't active.")}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Samsung */}
                    <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                      <button
                        type="button"
                        onClick={() => setOpenTroubleshootBrand(openTroubleshootBrand === "samsung" ? null : "samsung")}
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-850/40 text-xs font-extrabold transition-colors cursor-pointer outline-none"
                      >
                        <span className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                          <Battery className="w-4 h-4 text-blue-500" />
                          <span>{t("diag_guide_samsung", "Samsung Galaxy Devices (OneUI)")}</span>
                        </span>
                        <span className="text-slate-400 dark:text-slate-500">{openTroubleshootBrand === "samsung" ? "▲" : "▼"}</span>
                      </button>
                      {openTroubleshootBrand === "samsung" && (
                        <div className="p-3.5 bg-slate-50/50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 text-[10.5px] leading-relaxed text-slate-600 dark:text-slate-300 space-y-2">
                          <div className="flex gap-2 items-start">
                            <span className="w-4 h-4 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</span>
                            <p>{t("diag_samsung_step1", "Go to Settings > Apps > and select your browser (e.g., Chrome).")}</p>
                          </div>
                          <div className="flex gap-2 items-start">
                            <span className="w-4 h-4 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</span>
                            <p>{t("diag_samsung_step2", "Tap 'Battery' and choose 'Unrestricted' so the system won't freeze background tasks.")}</p>
                          </div>
                          <div className="flex gap-2 items-start">
                            <span className="w-4 h-4 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">3</span>
                            <p>{t("diag_samsung_step3", "Make sure 'Allow background data usage' is toggled ON under Mobile Data.")}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Apple iPhone */}
                    <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                      <button
                        type="button"
                        onClick={() => setOpenTroubleshootBrand(openTroubleshootBrand === "apple" ? null : "apple")}
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-850/40 text-xs font-extrabold transition-colors cursor-pointer outline-none"
                      >
                        <span className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                          <Smartphone className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          <span>{t("diag_guide_apple", "Apple iPhone Devices (iOS Safari)")}</span>
                        </span>
                        <span className="text-slate-400 dark:text-slate-500">{openTroubleshootBrand === "apple" ? "▲" : "▼"}</span>
                      </button>
                      {openTroubleshootBrand === "apple" && (
                        <div className="p-3.5 bg-slate-50/50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 text-[10.5px] leading-relaxed text-slate-600 dark:text-slate-300 space-y-2">
                          <p className="font-extrabold text-indigo-600 dark:text-indigo-400 mb-1">{t("diag_apple_note", "Extremely important note for Apple users:")}</p>
                          <div className="flex gap-2 items-start">
                            <span className="w-4 h-4 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</span>
                            <p>{t("diag_apple_step1", "You must open this page in standard Safari browser (other iOS browsers like Chrome do not support native web push).")}</p>
                          </div>
                          <div className="flex gap-2 items-start">
                            <span className="w-4 h-4 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</span>
                            <p>{t("diag_apple_step2", "Tap the 'Share' button 📤.")}</p>
                          </div>
                          <div className="flex gap-2 items-start">
                            <span className="w-4 h-4 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">3</span>
                            <p>{t("diag_apple_step3", "Select 'Add to Home Screen' 📲 and set any name.")}</p>
                          </div>
                          <div className="flex gap-2 items-start">
                            <span className="w-4 h-4 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">4</span>
                            <p>{t("diag_apple_step4", "Launch the newly installed app from your home screen, then grant permissions.")}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* PWA Installation Card */}
            {showInstallBanner && !isStandalone && (
              <div className="bg-white border-2 border-dashed border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 brand-bg-light brand-text-primary">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div className={isRtl ? "text-right" : "text-left"}>
                    <h4 className="text-xs font-black text-slate-900">
                      {t("customer_pwa_install_ticket_title")}
                    </h4>
                    <p className="text-[10.5px] text-slate-500 font-semibold leading-relaxed mt-1">
                      {t("customer_pwa_install_ticket_desc")}
                    </p>
                  </div>
                </div>

                {deferredPrompt ? (
                  /* Native Prompt Support (Android / Chrome) */
                  <button
                    onClick={handleInstallPWA}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs py-3 rounded-2xl transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer brand-bg-primary"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t("customer_pwa_install_ticket_btn")}</span>
                  </button>
                ) : (
                  /* Manual Instruction Fallback (iOS / Apple Safari or fallback browsers) */
                  <div className="bg-slate-50/70 rounded-2xl p-3.5 border border-slate-100 text-slate-700 space-y-2">
                    <div className={`text-[10px] font-black text-indigo-600 uppercase tracking-wider brand-text-primary ${isRtl ? "text-right" : "text-left"}`}>
                      {t("customer_pwa_install_ticket_guide")}
                    </div>
                    
                    {/* iOS Apple instruction */}
                    {/iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent) ? (
                      <p className={`text-[10.5px] leading-relaxed font-semibold ${isRtl ? "text-right" : "text-left"}`}>
                        {isRtl ? (
                          <>
                            اضغط على زر المشاركة <span className="inline-block bg-white border border-slate-200 px-1.5 py-0.5 rounded text-xs font-mono">⎋</span> أسفل المتصفح، ثم اختر <span className="text-indigo-600 font-bold brand-text-primary">"إضافة إلى الشاشة الرئيسية"</span> <span className="inline-block bg-white border border-slate-200 px-1.5 py-0.5 rounded text-xs font-mono">⊕</span> من القائمة.
                          </>
                        ) : (
                          <>
                            Tap the Share button <span className="inline-block bg-white border border-slate-200 px-1 py-0.5 rounded text-xs font-mono">⎋</span> at the bottom of Safari, then choose <span className="text-indigo-600 font-bold brand-text-primary">"Add to Home Screen"</span> <span className="inline-block bg-white border border-slate-200 px-1 py-0.5 rounded text-xs font-mono">⊕</span> from the list.
                          </>
                        )}
                      </p>
                    ) : (
                      /* General fallback */
                      <p className={`text-[10.5px] leading-relaxed font-semibold ${isRtl ? "text-right" : "text-left"}`}>
                        {isRtl ? (
                          <>
                            اضغط على زر القائمة النقاط الثلاث <span className="font-bold">⋮</span> في زاوية المتصفح، ثم اختر <span className="text-indigo-600 font-bold">"تثبيت التطبيق"</span> أو <span className="text-indigo-600 font-bold">"إضافة إلى الشاشة الرئيسية"</span>.
                          </>
                        ) : (
                          <>
                            Tap the three dots menu <span className="font-bold">⋮</span> in your browser's corner, then choose <span className="text-indigo-600 font-bold">"Install App"</span> or <span className="text-indigo-600 font-bold">"Add to Home Screen"</span>.
                          </>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Cancel/Leave actions and warnings */}
            <div className="flex flex-col gap-2 z-10 relative">
              {["waiting", "calling"].includes(myTicket.status) && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-rose-600 font-bold text-xs py-3.5 rounded-2xl transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-98 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>{t("customer_btn_leave")}</span>
                </button>
              )}

              {["completed", "cancelled", "no_show"].includes(myTicket.status) && (
                <button
                  onClick={() => {
                    unsubscribeFromTicket();
                    localStorage.removeItem(`dork_ticket_${shop.id}`);
                    setMyTicket(null);
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3.5 rounded-2xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-100 active:scale-98 cursor-pointer"
                >
                  <Smile className="w-4 h-4" />
                  <span>{t("customer_btn_join_again")}</span>
                </button>
              )}
            </div>

            {/* Cancel Ticket Confirmation Dialog */}
            {showCancelConfirm && (
              <div 
                id="cancel-confirm-dialog"
                className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
              >
                <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 text-center space-y-5 transform scale-100 transition-all animate-scaleIn">
                  <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 rounded-2xl flex items-center justify-center text-rose-500 dark:text-rose-400 mx-auto">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {t("cancel_confirm_title")}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed px-1">
                      {t("cancel_confirm_desc")}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      id="confirm-cancel-btn"
                      onClick={handleLeaveQueue}
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black text-xs py-3.5 rounded-2xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-rose-100 dark:shadow-none active:scale-98 cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>{t("cancel_confirm_btn")}</span>
                    </button>
                    <button
                      id="cancel-keep-btn"
                      onClick={() => setShowCancelConfirm(false)}
                      className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs py-3.5 rounded-2xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      <span>{t("cancel_keep_btn")}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 5-Customer Limit Alert Modal Component */}
            {showLimitModal && (
              <LimitAlertDialog 
                isOpen={showLimitModal} 
                onClose={() => setShowLimitModal(false)} 
                isRtl={isRtl} 
              />
            )}

            {/* Custom Error Alert Modal Component */}
            {showAlert && (
              <div 
                id="error-alert-dialog"
                className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
              >
                <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 text-center space-y-5 transform scale-100 transition-all animate-scaleIn relative overflow-hidden">
                  {/* Rose alert indicator top line */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-red-500 to-rose-500" />
                  
                  {/* Close button */}
                  <button
                    onClick={() => setShowAlert(false)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer p-1 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800"
                    aria-label="Close"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>

                  {/* Warning / Error icon container */}
                  <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-center justify-center text-rose-500 dark:text-rose-400 mx-auto mt-2 shadow-inner">
                    <AlertCircle className="w-9 h-9 text-rose-500 animate-pulse" />
                  </div>
                  
                  {/* Error details */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      {t("customer_alert_title")}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed px-2 whitespace-pre-line">
                      {errorMessage}
                    </p>
                  </div>

                  {/* Confirmation button */}
                  <div className="pt-2">
                    <button
                      id="close-error-modal-btn"
                      onClick={() => setShowAlert(false)}
                      className="w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-extrabold text-xs py-3.5 rounded-2xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-rose-100 dark:shadow-none active:scale-98 cursor-pointer"
                    >
                      <span>{t("customer_ok_btn")}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* Floating Action Button (FAB) for fast ticket access */}
      <AnimatePresence>
        {showScrollFab && myTicket && (
          <motion.button
            id="fab-scroll-to-ticket"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className={`fixed bottom-6 ${
              isRtl ? "left-6" : "right-6"
            } z-40 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-850 text-white shadow-2xl hover:shadow-indigo-500/25 p-3.5 sm:p-4 rounded-full flex items-center gap-2 border border-indigo-500/30 transition-all cursor-pointer`}
            title={isRtl ? "عرض تذكرتي" : "View My Ticket"}
          >
            <div className="relative">
              <TicketIcon className="w-5 h-5 animate-pulse" />
              <span className="absolute -top-2.5 -right-2 bg-rose-500 text-[9px] font-black tracking-tight px-1.5 py-0.5 rounded-full border border-white shadow-sm flex items-center justify-center min-w-4 h-4">
                {String(myTicket.ticketNumber).padStart(2, "0")}
              </span>
            </div>
            
            <span className="text-xs font-black tracking-wide hidden sm:inline flex items-center gap-1">
              <span>{isRtl ? "تذكرتي" : "My Ticket"}</span>
              <ArrowUp className="w-3.5 h-3.5 inline" />
            </span>
            <span className="sm:hidden bg-white/20 p-1 rounded-full">
              <ArrowUp className="w-3.5 h-3.5" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Modern Custom Share Modal Dialog */}
      <AnimatePresence>
        {showShareModal && myTicket && shop && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShareModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.35 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 text-center space-y-4"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 p-1.5 rounded-full transition-all cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3">
                  <Share2 className="w-6 h-6" />
                </div>

                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {isRtl ? "مشاركة تذكرتك" : "Share Your Ticket"}
                </h3>
                
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-1.5 max-w-[280px]">
                  {isRtl 
                    ? "شارك رابط تذكرتك المباشر لمتابعة حالة دورك في الطابور بسهولة وفي أي وقت"
                    : "Share your direct ticket link to track your queue status easily anytime"}
                </p>
              </div>

              {/* Copy Link Container */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl p-3 flex items-center justify-between gap-2.5">
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold truncate dir-ltr select-all flex-1 text-left">
                  {getDirectTicketUrl()}
                </span>
                
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="shrink-0 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 p-2 rounded-xl transition-all border border-slate-200 dark:border-slate-700 active:scale-95 cursor-pointer flex items-center justify-center"
                  title={isRtl ? "نسخ الرابط" : "Copy Link"}
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  )}
                </button>
              </div>

              {/* Popular Social Destinations */}
              <div className="grid grid-cols-1 gap-2 pt-1">
                {/* WhatsApp */}
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    (isRtl 
                      ? `تابع حالة دوري الرقمي #${myTicket.ticketNumber} مباشرة في طابور الانتظار لدى ${shop.name}:` 
                      : `Track my digital ticket #${myTicket.ticketNumber} live at ${shop.name}:`) + "\n" + getDirectTicketUrl()
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3 rounded-2xl transition-all shadow-sm active:scale-98 cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.864.002-2.637-1.03-5.114-2.905-6.99C16.546 1.88 14.078.845 11.442.844c-5.441 0-9.865 4.422-9.87 9.865-.001 1.802.495 3.56 1.438 5.114L1.93 21.567l5.881-1.542zm11.365-5.393c-.313-.156-1.85-.913-2.128-1.015-.279-.1-.482-.15-.683.15-.202.3-.777.979-.953 1.18-.176.2-.352.226-.665.07-1.298-.65-2.118-1.12-2.952-2.558-.231-.4-.084-.617.073-.773.14-.14.313-.365.469-.548.156-.182.209-.313.313-.522.105-.209.052-.391-.026-.547-.078-.156-.683-1.644-.936-2.251-.247-.593-.498-.513-.683-.522-.176-.008-.377-.01-.578-.01-.202 0-.53.075-.808.377-.279.301-1.063 1.041-1.063 2.537 0 1.497 1.088 2.943 1.24 3.144.151.202 2.141 3.27 5.19 4.584.724.312 1.29.499 1.731.639.728.231 1.39.198 1.912.12.583-.087 1.85-.756 2.11-1.448.261-.692.261-1.285.183-1.411-.078-.125-.285-.201-.599-.356z"/>
                  </svg>
                  <span>{isRtl ? "مشاركة عبر واتساب" : "Share via WhatsApp"}</span>
                </a>

                {/* Telegram */}
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(getDirectTicketUrl())}&text=${encodeURIComponent(
                    isRtl 
                      ? `تابع حالة دوري الرقمي #${myTicket.ticketNumber} مباشرة في طابور الانتظار لدى ${shop.name}:` 
                      : `Track my digital ticket #${myTicket.ticketNumber} live at ${shop.name}:`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-black text-xs py-3 rounded-2xl transition-all shadow-sm active:scale-98 cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0">
                    <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.56 8.18l-1.92 9.04c-.14.65-.53.8-.1.54l-2.93-2.16-1.41 1.36c-.16.16-.29.29-.6.29l.21-2.98 5.42-4.9c.24-.21-.05-.33-.37-.12l-6.7 4.22-2.89-.9c-.63-.2-.64-.63.13-.93l11.29-4.35c.52-.19.98.12.78.91z"/>
                  </svg>
                  <span>{isRtl ? "مشاركة عبر تلغرام" : "Share via Telegram"}</span>
                </a>

                {/* Twitter / X */}
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    (isRtl 
                      ? `تابع حالة دوري الرقمي #${myTicket.ticketNumber} لدى ${shop.name}:` 
                      : `Track my digital ticket #${myTicket.ticketNumber} at ${shop.name}:`) + "\n" + getDirectTicketUrl()
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-950 dark:bg-slate-850 dark:hover:bg-slate-800 text-white font-black text-xs py-3 rounded-2xl transition-all shadow-sm active:scale-98 cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  <span>{isRtl ? "مشاركة عبر تويتر / X" : "Share via Twitter / X"}</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}

        {showPwaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPwaModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.35 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-2xl z-10 text-center space-y-4"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowPwaModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 p-1.5 rounded-full transition-all cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3">
                  <Smartphone className="w-6 h-6 animate-pulse" />
                </div>

                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {isRtl ? "تثبيت تطبيق 'دورك'" : "Install 'Dork' App"}
                </h3>
                
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-1.5 max-w-[280px]">
                  {isRtl 
                    ? "تابع طابور الانتظار وتذكرتك مباشرة من شاشتك الرئيسية في أي وقت وبسرعة فائقة!"
                    : "Track queue status and your ticket directly from your home screen in one click!"}
                </p>
              </div>

              {/* Instructions container */}
              <div className="bg-slate-50 dark:bg-slate-950/30 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/60 text-slate-700 dark:text-slate-300 space-y-3">
                <div className={`text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider ${isRtl ? "text-right" : "text-left"}`}>
                  {isRtl ? "خطوات التثبيت البسيطة" : "Quick Installation Steps"}
                </div>
                {/iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent) ? (
                  <p className={`text-[11px] leading-relaxed font-bold ${isRtl ? "text-right" : "text-left"}`}>
                    {isRtl ? (
                      <>
                        ١. اضغط على زر المشاركة <span className="inline-block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">⎋</span> في شريط Safari السفلي.
                        <br />
                        ٢. اختر <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">"إضافة إلى الشاشة الرئيسية"</span> <span className="inline-block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">⊕</span> من قائمة الخيارات.
                      </>
                    ) : (
                      <>
                        1. Tap the Share button <span className="inline-block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">⎋</span> at Safari's bottom bar.
                        <br />
                        2. Select <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">"Add to Home Screen"</span> <span className="inline-block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">⊕</span> from the list.
                      </>
                    )}
                  </p>
                ) : (
                  <p className={`text-[11px] leading-relaxed font-bold ${isRtl ? "text-right" : "text-left"}`}>
                    {isRtl ? (
                      <>
                        ١. اضغط على زر الخيارات الثلاث نقاط <span className="font-extrabold">⋮</span> في زاوية المتصفح العليا.
                        <br />
                        ٢. اختر <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">"تثبيت التطبيق"</span> أو <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">"إضافة إلى الشاشة الرئيسية"</span> من القائمة المنسدلة.
                      </>
                    ) : (
                      <>
                        1. Tap the browser options menu <span className="font-extrabold">⋮</span> at the corner.
                        <br />
                        2. Select <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">"Install App"</span> or <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">"Add to Home Screen"</span>.
                      </>
                    )}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowPwaModal(false)}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-850 text-white font-extrabold text-xs py-3.5 rounded-2xl transition-all shadow-md shadow-indigo-100 dark:shadow-none cursor-pointer"
              >
                {isRtl ? "فهمت" : "Got it!"}
              </button>
            </motion.div>
          </div>
        )}

        {inAppAlert.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInAppAlert(prev => ({ ...prev, show: false }))}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 border-2 border-indigo-500/30 dark:border-indigo-500/40 rounded-3xl p-6 shadow-2xl z-10 text-center space-y-4 animate-pulse-border"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setInAppAlert(prev => ({ ...prev, show: false }))}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 p-1.5 rounded-full transition-all cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center">
                {/* Pulsing Bell/Notification Icon */}
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-lg ${
                  inAppAlert.type === "next" 
                    ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 shadow-rose-100 dark:shadow-none" 
                    : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shadow-amber-100 dark:shadow-none"
                }`}>
                  <Bell className="w-7 h-7 animate-bounce" />
                </div>

                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {inAppAlert.title}
                </h3>
                
                <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed mt-2 max-w-[290px]">
                  {inAppAlert.message}
                </p>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setInAppAlert(prev => ({ ...prev, show: false }))}
                  className={`w-full text-white font-extrabold text-xs py-3.5 rounded-2xl transition-all shadow-md cursor-pointer ${
                    inAppAlert.type === "next"
                      ? "bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-850 shadow-rose-100 dark:shadow-none"
                      : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-750 shadow-amber-100 dark:shadow-none"
                  }`}
                >
                  {isRtl ? "حاضر، أنا مستعد! 👍" : "I am ready! 👍"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
