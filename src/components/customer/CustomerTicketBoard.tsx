import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { 
  Ticket as TicketIcon, Bell, Volume2, VolumeX, CheckCircle, Star, Users, Clock, Sparkles, 
  Battery, Wrench, AlertTriangle, AlertCircle, XCircle, Copy, Check, Share2, Calendar, Smile, Loader2,
  Smartphone, Download
} from "lucide-react";
import { Shop, Ticket } from "../../types";

interface CustomerTicketBoardProps {
  shop: Shop;
  myTicket: Ticket;
  todayTickets: Ticket[];
  peopleInFront: number;
  estimatedWaitMinutes: number;
  progressPercent: number;
  calculatedAvgServiceTime: number;
  activeCountersCount: number;
  aiEstimateLoading: boolean;
  aiEstimateMessage: string | null;
  soundEnabled: boolean;
  handleToggleSound: () => void;
  handleTestAudio: () => void;
  pushPermission: string;
  handleRequestPushPermission: () => void;
  handleSendTestNotification: () => void;
  showDiagnosticsPanel: boolean;
  setShowDiagnosticsPanel: (val: boolean) => void;
  openTroubleshootBrand: string | null;
  setOpenTroubleshootBrand: (val: string | null) => void;
  
  ratingSpeed: number;
  setRatingSpeed: (val: number) => void;
  ratingSpeedHover: number;
  setRatingSpeedHover: (val: number) => void;
  ratingQuality: number;
  setRatingQuality: (val: number) => void;
  ratingQualityHover: number;
  setRatingQualityHover: (val: number) => void;
  showFeedbackForm: boolean;
  setShowFeedbackForm: (val: boolean) => void;
  ratingComment: string;
  setRatingComment: (val: string) => void;
  submittingRating: boolean;
  ratingSuccess: boolean;
  handleSubmitRating: () => void;
  
  counterStatuses: any[];
  showCancelConfirm: boolean;
  setShowCancelConfirm: (val: boolean) => void;
  handleLeaveQueue: () => void;
  unsubscribeFromTicket: () => void;
  setMyTicket: (ticket: Ticket | null) => void;
  copied: boolean;
  handleCopyLink: () => void;
  handleShareLink: () => void;
  getDirectTicketUrl: () => string;
  getWhatsAppUrl: () => string;
  getGoogleCalendarUrl: () => string;
  whatsappPhone: string;
  setWhatsappPhone: (val: string) => void;
  isStandalone: boolean;
  showInstallBanner: boolean;
  deferredPrompt: any;
  handleInstallPWA: () => void;
  isOnline: boolean;
  isRtl: boolean;
}

export function CustomerTicketBoard({
  shop,
  myTicket,
  todayTickets,
  peopleInFront,
  estimatedWaitMinutes,
  progressPercent,
  calculatedAvgServiceTime,
  activeCountersCount,
  aiEstimateLoading,
  aiEstimateMessage,
  soundEnabled,
  handleToggleSound,
  handleTestAudio,
  pushPermission,
  handleRequestPushPermission,
  handleSendTestNotification,
  showDiagnosticsPanel,
  setShowDiagnosticsPanel,
  openTroubleshootBrand,
  setOpenTroubleshootBrand,
  
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
  handleSubmitRating,
  
  counterStatuses,
  showCancelConfirm,
  setShowCancelConfirm,
  handleLeaveQueue,
  unsubscribeFromTicket,
  setMyTicket,
  copied,
  handleCopyLink,
  handleShareLink,
  getDirectTicketUrl,
  getWhatsAppUrl,
  getGoogleCalendarUrl,
  whatsappPhone,
  setWhatsappPhone,
  isStandalone,
  showInstallBanner,
  deferredPrompt,
  handleInstallPWA,
  isOnline,
  isRtl
}: CustomerTicketBoardProps) {
  const { t } = useTranslation();

  return (
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
                  <div className="space-y-4 pt-1 text-start">
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
                            const actualSpeedRating = myTicket.ratingSpeed || ratingSpeed || myTicket.rating;
                            return (
                              <Star
                                key={starVal}
                                className={`w-3.5 h-3.5 ${
                                  starVal <= (actualSpeedRating || 0)
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
                            const actualQualityRating = myTicket.ratingQuality || ratingQuality || myTicket.rating;
                            return (
                              <Star
                                key={starVal}
                                className={`w-3.5 h-3.5 ${
                                  starVal <= (actualQualityRating || 0)
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
                    className="absolute -end-2 -top-1 w-4.5 h-4.5 rounded-full bg-white dark:bg-slate-950 border-2 border-indigo-500 flex items-center justify-center shadow-md animate-pulse"
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
              const statusColors: Record<string, string> = {
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
            <div className="text-start">
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
            <div className="text-start">
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
            <div className="text-start">
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
            <div className="text-start">
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
                <div className="text-[10px] font-bold text-rose-800 dark:text-rose-300 leading-relaxed text-start">
                  <strong>{t("diag_blocked_warning", "Warning: Notifications Blocked!")}</strong>
                  <p className="mt-0.5 font-medium">
                    {t("diag_blocked_desc", "You have blocked notifications. Please click the lock icon 🔒 next to the address bar to reset the permissions.")}
                  </p>
                </div>
              </div>
            )}

            {!isStandalone && /iPhone|iPad|iPod/i.test(navigator.userAgent) && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-155 dark:border-amber-900/40 p-3 rounded-2xl flex gap-2.5 items-start">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-[10px] font-bold text-amber-800 dark:text-amber-300 leading-relaxed text-start">
                  <strong>{t("diag_ios_warning", "Crucial for iOS (iPhone):")}</strong>
                  <p className="mt-0.5 font-medium">
                    {t("diag_ios_desc", "Apple iOS restricts notifications to Home Screen apps. Tap the Share button 📤, then select 'Add to Home Screen' 📲, and launch it from there.")}
                  </p>
                </div>
              </div>
            )}

            {/* Checklist of diagnostics */}
            <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60 p-3.5 rounded-2xl space-y-2.5">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-start">
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
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-start">
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
            <div className="text-start">
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
              <div className="text-[10px] font-black text-indigo-600 uppercase tracking-wider brand-text-primary text-start">
                {t("customer_pwa_install_ticket_guide")}
              </div>
              
              {/* iOS Apple instruction */}
              {/iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent) ? (
                <p className="text-[10.5px] leading-relaxed font-semibold text-start">
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
                <p className="text-[10.5px] leading-relaxed font-semibold text-start">
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
    </motion.div>
  );
}
