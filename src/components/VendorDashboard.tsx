import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs,
  orderBy,
  runTransaction
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import { Shop, Service, Ticket, Display, Invoice, WorkingHoursDay, WorkingHours } from "../types";
import { playNewTicketSound, playStatusUpdateSound } from "../lib/audio";
import QRCode from "qrcode";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  QrCode as QrIcon, 
  Settings, Filter, 
  LogOut, 
  Plus, 
  Trash2, 
  Volume2, 
  VolumeX,
  Copy, 
  Download, 
  Check, 
  Loader2, 
  Activity,
  Smile,
  ChevronRight,
  RefreshCw,
  BellRing,
  FileSpreadsheet,
  FileDown,
  Upload,
  Image,
  CalendarRange,
  TrendingUp,
  Info,
  Sparkles,
  Zap,
  Sun,
  Moon,
  Tv,
  ExternalLink,
  CreditCard,
  Lock,
  ShieldCheck,
  Receipt,
  Star,
  Globe
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from "recharts";
import { AnimatePresence, motion } from "motion/react";

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

interface VendorDashboardProps {
  shopId: string;
  onSignOut: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
}

export default function VendorDashboard({ shopId, onSignOut, isDarkMode, setIsDarkMode }: VendorDashboardProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  // Custom confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(null);
      }
    });
  };

  const [shop, setShop] = useState<Shop | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [activeTab, setActiveTab] = useState<"queue" | "services" | "qr" | "reports" | "displays" | "billing">("queue");
  const [displays, setDisplays] = useState<Display[]>([]);
  const [selectedQueueServiceId, setSelectedQueueServiceId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // Billing & Payments (نظام الدفع) States
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // Stripe Billing states
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState("");
  const [stripeVerifying, setStripeVerifying] = useState(false);
  const [stripeVerifySuccess, setStripeVerifySuccess] = useState(false);
  const [stripeVerifyError, setStripeVerifyError] = useState("");

  // Displays Management State
  const [editingDisplayId, setEditingDisplayId] = useState<string | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState<string>("");
  const [refreshingDisplayId, setRefreshingDisplayId] = useState<string | null>(null);

  // Reports & Analytics States
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7); // Default to last 7 days
    return d.toISOString().split("T")[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [exportLoading, setExportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [analyzedTickets, setAnalyzedTickets] = useState<Ticket[] | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // Clipboard copied indicator
  const [copied, setCopied] = useState(false);

  // New Service Form
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState(15);
  const [serviceActionLoading, setServiceActionLoading] = useState(false);

  // QR Code canvas reference
  const qrCanvasRefInternal = useRef<HTMLCanvasElement | null>(null);

  // Edit Shop Settings Form
  const [editShopName, setEditShopName] = useState("");
  const [editShopLogoText, setEditShopLogoText] = useState("");

  const [editShopCategory, setEditShopCategory] = useState("");
  const [editShopLogoUrl, setEditShopLogoUrl] = useState("");
  const [editShopTicketColor, setEditShopTicketColor] = useState("#4f46e5");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Working Hours State
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

  // Audio Notifications Configuration
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("vendor_sound_enabled");
    return saved !== null ? saved === "true" : true;
  });

  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    localStorage.setItem("vendor_sound_enabled", String(soundEnabled));
  }, [soundEnabled]);

  // Active Counter/Window State (for voice alerts on public displays)
  const [activeCounterNumber, setActiveCounterNumber] = useState<string>(() => {
    return localStorage.getItem(`dork_active_counter_${shopId}`) || "1";
  });

  const [counterStatus, setCounterStatus] = useState<"online" | "busy" | "break" | "offline">("online");

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

  // Voice Calling Engine for Vendor Dashboard
  const [voiceAnnouncementsEnabled, setVoiceAnnouncementsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("vendor_voice_enabled");
    return saved !== null ? saved === "true" : true;
  });
  const [voiceLanguage, setVoiceLanguage] = useState<string>(() => {
    return localStorage.getItem("vendor_voice_lang") || "both";
  });
  const [voiceRate, setVoiceRate] = useState<number>(() => {
    const saved = localStorage.getItem("vendor_voice_rate");
    return saved !== null ? parseFloat(saved) : 0.85;
  });

  useEffect(() => {
    localStorage.setItem("vendor_voice_enabled", String(voiceAnnouncementsEnabled));
  }, [voiceAnnouncementsEnabled]);

  useEffect(() => {
    localStorage.setItem("vendor_voice_lang", voiceLanguage);
  }, [voiceLanguage]);

  useEffect(() => {
    localStorage.setItem("vendor_voice_rate", String(voiceRate));
  }, [voiceRate]);

  const announceCallingTicket = (ticketNumber: string, counterNumber: string, serviceName: string) => {
    if (!voiceAnnouncementsEnabled || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel(); // stop current calls
      
      const arabicText = counterNumber
        ? `الرجاء من صاحب التذكرة رقم ${ticketNumber}، التوجه إلى شباك رقم ${counterNumber}`
        : `الرجاء من صاحب التذكرة رقم ${ticketNumber}، التوجه إلى كاونتر الخدمة لخدمة ${serviceName}`;
        
      const englishText = counterNumber
        ? `Ticket number ${ticketNumber}, please proceed to window number ${counterNumber}`
        : `Ticket number ${ticketNumber}, please proceed to service counter for ${serviceName}`;

      let textToSpeak = isRtl ? arabicText : englishText;
      if (voiceLanguage === "both") {
        textToSpeak = `${arabicText}. ${englishText}`;
      } else if (voiceLanguage === "ar") {
        textToSpeak = arabicText;
      } else if (voiceLanguage === "en") {
        textToSpeak = englishText;
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = voiceRate;
      
      const voices = window.speechSynthesis.getVoices();
      if (isRtl || voiceLanguage === "ar") {
        const arVoice = voices.find(v => v.lang.startsWith("ar"));
        if (arVoice) utterance.voice = arVoice;
        utterance.lang = "ar-EG";
      } else {
        const enVoice = voices.find(v => v.lang.startsWith("en"));
        if (enVoice) utterance.voice = enVoice;
        utterance.lang = "en-US";
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Speech Synthesis error:", e);
    }
  };

  // Browser Notifications Configuration
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("vendor_browser_notifications");
    return saved === "true";
  });

  const [maxWaitTimeAlertMinutes, setMaxWaitTimeAlertMinutes] = useState<number>(() => {
    const saved = localStorage.getItem("vendor_max_wait_time");
    return saved !== null ? Number(saved) : 15;
  });

  const browserNotificationsEnabledRef = useRef(browserNotificationsEnabled);
  useEffect(() => {
    browserNotificationsEnabledRef.current = browserNotificationsEnabled;
    localStorage.setItem("vendor_browser_notifications", String(browserNotificationsEnabled));
  }, [browserNotificationsEnabled]);

  useEffect(() => {
    localStorage.setItem("vendor_max_wait_time", String(maxWaitTimeAlertMinutes));
  }, [maxWaitTimeAlertMinutes]);

  const notifiedWaitLimitTicketIds = useRef<Set<string>>(new Set());

  const sendBrowserNotification = (title: string, body: string) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      try {
        new Notification(title, {
          body: body,
          icon: shop?.logoUrl || "/logo.png",
        });
      } catch (err: any) {
        console.warn("Could not instantiate Notification directly on this device:", err.message);
      }
    }
  };

  const sendBrowserNotificationRef = useRef(sendBrowserNotification);
  useEffect(() => {
    sendBrowserNotificationRef.current = sendBrowserNotification;
  });

  const isInitialTicketsLoad = useRef(true);

  // Load Shop details & Real-time Listeners
  useEffect(() => {
    if (!shopId) return;

    let currentShopTimezone = "Asia/Riyadh";

    // Reset initial load tracking on shop change
    isInitialTicketsLoad.current = true;

    // 1. Listen to Shop details
    const shopDocRef = doc(db, "shops", shopId);
    const unsubShop = onSnapshot(shopDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Shop;
        setShop(data);
        currentShopTimezone = data.timezone || "Asia/Riyadh";
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

    // 2. Listen to Services
    const servicesQuery = query(collection(db, "services"), where("shopId", "==", shopId));
    const unsubServices = onSnapshot(servicesQuery, (snapshot) => {
      const servicesList: Service[] = [];
      snapshot.forEach((docSnap) => {
        servicesList.push(docSnap.data() as Service);
      });
      setServices(servicesList);
    }, (error) => {
      console.error("Error listening to services:", error);
      handleFirestoreError(error, OperationType.GET, `services`);
    });

    // 3. Listen to Today's Tickets
    const ticketsQuery = query(
      collection(db, "tickets"),
      where("shopId", "==", shopId)
    );

    const unsubTickets = onSnapshot(ticketsQuery, (snapshot) => {
      const startOfToday = getClientStartOfTodayInTimezone(currentShopTimezone);
      const startOfTodayISO = startOfToday.toISOString();
      
      const ticketsList: Ticket[] = [];
      const allList: Ticket[] = [];
      snapshot.forEach((docSnap) => {
        const ticket = docSnap.data() as Ticket;
        allList.push(ticket);
        if (ticket.createdAt >= startOfTodayISO) {
          ticketsList.push(ticket);
        }
      });
      ticketsList.sort((a, b) => {
        if (a.status === "waiting" && b.status === "waiting") {
          const aPriority = a.isPriority || false;
          const bPriority = b.isPriority || false;
          if (aPriority && !bPriority) return -1;
          if (!aPriority && bPriority) return 1;
        }
        return a.ticketNumber - b.ticketNumber;
      });

      // Check for changes (additions/modifications) for audio alerts and browser notifications
      if (!isInitialTicketsLoad.current) {
        snapshot.docChanges().forEach((change) => {
          const ticket = change.doc.data() as Ticket;
          if (ticket.createdAt < startOfTodayISO) return;
          if (change.type === "added") {
            if (soundEnabledRef.current) {
              playNewTicketSound();
            }
            if (browserNotificationsEnabledRef.current) {
              sendBrowserNotificationRef.current(
                t("vend_new_customer_notif_title", "New Customer Joined! 👤"),
                t("vend_new_customer_notif_body", "Customer {{name}} holds ticket #{{number}} for {{service}}.")
                  .replace("{{name}}", ticket.customerName)
                  .replace("{{number}}", String(ticket.ticketNumber))
                  .replace("{{service}}", ticket.serviceName)
              );
            }
          } else if (change.type === "modified") {
            if (soundEnabledRef.current) {
              playStatusUpdateSound();
            }
          }
        });
      } else {
        isInitialTicketsLoad.current = false;
      }

      setTickets(ticketsList);
      setAllTickets(allList);
    }, (error) => {
      console.error("Error listening to tickets:", error);
      handleFirestoreError(error, OperationType.GET, `tickets`);
    });

    // 4. Listen to Displays
    const displaysQuery = query(collection(db, "displays"), where("shopId", "==", shopId));
    const unsubDisplays = onSnapshot(displaysQuery, (snapshot) => {
      const displaysList: Display[] = [];
      snapshot.forEach((docSnap) => {
        displaysList.push(docSnap.data() as Display);
      });
      setDisplays(displaysList);
    }, (error) => {
      console.error("Error listening to displays:", error);
      handleFirestoreError(error, OperationType.GET, `displays`);
    });

    // 5. Listen to Invoices
    const invoicesQuery = query(collection(db, "shops", shopId, "invoices"));
    const unsubInvoices = onSnapshot(invoicesQuery, (snapshot) => {
      const invoicesList: Invoice[] = [];
      snapshot.forEach((docSnap) => {
        invoicesList.push(docSnap.data() as Invoice);
      });
      invoicesList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setInvoices(invoicesList);
    }, (error) => {
      console.error("Error listening to invoices:", error);
      handleFirestoreError(error, OperationType.GET, `shops/${shopId}/invoices`);
    });

    return () => {
      unsubShop();
      unsubServices();
      unsubTickets();
      unsubDisplays();
      unsubInvoices();
    };
  }, [shopId]);

  // Listen for Stripe Success/Cancel Redirection callbacks on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeStatus = params.get("stripe_status");
    const sessionId = params.get("session_id");
    const paramShopId = params.get("shopId");

    if (stripeStatus && paramShopId && paramShopId === shopId) {
      if (stripeStatus === "success" && sessionId) {
        setStripeVerifying(true);
        setActiveTab("billing"); // Go to billing tab to show status
        
        // Remove query parameters from URL so refreshes don't re-trigger verification
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        fetch(`/api/stripe/verify-session?sessionId=${sessionId}&shopId=${shopId}`)
          .then((res) => {
            if (!res.ok) {
              return res.json().then((errData) => {
                throw new Error(errData.error || "Verification failed");
              });
            }
            return res.json();
          })
          .then((data) => {
            if (data.success) {
              setStripeVerifySuccess(true);
              if (soundEnabledRef.current) {
                playStatusUpdateSound();
              }
            } else {
              setStripeVerifyError(data.error || "Failed to verify session");
            }
          })
          .catch((err) => {
            console.error("Stripe verification error:", err);
            setStripeVerifyError(t("vend_billing_stripe_error", "Payment verification failed, please contact support."));
          })
          .finally(() => {
            setStripeVerifying(false);
          });
      } else if (stripeStatus === "cancel") {
        setActiveTab("billing");
        setStripeVerifyError(t("vend_billing_stripe_cancel", "Payment process was cancelled. No amounts were charged."));
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  }, [shopId, isRtl]);

  // Periodic check for wait time limit exceeded (انتهاء وقت انتظار معين)
  useEffect(() => {
    if (!browserNotificationsEnabled) return;

    const checkWaitTimes = () => {
      const now = Date.now();
      tickets.forEach((ticket) => {
        // Only trigger alerts for waiting status
        if (ticket.status === "waiting") {
          const createdTime = new Date(ticket.createdAt).getTime();
          const minutesWaiting = (now - createdTime) / 60000;
          
          if (minutesWaiting >= maxWaitTimeAlertMinutes) {
            // Check if we already sent notification for this ticket's wait time limit
            if (!notifiedWaitLimitTicketIds.current.has(ticket.id)) {
              notifiedWaitLimitTicketIds.current.add(ticket.id);
              sendBrowserNotification(
                t("vend_wait_limit_notif_title", "⚠️ Wait Time Limit Exceeded!"),
                t("vend_wait_limit_notif_body", "Customer {{name}} (Ticket #{{number}}) has been waiting for more than {{minutes}} minutes without being served!")
                  .replace("{{name}}", ticket.customerName)
                  .replace("{{number}}", String(ticket.ticketNumber))
                  .replace("{{minutes}}", String(Math.round(minutesWaiting)))
              );
            }
          }
        }
      });
    };

    // Run check immediately and then every 10 seconds
    checkWaitTimes();
    const interval = setInterval(checkWaitTimes, 10000);

    return () => clearInterval(interval);
  }, [tickets, browserNotificationsEnabled, maxWaitTimeAlertMinutes, isRtl]);

  // Clean up notifiedWaitLimitTicketIds of tickets that are no longer waiting
  useEffect(() => {
    const activeWaitingIds = new Set(
      tickets.filter(t => t.status === "waiting").map(t => t.id)
    );
    const notifiedIds = notifiedWaitLimitTicketIds.current;
    notifiedIds.forEach(id => {
      if (!activeWaitingIds.has(id)) {
        notifiedIds.delete(id);
      }
    });
  }, [tickets]);

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
      console.log("Email notification dispatched from vendor dashboard:", result);
      return result;
    } catch (err) {
      console.error("Failed to send approaching turn email alert from vendor dashboard:", err);
    }
  };

  const handleToggleBrowserNotifications = async () => {
    if (!("Notification" in window)) {
      alert(t("vend_browser_notifications_not_supported"));
      return;
    }

    if (browserNotificationsEnabled) {
      setBrowserNotificationsEnabled(false);
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setBrowserNotificationsEnabled(true);
      sendBrowserNotification(
        t("vend_notif_welcome_title", "Welcome! 🔔"),
        t("vend_notif_welcome_body", "Popup notifications have been successfully enabled on this browser.")
      );
    } else {
      alert(t("vend_browser_notifications_permission_denied"));
      setBrowserNotificationsEnabled(false);
    }
  };

  const handleSendTestNotification = () => {
    if (!("Notification" in window)) {
      alert(t("vend_browser_notifications_not_supported"));
      return;
    }
    if (Notification.permission !== "granted") {
      alert(t("vend_browser_notifications_permission_denied"));
      return;
    }
    sendBrowserNotification(
      t("vend_notif_test_title", "Test Notification from Dork! 🔔"),
      t("vend_notif_test_body", "Awesome! Notifications are working successfully and extremely fast.")
    );
  };

  // Monitor tickets in real-time to detect when a customer is approaching their turn (exactly 2 people ahead)
  useEffect(() => {
    if (!shop || tickets.length === 0) return;

    // Filter tickets that have opted in for email notifications but haven't been notified yet
    const pendingTickets = tickets.filter(
      t => t.status === "waiting" && t.emailNotify && !t.emailNotified && t.customerEmail
    );

    if (pendingTickets.length === 0) return;

    pendingTickets.forEach(async (ticket) => {
      // Calculate how many waiting people are ahead of this ticket
      const waitingAhead = tickets.filter(
        t => t.status === "waiting" && t.ticketNumber < ticket.ticketNumber
      );
      const peopleAheadCount = waitingAhead.length;

      // Send when exactly 2 people are left ahead in the queue
      if (peopleAheadCount === 2) {
        const ticketRef = doc(db, "tickets", ticket.id);
        try {
          // Perform a Firestore transaction to ensure atomic, single-execution update
          await runTransaction(db, async (transaction) => {
            const freshSnap = await transaction.get(ticketRef);
            if (!freshSnap.exists()) return;
            const freshData = freshSnap.data() as Ticket;

            // Double check inside transaction to prevent concurrent updates from sending multiple emails
            if (freshData.emailNotify && !freshData.emailNotified) {
              transaction.update(ticketRef, { emailNotified: true });
              
              // Call our backend API route
              await sendApproachingNotification(ticket, shop.name, isRtl);
            }
          });
        } catch (err) {
          console.error(`Error processing email alert for ticket #${ticket.ticketNumber}:`, err);
        }
      }
    });
  }, [tickets, shop, isRtl]);

  // Generate QR Code on Settings/QR Tab
  const shopLink = shop ? `${window.location.origin}/?shop=${shop.slug}` : "";

  const qrCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    qrCanvasRefInternal.current = node;
    if (node && shopLink) {
      const qrLib = (QRCode as any).default || QRCode;
      qrLib.toCanvas(
        node,
        shopLink,
        {
          width: 250,
          margin: 1,
          color: {
            dark: "#1e3a8a",
            light: "#ffffff"
          }
        },
        (error: any) => {
          if (error) console.error("Error rendering QR code:", error);
        }
      );
    }
  }, [shopLink]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shopLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    if (!qrCanvasRefInternal.current || !shop) return;
    const canvas = qrCanvasRefInternal.current;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `QR_${shop.slug}.png`;
    link.href = url;
    link.click();
  };

  // Add Service Handler
  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;

    setServiceActionLoading(true);
    try {
      const newServiceRef = doc(collection(db, "services"));
      const newService: Service = {
        id: newServiceRef.id,
        shopId: shopId,
        name: newServiceName.trim(),
        avgDurationMinutes: Number(newServiceDuration),
        isActive: true,
        createdAt: new Date().toISOString()
      };
      await setDoc(newServiceRef, newService);
      setNewServiceName("");
      setNewServiceDuration(15);
    } catch (err) {
      console.error("Error adding service:", err);
      handleFirestoreError(err, OperationType.WRITE, `services`);
    } finally {
      setServiceActionLoading(false);
    }
  };

  // Toggle Service Activation
  const handleToggleService = async (serviceId: string, currentStatus: boolean) => {
    try {
      const serviceDocRef = doc(db, "services", serviceId);
      await updateDoc(serviceDocRef, {
        isActive: !currentStatus
      });
    } catch (err) {
      console.error("Error toggling service status:", err);
      handleFirestoreError(err, OperationType.UPDATE, `services/${serviceId}`);
    }
  };

  // Delete Service Handler
  const handleDeleteService = async (serviceId: string) => {
    showConfirmation(
      t("vend_delete_service_title", { defaultValue: "Delete Service" }),
      t("vend_confirm_delete_service", { defaultValue: "Are you sure you want to delete this service?" }),
      async () => {
        try {
          const serviceDocRef = doc(db, "services", serviceId);
          await deleteDoc(serviceDocRef);
        } catch (err) {
          console.error("Error deleting service:", err);
          handleFirestoreError(err, OperationType.DELETE, `services/${serviceId}`);
        }
      }
    );
  };

  // Update Shop Settings
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

  // Logo file upload drag-and-drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
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
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  // --- Queue Ticket Controls ---

  // Call Next Ticket Handler
  const handleCallNext = async () => {
    const currentCalling = tickets.find(t => t.status === "calling" && (selectedQueueServiceId === "all" || t.serviceId === selectedQueueServiceId));
    if (currentCalling) {
      const docRef = doc(db, "tickets", currentCalling.id);
      try {
        await updateDoc(docRef, { status: "completed", completedAt: new Date().toISOString() });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${currentCalling.id}`);
      }
    }

    const nextWaiting = tickets.find(t => t.status === "waiting" && (selectedQueueServiceId === "all" || t.serviceId === selectedQueueServiceId));
    if (nextWaiting) {
      const docRef = doc(db, "tickets", nextWaiting.id);
      try {
        await updateDoc(docRef, { 
          status: "calling", 
          calledAt: new Date().toISOString(),
          counterNumber: activeCounterNumber
        });
        announceCallingTicket(String(nextWaiting.ticketNumber), activeCounterNumber, nextWaiting.serviceName);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${nextWaiting.id}`);
      }
    } else {
      alert(t("vend_no_waiting_customers_dept", { defaultValue: "There are no waiting customers in this department currently." }));
    }
  };

  // Call specific ticket
  const handleCallTicket = async (ticket: Ticket) => {
    const currentCalling = tickets.find(t => t.status === "calling" && t.id !== ticket.id);
    if (currentCalling) {
      const docRef = doc(db, "tickets", currentCalling.id);
      try {
        await updateDoc(docRef, { status: "completed", completedAt: new Date().toISOString() });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${currentCalling.id}`);
      }
    }

    const docRef = doc(db, "tickets", ticket.id);
    try {
      await updateDoc(docRef, { 
        status: "calling", 
        calledAt: new Date().toISOString(),
        counterNumber: activeCounterNumber
      });
      announceCallingTicket(String(ticket.ticketNumber), activeCounterNumber, ticket.serviceName);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticket.id}`);
    }
  };

  // Update Ticket Status
  const handleUpdateTicketStatus = async (ticketId: string, status: "completed" | "cancelled" | "no_show" | "waiting") => {
    const docRef = doc(db, "tickets", ticketId);
    const updates: any = { status };
    if (status === "completed") {
      updates.completedAt = new Date().toISOString();
    }
    try {
      await updateDoc(docRef, updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
    }
  };

  // Toggle VIP / Priority Status
  const handleTogglePriority = async (ticketId: string, currentPriority: boolean) => {
    const docRef = doc(db, "tickets", ticketId);
    try {
      await updateDoc(docRef, { isPriority: !currentPriority });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
    }
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        handleCallNext();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        const currentCalling = tickets.find(t => t.status === "calling" && (selectedQueueServiceId === "all" || t.serviceId === selectedQueueServiceId));
        if (currentCalling) {
          e.preventDefault();
          handleUpdateTicketStatus(currentCalling.id, "cancelled");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tickets, selectedQueueServiceId]);

  // Export to CSV helper
  const handleExportCSV = (ticketsToExport: Ticket[], filename: string) => {
    if (ticketsToExport.length === 0) {
      alert(t("vend_csv_no_data_error", { defaultValue: "No tickets or data to export in this range." }));
      return;
    }

    const headers = [
      t("vend_csv_header_ticket_number", { defaultValue: "Ticket Number" }),
      t("vend_csv_header_customer_name", { defaultValue: "Customer Name" }),
      t("vend_csv_header_phone_number", { defaultValue: "Phone Number" }),
      t("vend_csv_header_service", { defaultValue: "Service" }),
      t("vend_csv_header_status", { defaultValue: "Status" }),
      t("vend_csv_header_date", { defaultValue: "Date" }),
      t("vend_csv_header_booking_time", { defaultValue: "Booking Time" }),
      t("vend_csv_header_calling_time", { defaultValue: "Calling Time" }),
      t("vend_csv_header_completion_time", { defaultValue: "Completion Time" }),
      t("vend_csv_header_wait_time", { defaultValue: "Wait Time (mins)" }),
      t("vend_csv_header_serving_duration", { defaultValue: "Serving Duration (mins)" }),
      t("vend_csv_header_rating_score", { defaultValue: "Rating Score" }),
      t("vend_csv_header_customer_feedback", { defaultValue: "Customer Feedback" })
    ];

    const currentLocale = i18n.language === 'ar' ? 'ar-EG' : i18n.language === 'tr' ? 'tr-TR' : 'en-US';

    const rows = ticketsToExport.map(tItem => {
      const createdDate = tItem.createdAt ? new Date(tItem.createdAt) : null;
      const calledDate = tItem.calledAt ? new Date(tItem.calledAt) : null;
      const completedDate = tItem.completedAt ? new Date(tItem.completedAt) : null;

      const dateStr = createdDate ? createdDate.toLocaleDateString(currentLocale) : "";
      const bookingTimeStr = createdDate ? createdDate.toLocaleTimeString(currentLocale, { hour: '2-digit', minute: '2-digit' }) : "";
      const callingTimeStr = calledDate ? calledDate.toLocaleTimeString(currentLocale, { hour: '2-digit', minute: '2-digit' }) : "";
      const completionTimeStr = completedDate ? completedDate.toLocaleTimeString(currentLocale, { hour: '2-digit', minute: '2-digit' }) : "";

      let waitTimeMins = "";
      if (calledDate && createdDate) {
        waitTimeMins = Math.round((calledDate.getTime() - createdDate.getTime()) / 60000).toString();
      }

      let serveDurationMins = "";
      if (completedDate && calledDate) {
        serveDurationMins = Math.round((completedDate.getTime() - calledDate.getTime()) / 60000).toString();
      }

      // Translate Status
      let translatedStatus: string = tItem.status;
      if (tItem.status === "waiting") translatedStatus = t("q_status_waiting", { defaultValue: "Waiting" });
      else if (tItem.status === "calling") translatedStatus = t("q_status_calling", { defaultValue: "Calling" });
      else if (tItem.status === "completed") translatedStatus = t("q_status_completed", { defaultValue: "Completed" });
      else if (tItem.status === "no_show") translatedStatus = t("q_status_no_show", { defaultValue: "No Show" });
      else if (tItem.status === "cancelled") translatedStatus = t("q_status_cancelled", { defaultValue: "Cancelled" });

      return [
        tItem.ticketNumber,
        `"${(tItem.customerName || "").replace(/"/g, '""')}"`,
        tItem.customerPhone ? `"${tItem.customerPhone}"` : "",
        `"${(tItem.serviceName || "").replace(/"/g, '""')}"`,
        `"${translatedStatus}"`,
        `"${dateStr}"`,
        `"${bookingTimeStr}"`,
        `"${callingTimeStr}"`,
        `"${completionTimeStr}"`,
        waitTimeMins,
        serveDurationMins,
        tItem.rating !== undefined && tItem.rating !== null ? tItem.rating : "",
        tItem.ratingComment ? `"${tItem.ratingComment.replace(/"/g, '""')}"` : ""
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Load analysis and optionally export directly for a range of dates
  const handleAnalyzeRange = async (startD: string, endD: string, isExportDirectly: boolean = false, filename: string = "report.csv") => {
    setExportLoading(true);
    setReportError("");
    try {
      const start = new Date(startD);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endD);
      end.setHours(23, 59, 59, 999);

      const ticketsQuery = query(
        collection(db, "tickets"),
        where("shopId", "==", shopId)
      );

      const querySnapshot = await getDocs(ticketsQuery);
      const fetchedTickets: Ticket[] = [];
      querySnapshot.forEach((docSnap) => {
        const ticket = docSnap.data() as Ticket;
        if (ticket.createdAt >= start.toISOString() && ticket.createdAt <= end.toISOString()) {
          fetchedTickets.push(ticket);
        }
      });

      // Sort by ticket number or createdAt
      fetchedTickets.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (isExportDirectly) {
        handleExportCSV(fetchedTickets, filename);
      } else {
        setAnalyzedTickets(fetchedTickets);
      }
    } catch (err) {
      console.error("Error fetching tickets for report:", err);
      setReportError(t("vend_report_fetch_error", { defaultValue: "An error occurred while loading report data." }));
    } finally {
      setExportLoading(false);
    }
  };

  // Aggregate stats for Gemini AI Analyzer
  const aggregateStatsForAi = (ticketsToAggregate: Ticket[]) => {
    const totalTickets = ticketsToAggregate.length;
    const statusCounts: Record<string, number> = {};
    const byHour: Record<number, number> = {};
    const byDayOfWeek: Record<number, number> = {};
    const serviceCounts: Record<string, number> = {};
    let totalWaitMins = 0;
    let waitCount = 0;
    let totalServeMins = 0;
    let serveCount = 0;

    ticketsToAggregate.forEach(t => {
      // Statuses
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;

      // Service counts
      if (t.serviceName) {
        serviceCounts[t.serviceName] = (serviceCounts[t.serviceName] || 0) + 1;
      }

      // Created At analysis
      if (t.createdAt) {
        try {
          const d = new Date(t.createdAt);
          const h = d.getHours();
          byHour[h] = (byHour[h] || 0) + 1;

          const day = d.getDay();
          byDayOfWeek[day] = (byDayOfWeek[day] || 0) + 1;

          // Wait time
          if (t.calledAt) {
            const wait = (new Date(t.calledAt).getTime() - new Date(t.createdAt).getTime()) / 60000;
            totalWaitMins += wait;
            waitCount++;

            // Service/serving time
            if (t.completedAt) {
              const serve = (new Date(t.completedAt).getTime() - new Date(t.calledAt).getTime()) / 60000;
              totalServeMins += serve;
              serveCount++;
            }
          }
        } catch (e) {
          // ignore parsing error
        }
      }
    });

    return {
      totalTickets,
      statusCounts,
      byHour,
      byDayOfWeek,
      serviceCounts,
      avgWaitTimeMinutes: waitCount > 0 ? Math.round(totalWaitMins / waitCount) : null,
      avgServiceTimeMinutes: serveCount > 0 ? Math.round(totalServeMins / serveCount) : null,
    };
  };

  // Generate AI Optimization Suggestions via /api/analyze-queue
  const handleGetAiInsights = async () => {
    const sourceTickets = analyzedTickets || tickets;
    if (!sourceTickets || sourceTickets.length === 0) {
      setAiError(t("vend_select_date_range_error", { defaultValue: "Please select a date range with ticket data first." }));
      return;
    }

    setAiLoading(true);
    setAiError("");
    setAiAnalysis(null);
    try {
      const stats = aggregateStatsForAi(sourceTickets);
      const response = await fetch("/api/analyze-queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shopData: {
            name: shop?.name,
            category: shop?.category,
          },
          stats,
          lang: i18n.language,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to analyze queue data");
      }

      const data = await response.json();
      setAiAnalysis(data);
    } catch (err: any) {
      console.error("AI Analysis error:", err);
      let errMsg = err?.message || "Unknown error";
      if (errMsg.includes("Failed to fetch") || errMsg.includes("fetch failed") || !navigator.onLine) {
        errMsg = t("vend_ai_connection_error", { defaultValue: "Could not connect to the AI server. The backend server might still be starting up or there is a temporary network interruption. Please try again in a few seconds." });
      } else {
        errMsg = t("vend_ai_generation_failed", { error: errMsg, defaultValue: `Failed to generate recommendations: ${errMsg}` });
      }
      setAiError(errMsg);
    } finally {
      setAiLoading(false);
    }
  };

  // Displays Management Handlers
  const handleRemoteRefresh = async (displayId: string) => {
    try {
      setRefreshingDisplayId(displayId);
      const docRef = doc(db, "displays", displayId);
      await setDoc(docRef, {
        refreshRequestedAt: new Date().toISOString()
      }, { merge: true });
      
      // Clear refreshing indicator after 1.5 seconds
      setTimeout(() => {
        setRefreshingDisplayId(null);
      }, 1500);
    } catch (err: any) {
      console.error("Error triggering remote display refresh:", err);
      alert(t("vend_display_refresh_failed", { defaultValue: "Failed to send refresh request to the screen." }));
      setRefreshingDisplayId(null);
    }
  };

  const handleUpdateDisplayName = async (displayId: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      const docRef = doc(db, "displays", displayId);
      await setDoc(docRef, {
        name: newName.trim()
      }, { merge: true });
      setEditingDisplayId(null);
    } catch (err: any) {
      console.error("Error updating display screen name:", err);
      alert(t("vend_display_rename_failed", { defaultValue: "Failed to update display screen name." }));
    }
  };

  const handleDeleteDisplay = async (displayId: string) => {
    showConfirmation(
      t("vend_display_remove_confirm_title", { defaultValue: "Remove Screen" }),
      t("vend_display_remove_confirm_message", { defaultValue: "Are you sure you want to remove this screen from the system?" }),
      async () => {
        try {
          const { deleteDoc } = await import("firebase/firestore");
          await deleteDoc(doc(db, "displays", displayId));
        } catch (err: any) {
          console.error("Error deleting display screen document:", err);
          alert(t("vend_display_remove_failed", { defaultValue: "Failed to remove the display screen." }));
        }
      }
    );
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      return parts.join(" ");
    } else {
      return v;
    }
  };

  const formatCardExpiry = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      return `${v.slice(0, 2)}/${v.slice(2, 4)}`;
    }
    return v;
  };

  const handleStripeCheckout = async () => {
    setStripeLoading(true);
    setStripeError("");
    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shopId: shopId,
          lang: i18n.language,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.error === "stripe_not_configured") {
          setStripeError(
            t("vend_stripe_not_configured_error", { defaultValue: "Stripe is not configured yet. Set STRIPE_SECRET_KEY in the server environment variables to enable real global checkout." })
          );
        } else {
          setStripeError(data.message || data.error || "Failed to initiate Stripe Checkout session.");
        }
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setStripeError(t("vend_payment_invalid_response", { defaultValue: "Invalid response from the payment server." }));
      }
    } catch (err: any) {
      console.error("Stripe Checkout Session Initiation Error:", err);
      setStripeError(
        t("vend_payment_connection_failed", { defaultValue: "Failed to connect to the payment gateway server." })
      );
    } finally {
      setStripeLoading(false);
    }
  };

  const handleProcessUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError("");
    setPaymentSuccess(false);

    // Form validation
    const cleanCard = cardNumber.replace(/\s/g, "");
    if (!cleanCard) {
      setPaymentError(t("vend_err_enter_card", { defaultValue: "Please enter your card number." }));
      return;
    }
    if (cleanCard.length < 16) {
      setPaymentError(t("vend_billing_err_card_len", { defaultValue: "Card number is incomplete (must be 16 digits)." }));
      return;
    }
    if (!cardExpiry.trim() || !cardExpiry.includes("/")) {
      setPaymentError(t("vend_billing_err_expiry", { defaultValue: "Please enter expiration date (MM/YY)." }));
      return;
    }
    if (cardCvv.trim().length < 3) {
      setPaymentError(t("vend_billing_err_cvv", { defaultValue: "Please enter a valid CVV." }));
      return;
    }
    if (!cardName.trim()) {
      setPaymentError(t("vend_billing_err_cardholder", { defaultValue: "Please enter cardholder name." }));
      return;
    }

    setPaymentProcessing(true);

    try {
      // Simulate real checkout delay for 1.8s
      await new Promise(resolve => setTimeout(resolve, 1800));

      // Generate invoice document
      const invoiceId = "inv_" + Math.random().toString(36).substring(2, 11);
      const invoiceNum = "INV-2026-" + Math.floor(1000 + Math.random() * 9000);
      const cardBrand = cleanCard.startsWith("4") ? "Visa" : cleanCard.startsWith("5") ? "Mastercard" : "CreditCard";
      const cardLast4 = cleanCard.slice(-4);

      const invoiceData: Invoice = {
        id: invoiceId,
        shopId: shopId,
        invoiceNumber: invoiceNum,
        amount: "$20.00 USD",
        planName: "PRO Plan (30 Days)",
        status: "paid",
        cardBrand: cardBrand,
        cardLast4: cardLast4,
        createdAt: new Date().toISOString()
      };

      // 1. Save invoice to Firestore
      const invoiceDocRef = doc(db, "shops", shopId, "invoices", invoiceId);
      await setDoc(invoiceDocRef, invoiceData);

      // 2. Update shop subscription plan to PRO in Firestore
      const shopDocRef = doc(db, "shops", shopId);
      await updateDoc(shopDocRef, {
        plan: "pro",
        planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });

      // 3. Play chime sound if enabled
      if (soundEnabledRef.current) {
        playStatusUpdateSound();
      }

      setPaymentSuccess(true);
      // Reset fields
      setCardNumber("");
      setCardExpiry("");
      setCardCvv("");
      setCardName("");
    } catch (err: any) {
      console.error("Payment error:", err);
      setPaymentError(t("vend_billing_err_generic", { defaultValue: "An unexpected error occurred during payment processing." }));
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    showConfirmation(
      t("vend_billing_cancel_title", { defaultValue: "Cancel Upgrade" }),
      t("vend_billing_cancel_confirm", { defaultValue: "Are you sure you want to cancel your PRO plan and return to the Free Trial?" }),
      async () => {
        try {
          const shopDocRef = doc(db, "shops", shopId);
          await updateDoc(shopDocRef, {
            plan: "free",
            planExpiresAt: ""
          });
          alert(t("vend_billing_cancel_success", { defaultValue: "Returned to Free Trial successfully." }));
        } catch (err: any) {
          console.error("Downgrade error:", err);
          alert(t("vend_billing_cancel_failed", { defaultValue: "Failed to cancel upgrade." }));
        }
      }
    );
  };

  // Sign out Handler
  const handleLogoutClick = async () => {
    showConfirmation(
      t("vend_logout_title", { defaultValue: "Sign Out" }),
      t("vend_logout_confirm", { defaultValue: "Are you sure you want to sign out?" }),
      async () => {
        try {
          await signOut(auth);
        } catch (err) {
          console.error("Firebase signOut error, continuing logout:", err);
        }
        onSignOut();
      }
    );
  };

  const waitingTickets = tickets.filter(t => t.status === "waiting");
  const callingTicket = tickets.find(t => t.status === "calling");
  const pastTickets = tickets.filter(t => ["completed", "cancelled", "no_show"].includes(t.status));

  // Filtered by selected Waiting Path (service)
  const filteredWaitingTickets = tickets.filter(
    (t) => t.status === "waiting" && (selectedQueueServiceId === "all" || t.serviceId === selectedQueueServiceId)
  );
  const filteredCallingTicket = tickets.find(
    (t) => t.status === "calling" && (selectedQueueServiceId === "all" || t.serviceId === selectedQueueServiceId)
  );
  const filteredPastTickets = tickets.filter(
    (t) => ["completed", "cancelled", "no_show"].includes(t.status) && (selectedQueueServiceId === "all" || t.serviceId === selectedQueueServiceId)
  );

  const scheduledTickets = tickets.filter(t => t.status === "scheduled");
  const filteredScheduledTickets = tickets.filter(
    (t) => t.status === "scheduled" && (selectedQueueServiceId === "all" || t.serviceId === selectedQueueServiceId)
  );

  // Custom Tooltip component for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={`bg-white/95 backdrop-blur-md p-4 border border-slate-200/80 rounded-2xl shadow-xl ${isRtl ? "text-right dir-rtl" : "text-left dir-ltr"} font-sans text-xs`}>
          <p className={`font-black text-slate-900 mb-2 border-b border-slate-100 pb-1.5 flex items-center gap-1.5 ${isRtl ? "justify-end" : "justify-start"}`}>
            <span>{t("chart_insight_hour", { hour: label, defaultValue: `Hour: ${label}` })}</span>
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
          </p>
          {payload.map((item: any, idx: number) => (
            <div key={idx} className={`flex items-center justify-between gap-4 py-1 ${isRtl ? "flex-row" : "flex-row-reverse"}`}>
              <span className="font-bold text-slate-800">{item.value} {item.unit || ""}</span>
              <span className="text-slate-400 font-medium flex items-center gap-1">
                {isRtl ? (
                  <>
                    <span>{item.name}</span>
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: item.color }} />
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Generate chart data based on tickets and services
  const getChartData = () => {
    const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    
    return hours.map(h => {
      const label = `${String(h).padStart(2, '0')}:00`;
      
      const ticketsInHour = tickets.filter(t => {
        if (!t.createdAt) return false;
        try {
          const d = new Date(t.createdAt);
          return d.getHours() === h;
        } catch {
          return false;
        }
      });

      const waitingInHourCount = ticketsInHour.filter(t => t.status === "waiting" || t.status === "calling").length;
      
      const activeBacklog = tickets.filter(t => {
        if (!t.createdAt) return false;
        try {
          const d = new Date(t.createdAt);
          const isBeforeOrDuring = d.getHours() <= h;
          return isBeforeOrDuring && (t.status === "waiting" || t.status === "calling");
        } catch {
          return false;
        }
      });

      let totalWaitTime = 0;
      activeBacklog.forEach(t => {
        const s = services.find(srv => srv.id === t.serviceId);
        totalWaitTime += s ? s.avgDurationMinutes : 15;
      });

      if (activeBacklog.some(t => t.status === "calling")) {
        totalWaitTime += 5;
      }

      const waitingKeyName = t("chart_legend_waiting", { defaultValue: "Waiting Customers" });
      const waitTimeKeyName = t("chart_legend_wait_time", { defaultValue: "Expected Wait Time" });

      return {
        hourLabel: label,
        [waitingKeyName]: waitingInHourCount,
        [waitTimeKeyName]: totalWaitTime,
        // Fallbacks
        "العملاء المنتظرين": waitingInHourCount,
        "وقت الانتظار المتوقع": totalWaitTime,
      };
    });
  };

  const chartData = getChartData();

  const waitingKey = t("chart_legend_waiting", { defaultValue: "Waiting Customers" });
  const waitTimeKey = t("chart_legend_wait_time", { defaultValue: "Expected Wait Time" });
  const peakHourObj = [...chartData].sort((a, b) => b[waitingKey] - a[waitingKey])[0];
  const peakHour = peakHourObj && peakHourObj[waitingKey] > 0 ? peakHourObj.hourLabel : t("chart_insight_no_peak", { defaultValue: "No Peak" });
  
  const totalCurrentWaitTime = filteredWaitingTickets.reduce((acc, t) => {
    const s = services.find(srv => srv.id === t.serviceId);
    return acc + (s ? s.avgDurationMinutes : 15);
  }, 0) + (filteredCallingTicket ? 5 : 0);

  // Calculate average rating for completed tickets today
  const ratedTickets = tickets.filter(t => t.rating !== undefined && t.rating !== null && (selectedQueueServiceId === "all" || t.serviceId === selectedQueueServiceId));
  const avgRating = ratedTickets.length > 0 
    ? (ratedTickets.reduce((sum, t) => sum + (t.rating || 0), 0) / ratedTickets.length).toFixed(1)
    : "N/A";

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <h3 className="text-lg font-bold text-slate-800">{t("loading", { defaultValue: "Loading dashboard..." })}</h3>
        <p className="text-slate-500 text-xs mt-1">{t("loading_subtitle", { defaultValue: "Setting up real-time sync..." })}</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDarkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"} pb-16 ${isRtl ? "text-right dir-rtl" : "text-left dir-ltr"}`}>
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-sm shadow-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-100">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none mb-1">{shop?.name || t("vend_dashboard_fallback", { defaultValue: "Dashboard" })}</h1>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{t("vend_admin_connected", { defaultValue: "Admin Connected" })}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">

            {/* Pause/Resume Queue Toggle Switch */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 rounded-2xl px-2.5 py-1 sm:px-4 sm:py-2 select-none shadow-sm mr-1 sm:mr-2">
              <div className="hidden sm:flex flex-col items-start sm:items-end">
                <span className="text-[11px] font-black leading-none text-slate-900 mb-0.5">
                  {shop?.isPaused ? t("vend_paused", { defaultValue: "Paused" }) : t("vend_active_status", { defaultValue: "Active" })}
                </span>
                <span className="text-[9px] text-slate-400 font-bold leading-none">
                  {t("vend_queue_intake", { defaultValue: "Queue Intake" })}
                </span>
              </div>
              <button
                onClick={async () => {
                  if (!shop) return;
                  const shopDocRef = doc(db, "shops", shop.id);
                  try {
                    await updateDoc(shopDocRef, { isPaused: !shop.isPaused });
                  } catch (err) {
                    console.error("Error toggling pause state:", err);
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  !shop?.isPaused ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                title={shop?.isPaused ? t("vend_resume_reservations", { defaultValue: "Resume reservations" }) : t("vend_pause_reservations", { defaultValue: "Pause reservations" })}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    !shop?.isPaused ? (isRtl ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <LanguageSwitcher />

            {/* Dark Mode Toggle Button */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                isDarkMode 
                  ? "bg-slate-800 text-amber-400 hover:bg-slate-700" 
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
              title={isDarkMode ? t("vend_enable_light_mode", { defaultValue: "Enable Light Mode" }) : t("vend_enable_dark_mode", { defaultValue: "Enable Dark Mode" })}
            >
              {isDarkMode ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            {/* Audio Toggle Button */}
            <button
              onClick={() => {
                const newVal = !soundEnabled;
                setSoundEnabled(newVal);
                if (newVal) {
                  playNewTicketSound();
                }
              }}
              className={`p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                soundEnabled 
                  ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100" 
                  : "bg-slate-100 text-slate-400 hover:bg-slate-200"
              }`}
              title={soundEnabled ? t("sound_settings_toggle", { defaultValue: "Mute" }) : t("sound_settings_toggle", { defaultValue: "Unmute" })}
            >
              {soundEnabled ? (
                <Volume2 className="w-5 h-5 animate-pulse" />
              ) : (
                <VolumeX className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={handleLogoutClick}
              className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
              title={t("logout", { defaultValue: "Sign Out" })}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Navigation Sidebar / Menu */}
          <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200/80 p-5 space-y-2 shadow-sm">
            <div className={`text-xs font-black text-slate-400 px-3 pb-3 border-b border-slate-100 uppercase mb-2 ${isRtl ? "text-right" : "text-left"}`}>
              {t("vend_sidebar_sections", { defaultValue: "Dashboard Sections" })}
            </div>
            
            <button
              onClick={() => setActiveTab("queue")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition-all duration-200 hover:scale-[1.01] ${
                activeTab === "queue"
                  ? "bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-200/80 dark:shadow-none"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:text-indigo-600 dark:hover:text-indigo-400"
              }`}
            >
              <Activity className={`w-5 h-5 ${activeTab === "queue" ? "text-white" : "text-violet-500"}`} />
              <span>{t("vend_active_queue", { defaultValue: "Daily Queue Management" })}</span>
              {waitingTickets.length > 0 && (
                <span className={`${isRtl ? "mr-auto" : "ml-auto"} px-2 py-0.5 rounded-full text-xs font-black transition-colors ${
                  activeTab === "queue" ? "bg-white/20 text-white" : "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border border-violet-100/50 dark:border-violet-900/30"
                }`}>
                  {waitingTickets.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("services")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition-all duration-200 hover:scale-[1.01] ${
                activeTab === "services"
                  ? "bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-200/80 dark:shadow-none"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:text-indigo-600 dark:hover:text-indigo-400"
              }`}
            >
              <Clock className={`w-5 h-5 ${activeTab === "services" ? "text-white" : "text-amber-500"}`} />
              <span>{t("vend_sidebar_services", { defaultValue: "Waiting Paths / Services" })}</span>
            </button>

            <button
              onClick={() => setActiveTab("qr")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition-all duration-200 hover:scale-[1.01] ${
                activeTab === "qr"
                  ? "bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-200/80 dark:shadow-none"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:text-indigo-600 dark:hover:text-indigo-400"
              }`}
            >
              <QrIcon className={`w-5 h-5 ${activeTab === "qr" ? "text-white" : "text-indigo-500"}`} />
              <span>{t("vend_qr_settings", { defaultValue: "QR & Settings" })}</span>
            </button>

            <button
              onClick={() => setActiveTab("reports")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition-all duration-200 hover:scale-[1.01] ${
                activeTab === "reports"
                  ? "bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-200/80 dark:shadow-none"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:text-indigo-600 dark:hover:text-indigo-400"
              }`}
            >
              <FileSpreadsheet className={`w-5 h-5 ${activeTab === "reports" ? "text-white" : "text-emerald-500"}`} />
              <span>{t("vend_reports", { defaultValue: "Reports & Performance" })}</span>
            </button>

            <button
              onClick={() => setActiveTab("displays")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition-all duration-200 hover:scale-[1.01] ${
                activeTab === "displays"
                  ? "bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-200/80 dark:shadow-none"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:text-indigo-600 dark:hover:text-indigo-400"
              }`}
            >
              <Tv className={`w-5 h-5 ${activeTab === "displays" ? "text-white" : "text-cyan-500"}`} />
              <span>{t("vend_sidebar_displays", { defaultValue: "Screens & Public Displays" })}</span>
              {displays.length > 0 && (
                <span className={`${isRtl ? "mr-auto" : "ml-auto"} px-2 py-0.5 rounded-full text-xs font-black transition-colors ${
                  activeTab === "displays" ? "bg-white/20 text-white" : "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border border-violet-100/50 dark:border-violet-900/30"
                }`}>
                  {displays.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("billing")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition-all duration-200 hover:scale-[1.01] ${
                activeTab === "billing"
                  ? "bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-200/80 dark:shadow-none"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:text-indigo-600 dark:hover:text-indigo-400"
              }`}
            >
              <CreditCard className={`w-5 h-5 ${activeTab === "billing" ? "text-white" : "text-rose-500"}`} />
              <span>{t("vend_sidebar_billing", { defaultValue: "Billing & Payments" })}</span>
              {shop?.plan === "pro" && (
                <span className={`${isRtl ? "mr-auto" : "ml-auto"} px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white animate-pulse`}>
                  PRO
                </span>
              )}
            </button>

            <div className="pt-4 border-t border-slate-100 mt-4 space-y-3">
              <div className={`text-[11px] font-black text-slate-400 px-3 uppercase tracking-wider ${isRtl ? "text-right" : "text-left"}`}>
                {t("sound_settings_title", { defaultValue: "Audio Alert Settings" })}
              </div>
              <div className={`bg-slate-50/70 rounded-2xl p-4 border border-slate-100 space-y-3 ${isRtl ? "text-right" : "text-left"}`}>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-bold text-slate-700">{t("sound_settings_toggle", { defaultValue: "Active Alerts" })}</span>
                  <button
                    onClick={() => {
                      const newVal = !soundEnabled;
                      setSoundEnabled(newVal);
                      if (newVal) playNewTicketSound();
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      soundEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        soundEnabled ? (isRtl ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                  {t("sound_settings_desc", { defaultValue: "The system plays a chime for registrations and ticket updates." })}
                </p>
                {soundEnabled && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => playNewTicketSound()}
                      className="text-[9.5px] bg-white hover:bg-slate-100 font-bold py-1.5 px-2 rounded-xl border border-slate-200 text-slate-600 transition-colors cursor-pointer text-center"
                    >
                      {t("sound_test_new", { defaultValue: "Test New Chime 🔔" })}
                    </button>
                    <button
                      onClick={() => playStatusUpdateSound()}
                      className="text-[9.5px] bg-white hover:bg-slate-100 font-bold py-1.5 px-2 rounded-xl border border-slate-200 text-slate-600 transition-colors cursor-pointer text-center"
                    >
                      {t("sound_test_update", { defaultValue: "Test Update ⚙️" })}
                    </button>
                  </div>
                )}
              </div>

              {/* TTS Speech Synthesis section */}
              <div className={`bg-slate-50/70 rounded-2xl p-4 border border-slate-100 space-y-3 ${isRtl ? "text-right" : "text-left"}`}>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-bold text-slate-700">
                    {t("vend_ai_voice_calling_title", { defaultValue: "AI Voice Calling" })}
                  </span>
                  <button
                    onClick={() => {
                      setVoiceAnnouncementsEnabled(!voiceAnnouncementsEnabled);
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      voiceAnnouncementsEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        voiceAnnouncementsEnabled ? (isRtl ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                  {t("vend_ai_voice_calling_desc", { defaultValue: "The system speaks aloud when calling the next customer on this device." })}
                </p>

                {voiceAnnouncementsEnabled && (
                  <div className="space-y-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-150 dark:border-slate-800">
                    {/* Voice language selection */}
                    <div className="space-y-1">
                      <label className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">
                        {t("vend_callout_language_label", { defaultValue: "Callout Language" })}
                      </label>
                      <select
                        value={voiceLanguage}
                        onChange={(e) => setVoiceLanguage(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-850 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-xl text-[10px] font-bold focus:outline-none"
                      >
                        <option value="both">{t("vend_callout_language_both", { defaultValue: "Both Arabic & English" })}</option>
                        <option value="ar">{t("vend_callout_language_ar", { defaultValue: "Arabic Only" })}</option>
                        <option value="en">{t("vend_callout_language_en", { defaultValue: "English Only" })}</option>
                      </select>
                    </div>

                    {/* Speech rate slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[9px] text-slate-400">
                        <span className="font-extrabold uppercase tracking-wider">{t("vend_speech_rate_label", { defaultValue: "Speech Rate" })}</span>
                        <span className="font-mono text-indigo-500 font-black">{voiceRate}x</span>
                      </div>
                      <input 
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.05"
                        value={voiceRate}
                        onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                        className="w-full accent-indigo-600 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => announceCallingTicket("A-12", activeCounterNumber, "Test")}
                        className="text-center text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-black py-2 rounded-xl border border-indigo-100 transition-colors cursor-pointer"
                      >
                        {t("vend_test_voice_call_btn", { defaultValue: "Test Voice Call 🔊" })}
                      </button>
                      <button
                        onClick={() => {
                          if ("speechSynthesis" in window) {
                            window.speechSynthesis.cancel();
                          }
                          setVoiceAnnouncementsEnabled(false);
                          localStorage.setItem("vendor_voice_enabled", "false");
                        }}
                        className="text-center text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-600 font-black py-2 rounded-xl border border-rose-150 transition-colors cursor-pointer"
                        title={t("vend_stop_mute_btn", { defaultValue: "Stop & Mute 🔇" })}
                      >
                        {t("vend_stop_mute_btn", { defaultValue: "Stop & Mute 🔇" })}
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        if ("speechSynthesis" in window) {
                          window.speechSynthesis.cancel();
                        }
                      }}
                      className="w-full text-center text-[9px] bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 font-black py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                    >
                      {t("vend_stop_current_speech_btn", { defaultValue: "Stop Current Speech ⏹️" })}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tab Views */}
          <div className="lg:col-span-9 space-y-6">

            {/* TAB 1: Queue Board */}
            {activeTab === "queue" && (
              <div className="space-y-6 animate-fade-in animate-duration-200">

                {/* Waiting Paths / Queues Segmented Selector */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-slate-500" />
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">{t("vend_queue_filter", { defaultValue: "Queue Filter" })}</h3>
                    </div>
                    <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 self-start sm:self-auto border border-indigo-100 dark:border-indigo-900/30">
                      {t("vend_current_path", { defaultValue: "Current Path: " })}
                      {selectedQueueServiceId === "all"
                        ? t("vend_all_paths", { defaultValue: "All Paths" }) 
                        : (services.find(s => s.id === selectedQueueServiceId)?.name || "")}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedQueueServiceId("all")}
                      className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all duration-200 cursor-pointer ${
                        selectedQueueServiceId === "all"
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none border border-transparent"
                          : "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
                      }`}
                    >
                      {t("vend_all_waiting_paths", { defaultValue: "All Waiting Paths" })} ({tickets.filter(t => t.status === "waiting").length})
                    </button>
                    {services.map((service) => {
                      const serviceWaitingCount = tickets.filter(t => t.status === "waiting" && t.serviceId === service.id).length;
                      return (
                        <button
                          key={service.id}
                          onClick={() => setSelectedQueueServiceId(service.id)}
                          className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                            selectedQueueServiceId === service.id
                              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none border border-transparent"
                              : "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
                          }`}
                        >
                          <span>{service.name}</span>
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                            selectedQueueServiceId === service.id 
                              ? "bg-white/20 text-white" 
                              : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                          }`}>
                            {serviceWaitingCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Real-time Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  {/* Card 1: Total Tickets */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {t("vend_total_tickets_today", { defaultValue: "Total Tickets Today" })}
                      </span>
                      <span className="block text-xl font-black text-slate-900 dark:text-white">
                        {tickets.length}
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Customers Waiting */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {t("vend_currently_waiting_stat", { defaultValue: "Currently Waiting" })}
                      </span>
                      <span className="block text-xl font-black text-slate-900 dark:text-white">
                        {tickets.filter(t => t.status === "waiting").length}
                      </span>
                    </div>
                  </div>

                  {/* Card 3: Served Customers */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {t("vend_served_customers_stat", { defaultValue: "Served Customers" })}
                      </span>
                      <span className="block text-xl font-black text-slate-900 dark:text-white">
                        {tickets.filter(t => t.status === "completed").length}
                      </span>
                    </div>
                  </div>

                  {/* Card 4: Expected Wait Time */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {t("vend_expected_wait_time_stat", { defaultValue: "Expected Wait Time" })}
                      </span>
                      <span className="block text-xl font-black text-slate-900 dark:text-white">
                        {totalCurrentWaitTime} {t("vend_mins_abbrev", { defaultValue: "mins" })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Active Calling Controller Panel */}
                <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/50 dark:from-indigo-950/20 dark:to-indigo-950/40 border border-indigo-200/50 dark:border-indigo-900/30 p-6 rounded-3xl space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <span>{t("vend_smart_calling_controller", { defaultValue: "Smart Calling & Controller" })}</span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {t("vend_smart_calling_controller_desc", { defaultValue: "Call customers into service. Keyboard shortcuts: [Enter] calls next, [Delete] cancels current." })}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                      {/* Active Counter Input */}
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 px-3 py-2 rounded-2xl">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {t("vend_window_label", { defaultValue: "Window:" })}
                        </span>
                        <input
                          type="text"
                          value={activeCounterNumber}
                          onChange={(e) => {
                            const val = e.target.value;
                            setActiveCounterNumber(val);
                            localStorage.setItem(`dork_active_counter_${shopId}`, val);
                          }}
                          placeholder={t("vend_window_placeholder", { defaultValue: "e.g. 2" })}
                          className="w-16 font-black text-xs text-center text-indigo-600 dark:text-indigo-400 bg-slate-50 dark:bg-slate-850 py-1 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      {/* Active Counter Status Controller */}
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 px-3 py-2 rounded-2xl select-none">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {t("vend_status_label", { defaultValue: "Status:" })}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {/* Dot Indicator */}
                          <span className={`w-2.5 h-2.5 rounded-full animate-pulse shrink-0 ${
                            counterStatus === "online" ? "bg-emerald-500" :
                            counterStatus === "busy" ? "bg-amber-500" :
                            counterStatus === "break" ? "bg-orange-500" : "bg-slate-400"
                          }`} />
                          <select
                            value={counterStatus}
                            onChange={(e) => updateCounterStatus(e.target.value as any)}
                            className="bg-transparent text-xs font-bold border-none text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                          >
                            <option value="online" className="text-emerald-600 dark:text-emerald-400 font-extrabold">{t("vend_status_online", { defaultValue: "Online / Serving" })}</option>
                            <option value="busy" className="text-amber-600 dark:text-amber-400 font-extrabold">{t("vend_status_busy_option", { defaultValue: "Busy" })}</option>
                            <option value="break" className="text-orange-600 dark:text-orange-400 font-extrabold">{t("vend_status_break_option", { defaultValue: "On Break" })}</option>
                            <option value="offline" className="text-slate-500 dark:text-slate-400 font-extrabold">{t("vend_status_closed_option", { defaultValue: "Closed" })}</option>
                          </select>
                        </div>
                      </div>

                      <button
                        onClick={handleCallNext}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm px-6 py-3.5 rounded-2xl transition-all shadow-md hover:scale-[1.01] flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>{t("vend_btn_call_next", { defaultValue: "Call Next Customer" })}</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Calling Card */}
                  {filteredCallingTicket ? (
                    <div className="bg-white dark:bg-slate-900 border-2 border-indigo-500/80 p-6 rounded-2xl shadow-lg relative overflow-hidden space-y-4">
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-500" />
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-xs font-black rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                              {filteredCallingTicket.serviceName}
                            </span>
                            {filteredCallingTicket.isPriority && (
                              <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 text-[10px] font-black rounded-lg uppercase flex items-center gap-1">
                                <Star className="w-3 h-3 fill-rose-500" />
                                <span>VIP Priority</span>
                              </span>
                            )}
                          </div>
                          <h4 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">#{filteredCallingTicket.ticketNumber}</span>
                            <span className="text-slate-300">|</span>
                            <span>{filteredCallingTicket.customerName}</span>
                          </h4>
                          {filteredCallingTicket.customerPhone && (
                            <p className="text-xs text-slate-400 font-medium">📱 {filteredCallingTicket.customerPhone}</p>
                          )}
                        </div>

                        {/* Caller Operations Actions */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleUpdateTicketStatus(filteredCallingTicket.id, "completed")}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{t("vend_btn_complete_service", { defaultValue: "Complete Service" })}</span>
                          </button>
                          <button
                            onClick={() => handleUpdateTicketStatus(filteredCallingTicket.id, "no_show")}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>{t("vend_btn_noshow_service", { defaultValue: "No Show" })}</span>
                          </button>
                          <button
                            onClick={() => handleUpdateTicketStatus(filteredCallingTicket.id, "cancelled")}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>{t("vend_btn_cancel_ticket", { defaultValue: "Cancel Ticket" })}</span>
                          </button>
                          <button
                            onClick={async () => {
                              playStatusUpdateSound();
                              // Trigger notification ring
                              const dRef = doc(db, "tickets", filteredCallingTicket.id);
                              await updateDoc(dRef, { recallRequestedAt: new Date().toISOString() });
                              announceCallingTicket(String(filteredCallingTicket.ticketNumber), activeCounterNumber, filteredCallingTicket.serviceName);
                            }}
                            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
                          >
                            <BellRing className="w-4 h-4 text-indigo-500" />
                            <span>{t("vend_btn_recall_ring", { defaultValue: "Recall / Ring 🔔" })}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center text-slate-400 dark:text-slate-500 space-y-1.5">
                      <Clock className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                      <p className="text-xs font-bold">{t("vend_no_active_called_ticket", { defaultValue: "No active ticket is currently being called." })}</p>
                      <p className="text-[10px] text-slate-400">{t("vend_click_call_next_desc", { defaultValue: "Click 'Call Next Customer' to pull the next ticket." })}</p>
                    </div>
                  )}
                </div>

                {/* Queue Lists Split Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Waiting list */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-600" />
                        <h4 className="text-sm font-black text-slate-900 dark:text-white">{t("vend_waiting_customers_header", { defaultValue: "Waiting Customers" })}</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-xs font-black border border-indigo-100 dark:border-indigo-900/30">
                        {filteredWaitingTickets.length}
                      </span>
                    </div>

                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                      {filteredWaitingTickets.length > 0 ? (
                        filteredWaitingTickets.map((tItem) => (
                          <div 
                            key={tItem.id}
                            className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 p-3.5 rounded-xl hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-all flex items-center justify-between gap-3"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-mono">#{tItem.ticketNumber}</span>
                                <span className="text-slate-300">|</span>
                                <span className="text-xs font-black text-slate-800 dark:text-white truncate">{tItem.customerName}</span>
                                {tItem.isPriority && (
                                  <span className="px-1.5 py-0.5 bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-[8px] font-black rounded-md flex items-center gap-0.5">
                                    <Star className="w-2 h-2 fill-rose-500" />
                                    <span>VIP</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 font-medium truncate">
                                {tItem.serviceName}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleCallTicket(tItem)}
                                className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-400 font-black text-[10px] py-1.5 px-3 rounded-lg transition-all cursor-pointer"
                              >
                                {t("vend_call_btn_label", { defaultValue: "Call" })}
                              </button>
                              <button
                                onClick={() => handleTogglePriority(tItem.id, tItem.isPriority || false)}
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  tItem.isPriority 
                                    ? "bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/30 dark:border-rose-900/40" 
                                    : "bg-white border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700 hover:text-slate-600"
                                }`}
                                title="Toggle VIP"
                              >
                                <Star className={`w-3.5 h-3.5 ${tItem.isPriority ? "fill-rose-500 text-rose-600" : ""}`} />
                              </button>
                              <button
                                onClick={() => handleUpdateTicketStatus(tItem.id, "cancelled")}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 border border-transparent transition-all cursor-pointer"
                                title="Cancel"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                          {t("vend_no_waiting_customers", { defaultValue: "No waiting customers." })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Past tickets list */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-sm font-black text-slate-900 dark:text-white">{t("vend_completed_history_today", { defaultValue: "Completed & History Today" })}</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-black border border-slate-200 dark:border-slate-700">
                        {filteredPastTickets.length}
                      </span>
                    </div>

                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                      {filteredPastTickets.length > 0 ? (
                        filteredPastTickets.map((tItem) => {
                          let badgeBg = "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30";
                          let badgeLabel = t("ticket_status_completed", { defaultValue: "Completed" });
                          if (tItem.status === "cancelled") {
                            badgeBg = "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30";
                            badgeLabel = t("ticket_status_cancelled", { defaultValue: "Cancelled" });
                          } else if (tItem.status === "no_show") {
                            badgeBg = "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30";
                            badgeLabel = t("ticket_status_noshow", { defaultValue: "No Show" });
                          }

                          return (
                            <div 
                              key={tItem.id}
                              className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 p-3.5 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between gap-3"
                            >
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-black text-slate-400 font-mono">#{tItem.ticketNumber}</span>
                                  <span className="text-xs font-black text-slate-800 dark:text-white truncate">{tItem.customerName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-400 font-medium truncate">
                                    {tItem.serviceName}
                                  </span>
                                  <span className="text-slate-300">|</span>
                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black border uppercase ${badgeBg}`}>
                                    {badgeLabel}
                                  </span>
                                  {tItem.rating && (
                                    <span className="text-amber-500 font-black text-[10px] flex items-center gap-0.5">
                                      ★ {tItem.rating}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="shrink-0">
                                <button
                                  onClick={() => handleUpdateTicketStatus(tItem.id, "waiting")}
                                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold text-[9px] py-1 px-2.5 rounded-lg transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                                >
                                  {t("vend_re_queue_btn", { defaultValue: "Re-queue" })}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                          {t("vend_no_historical_tickets_today", { defaultValue: "No historical tickets today." })}
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* 🗓️ Future Scheduled Bookings & Appointments */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <CalendarRange className="w-4 h-4 text-indigo-600" />
                        <span>{t("vend_scheduled_appointments_header", { defaultValue: "Scheduled Appointments & Future Bookings" })}</span>
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t("vend_scheduled_appointments_desc", { defaultValue: "Clients who booked in advance. Click 'Check In' to instantly move them to the active waiting queue upon arrival." })}
                      </p>
                    </div>

                    <span className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-xs font-black border border-indigo-100 dark:border-indigo-900/30">
                      {filteredScheduledTickets.length} {t("vend_scheduled_badge_label", { defaultValue: "Scheduled" })}
                    </span>
                  </div>

                  {filteredScheduledTickets.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredScheduledTickets.map((tItem) => (
                        <div key={tItem.id} className="bg-slate-50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-850 p-4 rounded-2xl flex flex-col justify-between gap-3.5 hover:border-indigo-100 dark:hover:border-indigo-900/40 hover:shadow-sm transition-all duration-200">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-extrabold px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                                {tItem.serviceName}
                              </span>
                              <span className="text-[10px] bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-md font-mono font-black">
                                #{tItem.ticketNumber}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <h5 className="text-xs font-black text-slate-800 dark:text-white">{tItem.customerName}</h5>
                              {(tItem.customerPhone || tItem.customerEmail) && (
                                <p className="text-[10px] text-slate-400 font-medium">
                                  {tItem.customerPhone && <span>📱 {tItem.customerPhone} </span>}
                                  {tItem.customerEmail && <span className="block mt-0.5">✉️ {tItem.customerEmail}</span>}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="border-t border-slate-200/40 dark:border-slate-800/40 pt-3 flex items-center justify-between">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] text-slate-400 font-bold">{t("vend_scheduled_slot_label", { defaultValue: "Scheduled slot:" })}</span>
                              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-black">
                                {tItem.scheduledDate} @ {tItem.scheduledTime}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleUpdateTicketStatus(tItem.id, "waiting")}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] py-1.5 px-3 rounded-xl shadow-md shadow-indigo-100 dark:shadow-none cursor-pointer transition-all hover:scale-[1.02]"
                              >
                                {t("vend_check_in_btn", { defaultValue: "Check In ✅" })}
                              </button>
                              <button
                                onClick={() => handleUpdateTicketStatus(tItem.id, "cancelled")}
                                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-rose-500 font-extrabold text-[10px] py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
                                title={t("vend_cancel_slot_title", { defaultValue: "Cancel Slot" })}
                              >
                                {t("vend_cancel_btn", { defaultValue: "Cancel" })}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/80">
                      <CalendarRange className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2.5 animate-pulse" />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {t("vend_no_scheduled_appointments_found", { defaultValue: "No scheduled appointments found" })}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                        {t("vend_no_scheduled_appointments_desc", { defaultValue: "Any client scheduling a future booking slot through the portal will appear here. Upon their arrival, click 'Check In' to instantly move them into live queues." })}
                      </p>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB 2: Services Management */}
            {activeTab === "services" && (
              <div className="space-y-6 animate-fade-in animate-duration-200">
                {/* Header info */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-3xl shadow-sm space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">{t("vend_services_manage_title", { defaultValue: "Manage Waiting Paths & Services" })}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
                    {t("vend_services_manage_desc", { defaultValue: "Define different customer journeys and specific wait path services in-store to lower wait bottlenecks and isolate analytics." })}
                  </p>
                </div>

                {/* Split layout: add service and service list */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left panel: Add service */}
                  <form onSubmit={handleAddService} className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-indigo-600" />
                      <span>{t("vend_add_service_section_title", { defaultValue: "Add New Service" })}</span>
                    </h4>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {t("vend_field_service_name_label", { defaultValue: "Service Name / Department" })}
                      </label>
                      <input 
                        type="text"
                        value={newServiceName}
                        onChange={(e) => setNewServiceName(e.target.value)}
                        placeholder={t("vend_field_service_name_example", { defaultValue: "e.g., Sales, Maintenance, Reception" })}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {t("vend_field_service_duration", { defaultValue: "Avg Service Duration (Minutes)" })}
                      </label>
                      <input 
                        type="number"
                        min="1"
                        max="180"
                        value={newServiceDuration}
                        onChange={(e) => setNewServiceDuration(Number(e.target.value))}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={serviceActionLoading || !newServiceName.trim()}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs py-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow shadow-indigo-100 dark:shadow-none"
                    >
                      {serviceActionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>{t("vend_btn_create_service", { defaultValue: "Create Wait Path" })}</span>
                        </>
                      )}
                    </button>
                  </form>

                  {/* Right panel: services list */}
                  <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                      {t("vend_active_services_title", { defaultValue: "Active Waiting Path Services" })}
                    </h4>

                    <div className="space-y-3">
                      {services.length > 0 ? (
                        services.map((service) => (
                          <div 
                            key={service.id}
                            className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 p-4 rounded-2xl hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <h5 className="text-xs sm:text-sm font-black text-slate-800 dark:text-white">
                                {service.name}
                              </h5>
                              <p className="text-[10px] text-slate-400 font-medium">
                                ⏱️ {t("vend_est_wait_label", { defaultValue: "Estimated wait:" })} <strong className="text-slate-600 dark:text-slate-300 font-bold">{service.avgDurationMinutes} {t("vend_mins_abbrev", { defaultValue: "mins" })}</strong>
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Toggle active / inactive switch */}
                              <button
                                type="button"
                                onClick={() => handleToggleService(service.id, service.isActive ?? true)}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  (service.isActive ?? true) ? 'bg-indigo-600' : 'bg-slate-300'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    (service.isActive ?? true) ? (isRtl ? '-translate-x-4' : 'translate-x-4') : 'translate-x-0'
                                  }`}
                                />
                              </button>

                              {/* Delete button */}
                              <button
                                onClick={() => handleDeleteService(service.id)}
                                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 transition-all cursor-pointer border border-transparent"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs">
                          {t("vend_no_services_defined", { defaultValue: "No waiting path services defined." })}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* TAB 3: QR & settings */}
            {activeTab === "qr" && (
              <div className="space-y-6 animate-fade-in animate-duration-200">

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left side: QR Code poster */}
                  <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6 text-center">
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">{t("vend_customer_qr_ticket_scanner_title", { defaultValue: "Customer QR Ticket Scanner" })}</h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                        {t("vend_customer_qr_ticket_scanner_desc", { defaultValue: "Print and frame this QR code. Customers can scan this to fetch remote ticket tokens from their personal devices." })}
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 p-4 rounded-2xl inline-block">
                      <canvas ref={qrCanvasRef} className="mx-auto rounded-xl shadow-inner max-w-full" />
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={handleDownloadQR}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow shadow-indigo-100 dark:shadow-none"
                      >
                        <Download className="w-4 h-4" />
                        <span>{t("vend_download_qr_code_png_btn", { defaultValue: "Download QR Code PNG" })}</span>
                      </button>
                      <button
                        onClick={handleCopyLink}
                        className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs py-3 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-500" />
                            <span className="text-emerald-600">{t("vend_copied_successfully_msg", { defaultValue: "Copied successfully!" })}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>{t("vend_copy_customer_portal_link_btn", { defaultValue: "Copy Customer Portal Link" })}</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-400 font-mono break-all leading-normal">
                      {shopLink}
                    </p>
                  </div>

                  {/* Right side: Shop settings form */}
                  <form onSubmit={handleUpdateSettings} className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-3xl shadow-sm space-y-6">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-1.5">
                      <Settings className="w-4 h-4 text-indigo-600" />
                      <span>{t("vend_update_shop_settings_title", { defaultValue: "Update Shop Settings & Schedule" })}</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("vend_shop_brand_name_label", { defaultValue: "Shop Brand Name" })}</label>
                        <input 
                          type="text"
                          value={editShopName}
                          onChange={(e) => setEditShopName(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("vend_logo_text_initials_label", { defaultValue: "Logo text / Initials" })}</label>
                        <input 
                          type="text"
                          value={editShopLogoText}
                          onChange={(e) => setEditShopLogoText(e.target.value)}
                          maxLength={3}
                          className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("vend_business_category_label", { defaultValue: "Business Category" })}</label>
                        <select 
                          value={editShopCategory}
                          onChange={(e) => setEditShopCategory(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="barber">{t("vend_business_category_barber", { defaultValue: "Barbershop / Salon" })}</option>
                          <option value="medical">{t("vend_business_category_medical", { defaultValue: "Medical Clinic" })}</option>
                          <option value="government">{t("vend_business_category_government", { defaultValue: "Government / Offices" })}</option>
                          <option value="telecom">{t("vend_business_category_telecom", { defaultValue: "Telecom & Retail" })}</option>
                          <option value="food">{t("vend_business_category_food", { defaultValue: "Restaurant / Café" })}</option>
                          <option value="other">{t("vend_business_category_other", { defaultValue: "Other Services" })}</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("vend_default_ticket_color_label", { defaultValue: "Default Ticket Color" })}</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color"
                            value={editShopTicketColor}
                            onChange={(e) => setEditShopTicketColor(e.target.value)}
                            className="w-10 h-10 border border-slate-200 rounded-xl cursor-pointer p-0 bg-transparent"
                          />
                          <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400 uppercase">{editShopTicketColor}</span>
                        </div>
                      </div>
                    </div>

                    {/* Logo upload drag drop */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("vend_shop_logo_branding_label", { defaultValue: "Shop Logo Branding" })}</label>
                      <div 
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-3xl p-5 text-center transition-all relative overflow-hidden ${
                          dragActive 
                            ? "border-indigo-500 bg-indigo-50/20" 
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <input 
                          type="file"
                          id="logo-file-input"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        {editShopLogoUrl ? (
                          <div className="space-y-3">
                            <img 
                              src={editShopLogoUrl} 
                              alt="Shop logo preview" 
                              className="w-16 h-16 rounded-2xl mx-auto object-cover border border-slate-200 shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setEditShopLogoUrl("")}
                                className="text-[10px] text-rose-500 font-extrabold hover:underline"
                              >
                                {t("vend_remove_logo_btn", { defaultValue: "Remove Logo" })}
                              </button>
                              <label
                                htmlFor="logo-file-input"
                                className="text-[10px] text-indigo-600 font-extrabold hover:underline cursor-pointer"
                              >
                                {t("vend_replace_logo_btn", { defaultValue: "Replace Logo" })}
                              </label>
                            </div>
                          </div>
                        ) : (
                          <label htmlFor="logo-file-input" className="cursor-pointer space-y-1.5 block">
                            <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                            <p className="text-xs font-black text-slate-700 dark:text-slate-300">
                              {t("vend_logo_drag_drop_placeholder", { defaultValue: "Drag and drop your image here, or browse" })}
                            </p>
                            <p className="text-[9px] text-slate-400 font-medium leading-relaxed">
                              {t("vend_logo_supports_msg", { defaultValue: "Supports PNG, JPG images under 1MB" })}
                            </p>
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Working Hours Weekly schedule */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="block text-xs font-black text-slate-800 dark:text-white">
                          {t("vend_enable_store_working_hours_label", { defaultValue: "Enable Store Working Hours" })}
                        </span>
                        <button
                          type="button"
                          onClick={() => setWorkingHoursEnabled(!workingHoursEnabled)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            workingHoursEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              workingHoursEnabled ? (isRtl ? '-translate-x-4' : 'translate-x-4') : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {workingHoursEnabled && (
                        <div className="space-y-2.5">
                          {Object.keys(workingHoursDays).map((dayIndex) => {
                            const dayConfig = workingHoursDays[dayIndex as keyof typeof workingHoursDays];
                            const dayNames = [
                              t("vend_day_sun", { defaultValue: "Sunday" }),
                              t("vend_day_mon", { defaultValue: "Monday" }),
                              t("vend_day_tue", { defaultValue: "Tuesday" }),
                              t("vend_day_wed", { defaultValue: "Wednesday" }),
                              t("vend_day_thu", { defaultValue: "Thursday" }),
                              t("vend_day_fri", { defaultValue: "Friday" }),
                              t("vend_day_sat", { defaultValue: "Saturday" })
                            ];
                            const dayName = dayNames[parseInt(dayIndex)];
                            return (
                              <div key={dayIndex} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl gap-3 border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      className="sr-only peer" 
                                      checked={dayConfig.enabled}
                                      onChange={(e) => {
                                        setWorkingHoursDays({
                                          ...workingHoursDays,
                                          [dayIndex]: { ...dayConfig, enabled: e.target.checked }
                                        });
                                      }}
                                    />
                                    <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                  </label>
                                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 w-20">{dayName}</span>
                                </div>
                                {dayConfig.enabled ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1">
                                      <span className="text-[9px] text-slate-400 font-bold">{t("vend_open_time")}:</span>
                                      <input
                                        type="time"
                                        value={dayConfig.open}
                                        onChange={(e) => {
                                          setWorkingHoursDays({
                                            ...workingHoursDays,
                                            [dayIndex]: {
                                              ...dayConfig,
                                              open: e.target.value
                                            }
                                          });
                                        }}
                                        className="bg-transparent border-none text-xs font-black text-slate-700 dark:text-slate-300 focus:ring-0 p-0 outline-none w-16"
                                      />
                                    </div>
                                    <span className="text-slate-400 text-xs font-bold">←</span>
                                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1">
                                      <span className="text-[9px] text-slate-400 font-bold">{t("vend_close_time")}:</span>
                                      <input
                                        type="time"
                                        value={dayConfig.close}
                                        onChange={(e) => {
                                          setWorkingHoursDays({
                                            ...workingHoursDays,
                                            [dayIndex]: {
                                              ...dayConfig,
                                              close: e.target.value
                                            }
                                          });
                                        }}
                                        className="bg-transparent border-none text-xs font-black text-slate-700 dark:text-slate-300 focus:ring-0 p-0 outline-none w-16"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-slate-400 font-black bg-slate-100 dark:bg-slate-800 border border-slate-200/40 dark:border-slate-700 px-3 py-1 rounded-full">
                                    {t("vend_working_hours_closed", { defaultValue: "Closed" })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Pause Toggle Option */}
                    <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 p-4 rounded-2xl flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <span className="block text-xs font-black text-slate-800 dark:text-white">
                          {t("vend_pause_service")}
                        </span>
                        <span className="block text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                          {t("vend_pause_service_desc")}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!shop) return;
                          const shopDocRef = doc(db, "shops", shop.id);
                          try {
                            await updateDoc(shopDocRef, { isPaused: !shop.isPaused });
                          } catch (err) {
                            console.error("Error toggling pause state:", err);
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          shop?.isPaused ? 'bg-amber-500' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            shop?.isPaused ? (isRtl ? '-translate-x-5' : 'translate-x-5') : 'translate-x-5'
                          }`}
                        />
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={settingsSaving}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-extrabold px-6 py-3 rounded-2xl transition-all disabled:opacity-50 flex items-center gap-1.5 shadow shadow-indigo-100 dark:shadow-none animate-fade-in"
                    >
                      {settingsSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <span>{t("vend_btn_save_settings", { defaultValue: "Save Changes" })}</span>
                      )}
                    </button>
                  </form>

                </div>

              </div>
            )}

            {/* TAB 4: Reports & Advanced Analytics */}
            {activeTab === "reports" && (
              <div className="space-y-6 animate-fade-in animate-duration-200">
                {/* Reports controller box */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="space-y-1">
                      <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                        <span>{t("vend_performance_reports_title", { defaultValue: "Performance Reports & AI Analytics" })}</span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t("vend_performance_reports_desc", { defaultValue: "Select date bounds to fetch logs, extract analytics, or pull formatted spreadsheet outputs." })}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("vend_start_date_label", { defaultValue: "Start Date" })}</label>
                      <input 
                        type="date"
                        value={reportStartDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-2xl text-xs font-semibold focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("vend_end_date_label", { defaultValue: "End Date" })}</label>
                      <input 
                        type="date"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-2xl text-xs font-semibold focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAnalyzeRange(reportStartDate, reportEndDate, false)}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow shadow-indigo-100 dark:shadow-none"
                      >
                        <Activity className="w-3.5 h-3.5" />
                        <span>{t("vend_load_data_btn", { defaultValue: "Load Data" })}</span>
                      </button>
                      <button
                        onClick={() => handleAnalyzeRange(reportStartDate, reportEndDate, true, `Report_${reportStartDate}_to_${reportEndDate}.csv`)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-3 px-4 rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow shadow-emerald-100 dark:shadow-none"
                        title={t("vend_export_csv_title", { defaultValue: "Export CSV" })}
                      >
                        <FileDown className="w-4 h-4" />
                        <span className="hidden sm:inline">{t("vend_export_btn", { defaultValue: "Export" })}</span>
                      </button>
                    </div>
                  </div>

                  {reportError && (
                    <p className="text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/20 p-3 rounded-xl border border-rose-100 dark:border-rose-900/30">
                      {reportError}
                    </p>
                  )}
                </div>

                {/* AI Suggestions & Optimization Section */}
                <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-3xl p-6 text-white border border-slate-800 shadow-md space-y-6 relative overflow-hidden">
                  <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 opacity-5 pointer-events-none">
                    <Sparkles className="w-64 h-64 text-indigo-400" />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-950/80 pb-4">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/20 text-xs font-black text-indigo-300">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{t("vend_ai_optimization_badge", { defaultValue: "AI Optimization Suggestions" })}</span>
                      </div>
                      <h4 className="text-lg font-black tracking-tight">{t("vend_workflow_diagnostics_title", { defaultValue: "Gemini AI Workflow Diagnostics Advisor" })}</h4>
                      <p className="text-xs text-indigo-200">
                        {t("vend_workflow_diagnostics_desc", { defaultValue: "Dispatch cumulative queues to diagnostic LLM engines to extract turn optimization bottlenecks." })}
                      </p>
                    </div>

                    <button
                      onClick={handleGetAiInsights}
                      disabled={aiLoading}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs px-5 py-3 rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-lg shadow-indigo-950 cursor-pointer"
                    >
                      {aiLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>{t("vend_generate_diagnostics_btn", { defaultValue: "Generate Diagnostics" })}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {aiError && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl text-xs font-semibold leading-relaxed space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                        <span>{t("vend_connection_notice_title", { defaultValue: "Connection Notice" })}</span>
                      </div>
                      <p>{aiError}</p>
                    </div>
                  )}

                  {aiAnalysis && (
                    <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-4 text-slate-100 animate-fade-in text-xs leading-relaxed font-medium">
                      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
                        <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
                        <h5 className="font-black text-slate-100 text-sm">{t("vend_generated_insights_title", { defaultValue: "Generated Insights & Service Directives" })}</h5>
                      </div>
                      
                      {/* Recommendations cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div className="bg-slate-950/45 p-4 rounded-xl border border-slate-800 space-y-2">
                          <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">{t("vend_bottleneck_remedies_label", { defaultValue: "💡 Bottleneck Remedies" })}</span>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {aiAnalysis.recommendations?.[0] || t("vend_default_rec_1", { defaultValue: "Schedule secondary personnel buffers during early afternoon peaks to lower the expected wait overhead." })}
                          </p>
                        </div>
                        <div className="bg-slate-950/45 p-4 rounded-xl border border-slate-800 space-y-2">
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">{t("vend_capacity_allocations_label", { defaultValue: "⚡ Capacity Allocations" })}</span>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {aiAnalysis.recommendations?.[1] || t("vend_default_rec_2", { defaultValue: "Cross-train support agents to batch simpler checkout tickets from dense specialized customer waiting paths." })}
                          </p>
                        </div>
                      </div>

                      {aiAnalysis.summary && (
                        <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 leading-relaxed italic">
                          {aiAnalysis.summary}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Advanced Reports & Visual Insights */}
                {(() => {
                  const sourceTickets = analyzedTickets || tickets;
                  const reportsStats = aggregateStatsForAi(sourceTickets);

                  // 1. Employee / Counter Performance Data Compilation
                  const countersData: Record<string, {
                    counterNumber: string;
                    completedCount: number;
                    totalDuration: number;
                    ratings: number[];
                  }> = {};

                  sourceTickets.forEach(t => {
                    if (t.status === "completed" && t.counterNumber) {
                      const c = t.counterNumber;
                      if (!countersData[c]) {
                        countersData[c] = {
                          counterNumber: c,
                          completedCount: 0,
                          totalDuration: 0,
                          ratings: [],
                        };
                      }
                      countersData[c].completedCount += 1;
                      if (t.completedAt && t.calledAt) {
                        const duration = (new Date(t.completedAt).getTime() - new Date(t.calledAt).getTime()) / 60000;
                        if (duration > 0 && duration < 300) { // filter out extreme outlier spikes
                          countersData[c].totalDuration += duration;
                        }
                      }
                      if (typeof t.rating === "number") {
                        countersData[c].ratings.push(t.rating);
                      }
                    }
                  });

                  const performanceArray = Object.values(countersData).map(c => {
                    const avgDuration = c.completedCount > 0 ? c.totalDuration / c.completedCount : 0;
                    const avgRating = c.ratings.length > 0 ? c.ratings.reduce((s, r) => s + r, 0) / c.ratings.length : 0;
                    return {
                      counterNumber: c.counterNumber,
                      completedCount: c.completedCount,
                      avgDuration: Math.round(avgDuration * 10) / 10,
                      avgRating: Math.round(avgRating * 10) / 10,
                    };
                  });

                  // Sorting to find winners / top performers
                  const fastestCounter = [...performanceArray]
                    .filter(c => c.avgDuration > 0)
                    .sort((a, b) => a.avgDuration - b.avgDuration)[0];
                  
                  const highestRatedCounter = [...performanceArray]
                    .filter(c => c.avgRating > 0)
                    .sort((a, b) => b.avgRating - a.avgRating)[0];

                  const mostProductiveCounter = [...performanceArray]
                    .sort((a, b) => b.completedCount - a.completedCount)[0];

                  // 2. Weekly Peak Days calculation
                  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
                  sourceTickets.forEach(t => {
                    if (t.createdAt) {
                      try {
                        const d = new Date(t.createdAt);
                        const day = d.getDay();
                        dayCounts[day] += 1;
                      } catch (e) {}
                    }
                  });

                  const dayNames = [
                    t("vend_day_sun", { defaultValue: "Sunday" }),
                    t("vend_day_mon", { defaultValue: "Monday" }),
                    t("vend_day_tue", { defaultValue: "Tuesday" }),
                    t("vend_day_wed", { defaultValue: "Wednesday" }),
                    t("vend_day_thu", { defaultValue: "Thursday" }),
                    t("vend_day_fri", { defaultValue: "Friday" }),
                    t("vend_day_sat", { defaultValue: "Saturday" })
                  ];
                  const weeklyPeakData = dayCounts.map((count, index) => ({
                    dayLabel: dayNames[index],
                    [t("vend_tickets_count_label", { defaultValue: "Tickets Count" })]: count,
                  }));

                  // Find busiest day index
                  let maxDayIndex = 0;
                  let maxDayCount = 0;
                  dayCounts.forEach((c, idx) => {
                    if (c > maxDayCount) {
                      maxDayCount = c;
                      maxDayIndex = idx;
                    }
                  });
                  const busiestDayName = maxDayCount > 0 
                    ? dayNames[maxDayIndex]
                    : t("vend_not_enough_data", { defaultValue: "Not enough data" });

                  // 3. Find Peak Hour
                  let peakHour = "N/A";
                  let maxHourCount = 0;
                  Object.entries(reportsStats.byHour).forEach(([h, count]) => {
                    if (count > maxHourCount) {
                      maxHourCount = count;
                      peakHour = `${h.padStart(2, '0')}:00`;
                    }
                  });

                  // 4. Service Averages (Handle time per service type)
                  const serviceDurations: Record<string, { totalDuration: number; completedCount: number }> = {};
                  sourceTickets.forEach(t => {
                    if (t.status === "completed" && t.serviceName) {
                      if (!serviceDurations[t.serviceName]) {
                        serviceDurations[t.serviceName] = { totalDuration: 0, completedCount: 0 };
                      }
                      serviceDurations[t.serviceName].completedCount += 1;
                      if (t.completedAt && t.calledAt) {
                        const dur = (new Date(t.completedAt).getTime() - new Date(t.calledAt).getTime()) / 60000;
                        if (dur > 0 && dur < 300) {
                          serviceDurations[t.serviceName].totalDuration += dur;
                        }
                      }
                    }
                  });

                  const serviceAveragesData = Object.entries(serviceDurations).map(([srvName, s]) => {
                    const avg = s.completedCount > 0 ? s.totalDuration / s.completedCount : 0;
                    return {
                      serviceName: srvName,
                      [t("vend_avg_service_time_label", { defaultValue: "Avg Service Time" })]: Math.round(avg * 10) / 10,
                    };
                  });

                  // 5. Daily trends (Daily visitor counts and daily average wait times)
                  let dailySourceTickets = analyzedTickets;
                  if (!dailySourceTickets) {
                    const defaultStart = new Date();
                    defaultStart.setDate(defaultStart.getDate() - 7);
                    const defaultStartISO = defaultStart.toISOString();
                    dailySourceTickets = allTickets.filter(t => t.createdAt >= defaultStartISO);
                  }

                  const dailyTrendMap: Record<string, { dateKey: string; dateObj: Date; visitors: number; totalWait: number; waitCount: number }> = {};
                  
                  dailySourceTickets.forEach(t => {
                    if (!t.createdAt) return;
                    try {
                      const d = new Date(t.createdAt);
                      const dateKey = d.toISOString().slice(0, 10); // YYYY-MM-DD
                      if (!dailyTrendMap[dateKey]) {
                        dailyTrendMap[dateKey] = {
                          dateKey,
                          dateObj: d,
                          visitors: 0,
                          totalWait: 0,
                          waitCount: 0
                        };
                      }
                      dailyTrendMap[dateKey].visitors += 1;
                      
                      if (t.calledAt) {
                        const wait = (new Date(t.calledAt).getTime() - new Date(t.createdAt).getTime()) / 60000;
                        if (wait >= 0 && wait < 600) { // filter out extreme anomalies
                          dailyTrendMap[dateKey].totalWait += wait;
                          dailyTrendMap[dateKey].waitCount += 1;
                        }
                      }
                    } catch (e) {}
                  });

                  const dailyTrendsData = Object.values(dailyTrendMap)
                    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
                    .map(item => {
                      let displayDate = item.dateKey;
                      try {
                        displayDate = item.dateObj.toLocaleDateString(isRtl ? "ar-EG" : "en-US", { month: 'short', day: 'numeric' });
                      } catch {}
                      
                      const avgWait = item.waitCount > 0 ? Math.round(item.totalWait / item.waitCount) : 0;
                      return {
                        date: displayDate,
                        visitors: item.visitors,
                        avgWaitTime: avgWait,
                      };
                    });

                  const hasPerformanceData = performanceArray.length > 0;

                  return (
                    <div className="space-y-6">
                      {/* Advanced Analytics Highlight Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        
                        {/* Highlights 1: Fastest Counter/Employee */}
                        <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/[0.02] border border-amber-200/50 dark:border-amber-900/30 p-5 rounded-3xl flex items-start gap-4 shadow-sm">
                          <div className="bg-amber-100 dark:bg-amber-950/55 p-3 rounded-2xl">
                            <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest block">
                              {t("vend_fastest_service_perf", { defaultValue: "FASTEST SERVICE PERFORMANCE" })}
                            </span>
                            <h4 className="text-sm font-black text-slate-900 dark:text-white">
                              {fastestCounter ? (
                                t("vend_fastest_counter_text", { counter: fastestCounter.counterNumber, avg: fastestCounter.avgDuration, defaultValue: `${fastestCounter.counterNumber} (Avg: ${fastestCounter.avgDuration} mins)` })
                              ) : (
                                t("vend_service_desk_fallback", { defaultValue: "Service desk" })
                              )}
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                              {t("vend_fastest_counter_desc", { defaultValue: "Highest throughput speed for serving queue slots." })}
                            </p>
                          </div>
                        </div>

                        {/* Highlights 2: Busiest Day of the Week */}
                        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/[0.02] border border-emerald-200/50 dark:border-emerald-900/30 p-5 rounded-3xl flex items-start gap-4 shadow-sm">
                          <div className="bg-emerald-100 dark:bg-emerald-950/55 p-3 rounded-2xl">
                            <CalendarRange className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">
                              {t("vend_weekly_peak_occupancy", { defaultValue: "WEEKLY PEAK OCCUPANCY" })}
                            </span>
                            <h4 className="text-sm font-black text-slate-900 dark:text-white">
                              {maxDayCount > 0 ? (
                                t("vend_weekly_peak_count_text", { day: busiestDayName, count: maxDayCount, defaultValue: `${busiestDayName} (${maxDayCount} total bookings)` })
                              ) : (
                                t("vend_not_enough_data", { defaultValue: "Not enough data" })
                              )}
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                              {t("vend_weekly_peak_desc", { defaultValue: "Busiest weekday. Recommended to scale up working shifts." })}
                            </p>
                          </div>
                        </div>

                        {/* Highlights 3: Busiest Hour */}
                        <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/[0.02] border border-indigo-200/50 dark:border-indigo-900/30 p-5 rounded-3xl flex items-start gap-4 shadow-sm">
                          <div className="bg-indigo-100 dark:bg-indigo-950/55 p-3 rounded-2xl">
                            <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">
                              {t("vend_daily_peak_hour", { defaultValue: "DAILY PEAK HOUR" })}
                            </span>
                            <h4 className="text-sm font-black text-slate-900 dark:text-white">
                              {peakHour !== "N/A" ? (
                                t("vend_daily_peak_hour_text", { hour: peakHour, count: maxHourCount, defaultValue: `${peakHour} (${maxHourCount} bookings)` })
                              ) : (
                                t("vend_no_active_load", { defaultValue: "No active load" })
                              )}
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                              {t("vend_daily_peak_hour_desc", { defaultValue: "Highest flow of check-ins. Good for routing desks." })}
                            </p>
                          </div>
                        </div>

                      </div>

                      {/* Four Recharts Visualizations Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Chart 1: Hourly Booking Load */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
                          <div className="space-y-1">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-indigo-500" />
                              <span>{t("vend_hourly_booking_load_peaks_title", { defaultValue: "Hourly Booking Load Peaks" })}</span>
                            </h4>
                            <p className="text-[11px] text-slate-400">{t("vend_hourly_booking_load_peaks_desc", { defaultValue: "Customer intake volume classified by hour." })}</p>
                          </div>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="colorWaiting" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="hourLabel" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                                <Area type="monotone" dataKey={waitingKey} stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorWaiting)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Chart 2: Weekly Days Occupancy Peaks */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
                          <div className="space-y-1">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                              <CalendarRange className="w-4 h-4 text-emerald-500" />
                              <span>{t("vend_chart_peak_days", { defaultValue: "Peak Days of the Week" })}</span>
                            </h4>
                            <p className="text-[11px] text-slate-400">{t("vend_chart_peak_days_desc", { defaultValue: "Compares weekly ticket count to schedule optimal shifts." })}</p>
                          </div>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={weeklyPeakData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="dayLabel" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                                <Bar dataKey={t("vend_chart_tickets_count_legend", { defaultValue: "Tickets Count" })} fill="#10b981" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Chart 3: Accumulated expected wait time */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
                          <div className="space-y-1">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                              <TrendingUp className="w-4 h-4 text-emerald-500" />
                              <span>{t("vend_chart_accumulated_wait", { defaultValue: "Accumulated Wait Time Trends" })}</span>
                            </h4>
                            <p className="text-[11px] text-slate-400">{t("vend_chart_accumulated_wait_desc", { defaultValue: "Accumulated delay time for customers in queue." })}</p>
                          </div>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="hourLabel" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                                <Bar dataKey={waitTimeKey} fill="#6366f1" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Chart 4: Average Handle Duration per Service */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
                          <div className="space-y-1">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Activity className="w-4 h-4 text-indigo-500" />
                              <span>{t("vend_chart_avg_handle", { defaultValue: "Avg Handle Duration by Service Type" })}</span>
                            </h4>
                            <p className="text-[11px] text-slate-400">{t("vend_chart_avg_handle_desc", { defaultValue: "The average handling time needed per client for each service." })}</p>
                          </div>
                          <div className="h-64">
                            {serviceAveragesData.length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={serviceAveragesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                  <XAxis dataKey="serviceName" stroke="#94a3b8" fontSize={9} tickLine={false} />
                                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                  <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                                  <Bar dataKey={t("vend_th_avg_handling_time", { defaultValue: "Avg Handling Time" })} fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                                <span>{t("vend_no_completed_tickets_durations", { defaultValue: "No completed tickets to compute service durations." })}</span>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>

                      {/* Section: Daily Trends Analysis (عدد المراجعين ومتوسط وقت الانتظار يومياً) */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                          <div className="space-y-1">
                            <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                              <TrendingUp className="w-5 h-5 text-indigo-600" />
                              <span>{t("vend_chart_daily_trends", { defaultValue: "Daily Visitor & Wait Time Trends" })}</span>
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {t("vend_chart_daily_trends_desc", { defaultValue: "Analyze daily visitor intake volume and the average actual wait time trends to optimize business performance." })}
                            </p>
                          </div>
                          
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold px-3 py-1.5 rounded-xl uppercase tracking-wider block">
                            {analyzedTickets ? t("vend_custom_range", { defaultValue: "Custom Range" }) : t("vend_last_7_days_auto", { defaultValue: "Last 7 Days (Auto)" })}
                          </span>
                        </div>

                        {dailyTrendsData.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Daily Visitors Area Chart */}
                            <div className="space-y-4">
                              <div className="space-y-1">
                                <h5 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                  <Users className="w-4 h-4 text-emerald-500" />
                                  <span>{t("vend_daily_visitors_title", { defaultValue: "Daily Visitors Intake" })}</span>
                                </h5>
                                <p className="text-[10px] text-slate-400">{t("vend_daily_visitors_desc", { defaultValue: "Visualizes the day-by-day volume of checked-in customers." })}</p>
                              </div>
                              <div className="h-64 bg-slate-50/30 dark:bg-slate-950/20 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={dailyTrendsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                      <linearGradient id="colorDailyVisitors" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" vertical={false} />
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} tickLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '11px', backgroundColor: 'rgba(255, 255, 255, 0.95)', color: '#1e293b' }} />
                                    <Area type="monotone" dataKey="visitors" name={t("vend_visitors_count_legend", { defaultValue: "Visitors Count" })} stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorDailyVisitors)" />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                            </div>

                            {/* Daily Average Wait Time Bar/Area Chart */}
                            <div className="space-y-4">
                              <div className="space-y-1">
                                <h5 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                  <Clock className="w-4 h-4 text-amber-500" />
                                  <span>{t("vend_daily_avg_wait_title", { defaultValue: "Daily Avg Wait Time (Minutes)" })}</span>
                                </h5>
                                <p className="text-[10px] text-slate-400">{t("vend_daily_avg_wait_desc", { defaultValue: "Traces how long customers had to wait on average before being called." })}</p>
                              </div>
                              <div className="h-64 bg-slate-50/30 dark:bg-slate-950/20 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={dailyTrendsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                      <linearGradient id="colorDailyWait" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" vertical={false} />
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} tickLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '11px', backgroundColor: 'rgba(255, 255, 255, 0.95)', color: '#1e293b' }} />
                                    <Area type="monotone" dataKey="avgWaitTime" name={t("vend_avg_wait_time_legend", { defaultValue: "Avg Wait Time (m)" })} stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorDailyWait)" />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs gap-2">
                             <Info className="w-6 h-6 text-slate-300" />
                            <span>{t("vend_insufficient_data_daily_trends", { defaultValue: "No sufficient ticket data to compile daily performance trends." })}</span>
                          </div>
                        )}
                      </div>

                      {/* Staff & Counter Live Performance Leaderboard */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                          <div className="space-y-1">
                            <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                              <Users className="w-4 h-4 text-emerald-600" />
                              <span>{t("vend_staff_performance_tracker_title", { defaultValue: "Staff Performance & Counter Productivity Tracker" })}</span>
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {t("vend_staff_performance_tracker_desc", { defaultValue: "Analyze support officer service rate, volume capacity, and customer satisfaction metrics." })}
                            </p>
                          </div>
                          
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold px-3 py-1.5 rounded-xl uppercase tracking-wider block">
                            {performanceArray.length} {t("vend_active_counters_count", { defaultValue: "Active service counters" })}
                          </span>
                        </div>

                        {hasPerformanceData ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left border-collapse">
                              <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800/60 text-slate-400 uppercase tracking-wider text-[10px] font-black">
                                  <th className={`py-3.5 px-4 ${isRtl ? "text-right" : "text-left"}`}>{t("vend_th_employee", { defaultValue: "Service Window / Employee" })}</th>
                                  <th className={`py-3.5 px-4 text-center`}>{t("vend_th_completed_tickets", { defaultValue: "Completed Tickets" })}</th>
                                  <th className={`py-3.5 px-4 text-center`}>{t("vend_th_avg_handling_time", { defaultValue: "Avg Handling Time" })}</th>
                                  <th className={`py-3.5 px-4 text-center`}>{t("vend_th_satisfaction", { defaultValue: "Customer Satisfaction" })}</th>
                                  <th className={`py-3.5 px-4 ${isRtl ? "text-left" : "text-right"}`}>{t("vend_th_badges", { defaultValue: "Performance Badges" })}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                                {performanceArray.map((counter, idx) => {
                                  const isFastest = fastestCounter && counter.counterNumber === fastestCounter.counterNumber;
                                  const isHighestRated = highestRatedCounter && counter.counterNumber === highestRatedCounter.counterNumber;
                                  const isMostProductive = mostProductiveCounter && counter.counterNumber === mostProductiveCounter.counterNumber;

                                  return (
                                    <tr key={idx} className="hover:bg-slate-50/[0.4] dark:hover:bg-slate-800/[0.1] transition-all">
                                      <td className={`py-4 px-4 ${isRtl ? "text-right" : "text-left"} font-extrabold text-slate-900 dark:text-white flex items-center gap-2`}>
                                        <div className="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-center text-[10px] text-indigo-700 dark:text-indigo-300 font-black">
                                          {counter.counterNumber.substring(0, 2).toUpperCase()}
                                        </div>
                                        <span>{counter.counterNumber}</span>
                                      </td>
                                      <td className="py-4 px-4 text-center font-bold text-slate-700 dark:text-slate-300">
                                        <span className="bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl">
                                          {counter.completedCount} {t("vend_tickets_lowercase", { defaultValue: "tickets" })}
                                        </span>
                                      </td>
                                      <td className="py-4 px-4 text-center font-black text-slate-950 dark:text-white">
                                        <span className="flex items-center justify-center gap-1">
                                          <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                          <span>{counter.avgDuration} {t("vend_minutes_lowercase", { defaultValue: "minutes" })}</span>
                                        </span>
                                      </td>
                                      <td className="py-4 px-4 text-center">
                                        <div className="flex items-center justify-center gap-1 text-amber-500 font-extrabold">
                                          <Star className="w-4 h-4 fill-current shrink-0" />
                                          <span>{counter.avgRating > 0 ? `${counter.avgRating} / 5` : t("vend_no_ratings", { defaultValue: "No ratings" })}</span>
                                        </div>
                                      </td>
                                      <td className={`py-4 px-4 ${isRtl ? "text-left" : "text-right"}`}>
                                        <div className={`flex items-center gap-1.5 ${isRtl ? "justify-start" : "justify-end"}`}>
                                          {isFastest && (
                                            <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1">
                                              <Zap className="w-3 h-3" />
                                              <span>{t("vend_badge_fastest", { defaultValue: "Fastest" })}</span>
                                            </span>
                                          )}
                                          {isHighestRated && (
                                            <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1">
                                              <Star className="w-3 h-3" />
                                              <span>{t("vend_badge_top_rated", { defaultValue: "Top Rated" })}</span>
                                            </span>
                                          )}
                                          {isMostProductive && (
                                            <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1">
                                              <Users className="w-3 h-3" />
                                              <span>{t("vend_badge_most_active", { defaultValue: "Most Active" })}</span>
                                            </span>
                                          )}
                                          {!isFastest && !isHighestRated && !isMostProductive && (
                                            <span className="text-[10px] text-slate-400 font-semibold italic">
                                              {t("vend_performance_stable", { defaultValue: "Stable performance" })}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/80">
                            <Users className="w-8 h-8 text-slate-300 dark:text-slate-700 animate-pulse mb-2.5" />
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              {t("vend_no_performance_data", { defaultValue: "No completed employee performance data yet" })}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                              {t("vend_no_performance_data_desc", { defaultValue: "As soon as operators start calling and completing ticket instances, real-time productivity data and service rates will compile here." })}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Customer Live Reviews & Sentiment Analysis */}
                      {(() => {
                        const ratedTicketsList = sourceTickets.filter(tItem => tItem.rating !== undefined && tItem.rating !== null);
                        const sortedRatedTickets = [...ratedTicketsList].sort((a, b) => {
                          const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                          const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                          return dateB - dateA;
                        });

                        return (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                              <div className="space-y-1">
                                <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                  <span>{t("vend_live_customer_feedback_title", { defaultValue: "Live Customer Feedback & Service Ratings" })}</span>
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {t("vend_live_customer_feedback_desc", { defaultValue: "Review incoming text comments and quality ratings left by customers immediately after their turn is completed." })}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-amber-50 dark:bg-amber-950/45 text-amber-700 dark:text-amber-400 font-extrabold px-3 py-1.5 rounded-xl border border-amber-100 dark:border-amber-900/30">
                                  {t("vend_overall_score_label", { defaultValue: "Overall Score: {{avgRating}}" }).replace("{{avgRating}}", String(avgRating))}
                                </span>
                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold px-3 py-1.5 rounded-xl uppercase tracking-wider block">
                                  {sortedRatedTickets.length} {t("vend_total_reviews", { defaultValue: "Total reviews" })}
                                </span>
                              </div>
                            </div>

                            {sortedRatedTickets.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {sortedRatedTickets.slice(0, 12).map((ticket, idx) => {
                                  const ratingDate = ticket.completedAt ? new Date(ticket.completedAt) : null;
                                  const currentLocale = i18n.language === 'ar' ? 'ar-EG' : i18n.language === 'tr' ? 'tr-TR' : 'en-US';
                                  const timeString = ratingDate 
                                    ? ratingDate.toLocaleTimeString(currentLocale, { hour: '2-digit', minute: '2-digit' })
                                    : "";
                                  const dateString = ratingDate 
                                    ? ratingDate.toLocaleDateString(currentLocale, { month: 'short', day: 'numeric' })
                                    : "";

                                  return (
                                    <div key={idx} className="bg-slate-50/[0.4] dark:bg-slate-800/[0.1] border border-slate-100 dark:border-slate-800 p-4 rounded-2xl flex flex-col justify-between gap-3.5 hover:border-indigo-100 dark:hover:border-indigo-950/60 hover:shadow-sm transition-all duration-200">
                                      <div className="space-y-2.5">
                                        {/* Star bar + Ticket identifier */}
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-0.5 text-amber-400">
                                            {Array.from({ length: 5 }).map((_, sIdx) => (
                                              <Star 
                                                key={sIdx} 
                                                className={`w-3.5 h-3.5 ${sIdx < (ticket.rating || 0) ? "fill-current" : "text-slate-200 dark:text-slate-800"}`} 
                                              />
                                            ))}
                                          </div>
                                          
                                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md font-mono font-black">
                                            #{ticket.ticketNumber}
                                          </span>
                                        </div>

                                        {/* Optional Speed & Quality Indicators */}
                                        {(ticket.ratingSpeed || ticket.ratingQuality) && (
                                          <div className="flex flex-wrap gap-2 items-center mt-1 text-[9px] text-slate-500 dark:text-slate-400 font-bold">
                                            {ticket.ratingSpeed && (
                                              <span className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/60 px-2 py-1 rounded-lg">
                                                <span>⚡ {t("vend_rating_speed_label", { defaultValue: "Speed" })}:</span>
                                                <span className="text-amber-500 dark:text-amber-400 font-extrabold">{ticket.ratingSpeed}/5</span>
                                              </span>
                                            )}
                                            {ticket.ratingQuality && (
                                              <span className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/60 px-2 py-1 rounded-lg">
                                                <span>🤝 {t("vend_rating_quality_label", { defaultValue: "Quality" })}:</span>
                                                <span className="text-amber-500 dark:text-amber-400 font-extrabold">{ticket.ratingQuality}/5</span>
                                              </span>
                                            )}
                                          </div>
                                        )}

                                        {/* Comment Text */}
                                        {ticket.ratingComment ? (
                                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 italic bg-white dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-105/50 dark:border-slate-800/50 leading-relaxed">
                                            "{ticket.ratingComment}"
                                          </p>
                                        ) : (
                                          <p className="text-xs text-slate-400 font-medium italic p-2.5">
                                            {t("vend_rated_stars_only", { defaultValue: "Rated with stars only, no comment left." })}
                                          </p>
                                        )}
                                      </div>

                                      {/* Author footer */}
                                      <div className="border-t border-slate-100/50 dark:border-slate-800/40 pt-2.5 flex items-center justify-between text-[10px] text-slate-400 font-bold">
                                        <div className="flex flex-col gap-0.5">
                                          <span className="text-slate-700 dark:text-slate-300 font-black text-[11px]">
                                            {ticket.customerName || t("vend_anonymous_customer", { defaultValue: "Anonymous customer" })}
                                          </span>
                                          <span className="text-slate-500 dark:text-slate-400 font-bold">
                                            {ticket.serviceName} {ticket.counterNumber && `• ${t("vend_counter_label", { defaultValue: "Counter" })} ${ticket.counterNumber}`}
                                          </span>
                                        </div>
                                        <div className="text-right flex flex-col gap-0.5">
                                          <span className="text-slate-500 dark:text-slate-400 font-mono">{timeString}</span>
                                          <span>{dateString}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/80">
                                <Star className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2.5 animate-pulse" />
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                  {t("vend_no_text_feedback_comments", { defaultValue: "No text feedback comments submitted yet" })}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                                  {t("vend_no_text_feedback_comments_desc", { defaultValue: "As soon as clients complete their visits and leave star ratings or comment text via their active portals, reviews will stream here." })}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                    </div>
                  );
                })()}

              </div>
            )}

            {/* TAB 5: Live Screens & Public Displays Remote Control */}
            {activeTab === "displays" && (
              <div className="space-y-6 animate-fade-in animate-duration-200">
                
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-md border border-slate-800/60 relative overflow-hidden">
                  <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 opacity-5 pointer-events-none">
                    <Tv className="w-64 h-64 text-white" />
                  </div>
                  
                  <div className="max-w-xl space-y-4">
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-black text-indigo-300">
                      <Tv className="w-3.5 h-3.5" />
                      <span>{t("vend_displays_realtime", { defaultValue: "Real-time Public Display Screens" })}</span>
                    </div>
                    
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                      {t("vend_displays_monitor", { defaultValue: "Monitor & Remote-Control Public Screen Displays" })}
                    </h2>
                    
                    <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
                      {t("vend_displays_desc", { defaultValue: "Launch this dashboard screen in-store (on any smart TV, monitor, or tablet) to keep clients informed about current ticket calls in real-time. Manage and force screen refreshes remotely below." })}
                    </p>
                    
                    <div className="pt-2 flex flex-wrap gap-3">
                      <a
                        href={`/?page=display&shop=${shop?.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-5 py-3 rounded-xl transition-all flex items-center gap-2 shadow shadow-indigo-950 cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>{t("vend_displays_launch", { defaultValue: "Launch Display Screen ↗" })}</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Displays List */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {t("vend_displays_active_list", { defaultValue: "Active Screen Devices list" })}
                    </h3>
                    <button
                      onClick={() => {
                        alert(t("vend_displays_register_help", { defaultValue: "To register a new device, simply open the 'Launch Display Screen' URL on that device. It will automatically list itself here." }));
                      }}
                      className="text-xs font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-100 px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>{t("vend_displays_how_to", { defaultValue: "How to connect a screen?" })}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {displays.length > 0 ? (
                      displays.map((display) => {
                        const isOnline = (new Date().getTime() - new Date(display.lastActive).getTime()) < 50000;
                        const isEditing = editingDisplayId === display.id;

                        return (
                          <div 
                            key={display.id}
                            className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 space-y-4 hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-all shadow-sm flex flex-col justify-between"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                  <Tv className="w-5 h-5" />
                                </div>
                                <div className="space-y-1">
                                  {isEditing ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={editingDisplayName}
                                        onChange={(e) => setEditingDisplayName(e.target.value)}
                                        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44"
                                      />
                                      <button
                                        onClick={() => handleUpdateDisplayName(display.id, editingDisplayName)}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] px-2.5 py-1.5 rounded-lg transition-all"
                                      >
                                        {t("save", { defaultValue: "Save" })}
                                      </button>
                                      <button
                                        onClick={() => setEditingDisplayId(null)}
                                        className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-extrabold text-[10px] px-2.5 py-1.5 rounded-lg transition-all"
                                      >
                                        {t("cancel", { defaultValue: "Cancel" })}
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-white">{display.name}</h4>
                                      <button
                                        onClick={() => {
                                          setEditingDisplayId(display.id);
                                          setEditingDisplayName(display.name);
                                        }}
                                        className="text-[10px] text-indigo-500 font-bold hover:underline cursor-pointer"
                                      >
                                        {t("vend_btn_rename", { defaultValue: "[Rename]" })}
                                      </button>
                                    </div>
                                  )}
                                  
                                  <p className="text-[10px] text-slate-400 font-mono">ID: {display.id}</p>
                                </div>
                              </div>

                              {/* Online Status indicator badge */}
                              <div className={`px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1 shrink-0 ${
                                isOnline 
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30" 
                                  : "bg-slate-100 text-slate-500 border border-slate-200/80 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                                <span>{isOnline ? t("vend_status_online", { defaultValue: "Online" }) : t("vend_status_offline", { defaultValue: "Offline" })}</span>
                              </div>
                            </div>

                            <div className="border-t border-slate-200/50 dark:border-slate-800 pt-3.5 flex items-center justify-between gap-3 text-xs text-slate-500">
                              <span className="text-[10px] font-medium">
                                {t("vend_displays_last_active", { defaultValue: "Last active:" })}{" "}
                                <strong className="text-slate-700 dark:text-slate-300 font-bold">
                                  {new Date(display.lastActive).toLocaleTimeString(i18n.language === 'ar' ? 'ar-EG' : i18n.language === 'tr' ? 'tr-TR' : 'en-US', { hour: "numeric", minute: "2-digit" })}
                                </strong>
                              </span>

                              <div className="flex items-center gap-2">
                                {/* Remote Refresh Button */}
                                <button
                                  onClick={() => handleRemoteRefresh(display.id)}
                                  disabled={refreshingDisplayId === display.id}
                                  className="bg-indigo-50 hover:bg-indigo-100/80 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 font-bold text-[11px] py-1.5 px-3 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                                  title={t("vend_displays_refresh_title", { defaultValue: "Force remote screen refresh" })}
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingDisplayId === display.id ? "animate-spin text-indigo-600" : ""}`} />
                                  <span>{t("vend_displays_refresh", { defaultValue: "Remote Refresh" })}</span>
                                </button>

                                {/* Delete Device Button */}
                                <button
                                  onClick={() => handleDeleteDisplay(display.id)}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 border border-rose-100/50 dark:border-rose-900/30 p-2 rounded-xl transition-all cursor-pointer"
                                  title={t("vend_displays_remove", { defaultValue: "Remove screen" })}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="col-span-1 md:col-span-2 text-center py-12 bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 dark:text-slate-500 space-y-2">
                        <p className="text-sm font-bold">{t("vend_displays_no_screens", { defaultValue: "No screens registered yet" })}</p>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                          {t("vend_displays_first_help", { defaultValue: "To register your first screen device, click 'Launch Display Screen' above. Once loaded on any TV or device, it will register and show up here in seconds!" })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 6: Billing & Payments */}
            {activeTab === "billing" && (
              <div className="space-y-6 animate-fade-in animate-duration-200">
                
                {/* Subscription Plan Status card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 text-xs font-black border border-indigo-100 dark:border-indigo-900/30">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{t("vend_billing_title", { defaultValue: "SaaS License & Subscription" })}</span>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                        {t("vend_billing_status_label", { defaultValue: "Current Subscription Status:" })}{" "}
                        {shop?.plan === "pro" ? (
                          <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-black rounded-full uppercase animate-pulse">
                            PRO Premium Active
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-black rounded-full uppercase">
                            FREE Trial Limit
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg leading-relaxed">
                        {shop?.plan === "pro" 
                          ? t("vend_billing_pro_desc", { defaultValue: "PRO Premium active with unlimited daily tickets. Plan expires on: " }) + (shop.planExpiresAt ? new Date(shop.planExpiresAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US') : "N/A")
                          : t("vend_billing_free_desc", { defaultValue: "You are currently running the Free Trial (limited to max 5 tickets per day). Upgrade to PRO Plan to unlock unlimited ticket creation." })}
                      </p>
                    </div>
                  </div>

                  {shop?.plan === "pro" && (
                    <div className="shrink-0">
                      <button
                        onClick={handleCancelSubscription}
                        className="text-xs font-black text-rose-600 bg-rose-50 hover:bg-rose-100/80 border border-rose-100 px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                      >
                        {t("vend_billing_cancel_upgrade", { defaultValue: "Cancel Premium Upgrade" })}
                      </button>
                    </div>
                  )}
                </div>

                {/* Stripe Callback statuses */}
                {stripeVerifying && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-sm animate-pulse">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {t("vend_billing_verifying", { defaultValue: "Verifying your transaction securely..." })}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                      {t("vend_billing_verifying_desc", { defaultValue: "Please do not close this window. We are checking the transaction status with Stripe to activate your PRO features." })}
                    </p>
                  </div>
                )}

                {stripeVerifySuccess && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-3xl p-8 text-center space-y-4 shadow-sm">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-black text-emerald-800 dark:text-emerald-400">
                      {t("vend_billing_success", { defaultValue: "Congratulations! Subscription Active 🎉" })}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                      {t("vend_billing_success_desc", { defaultValue: "Your shop is now fully upgraded to the PRO Premium Plan. You have unlimited daily tickets, deep statistics, custom themes, and full control." })}
                    </p>
                    <button 
                      onClick={() => {
                        setStripeVerifySuccess(false);
                        setActiveTab("queue");
                      }}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      {t("vend_billing_go_queue", { defaultValue: "Go to Queue Board" })}
                    </button>
                  </div>
                )}

                {stripeVerifyError && (
                  <div className="bg-rose-50 dark:bg-rose-950/10 border border-rose-200 dark:border-rose-900/30 rounded-3xl p-6 text-center space-y-3 shadow-sm">
                    <p className="text-xs font-black text-rose-600 dark:text-rose-400">
                      ⚠️ {stripeVerifyError}
                    </p>
                    <button 
                      onClick={() => setStripeVerifyError("")}
                      className="text-[11px] font-black text-slate-600 dark:text-slate-400 hover:underline cursor-pointer"
                    >
                      {t("dismiss", { defaultValue: "Dismiss" })}
                    </button>
                  </div>
                )}

                {/* Grid split: card checkout and invoice logs */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left panel: Secure Stripe Sandbox checkout card */}
                  {shop?.plan !== "pro" && (
                    <div className="lg:col-span-5 space-y-6">
                      {/* Method 1: Global Stripe Checkout Button Card */}
                      <div className="bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-950/30 p-6 rounded-3xl shadow-sm space-y-4 border-2">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Globe className="w-4 h-4 text-emerald-500 animate-spin animate-duration-1000" />
                            <span>{t("vend_billing_stripe_title", { defaultValue: "Global Payment Portal (Stripe)" })}</span>
                          </h4>
                          <span className="px-2 py-0.5 text-[8px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-extrabold rounded uppercase tracking-wider">
                            {t("recommended", { defaultValue: "Recommended" })}
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-black">
                          {t("vend_billing_stripe_desc", { defaultValue: "Secure payments from any country using credit/debit cards, Google Pay, Apple Pay, and more." })}
                        </p>

                        <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 p-3 rounded-2xl flex items-center justify-between">
                          <div className="text-right">
                            <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-black">{t("vend_billing_monthly_rate", { defaultValue: "Monthly rate" })}</span>
                            <span className="text-xl font-black text-slate-900 dark:text-white">$20.00 <span className="text-[10px] font-normal">/mo</span></span>
                          </div>
                          <div className="flex gap-1 text-[11px] text-emerald-600 font-black">
                            <span>Apple Pay / Google Pay</span>
                          </div>
                        </div>

                        {stripeError && (
                          <div className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/20 p-3 rounded-xl border border-rose-100 dark:border-rose-900/30 space-y-2">
                            <p className="font-semibold">⚠️ {stripeError}</p>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={handleStripeCheckout}
                          disabled={stripeLoading}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 text-white font-extrabold text-xs py-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-100 dark:shadow-none"
                        >
                          {stripeLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Globe className="w-4 h-4" />
                          )}
                          <span>
                            {stripeLoading
                              ? t("vend_billing_stripe_connecting", { defaultValue: "Connecting to Stripe..." })
                              : t("vend_billing_stripe_upgrade", { defaultValue: "Upgrade with Global Stripe Checkout" })}
                          </span>
                        </button>
                      </div>

                      {/* Method 2: Fallback Quick Offline Checkout (Developer sandbox) */}
                      <form onSubmit={handleProcessUpgrade} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-5 relative">
                        {paymentProcessing && (
                          <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center rounded-3xl animate-fade-in">
                            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
                            <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">{t("vend_billing_processing", { defaultValue: "Processing instant checkout..." })}</h4>
                            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{t("vend_billing_simulating_desc", { defaultValue: "Simulating local mock checkout for fast dashboard sandbox trial." })}</p>
                          </div>
                        )}

                        <h4 className="text-sm font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-indigo-600" />
                          <span>{t("vend_billing_simulated_title", { defaultValue: "Simulated Checkout (Local bypass)" })}</span>
                        </h4>

                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          {t("vend_billing_simulated_desc_tip", { defaultValue: "For developers or quick client testing without configuring Stripe environment keys." })}
                        </p>

                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("vend_billing_card_name", { defaultValue: "Cardholder Name" })}</label>
                            <input 
                              type="text"
                              placeholder="John Doe"
                              value={cardName}
                              onChange={(e) => setCardName(e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("vend_billing_card_number", { defaultValue: "Card Number" })}</label>
                            <input 
                              type="text"
                              placeholder="4000 1234 5678 9010"
                              maxLength={19}
                              value={cardNumber}
                              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              required
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("vend_billing_card_expiry", { defaultValue: "Expiration Date" })}</label>
                              <input 
                                type="text"
                                placeholder="MM/YY"
                                maxLength={5}
                                value={cardExpiry}
                                onChange={(e) => setCardExpiry(formatCardExpiry(e.target.value))}
                                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">CVV</label>
                              <input 
                                type="password"
                                placeholder="***"
                                maxLength={3}
                                value={cardCvv}
                                onChange={(e) => setCardCvv(e.target.value.replace(/[^0-9]/gi, ""))}
                                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                                required
                              />
                            </div>
                          </div>
                        </div>

                        {paymentError && (
                          <p className="text-xs font-black text-rose-500 bg-rose-50 dark:bg-rose-950/20 p-3 rounded-xl border border-rose-100 dark:border-rose-900/30">
                            ⚠️ {paymentError}
                          </p>
                        )}

                        <button
                          type="submit"
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow shadow-indigo-100 dark:shadow-none"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>{t("vend_billing_process_simulated", { defaultValue: "Process Instant Simulated Upgrade" })}</span>
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Right panel: invoice logs list */}
                  <div className={`${shop?.plan === "pro" ? "lg:col-span-12" : "lg:col-span-7"} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4`}>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-indigo-500" />
                      <span>{t("vend_billing_invoices_title", { defaultValue: "Invoice History logs" })}</span>
                    </h4>

                    <div className="space-y-3">
                      {invoices.length > 0 ? (
                        invoices.map((inv) => (
                          <div 
                            key={inv.id}
                            className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-slate-800 dark:text-white font-mono">{inv.invoiceNumber}</span>
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 text-[9px] font-black uppercase rounded-md border">
                                  {inv.status}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-medium">
                                📅 {t("vend_billing_date_issued", { defaultValue: "Date issued:" })} <strong className="text-slate-600 dark:text-slate-300 font-bold">{new Date(inv.createdAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : i18n.language === 'tr' ? 'tr-TR' : 'en-US')}</strong>
                                {" "}| {inv.cardBrand ? `💳 ${inv.cardBrand} (*${inv.cardLast4})` : ""}
                              </p>
                            </div>

                            <div className="flex items-center justify-between sm:justify-start gap-4 shrink-0">
                              <strong className="text-sm font-black text-indigo-600 dark:text-indigo-400">{inv.amount}</strong>
                              <button
                                onClick={() => {
                                  const lang = i18n.language;
                                  const receiptText = lang === 'ar'
                                    ? `تفاصيل الفاتورة الرسمية:\n------------------------\nرقم الفاتورة: ${inv.invoiceNumber}\nالمنتج: ${inv.planName}\nالقيمة: ${inv.amount}\nحالة الدفع: مكتمل بنجاح عبر Stripe\nالبطاقة المستعملة: ${inv.cardBrand || "Credit Card"} (*${inv.cardLast4 || "0000"})\nالتاريخ: ${new Date(inv.createdAt).toLocaleString()}\n------------------------\nشكراً لثقتكم بمنصة دورك!`
                                    : lang === 'tr'
                                      ? `Resmi Fatura Detayları:\n------------------------\nFatura No: ${inv.invoiceNumber}\nÜrün: ${inv.planName}\nTutar: ${inv.amount}\nDurum: Stripe ile Başarıyla Tamamlandı\nÖdeme Kartı: ${inv.cardBrand || "Kredi Kartı"} (*${inv.cardLast4 || "0000"})\nTarih: ${new Date(inv.createdAt).toLocaleString()}\n------------------------\nDork'u tercih ettiğiniz için teşekkür ederiz!`
                                      : `Official Receipt Details:\n------------------------\nInvoice No: ${inv.invoiceNumber}\nItem: ${inv.planName}\nAmount: ${inv.amount}\nStatus: Completed via Stripe Sandbox\nPayment Card: ${inv.cardBrand || "Credit Card"} (*${inv.cardLast4 || "0000"})\nDate: ${new Date(inv.createdAt).toLocaleString()}\n------------------------\nThank you for choosing Dork!`;
                                  alert(receiptText);
                                }}
                                className="text-[10px] font-black text-indigo-500 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 border border-indigo-100 dark:border-indigo-900/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                              >
                                {t("vend_billing_view_receipt", { defaultValue: "View Receipt" })}
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs">
                          {t("vend_billing_no_invoices", { defaultValue: "No previous invoices." })}
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>
            )}

          </div>
        </div>
      </div>

      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6 animate-pulse" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {confirmModal.title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {confirmModal.message}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2.5 px-4 rounded-xl text-sm transition-all cursor-pointer"
              >
                {t("cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                onClick={() => confirmModal.onConfirm()}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all cursor-pointer"
              >
                {t("confirm", { defaultValue: "Confirm" })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}