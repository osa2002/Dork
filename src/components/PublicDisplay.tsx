import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  setDoc,
  getDoc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { Shop, Ticket, Service } from "../types";
import { playChime } from "../lib/audio";
import { useTranslation } from "react-i18next";
import { 
  Tv, 
  Clock, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  ArrowLeft,
  RefreshCw,
  Bell,
  Sparkles,
  X,
  Sliders,
  Settings
} from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";

interface PublicDisplayProps {
  shopSlug: string;
  onBackToHome: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
}

interface CounterStatus {
  id: string;
  shopId: string;
  counterNumber: string;
  status: "online" | "busy" | "break" | "offline";
  updatedAt: string;
}

export default function PublicDisplay({ shopSlug, onBackToHome, isDarkMode, setIsDarkMode }: PublicDisplayProps) {
  const { t, i18n } = useTranslation();
  const isRtl = (i18n.language || "ar").startsWith("ar");
  const currentLang = (i18n.language || "ar").split("-")[0];

  const t_display = (key: string, fallback: string): string => {
    const dicts: Record<string, Record<string, string>> = {
      ar: {
        loading_display: "جاري تحميل شاشة العرض...",
        connecting_live: "يرجى الانتظار بينما ننشئ اتصالاً آمناً مع قاعدة البيانات",
        connection_error: "خطأ في الاتصال",
        shop_not_found: "تعذر العثور على المحل المطلوب.",
        back_to_home: "العودة للرئيسية",
        all_waiting_paths: "جميع مسارات الانتظار",
        disable_tv: "إيقاف وضع التلفاز",
        enable_tv: "تشغيل وضع التلفاز",
        tv_screen_active: "شاشة TV نشطة",
        tv_mode: "شاشة TV",
        enable_voice_alerts: "تفعيل التنبيه الصوتي 🔊",
        voice_on: "الصوت مفعل",
        stop_speaking_mute: "إيقاف النداء وكتم الصوت فوراً",
        stop_mute: "إيقاف وكتم النطق",
        audio_settings: "إعدادات النداء الصوتي",
        voice_announcements_setup: "تخصيص النداء الصوتي الآلي",
        chime_alert: "صوت الرنين (الجرس)",
        play_subtle_chime: "تشغيل رنين خفيف عند النداء",
        ai_voice_calling: "النداء الصوتي الآلي",
        speak_ticket_window: "نطق رقم التذكرة والشبّاك آلياً",
        callout_lang: "لغة النداء الصوتي",
        both_ar_en: "العربية والإنجليزية معاً",
        ar_only: "العربية فقط",
        en_only: "الإنجليزية فقط",
        speech_rate: "سرعة التحدث",
        slow: "بطيء",
        normal: "طبيعي",
        fast: "سريع",
        stop_current_speech: "إيقاف نطق الصوت الحالي ⏹️",
        exit_fullscreen: "خروج من ملء الشاشة",
        fullscreen: "ملء الشاشة",
        back: "رجوع",
        enter_fullscreen: "دخول ملء الشاشة",
        close: "إغلاق",
        now_serving: "الرقم المستدعى حالياً",
        currently_calling: "الرقم المستدعى حالياً",
        new_call: "مناداة جديدة!",
        service: "الخدمة:",
        go_to_window: "توجه إلى شباك:",
        service_desk: "كاونتر الخدمة",
        waiting_for_next_ticket: "في انتظار مناداة دور جديد",
        waiting_to_call: "في انتظار مناداة دور جديد",
        tts_active: "التوجيه الصوتي الآلي نشط",
        next_in_queue: "التالي في الطابور",
        waiting: "قيد الانتظار",
        waiting_lbl: "انتظار",
        no_upcoming: "لا توجد تذاكر انتظار قادمة",
        new_waiting_clients: "العملاء الجدد سيظهرون هنا تلقائياً عند التسجيل.",
        total_today: "إجمالي تذاكر اليوم",
        completed_today: "المكتملة اليوم",
        live_windows: "حالة شبابيك الخدمة المباشرة",
        window_num: "شباك {{number}}",
        online_status: "يخدم",
        busy_status: "مشغول",
        break_status: "استراحة",
        closed_status: "مغلق",
        system_title: "نظام دورك لإدارة طوابير الانتظار الرقمية 🎟️",
        dedicated_monitor_desc: "وضع الشاشة المخصصة: قم بتفعيل ملء الشاشة لتخصيص هذا المونيتور لعرض الطابور بالكامل للعملاء.",
        dedicated_monitor_sub: "يخفي هذا الوضع شريط المتصفح والأزرار الإضافية للحصول على مظهر احترافي داخل المحل.",
        tts_active_desc: "يقوم النظام بقراءة التذاكر الجديدة صوتياً باللغتين العربية والإنجليزية تلقائياً لتسهيل المتابعة على كبار السن وذوي الهمم.",
        tip_text: "💡 نصيحة: قم بتشغيل شاشة العرض هذه على تابلت أو شاشة TV داخل محلك لتمكن عملائك من متابعة تقدم الطابور لحظياً وسماع جرس التنبيه.",
        no_calling_tickets_desc: "لا توجد أي تذاكر مستدعاة حالياً. سيقوم الموظف بمناداة التذكرة التالية فوراً.",
        waiting_clients_populate_desc: "سيظهر العملاء هنا فور حجز تذكرة انتظار جديدة."
      },
      tr: {
        loading_display: "Dijital sıra ekranı yükleniyor...",
        connecting_live: "Canlı sıra veritabanına güvenli bağlantı kurulurken lütfen bekleyin...",
        connection_error: "Bağlantı Hatası",
        shop_not_found: "Belirtilen mağaza bulunamadı.",
        back_to_home: "Ana Sayfaya Dön",
        all_waiting_paths: "Tüm Bekleme Sıraları",
        disable_tv: "TV Modunu Kapat",
        enable_tv: "TV Modunu Aç",
        tv_screen_active: "TV Ekranı Aktif",
        tv_mode: "TV Modu",
        enable_voice_alerts: "Sesli Uyarıları Etkinleştir 🔊",
        voice_on: "Ses Açık",
        stop_speaking_mute: "Konuşmayı durdur ve sesli duyuruları sessize al",
        stop_mute: "Durdur ve Sessiz",
        audio_settings: "Ses Ayarları",
        voice_announcements_setup: "Yapay Cihan Sesli Çağrı Ayarları",
        chime_alert: "Zil Sesi Uyarısı",
        play_subtle_chime: "Çağrı sırasında hafif bir zil sesi çal",
        ai_voice_calling: "Yapay Zeka Sesli Çağrı",
        speak_ticket_window: "Bilet numarası ve masayı sesli oku",
        callout_lang: "Çağrı Dili",
        both_ar_en: "Hem Arapça Hem İngilizce",
        ar_only: "Sadece Arapça",
        en_only: "Sadece İngilizce",
        speech_rate: "Konuşma Hızı",
        slow: "Yavaş",
        normal: "Normal",
        fast: "Hızlı",
        stop_current_speech: "Mevcut Konuşmayı Durdur ⏹️",
        exit_fullscreen: "Tam Ekrandan Çık",
        fullscreen: "Tam Ekran",
        back: "Geri",
        enter_fullscreen: "Tam Ekrana Geç",
        close: "Kapat",
        now_serving: "ŞU ANDA ÇAĞRILAN",
        currently_calling: "Şu Anda Çağrılan",
        new_call: "YENİ ÇAĞRI!",
        service: "Hizmet:",
        go_to_window: "Masaya Gidin:",
        service_desk: "Hizmet Masası",
        waiting_for_next_ticket: "Sıradaki Bilet Bekleniyor",
        waiting_to_call: "Çağrı Bekleniyor",
        tts_active: "SESLİ OKUMA AKTİF",
        next_in_queue: "SIRADAKİ MÜŞTERİ",
        waiting: "BEKLEYEN",
        waiting_lbl: "Bekliyor",
        no_upcoming: "Sırada bekleyen bilet yok",
        new_waiting_clients: "Yeni bekleyen müşteriler burada dinamik olarak görünecektir.",
        total_today: "BUGÜNKÜ TOPLAM",
        completed_today: "BUGÜN TAMAMLANAN",
        live_windows: "Canlı Hizmet Masası Durumu",
        window_num: "Masa {{number}}",
        online_status: "Aktif",
        busy_status: "Meşgul",
        break_status: "Molada",
        closed_status: "Kapalı",
        system_title: "Dork Dijital Sıra Yönetim Sistemi 🎟️",
        dedicated_monitor_desc: "Özel Monitör Modu: Bu ekranı sadece müşterilerinizin sıra durumunu izlemesi için tam ekrana geçirin.",
        dedicated_monitor_sub: "Bu mod, mağaza içinde profesyonel bir görünüm için tarayıcı çubuklarını ve diğer düğmeleri gizler.",
        tts_active_desc: "Sistem, yaşlı veya görme engelli müşterilerimizin takibini kolaylaştırmak amacıyla yeni çağrılan biletleri otomatik olarak Arapça ve İngilizce seslendirir.",
        tip_text: "💡 İpucu: Müşterilerinizin sıra durumunu canlı izlemesi ve çağrı seslerini duyabilmesi için bu ekranı mağazanızda bir tablet veya akıllı TV'de açın.",
        no_calling_tickets_desc: "Şu anda çağrılan bilet bulunmuyor. Görevli az sonra sıradaki müşteriyi çağıracaktır.",
        waiting_clients_populate_desc: "Yeni bir sıra bileti alındığında müşteriler burada görünecektir."
      },
      en: {
        loading_display: "Loading public display...",
        connecting_live: "Please wait while connecting to live queue...",
        connection_error: "Connection Error",
        shop_not_found: "Specified shop could not be found.",
        back_to_home: "Back to Home",
        all_waiting_paths: "All Waiting Paths",
        disable_tv: "Disable TV Mode",
        enable_tv: "Enable TV Mode",
        tv_screen_active: "TV Screen Active",
        tv_mode: "TV Mode",
        enable_voice_alerts: "Enable Voice Alerts 🔊",
        voice_on: "Voice On",
        stop_speaking_mute: "Stop speaking & mute voice announcements",
        stop_mute: "Stop & Mute",
        audio_settings: "Audio Settings",
        voice_announcements_setup: "Voice Announcements Setup",
        chime_alert: "Chime Alert (Beep)",
        play_subtle_chime: "Play subtle chime on call",
        ai_voice_calling: "AI Voice Calling",
        speak_ticket_window: "Speak ticket & window aloud",
        callout_lang: "Callout Language",
        both_ar_en: "Both Arabic & English",
        ar_only: "Arabic Only",
        en_only: "English Only",
        speech_rate: "Speech Rate",
        slow: "Slow",
        normal: "Normal",
        fast: "Fast",
        stop_current_speech: "Stop Current Speech ⏹️",
        exit_fullscreen: "Exit Fullscreen",
        fullscreen: "Fullscreen",
        back: "Back",
        enter_fullscreen: "Enter Fullscreen",
        close: "Dismiss",
        now_serving: "NOW SERVING",
        currently_calling: "Currently Calling",
        new_call: "NEW CALL!",
        service: "Service:",
        go_to_window: "Go to Window:",
        service_desk: "Service Desk",
        waiting_for_next_ticket: "Waiting for Next Ticket",
        waiting_to_call: "Waiting to Call Turn",
        tts_active: "TEXT-TO-SPEECH ACTIVE",
        next_in_queue: "NEXT IN QUEUE",
        waiting: "WAITING",
        waiting_lbl: "Waiting",
        no_upcoming: "No upcoming waiting tickets",
        new_waiting_clients: "New waiting clients will populate here dynamically.",
        total_today: "TOTAL TODAY",
        completed_today: "COMPLETED TODAY",
        live_windows: "Live Service Window Status",
        window_num: "Window {{number}}",
        online_status: "Online",
        busy_status: "Busy",
        break_status: "Break",
        closed_status: "Closed",
        system_title: "Dork Digital Queue System 🎟️",
        dedicated_monitor_desc: "Dedicated Monitor Mode: Go fullscreen to dedicate this monitor or TV exclusively for queue status.",
        dedicated_monitor_sub: "This hides browser bars and extra buttons for a clean, professional in-shop look.",
        tts_active_desc: "The system reads out new calling ticket numbers in both Arabic and English to support elder and visually impaired clients.",
        tip_text: "💡 Tip: Launch this public display on a tablet or wall-mounted TV in-store so clients can track their queue progress and hear turn alerts.",
        no_calling_tickets_desc: "No tickets are being called right now. The operator will summon the next queue ticket soon.",
        waiting_clients_populate_desc: "New waiting clients will populate here dynamically."
      }
    };
    return dicts[currentLang]?.[key] || dicts["en"]?.[key] || fallback;
  };

  const [shop, setShop] = useState<Shop | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [counterStatuses, setCounterStatuses] = useState<CounterStatus[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() => {
    return localStorage.getItem(`dork_display_filter_${shopSlug}`) || "all";
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  const selectedServiceIdRef = useRef(selectedServiceId);
  useEffect(() => {
    selectedServiceIdRef.current = selectedServiceId;
  }, [selectedServiceId]);

  const handleServiceChange = (id: string) => {
    setSelectedServiceId(id);
    localStorage.setItem(`dork_display_filter_${shopSlug}`, id);
  };
  
  // Display device settings
  const [deviceId] = useState(() => {
    let id = localStorage.getItem("dork_display_device_id");
    if (!id) {
      id = `display_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem("dork_display_device_id", id);
    }
    return id;
  });

  const [displayName, setDisplayName] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [audioPermission, setAudioPermission] = useState(false);
  const [showFullscreenBanner, setShowFullscreenBanner] = useState(true);

  // Advanced Voice Announcement Preferences (Custom Persisted States)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem(`dork_display_sound_enabled_${shopSlug}`) !== "false";
  });
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    return localStorage.getItem(`dork_display_voice_enabled_${shopSlug}`) !== "false";
  });
  const [voiceLanguage, setVoiceLanguage] = useState<string>(() => {
    return localStorage.getItem(`dork_display_voice_lang_${shopSlug}`) || "both";
  });
  const [voiceRate, setVoiceRate] = useState<number>(() => {
    const stored = localStorage.getItem(`dork_display_voice_rate_${shopSlug}`);
    return stored ? parseFloat(stored) : 0.85;
  });
  const [showAudioSettings, setShowAudioSettings] = useState(false);

  // TV Mode and visual flash states
  const [isTvMode, setIsTvMode] = useState<boolean>(() => {
    return localStorage.getItem(`dork_display_tv_mode_${shopSlug}`) === "true";
  });
  const [showCallFlash, setShowCallFlash] = useState(false);
  const flashTimerRef = useRef<any>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  // Sound triggering refs
  const lastCalledTicketIdRef = useRef<string | null>(null);
  const initialLoadRef = useRef(true);
  const lastRefreshRequestedAtRef = useRef<string | null>(null);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch shop details by slug
  useEffect(() => {
    if (!shopSlug) return;

    const shopsRef = collection(db, "shops");
    const q = query(shopsRef, where("slug", "==", shopSlug));

    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const shopDoc = snapshot.docs[0];
        setShop({ id: shopDoc.id, ...shopDoc.data() } as Shop);
        setError("");
      } else {
        setError(isRtl ? "المحل غير موجود." : "Shop not found.");
      }
      setLoading(false);
    }, (err) => {
      console.error("Error fetching shop:", err);
      setError(isRtl ? "فشل تحميل معلومات المحل." : "Failed to load shop details.");
      setLoading(false);
    });

    return () => unsub();
  }, [shopSlug, isRtl]);

  // Fetch active services
  useEffect(() => {
    if (!shop) return;

    const servicesRef = collection(db, "services");
    const q = query(servicesRef, where("shopId", "==", shop.id), where("isActive", "==", true));

    const unsub = onSnapshot(q, (snapshot) => {
      const list: Service[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Service);
      });
      setServices(list);
    }, (err) => {
      console.error("Error fetching services:", err);
    });

    return () => unsub();
  }, [shop]);

  // Keep display registered in Firestore and listen for remote refreshes
  useEffect(() => {
    if (!shop) return;

    // 1. Initial Registration and Periodic Heartbeat
    const registerDevice = async () => {
      try {
        const displayDocRef = doc(db, "displays", deviceId);
        const docSnap = await getDoc(displayDocRef);
        
        let existingName = `شاشة عرض - ${shop.name}`;
        if (docSnap.exists()) {
          existingName = docSnap.data().name || existingName;
        }
        setDisplayName(existingName);

        await setDoc(displayDocRef, {
          id: deviceId,
          shopId: shop.id,
          name: existingName,
          lastActive: new Date().toISOString(),
          createdAt: docSnap.exists() ? docSnap.data().createdAt || new Date().toISOString() : new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error("Failed to register display device:", err);
      }
    };

    registerDevice();
    const heartbeatInterval = setInterval(registerDevice, 20000); // 20s heartbeat

    // 2. Real-time Subscription for Remote Refresh and Renames
    const displayDocRef = doc(db, "displays", deviceId);
    const unsubDisplay = onSnapshot(displayDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.name && data.name !== displayName) {
          setDisplayName(data.name);
        }

        // Check remote refresh request
        if (data.refreshRequestedAt) {
          if (lastRefreshRequestedAtRef.current === null) {
            // Store initial timestamp without reloading
            lastRefreshRequestedAtRef.current = data.refreshRequestedAt;
          } else if (data.refreshRequestedAt !== lastRefreshRequestedAtRef.current) {
            // Timestamp updated! Trigger window reload
            console.log("Remote refresh triggered!");
            playChime();
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        }
      }
    });

    return () => {
      clearInterval(heartbeatInterval);
      unsubDisplay();
    };
  }, [shop, deviceId]);

  // Listen to Today's Tickets
  useEffect(() => {
    if (!shop) return;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const ticketsQuery = query(
      collection(db, "tickets"),
      where("shopId", "==", shop.id)
    );

    const unsubTickets = onSnapshot(ticketsQuery, (snapshot) => {
      const ticketsList: Ticket[] = [];
      snapshot.forEach((docSnap) => {
        const tVal = docSnap.data() as Ticket;
        if (tVal.createdAt >= startOfToday.toISOString()) {
          ticketsList.push(tVal);
        }
      });
      // Sort ascending by ticket number
      ticketsList.sort((a, b) => a.ticketNumber - b.ticketNumber);
      setTickets(ticketsList);

      // Identify currently calling ticket
      const currentCalling = ticketsList.find(t => t.status === "calling");

      if (currentCalling) {
        // Trigger sound/voice announcements when a new calling ticket is registered
        if (lastCalledTicketIdRef.current !== currentCalling.id) {
          if (!initialLoadRef.current) {
            // Check if this called ticket matches our current display filter
            const currentFilter = selectedServiceIdRef.current;
            if (currentFilter === "all" || currentCalling.serviceId === currentFilter) {
              // Trigger Visual Strobe Flash!
              if (flashTimerRef.current) {
                clearTimeout(flashTimerRef.current);
              }
              setShowCallFlash(true);
              flashTimerRef.current = setTimeout(() => {
                setShowCallFlash(false);
              }, 5000); // flash for 5 seconds

              // Play Audio and Voice Announcements if permitted
              if (audioPermission) {
                // 1. Play Chime
                if (soundEnabled) {
                  playChime();
                }

                // 2. Text-to-Speech Announcement
                if (voiceEnabled && "speechSynthesis" in window) {
                  setTimeout(() => {
                    // Cancel current speaking queues to avoid overlaps
                    window.speechSynthesis.cancel();

                    const arabicText = currentCalling.counterNumber
                      ? `الرجاء من صاحب التذكرة رقم ${currentCalling.ticketNumber}، التوجه إلى شباك رقم ${currentCalling.counterNumber} لخدمة ${currentCalling.serviceName}`
                      : `الرجاء من صاحب التذكرة رقم ${currentCalling.ticketNumber}، التوجه إلى كاونتر الخدمة لخدمة ${currentCalling.serviceName}`;

                    const englishText = currentCalling.counterNumber
                      ? `Ticket number ${currentCalling.ticketNumber}, please proceed to window number ${currentCalling.counterNumber} for ${currentCalling.serviceName}`
                      : `Ticket number ${currentCalling.ticketNumber}, please proceed to the service counter for ${currentCalling.serviceName}`;

                    if (voiceLanguage === "ar" || voiceLanguage === "both") {
                      const arabicUtterance = new SpeechSynthesisUtterance(arabicText);
                      arabicUtterance.lang = "ar-EG";
                      arabicUtterance.rate = voiceRate;

                      if (voiceLanguage === "both") {
                        const englishUtterance = new SpeechSynthesisUtterance(englishText);
                        englishUtterance.lang = "en-US";
                        englishUtterance.rate = voiceRate;

                        arabicUtterance.onend = () => {
                          setTimeout(() => {
                            if (window.speechSynthesis) {
                              window.speechSynthesis.speak(englishUtterance);
                            }
                          }, 500);
                        };
                      }
                      window.speechSynthesis.speak(arabicUtterance);
                    } else if (voiceLanguage === "en") {
                      const englishUtterance = new SpeechSynthesisUtterance(englishText);
                      englishUtterance.lang = "en-US";
                      englishUtterance.rate = voiceRate;
                      window.speechSynthesis.speak(englishUtterance);
                    }
                  }, 1200);
                }
              }
            }
          }
          lastCalledTicketIdRef.current = currentCalling.id;
        }
      } else {
        lastCalledTicketIdRef.current = null;
      }

      initialLoadRef.current = false;
    }, (error) => {
      console.error("Error listening to tickets:", error);
    });

    return () => unsubTickets();
  }, [shop, audioPermission, isRtl, soundEnabled, voiceEnabled, voiceLanguage, voiceRate]);

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
    });

    return () => unsubStatuses();
  }, [shop]);

  // Handle Enable Audio Request
  const handleEnableAudio = () => {
    setAudioPermission(true);
    playChime();
    
    // Quick speech check/activation
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(isRtl ? "تم تفعيل الصوت بنجاح" : "Sound alerts enabled successfully");
      utterance.lang = isRtl ? "ar-EG" : "en-US";
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleToggleSound = (val: boolean) => {
    setSoundEnabled(val);
    localStorage.setItem(`dork_display_sound_enabled_${shopSlug}`, String(val));
    if (val) {
      playChime();
    }
  };

  const handleToggleVoice = (val: boolean) => {
    setVoiceEnabled(val);
    localStorage.setItem(`dork_display_voice_enabled_${shopSlug}`, String(val));
  };

  const handleSetVoiceLanguage = (val: string) => {
    setVoiceLanguage(val);
    localStorage.setItem(`dork_display_voice_lang_${shopSlug}`, val);
  };

  const handleSetVoiceRate = (val: number) => {
    setVoiceRate(val);
    localStorage.setItem(`dork_display_voice_rate_${shopSlug}`, String(val));
  };

  // Toggle Fullscreen Mode
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error("Error enabling fullscreen:", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // Listen to external fullscreen changes (like Esc key)
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
        <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
        <h3 className="text-lg font-bold">{t_display("loading_display", "Loading public display...")}</h3>
        <p className="text-slate-400 text-xs mt-1">{t_display("connecting_live", "Please wait while connecting to live queue...")}</p>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
        <ArrowLeft className="w-12 h-12 text-rose-500 mb-4 cursor-pointer" onClick={onBackToHome} />
        <h3 className="text-lg font-bold text-rose-500">{t_display("connection_error", "Connection Error")}</h3>
        <p className="text-slate-400 text-sm mt-1">{error || t_display("shop_not_found", "Specified shop could not be found.")}</p>
        <button
          onClick={onBackToHome}
          className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all"
        >
          {t_display("back_to_home", "Back to Home")}
        </button>
      </div>
    );
  }

  // Filter queue states
  const filteredTickets = tickets.filter(t => selectedServiceId === "all" || t.serviceId === selectedServiceId);
  const currentCalling = filteredTickets.find(t => t.status === "calling");
  const upcomingTickets = filteredTickets.filter(t => t.status === "waiting").slice(0, 4);

  // Formatting helper for clock
  const formattedTime = currentTime.toLocaleTimeString(isRtl ? "ar-EG" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  const formattedDate = currentTime.toLocaleDateString(isRtl ? "ar-EG" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  return (
    <div className={`min-h-screen bg-slate-950 text-white flex flex-col select-none overflow-hidden ${isRtl ? "font-sans dir-rtl text-right" : "font-sans dir-ltr text-left"}`}>
      
      {/* Top Header Panel */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-lg shrink-0">
        <div className="flex items-center gap-4">
          {shop.logoUrl ? (
            <img 
              src={shop.logoUrl} 
              alt={shop.name} 
              className="w-12 h-12 rounded-2xl object-cover shadow-lg shadow-indigo-950 border border-slate-800"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div 
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-950"
              style={{ backgroundColor: shop.ticketColor || "#4f46e5" }}
            >
              {shop.logoText ? shop.logoText.charAt(0).toUpperCase() : shop.name.charAt(0)}
            </div>
          )}
          <div className="flex flex-col">
            <h1 className="text-lg sm:text-xl font-black leading-tight tracking-tight flex items-center gap-2 flex-wrap">
              {shop.logoText ? (
                <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-400 bg-clip-text text-transparent font-black tracking-wider uppercase font-mono">
                  {shop.logoText}
                </span>
              ) : (
                <span>{shop.name}</span>
              )}
              {shop.logoText && (
                <span className="text-[10px] text-slate-400 font-extrabold bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">
                  {shop.name}
                </span>
              )}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-indigo-400 font-bold">{displayName}</span>
              <span className="text-slate-600">|</span>
              
              {/* Waiting Path Filter Dropdown */}
              <select
                value={selectedServiceId}
                onChange={(e) => handleServiceChange(e.target.value)}
                className="bg-slate-800 hover:bg-slate-700 text-[11px] font-extrabold text-slate-200 hover:text-white px-2.5 py-1 rounded-lg border border-slate-700/80 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
              >
                <option value="all">{t_display("all_waiting_paths", "All Waiting Paths")}</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Dynamic Live Clock */}
        <div className="hidden md:flex flex-col items-center justify-center text-center">
          <span className="text-xl font-black tracking-widest text-indigo-300 font-mono">{formattedTime}</span>
          <span className="text-[10px] text-slate-400 font-semibold mt-0.5">{formattedDate}</span>
        </div>

        {/* Display Actions/Controls */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher />

          {/* TV Mode Toggle Button */}
          <button
            onClick={() => {
              const newVal = !isTvMode;
              setIsTvMode(newVal);
              localStorage.setItem(`dork_display_tv_mode_${shopSlug}`, String(newVal));
            }}
            className={`p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-black cursor-pointer ${
              isTvMode 
                ? "bg-amber-500 text-slate-950 hover:bg-amber-600 shadow-lg shadow-amber-500/20" 
                : "bg-slate-800 hover:bg-slate-700 text-slate-300"
            }`}
            title={isTvMode ? t_display("disable_tv", "Disable TV Mode") : t_display("enable_tv", "Enable TV Mode")}
          >
            <Tv className="w-4 h-4 text-current" />
            <span className="hidden sm:inline">{isTvMode ? t_display("tv_screen_active", "TV Screen Active") : t_display("tv_mode", "TV Mode")}</span>
          </button>

          {/* Audio Enable Request Overlay Banner */}
          {!audioPermission ? (
            <button
              onClick={handleEnableAudio}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all animate-bounce cursor-pointer shadow-md shadow-amber-500/20"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>{t_display("enable_voice_alerts", "Enable Voice Alerts 🔊")}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="bg-indigo-950/60 border border-indigo-800/80 px-3 py-2 rounded-xl flex items-center gap-1.5 text-indigo-400 text-xs font-black">
                <Volume2 className="w-4 h-4 animate-pulse" />
                <span className="hidden sm:inline">{t_display("voice_on", "Voice On")}</span>
              </div>

              {voiceEnabled && (
                <button
                  onClick={() => {
                    if ("speechSynthesis" in window) {
                      window.speechSynthesis.cancel();
                    }
                    setVoiceEnabled(false);
                    localStorage.setItem(`dork_display_voice_enabled_${shopSlug}`, "false");
                  }}
                  className="bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 px-3 py-2 rounded-xl flex items-center gap-1.5 text-rose-400 hover:text-rose-300 text-xs font-black transition-all cursor-pointer shadow-md shadow-rose-950/20"
                  title={t_display("stop_speaking_mute", "Stop speaking & mute voice announcements")}
                >
                  <VolumeX className="w-4 h-4 text-rose-500 animate-pulse" />
                  <span>{t_display("stop_mute", "Stop & Mute")}</span>
                </button>
              )}

              {/* Audio Settings Toggle Button */}
              <div className="relative">
                <button
                  onClick={() => setShowAudioSettings(!showAudioSettings)}
                  className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center border ${
                    showAudioSettings 
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20" 
                      : "bg-slate-800 hover:bg-slate-700 border-slate-700/80 text-slate-300"
                  }`}
                  title={t_display("audio_settings", "Audio Settings")}
                >
                  <Sliders className="w-4 h-4" />
                </button>

                {/* Float popover menu */}
                {showAudioSettings && (
                  <div className="absolute top-full mt-3 end-0 w-72 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl z-50 text-xs text-slate-300 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                      <span className="font-black text-white flex items-center gap-1.5">
                        <Settings className="w-3.5 h-3.5 text-indigo-400" />
                        {t_display("voice_announcements_setup", "Voice Announcements Setup")}
                      </span>
                      <button 
                        onClick={() => setShowAudioSettings(false)}
                        className="text-slate-500 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Option 1: Play chime beep */}
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-extrabold text-white">{t_display("chime_alert", "Chime Alert (Beep)")}</span>
                        <span className="text-[10px] text-slate-500">{t_display("play_subtle_chime", "Play subtle chime on call")}</span>
                      </div>
                      <input 
                        type="checkbox"
                        checked={soundEnabled}
                        onChange={(e) => handleToggleSound(e.target.checked)}
                        className="accent-indigo-500 cursor-pointer"
                      />
                    </div>

                    {/* Option 2: TTS speech toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-extrabold text-white">{t_display("ai_voice_calling", "AI Voice Calling")}</span>
                        <span className="text-[10px] text-slate-500">{t_display("speak_ticket_window", "Speak ticket & window aloud")}</span>
                      </div>
                      <input 
                        type="checkbox"
                        checked={voiceEnabled}
                        onChange={(e) => handleToggleVoice(e.target.checked)}
                        className="accent-indigo-500 cursor-pointer"
                      />
                    </div>

                    {/* Option 3: TTS Lang selection */}
                    {voiceEnabled && (
                      <div className="space-y-1.5 pt-1">
                        <label className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                          {t_display("callout_lang", "Callout Language")}
                        </label>
                        <select
                          value={voiceLanguage}
                          onChange={(e) => handleSetVoiceLanguage(e.target.value)}
                          className="w-full bg-slate-800 text-slate-200 border border-slate-700/80 px-2.5 py-1.5 rounded-xl text-xs focus:outline-none"
                        >
                          <option value="both">{t_display("both_ar_en", "Both Arabic & English")}</option>
                          <option value="ar">{t_display("ar_only", "Arabic Only")}</option>
                          <option value="en">{t_display("en_only", "English Only")}</option>
                        </select>
                      </div>
                    )}

                    {/* Option 4: Speed adjustment rate */}
                    {voiceEnabled && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span className="font-extrabold uppercase tracking-wider">{t_display("speech_rate", "Speech Rate")}</span>
                          <span className="font-mono text-indigo-400 font-bold">{voiceRate}x</span>
                        </div>
                        <input 
                          type="range"
                          min="0.5"
                          max="1.5"
                          step="0.05"
                          value={voiceRate}
                          onChange={(e) => handleSetVoiceRate(parseFloat(e.target.value))}
                          className="w-full accent-indigo-500 cursor-pointer h-1 bg-slate-800 rounded-lg appearance-none"
                        />
                        <div className="flex justify-between text-[9px] text-slate-500">
                          <span>{t_display("slow", "Slow")}</span>
                          <span>{t_display("normal", "Normal")}</span>
                          <span>{t_display("fast", "Fast")}</span>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        if ("speechSynthesis" in window) {
                          window.speechSynthesis.cancel();
                        }
                      }}
                      className="w-full text-center text-[10px] bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 font-extrabold py-2.5 rounded-xl border border-rose-900/40 transition-colors cursor-pointer"
                    >
                      {t_display("stop_current_speech", "Stop Current Speech ⏹️")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={handleToggleFullscreen}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer"
            title={isFullscreen ? t_display("exit_fullscreen", "Exit Fullscreen") : t_display("fullscreen", "Fullscreen")}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Back to dashboard / home button */}
          <button
            onClick={onBackToHome}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer"
            title={t_display("back", "Back")}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Fullscreen Helper Banner */}
      {!isFullscreen && showFullscreenBanner && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-indigo-950/90 border-b border-indigo-500/30 px-6 py-3 flex items-center justify-between gap-4 text-slate-200 z-10 relative shrink-0"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 shrink-0">
              <Tv className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-white leading-snug">
                {t_display("dedicated_monitor_desc", "Dedicated Monitor Mode: Go fullscreen to dedicate this monitor or TV exclusively for queue status.")}
              </p>
              <p className="text-[10px] text-indigo-300 font-medium mt-0.5">
                {t_display("dedicated_monitor_sub", "This hides browser bars and extra buttons for a clean, professional in-shop look.")}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleToggleFullscreen}
              className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-750 text-white font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-indigo-500/10 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>{t_display("enter_fullscreen", "Enter Fullscreen")}</span>
            </button>
            
            <button
              onClick={() => setShowFullscreenBanner(false)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
              title={t_display("close", "Dismiss")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Main Display Grid Content */}
      {isTvMode ? (
        /* --- TV DASHBOARD VIEW (ULTRA HIGH-CONTRAST & GIANT FONTS) --- */
        <main className={`flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 p-8 min-h-0 overflow-hidden relative ${showCallFlash ? "ring-[16px] ring-amber-500 animate-pulse" : ""}`}>
          
          {/* Visual Flash overlay */}
          <AnimatePresence>
            {showCallFlash && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.4, 0.1, 0.4, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, repeat: 2 }}
                className="absolute inset-0 bg-amber-500/15 pointer-events-none z-50 border-[12px] border-amber-500 rounded-[40px]"
              />
            )}
          </AnimatePresence>

          {/* Left Block: NOW SERVING (GIANT DISPATCH CARD) - occupies 7 cols */}
          <section className={`lg:col-span-7 flex flex-col justify-between p-10 rounded-[40px] border-4 transition-all duration-500 shadow-2xl relative overflow-hidden ${
            showCallFlash 
              ? "bg-slate-900 border-amber-400 scale-[1.01] shadow-amber-500/20" 
              : "bg-slate-900 border-slate-800 shadow-black"
          }`}>
            <div className="flex items-center justify-between border-b-4 border-slate-800 pb-6 shrink-0">
              <span className="text-xl sm:text-2xl font-black text-amber-400 uppercase tracking-widest flex items-center gap-3">
                <Bell className="w-8 h-8 text-amber-400 animate-bounce" />
                <span className="text-2xl sm:text-3xl">{t_display("now_serving", "NOW SERVING")}</span>
              </span>
              
              {showCallFlash && (
                <span className="bg-amber-400 text-slate-950 font-black text-sm px-4 py-1.5 rounded-full uppercase animate-pulse">
                  {t_display("new_call", "NEW CALL!")}
                </span>
              )}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center my-8">
              {currentCalling ? (
                <div className="space-y-8 w-full">
                  {/* Giant Ticket Number */}
                  <div 
                    className="inline-block text-[150px] sm:text-[190px] md:text-[230px] font-black leading-none font-mono tracking-tighter px-16 py-10 rounded-[50px] border-4 select-none animate-bounce"
                    style={{ 
                      color: "#ffffff",
                      borderColor: shop.ticketColor || "#eab308",
                      backgroundColor: "rgba(0, 0, 0, 0.6)",
                      textShadow: "0 0 80px rgba(255, 255, 255, 0.4), 0 0 120px rgba(234, 179, 8, 0.4)"
                    }}
                  >
                    #{currentCalling.ticketNumber}
                  </div>

                  {/* Customer and Desk/Window details */}
                  <div className="space-y-4">
                    <h2 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-wide">
                      {currentCalling.customerName}
                    </h2>
                    
                    <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
                      <span className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-lg sm:text-xl font-black uppercase bg-slate-950 border border-slate-800 text-slate-300">
                        {t_display("service", "Service:")} {currentCalling.serviceName}
                      </span>

                      {/* Display Window */}
                      <span className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-lg sm:text-2xl font-black uppercase bg-amber-400 border border-amber-300 text-slate-950 shadow-lg shadow-amber-500/10">
                        {t_display("go_to_window", "Go to Window:")} {currentCalling.counterNumber || t_display("service_desk", "Service Desk")}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 max-w-lg">
                  <div className="w-28 h-28 bg-slate-850 border-4 border-slate-800 rounded-[40px] flex items-center justify-center text-slate-600 mx-auto">
                    <Tv className="w-14 h-14" />
                  </div>
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-400">{t_display("waiting_for_next_ticket", "Waiting for Next Ticket")}</h3>
                    <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
                      {t_display("no_calling_tickets_desc", "No tickets are being called right now. The operator will summon the next queue ticket soon.")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-950/80 border-2 border-slate-800 p-5 rounded-[25px] flex items-center gap-4 shrink-0 text-start">
              <Sparkles className="w-8 h-8 text-amber-400 shrink-0" />
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider">{t_display("tts_active", "TEXT-TO-SPEECH ACTIVE")}</h4>
                <p className="text-[11px] text-slate-400 font-bold mt-1 leading-normal">
                  {t_display("tts_active_desc", "The system reads out new calling ticket numbers in both Arabic and English to support elder and visually impaired clients.")}
                </p>
              </div>
            </div>
          </section>

          {/* Right Block: UPCOMING TICKETS (NEXT IN QUEUE) - occupies 5 cols */}
          <section className="lg:col-span-5 bg-slate-900 border-4 border-slate-800 rounded-[40px] p-8 flex flex-col justify-between shadow-2xl overflow-hidden">
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between border-b-4 border-slate-800 pb-5 mb-5 shrink-0">
                <h3 className="text-xl sm:text-2xl font-black text-indigo-400 uppercase tracking-widest">
                  {t_display("next_in_queue", "NEXT IN QUEUE")}
                </h3>
                <span className="bg-slate-950 text-indigo-400 border border-indigo-900/60 font-black text-sm px-4 py-1.5 rounded-full">
                  {filteredTickets.filter(t => t.status === "waiting").length} {t_display("waiting", "WAITING")}
                </span>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto pe-1 min-h-0">
                {upcomingTickets.length > 0 ? (
                  <AnimatePresence initial={false} mode="popLayout">
                    {upcomingTickets.map((t, idx) => (
                      <motion.div 
                        key={t.id} 
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.25 }}
                        className="bg-slate-950 border-2 border-slate-800 rounded-3xl p-5 flex items-center justify-between gap-4 transition-all duration-300 hover:border-slate-700"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-black text-slate-500 w-6 text-center">
                            {idx + 1}
                          </span>
                          
                          {/* Giant Badge */}
                          <div 
                            className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl font-mono border-2"
                            style={{ 
                              backgroundColor: "rgba(255, 255, 255, 0.03)",
                              color: shop.ticketColor || "#ffffff",
                              borderColor: shop.ticketColor || "#4f46e5"
                            }}
                          >
                            #{t.ticketNumber}
                          </div>
                          <div>
                            <h4 className="text-lg font-black text-white">{t.customerName}</h4>
                            <span className="text-xs text-slate-400 font-extrabold block mt-1 uppercase tracking-wider">
                              {t.serviceName}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs text-indigo-400 font-black bg-indigo-950/80 border-2 border-indigo-900 px-3 py-1.5 rounded-xl uppercase">
                            {t_display("waiting_lbl", "WAIT")}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center py-16 text-slate-500">
                    <p className="text-base font-bold">{t_display("no_upcoming", "No upcoming waiting tickets")}</p>
                    <p className="text-xs text-slate-600 max-w-xs mx-auto mt-2 leading-relaxed">
                      {t_display("waiting_clients_populate_desc", "New waiting clients will populate here dynamically.")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* TV Mode Stats */}
            <div className="border-t-4 border-slate-800/80 pt-5 mt-5 grid grid-cols-2 gap-4 shrink-0">
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-center">
                <span className="text-xs text-slate-500 font-black block uppercase tracking-wider">{t_display("total_today", "TOTAL TODAY")}</span>
                <span className="text-xl font-black text-slate-200 mt-1 block font-mono">{filteredTickets.length}</span>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-center">
                <span className="text-xs text-slate-500 font-black block uppercase tracking-wider">{t_display("completed_today", "COMPLETED TODAY")}</span>
                <span className="text-xl font-black text-emerald-500 mt-1 block font-mono">
                  {filteredTickets.filter(t => t.status === "completed").length}
                </span>
              </div>
            </div>

            {/* TV Mode Counter Status Grid */}
            {counterStatuses.length > 0 && (
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl shrink-0 space-y-2.5 mt-4">
                <span className="text-[10px] text-slate-500 font-extrabold block uppercase tracking-wider text-start">
                  {t_display("live_windows", "Live Service Window Status")}
                </span>
                <div className="grid grid-cols-2 gap-3">
                  {counterStatuses.map((counter) => (
                    <div 
                      key={counter.id} 
                      className="bg-slate-900 border border-slate-800/60 p-2.5 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          counter.status === "online" ? "bg-emerald-500 animate-pulse" :
                          counter.status === "busy" ? "bg-amber-500 animate-pulse" :
                          counter.status === "break" ? "bg-orange-500 animate-pulse" : "bg-slate-500"
                        }`} />
                        <span className="font-extrabold text-slate-300 truncate">
                          {t_display("window_num", "Window {{number}}").replace("{{number}}", String(counter.counterNumber))}
                        </span>
                      </div>
                      <span className={`text-[10px] font-black uppercase ${
                        counter.status === "online" ? "text-emerald-400" :
                        counter.status === "busy" ? "text-amber-400" :
                        counter.status === "break" ? "text-orange-400" : "text-slate-400"
                      }`}>
                        {counter.status === "online" ? t_display("online_status", "Online") :
                         counter.status === "busy" ? t_display("busy_status", "Busy") :
                         counter.status === "break" ? t_display("break_status", "Break") : t_display("closed_status", "Closed")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

        </main>
      ) : (
        /* --- STANDARD PUBLIC DISPLAY VIEW --- */
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 min-h-0 overflow-hidden">
          
          {/* Left/Main Block: NOW CALLING (GIANT DISPLAY) */}
          <section className="lg:col-span-8 bg-slate-900/60 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            {/* Subtle Background Glow Accent matching brand color */}
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full blur-[120px] opacity-10 pointer-events-none transition-all duration-500" 
              style={{ backgroundColor: shop.ticketColor || "#4f46e5" }}
            />

            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 shrink-0">
              <span className="text-xs sm:text-sm font-black text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400 animate-swing" />
                <span>{t_display("currently_calling", "Currently Calling")}</span>
              </span>
              <span className="text-xs text-slate-500 font-bold font-mono">
                {currentTime.toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : (currentLang === 'tr' ? 'tr-TR' : 'en-US'), { month: "short", day: "numeric" })}
              </span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center my-6">
              {currentCalling ? (
                <div className="space-y-6 w-full max-w-2xl">
                  {/* Giant Display of calling Ticket Number */}
                  <div 
                    className="inline-block text-[110px] sm:text-[140px] md:text-[170px] font-black leading-none font-mono tracking-tighter px-12 py-8 rounded-[40px] border border-white/5 shadow-2xl select-none animate-pulse-slow"
                    style={{ 
                      color: shop.ticketColor || "#ffffff",
                      backgroundColor: shop.ticketColor ? `${shop.ticketColor}10` : "rgba(255, 255, 255, 0.02)",
                      textShadow: shop.ticketColor ? `0 0 50px ${shop.ticketColor}40` : "0 0 50px rgba(255, 255, 255, 0.15)"
                    }}
                  >
                    #{currentCalling.ticketNumber}
                  </div>

                  {/* Service and customer name details */}
                  <div className="space-y-2">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-100 uppercase tracking-wide">
                      {currentCalling.customerName}
                    </h2>
                    
                    <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
                      <p 
                        className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded-full text-xs sm:text-sm font-black uppercase border"
                        style={{ 
                          borderColor: shop.ticketColor ? `${shop.ticketColor}30` : "rgba(255, 255, 255, 0.1)",
                          backgroundColor: shop.ticketColor ? `${shop.ticketColor}05` : "rgba(255, 255, 255, 0.01)",
                          color: shop.ticketColor || "#a5b4fc"
                        }}
                      >
                        <span>{t_display("service", "Service:")}</span>
                        <span>{currentCalling.serviceName}</span>
                      </p>

                      {/* Display Window */}
                      <p className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded-full text-xs sm:text-sm font-black uppercase border border-amber-500/30 bg-amber-500/5 text-amber-400">
                        <span>{t_display("go_to_window", "Go to Window:")}</span>
                        <span>{currentCalling.counterNumber || t_display("service_desk", "Service Desk")}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-w-md">
                  <div className="w-20 h-20 bg-slate-850 border border-slate-800 rounded-3xl flex items-center justify-center text-slate-600 mx-auto">
                    <Tv className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-400">{t_display("waiting_to_call", "Waiting to Call Turn")}</h3>
                    <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto leading-relaxed">
                      {t_display("no_calling_tickets_desc", "No tickets are being called right now. The operator will summon the next queue ticket soon.")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Live Counter Status Grid */}
            {counterStatuses.length > 0 && (
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 shrink-0 space-y-2 mt-2">
                <span className="text-[10px] text-slate-500 font-extrabold block uppercase tracking-wider">
                  {t_display("live_windows", "Live Service Window Status")}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {counterStatuses.map((counter) => (
                    <div 
                      key={counter.id} 
                      className="bg-slate-900/60 border border-slate-800/60 p-2.5 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          counter.status === "online" ? "bg-emerald-500 animate-pulse" :
                          counter.status === "busy" ? "bg-amber-500 animate-pulse" :
                          counter.status === "break" ? "bg-orange-500 animate-pulse" : "bg-slate-500"
                        }`} />
                        <span className="font-extrabold text-slate-300 truncate">
                          {t_display("window_num", "Window {{number}}").replace("{{number}}", String(counter.counterNumber))}
                        </span>
                      </div>
                      <span className={`text-[10px] font-black uppercase ${
                        counter.status === "online" ? "text-emerald-400" :
                        counter.status === "busy" ? "text-amber-400" :
                        counter.status === "break" ? "text-orange-400" : "text-slate-400"
                      }`}>
                        {counter.status === "online" ? t_display("online_status", "Online") :
                         counter.status === "busy" ? t_display("busy_status", "Busy") :
                         counter.status === "break" ? t_display("break_status", "Break") : t_display("closed_status", "Closed")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sound Alert Helper Overlay for Public Screen deployment */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3 shrink-0">
              <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
              <p className="text-[10px] sm:text-xs text-slate-400 font-bold leading-normal text-start">
                {t_display("tip_text", "💡 Tip: Launch this public display on a tablet or wall-mounted TV in-store so clients can track their queue progress and hear turn alerts.")}
              </p>
            </div>
          </section>

          {/* Right Block: UPCOMING TICKETS (NEXT IN QUEUE) */}
          <section className="lg:col-span-4 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-2xl overflow-hidden">
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 mb-4 shrink-0">
                <h3 className="text-xs sm:text-sm font-black text-indigo-400 uppercase tracking-wider">
                  {t_display("next_in_queue", "Next in Queue")}
                </h3>
                <span className="bg-indigo-950 text-indigo-400 font-black text-xs px-2.5 py-1 rounded-lg">
                  {filteredTickets.filter(t => t.status === "waiting").length} {t_display("waiting", "Waiting")}
                </span>
              </div>

              <div className="flex-1 space-y-3.5 overflow-y-auto pe-1 min-h-0">
                {upcomingTickets.length > 0 ? (
                  <AnimatePresence initial={false} mode="popLayout">
                    {upcomingTickets.map((t, idx) => (
                      <motion.div 
                        key={t.id} 
                        layout
                        initial={{ opacity: 0, y: 15, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -15, scale: 0.95 }}
                        transition={{ 
                          type: "spring", 
                          stiffness: 300, 
                          damping: 26,
                          mass: 0.8
                        }}
                        className="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 flex items-center justify-between gap-3 transition-colors duration-200"
                      >
                        <div className="flex items-center gap-3">
                          {/* Place index rank */}
                          <span className="text-[11px] font-black text-slate-500 w-4 text-center">
                            {idx + 1}
                          </span>
                          {/* Ticket Number Badge */}
                          <div 
                            className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-base font-mono shadow-md"
                            style={{ 
                              backgroundColor: shop.ticketColor ? `${shop.ticketColor}15` : "rgba(255, 255, 255, 0.03)",
                              color: shop.ticketColor || "#ffffff",
                              border: `1px solid ${shop.ticketColor ? `${shop.ticketColor}30` : "rgba(255, 255, 255, 0.05)"}`
                            }}
                          >
                            #{t.ticketNumber}
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-100">{t.customerName}</h4>
                            <span className="text-[10px] text-slate-500 font-bold block mt-0.5 uppercase tracking-wide">
                              {t.serviceName}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-indigo-400 font-bold bg-indigo-950/55 border border-indigo-900/50 rounded-lg px-2 py-1 uppercase">
                            {t_display("waiting_lbl", "Waiting")}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-500">
                    <p className="text-xs font-bold">{t_display("no_upcoming", "No upcoming waiting tickets")}</p>
                    <p className="text-[10px] text-slate-600 max-w-[180px] mx-auto mt-1">
                      {t_display("waiting_clients_populate_desc", "New waiting clients will populate here dynamically.")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom quick statistics bar inside shop */}
            <div className="border-t border-slate-800/80 pt-4 mt-4 grid grid-cols-2 gap-3 shrink-0">
              <div className="bg-slate-900 border border-slate-800/60 p-3 rounded-xl text-center">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">{t_display("total_today", "Total Today")}</span>
                <span className="text-base font-black text-slate-200 mt-0.5 block font-mono">{filteredTickets.length}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800/60 p-3 rounded-xl text-center">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">{t_display("completed_today", "Completed Today")}</span>
                <span className="text-base font-black text-emerald-500 mt-0.5 block font-mono">
                  {filteredTickets.filter(t => t.status === "completed").length}
                </span>
              </div>
            </div>
          </section>

        </main>
      )}

      {/* Subtle Bottom Footer Info */}
      <footer className="bg-slate-950/80 border-t border-slate-900 px-6 py-2 flex justify-between items-center text-[10px] text-slate-600 shrink-0">
        <span>{t_display("system_title", "Dork Digital Queue System 🎟️")}</span>
        <span className="font-mono">ID: {deviceId}</span>
      </footer>

    </div>
  );
}
