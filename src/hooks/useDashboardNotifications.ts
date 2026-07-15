import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { playNewTicketSound, playStatusUpdateSound } from "../lib/audio";

interface UseDashboardNotificationsProps {
  shopId: string;
  shopLogoUrl: string | undefined;
  isRtl: boolean;
}

export function useDashboardNotifications({ shopId, shopLogoUrl, isRtl }: UseDashboardNotificationsProps) {
  const { t } = useTranslation();

  // Audio Notifications configuration
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("vendor_sound_enabled");
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem("vendor_sound_enabled", String(soundEnabled));
  }, [soundEnabled]);

  // Voice Calling configurations
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
      window.speechSynthesis.cancel();
      
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

  // Browser Notifications configurations
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("vendor_browser_notifications");
    return saved === "true";
  });

  const [maxWaitTimeAlertMinutes, setMaxWaitTimeAlertMinutes] = useState<number>(() => {
    const saved = localStorage.getItem("vendor_max_wait_time");
    return saved !== null ? Number(saved) : 15;
  });

  useEffect(() => {
    localStorage.setItem("vendor_browser_notifications", String(browserNotificationsEnabled));
  }, [browserNotificationsEnabled]);

  useEffect(() => {
    localStorage.setItem("vendor_max_wait_time", String(maxWaitTimeAlertMinutes));
  }, [maxWaitTimeAlertMinutes]);

  const sendBrowserNotification = (title: string, body: string) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      try {
        new Notification(title, {
          body: body,
          icon: shopLogoUrl || "/logo.png",
        });
      } catch (err: any) {
        console.warn("Could not instantiate Notification directly on this device:", err.message);
      }
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

  return {
    soundEnabled,
    setSoundEnabled,
    voiceAnnouncementsEnabled,
    setVoiceAnnouncementsEnabled,
    voiceLanguage,
    setVoiceLanguage,
    voiceRate,
    setVoiceRate,
    announceCallingTicket,
    browserNotificationsEnabled,
    setBrowserNotificationsEnabled,
    maxWaitTimeAlertMinutes,
    setMaxWaitTimeAlertMinutes,
    sendBrowserNotification,
    handleToggleBrowserNotifications,
    handleSendTestNotification
  };
}
