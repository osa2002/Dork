import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, XCircle, ArrowUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useUiStore } from "../store";

// Shared Utilities
import { isShopClosed } from "../lib/shopUtils";

// Custom hooks
import { useCustomerShop } from "../hooks/useCustomerShop";
import { useCustomerNotifications } from "../hooks/useCustomerNotifications";
import { useCustomerTicket } from "../hooks/useCustomerTicket";
import { useCustomerFeedback } from "../hooks/useCustomerFeedback";

// Modular UI Sub-components
import { CustomerHeader } from "./customer/CustomerHeader";
import { CustomerPausedScreen } from "./customer/CustomerPausedScreen";
import { CustomerClosedScreen } from "./customer/CustomerClosedScreen";
import { CustomerJoinForm } from "./customer/CustomerJoinForm";
import { CustomerShareModal } from "./customer/CustomerShareModal";
import { CustomerPwaModal } from "./customer/CustomerPwaModal";
import { CustomerTicketBoard } from "./customer/CustomerTicketBoard";
import { CustomerInAppAlertModal } from "./customer/CustomerInAppAlertModal";
import { CustomerErrorAlertModal } from "./customer/CustomerErrorAlertModal";
import { LimitAlertDialog } from "./LimitAlertDialog";

interface CustomerPortalProps {
  shopSlug: string;
  onBackToHome: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
}

export default function CustomerPortal({ 
  shopSlug, 
  onBackToHome, 
  isDarkMode: _propIsDarkMode, 
  setIsDarkMode: _propSetIsDarkMode 
}: CustomerPortalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  const {
    isDarkMode,
    setIsDarkMode,
    copied,
    setCopied,
    showShareModal,
    setShowShareModal,
    showPwaModal,
    setShowPwaModal,
    deferredPrompt,
    setDeferredPrompt,
    showInstallBanner,
    setShowInstallBanner,
    isStandalone,
    setIsStandalone
  } = useUiStore();

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

  // 1. Resolve Shop details & Services
  const {
    shop,
    services,
    counterStatuses,
    loadingShop,
    selectedServiceId,
    setSelectedServiceId,
    historicalAvgDuration
  } = useCustomerShop(shopSlug);

  // 2. Browser Notifications state & sound settings
  const {
    pushPermission,
    hasShownApproachingPush,
    setHasShownApproachingPush,
    hasShownOneInFrontFcm,
    setHasShownOneInFrontFcm,
    fcmToken,
    inAppAlert,
    setInAppAlert,
    openTroubleshootBrand,
    setOpenTroubleshootBrand,
    showDiagnosticsPanel,
    setShowDiagnosticsPanel,
    soundEnabled,
    soundEnabledRef,
    handleToggleSound,
    handleRequestPushPermission,
    handleSendTestNotification,
  } = useCustomerNotifications(null, shop, isRtl);

  // 3. Ticket Lifecycle State & Sync Engine
  const {
    myTicket,
    setMyTicket,
    todayTickets,
    joining,
    showCancelConfirm,
    setShowCancelConfirm,
    showLimitModal,
    setShowLimitModal,
    errorMessage,
    setErrorMessage,
    showAlert,
    setShowAlert,
    isOnline,
    aiEstimateMessage,
    aiEstimateLoading,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    customerEmail,
    setCustomerEmail,
    emailNotify,
    setEmailNotify,
    smsNotify,
    setSmsNotify,
    whatsappNotify,
    setWhatsappNotify,
    whatsappPhone,
    setWhatsappPhone,
    isScheduled,
    setIsScheduled,
    scheduledDate,
    setScheduledDate,
    scheduledTime,
    setScheduledTime,
    peopleInFront,
    estimatedWaitMinutes,
    progressPercent,
    calculatedAvgServiceTime,
    activeCountersCount,
    handleJoinQueue,
    handleLeaveQueue,
    unsubscribeFromTicket
  } = useCustomerTicket({
    shop,
    services,
    selectedServiceId,
    historicalAvgDuration,
    soundEnabledRef,
    fcmToken,
    isRtl,
    setInAppAlert,
    hasShownApproachingPush,
    setHasShownApproachingPush,
    hasShownOneInFrontFcm,
    setHasShownOneInFrontFcm
  });

  // 4. Rating & Review states
  const {
    ratingSpeed,
    setRatingSpeed,
    ratingSpeedHover,
    setRatingSpeedHover,
    ratingQuality,
    setRatingQuality,
    ratingQualityHover,
    setRatingQualityHover,
    showFeedbackForm,
    setShowFeedbackForm,
    ratingComment,
    setRatingComment,
    submittingRating,
    ratingSuccess,
    handleSubmitRating
  } = useCustomerFeedback(myTicket, isRtl);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
      console.log("PWA Installed successfully!");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone) {
      setIsStandalone(true);
      setShowInstallBanner(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User choice outcome: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  // Back to Top button
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

  const getWhatsAppUrl = () => {
    if (!myTicket || !shop) return "";
    const text = isRtl
      ? `مرحباً! لقد انضممت لقائمة الانتظار لدى *${shop.name}*.\n🏷️ رقم تذكرتك: *${myTicket.ticketNumber}*\n🕒 وقت الانتظار التقريبي: *${estimatedWaitMinutes} دقيقة*\n🔗 لتتبع دورك مباشرة:\n${getDirectTicketUrl()}`
      : `Hello! I have joined the queue at *${shop.name}*.\n🏷️ My Ticket Number: *${myTicket.ticketNumber}*\n🕒 Approx Wait Time: *${estimatedWaitMinutes} mins*\n🔗 Track your live turn here:\n${getDirectTicketUrl()}`;
    return `https://wa.me/${whatsappPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(text)}`;
  };

  const getGoogleCalendarUrl = () => {
    if (!myTicket || !shop) return "";
    const title = isRtl ? `موعدك لدى ${shop.name}` : `Appointment at ${shop.name}`;
    const desc = isRtl
      ? `تذكرتك رقم ${myTicket.ticketNumber}. تتبع دورك المباشر من هنا: ${getDirectTicketUrl()}`
      : `Ticket Number ${myTicket.ticketNumber}. Track live turn here: ${getDirectTicketUrl()}`;
    const start = new Date();
    const end = new Date(start.getTime() + estimatedWaitMinutes * 60 * 1000);
    const formatTime = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatTime(start)}/${formatTime(end)}&details=${encodeURIComponent(desc)}&sf=true&output=xml`;
  };

  if (loadingShop) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <span className="text-xs text-slate-500 font-semibold animate-pulse">{t("customer_loading_shop")}</span>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/30 rounded-2xl flex items-center justify-center text-rose-500 mb-4">
          <XCircle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">{t("customer_shop_not_found")}</h3>
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-6">{t("customer_shop_not_found_desc")}</p>
        <button
          onClick={onBackToHome}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-6 py-3.5 rounded-2xl transition-all shadow-md active:scale-98 cursor-pointer"
        >
          {t("customer_btn_back_home")}
        </button>
      </div>
    );
  }

  const closed = isShopClosed(shop);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-150 transition-colors duration-300 relative font-sans">
      
      {/* Header element */}
      <CustomerHeader 
        shop={shop}
        translateCategory={translateCategory}
        isStandalone={isStandalone}
        deferredPrompt={deferredPrompt}
        handleInstallPWA={handleInstallPWA}
        setShowPwaModal={setShowPwaModal}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        onBackToHome={onBackToHome}
        isRtl={isRtl}
      />

      {/* Main client window portal container */}
      <main className="max-w-md mx-auto px-4 pt-4 pb-24 relative">
        <AnimatePresence mode="wait">
          {!isOnline && (
            <motion.div 
              key="offline-toast"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-rose-600 text-white text-xs font-black py-3 px-4 rounded-2xl flex items-center justify-center gap-2 mb-4 shadow-md text-center"
            >
              <div className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>{t("customer_offline_toast")}</span>
            </motion.div>
          )}

          {shop.isPaused && !myTicket ? (
            <CustomerPausedScreen isRtl={isRtl} />
          ) : closed && !myTicket ? (
            <CustomerClosedScreen shop={shop} isRtl={isRtl} />
          ) : !myTicket ? (
            <CustomerJoinForm 
              shop={shop}
              services={services}
              selectedServiceId={selectedServiceId}
              setSelectedServiceId={setSelectedServiceId}
              joining={joining}
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              customerEmail={customerEmail}
              setCustomerEmail={setCustomerEmail}
              emailNotify={emailNotify}
              setEmailNotify={setEmailNotify}
              smsNotify={smsNotify}
              setSmsNotify={setSmsNotify}
              whatsappNotify={whatsappNotify}
              setWhatsappNotify={setWhatsappNotify}
              isScheduled={isScheduled}
              setIsScheduled={setIsScheduled}
              scheduledDate={scheduledDate}
              setScheduledDate={setScheduledDate}
              scheduledTime={scheduledTime}
              setScheduledTime={setScheduledTime}
              handleJoinQueue={handleJoinQueue}
              isOnline={isOnline}
              todayTickets={todayTickets}
              handleTestAudio={handleSendTestNotification}
              isStandalone={isStandalone}
              deferredPrompt={deferredPrompt}
              handleInstallPWA={handleInstallPWA}
              isRtl={isRtl}
            />
          ) : (
            <CustomerTicketBoard 
              shop={shop}
              myTicket={myTicket}
              todayTickets={todayTickets}
              peopleInFront={peopleInFront}
              estimatedWaitMinutes={estimatedWaitMinutes}
              progressPercent={progressPercent}
              calculatedAvgServiceTime={calculatedAvgServiceTime}
              activeCountersCount={activeCountersCount}
              aiEstimateLoading={aiEstimateLoading}
              aiEstimateMessage={aiEstimateMessage}
              soundEnabled={soundEnabled}
              handleToggleSound={handleToggleSound}
              handleTestAudio={handleSendTestNotification} // Retests or sends test audio alert
              pushPermission={pushPermission}
              handleRequestPushPermission={handleRequestPushPermission}
              handleSendTestNotification={handleSendTestNotification}
              showDiagnosticsPanel={showDiagnosticsPanel}
              setShowDiagnosticsPanel={setShowDiagnosticsPanel}
              openTroubleshootBrand={openTroubleshootBrand}
              setOpenTroubleshootBrand={setOpenTroubleshootBrand}
              ratingSpeed={ratingSpeed}
              setRatingSpeed={setRatingSpeed}
              ratingSpeedHover={ratingSpeedHover}
              setRatingSpeedHover={setRatingSpeedHover}
              ratingQuality={ratingQuality}
              setRatingQuality={setRatingQuality}
              ratingQualityHover={ratingQualityHover}
              setRatingQualityHover={setRatingQualityHover}
              showFeedbackForm={showFeedbackForm}
              setShowFeedbackForm={setShowFeedbackForm}
              ratingComment={ratingComment}
              setRatingComment={setRatingComment}
              submittingRating={submittingRating}
              ratingSuccess={ratingSuccess}
              handleSubmitRating={handleSubmitRating}
              counterStatuses={counterStatuses}
              showCancelConfirm={showCancelConfirm}
              setShowCancelConfirm={setShowCancelConfirm}
              handleLeaveQueue={handleLeaveQueue}
              unsubscribeFromTicket={unsubscribeFromTicket}
              setMyTicket={setMyTicket}
              copied={copied}
              handleCopyLink={handleCopyLink}
              handleShareLink={handleShareLink}
              getDirectTicketUrl={getDirectTicketUrl}
              getWhatsAppUrl={getWhatsAppUrl}
              getGoogleCalendarUrl={getGoogleCalendarUrl}
              whatsappPhone={whatsappPhone}
              setWhatsappPhone={setWhatsappPhone}
              isStandalone={isStandalone}
              showInstallBanner={showInstallBanner}
              deferredPrompt={deferredPrompt}
              handleInstallPWA={handleInstallPWA}
              isOnline={isOnline}
              isRtl={isRtl}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Back to top FAB */}
      {showScrollFab && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-lg text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 transition-all cursor-pointer z-40"
          aria-label={t("customer_btn_scroll_top")}
        >
          <ArrowUp className="w-5 h-5 animate-pulse" />
        </button>
      )}

      {/* 1. Share Social Links Modal */}
      <CustomerShareModal 
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        myTicket={myTicket!}
        shop={shop}
        getDirectTicketUrl={getDirectTicketUrl}
        handleCopyLink={handleCopyLink}
        copied={copied}
        isRtl={isRtl}
      />

      {/* 2. Manual PWA iOS instructions fallback modal */}
      <CustomerPwaModal 
        isOpen={showPwaModal}
        onClose={() => setShowPwaModal(false)}
        isRtl={isRtl}
      />

      {/* 3. Global approaching/next turn alert popup */}
      <CustomerInAppAlertModal 
        isOpen={inAppAlert.show}
        onClose={() => setInAppAlert(prev => ({ ...prev, show: false }))}
        type={inAppAlert.type || ""}
        title={inAppAlert.title}
        message={inAppAlert.message}
        isRtl={isRtl}
      />

      {/* 4. Global Error Alert Dialog */}
      <CustomerErrorAlertModal 
        isOpen={showAlert}
        onClose={() => setShowAlert(false)}
        errorMessage={errorMessage}
      />

      {/* 5. Max capacity subscription limit dialog */}
      <LimitAlertDialog 
        isOpen={showLimitModal} 
        onClose={() => setShowLimitModal(false)} 
      />
    </div>
  );
}
