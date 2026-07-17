import React from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Ticket as TicketIcon, Loader2, Volume2, Smartphone, Download } from "lucide-react";
import { motion } from "motion/react";
import { Shop, Service, Ticket } from "../../types";

interface CustomerJoinFormProps {
  shop: Shop;
  services: Service[];
  selectedServiceId: string;
  setSelectedServiceId: (val: string) => void;
  customerName: string;
  setCustomerName: (val: string) => void;
  customerPhone: string;
  setCustomerPhone: (val: string) => void;
  customerEmail: string;
  setCustomerEmail: (val: string) => void;
  emailNotify: boolean;
  setEmailNotify: (val: boolean) => void;
  smsNotify: boolean;
  setSmsNotify: (val: boolean) => void;
  whatsappNotify: boolean;
  setWhatsappNotify: (val: boolean) => void;
  isScheduled: boolean;
  setIsScheduled: (val: boolean) => void;
  scheduledDate: string;
  setScheduledDate: (val: string) => void;
  scheduledTime: string;
  setScheduledTime: (val: string) => void;
  joining: boolean;
  isOnline: boolean;
  todayTickets: Ticket[];
  handleJoinQueue: (e: React.FormEvent) => void;
  handleTestAudio: () => void;
  isStandalone: boolean;
  deferredPrompt: any;
  handleInstallPWA: () => void;
  isRtl: boolean;
}

export function CustomerJoinForm({
  shop,
  services,
  selectedServiceId,
  setSelectedServiceId,
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
  isScheduled,
  setIsScheduled,
  scheduledDate,
  setScheduledDate,
  scheduledTime,
  setScheduledTime,
  joining,
  isOnline,
  todayTickets,
  handleJoinQueue,
  handleTestAudio,
  isStandalone,
  deferredPrompt,
  handleInstallPWA,
  isRtl
}: CustomerJoinFormProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-lg z-10"
    >
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-1">
          {t("customer_join_title", "Join Queue")}
        </h2>
        <p className="text-xs text-slate-500 font-bold leading-normal">
          {t("customer_join_desc", "Fill in your details below to obtain your digital ticket.")}
        </p>
      </div>

      {/* Online/Offline Banner Status */}
      {!isOnline && (
        <div className="mb-6 bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <div className="text-start">
            <h4 className="text-[11px] font-black text-amber-950 uppercase tracking-wider">
              {t("customer_offline_mode_title", "Offline Mode Enabled")}
            </h4>
            <p className="text-[10px] text-amber-700 font-bold mt-0.5 leading-tight">
              {t("customer_offline_mode_desc", "You can join the queue offline. Your ticket will sync automatically once connected.")}
            </p>
          </div>
        </div>
      )}

      {/* Real-time Ticket Quota Meter */}
      {(() => {
        const planType = shop.plan || "free";
        const maxAllowed = planType === "pro" ? 99999 : 5;
        const totalToday = todayTickets.length;
        const remaining = Math.max(0, maxAllowed - totalToday);
        const percent = Math.min(100, Math.round((totalToday / maxAllowed) * 100));

        if (planType === "pro") {
          return (
            <div className="mb-6 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 border border-violet-100 dark:border-violet-900/40 rounded-2xl p-4 flex items-center gap-3 shadow-sm animate-fadeIn">
              <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0 shadow shadow-violet-200 dark:shadow-none">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div className="text-start">
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

        // Free Plan Quota Bar
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
                <div className="text-start">
                  <h4 className={`text-[11px] font-black ${
                    remaining === 0 
                      ? "text-rose-950 dark:text-rose-200" 
                      : remaining === 1 
                        ? "text-amber-950 dark:text-amber-200" 
                        : "text-slate-900 dark:text-slate-100"
                  }`}>
                    {t("customer_today_quota", "Today's Booking Limit")}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5 leading-tight">
                    {t("customer_free_plan_quota_desc", "This shop has free plan slot capacity (Max: {{maxAllowed}} daily bookings)").replace("{{maxAllowed}}", String(maxAllowed))}
                  </p>
                </div>
              </div>

              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                remaining === 0 
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800" 
                  : remaining === 1 
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800" 
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800"
              }`}>
                {remaining === 0 ? t("customer_quota_full", "Slots Full") : t("customer_quota_remaining", "Slots: {{remaining}} left").replace("{{remaining}}", String(remaining))}
              </span>
            </div>

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

            <div className={`flex justify-between items-center text-[10px] font-black ${
              remaining === 0 
                ? "text-rose-750 dark:text-rose-400" 
                : remaining === 1 
                  ? "text-amber-750 dark:text-amber-400" 
                  : "text-slate-500 dark:text-slate-400"
            }`}>
              <span>
                {t("customer_booked_count_desc", "Booked: {{totalToday}} / {{maxAllowed}}").replace("{{totalToday}}", String(totalToday)).replace("{{maxAllowed}}", String(maxAllowed))}
              </span>
              <span>
                {remaining === 0 
                  ? t("customer_booking_closed_msg", "Issuance Cleared") 
                  : remaining === 1 
                    ? t("customer_booking_urgent_msg", "Issuing Last Slot!") 
                    : t("customer_booking_open_msg", "Issuing Open")}
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

        {/* Future Appointment Scheduling */}
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
              <span className="text-xs font-black text-slate-800">{t("customer_schedule_later", "Schedule for Later")}</span>
              <span className="text-[10px] text-slate-500">{t("customer_schedule_later_desc", "Book a priority time-slot instead of immediate waiting")}</span>
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

      {/* Premium PWA Installation Card */}
      {!isStandalone && (
        <div className="mt-6 bg-slate-50/50 dark:bg-slate-900 border-2 border-dashed border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="text-start">
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
  );
}
