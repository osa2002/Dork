import React from "react";
import { 
  QrCode, Copy, Check, Download, Info, Clock, Save, 
  Upload, Scissors, Stethoscope, Landmark, PhoneCall, UtensilsCrossed, HelpCircle 
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Shop, WorkingHoursDay } from "../../types";

interface QrTabProps {
  shop: Shop | null;
  copied: boolean;
  handleCopyLink: () => void;
  handleDownloadQR: () => void;
  editShopName: string;
  setEditShopName: (val: string) => void;
  editShopLogoText: string;
  setEditShopLogoText: (val: string) => void;
  editShopCategory: string;
  setEditShopCategory: (val: string) => void;
  editShopLogoUrl: string;
  setEditShopLogoUrl: (val: string) => void;
  editShopTicketColor: string;
  setEditShopTicketColor: (val: string) => void;
  settingsSaving: boolean;
  dragActive: boolean;
  workingHoursEnabled: boolean;
  setWorkingHoursEnabled: (val: boolean) => void;
  workingHoursDays: { [key: string]: WorkingHoursDay };
  setWorkingHoursDays: (val: { [key: string]: WorkingHoursDay }) => void;
  handleUpdateSettings: (e: React.FormEvent) => void;
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  soundEnabled: boolean;
  setSoundEnabled: (val: boolean) => void;
  voiceAnnouncementsEnabled: boolean;
  setVoiceAnnouncementsEnabled: (val: boolean) => void;
  voiceLanguage: string;
  setVoiceLanguage: (val: string) => void;
  voiceRate: number;
  setVoiceRate: (val: number) => void;
  browserNotificationsEnabled: boolean;
  maxWaitTimeAlertMinutes: number;
  setMaxWaitTimeAlertMinutes: (val: number) => void;
  handleToggleBrowserNotifications: () => void;
  handleSendTestNotification: () => void;
  isRtl: boolean;
}

export function QrTab({
  shop,
  copied,
  handleCopyLink,
  handleDownloadQR,
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
  workingHoursEnabled,
  setWorkingHoursEnabled,
  workingHoursDays,
  setWorkingHoursDays,
  handleUpdateSettings,
  handleDrag,
  handleDrop,
  handleFileChange,
  soundEnabled,
  setSoundEnabled,
  voiceAnnouncementsEnabled,
  setVoiceAnnouncementsEnabled,
  voiceLanguage,
  setVoiceLanguage,
  voiceRate,
  setVoiceRate,
  browserNotificationsEnabled,
  maxWaitTimeAlertMinutes,
  setMaxWaitTimeAlertMinutes,
  handleToggleBrowserNotifications,
  handleSendTestNotification,
  isRtl
}: QrTabProps) {
  const { t } = useTranslation();

  const handleWorkingHoursDayToggle = (dayKey: string) => {
    const updated = { ...workingHoursDays };
    updated[dayKey] = {
      ...updated[dayKey],
      enabled: !updated[dayKey].enabled
    };
    setWorkingHoursDays(updated);
  };

  const handleWorkingHoursTimeChange = (dayKey: string, field: "open" | "close", value: string) => {
    const updated = { ...workingHoursDays };
    updated[dayKey] = {
      ...updated[dayKey],
      [field]: value
    };
    setWorkingHoursDays(updated);
  };

  const daysOfWeek = [
    { key: "1", label: t("day_monday", "Monday") },
    { key: "2", label: t("day_tuesday", "Tuesday") },
    { key: "3", label: t("day_wednesday", "Wednesday") },
    { key: "4", label: t("day_thursday", "Thursday") },
    { key: "5", label: t("day_friday", "Friday") },
    { key: "6", label: t("day_saturday", "Saturday") },
    { key: "0", label: t("day_sunday", "Sunday") }
  ];

  return (
    <div className="space-y-6 animate-fade-in animate-duration-200" id="qr-settings-tab">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: QR Code & Public Link */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm text-center space-y-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {t("vend_digital_counter_header", "Digital Queue Access")}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
                {t("vend_digital_counter_desc", "Customers can scan this QR code or use the link to join your waiting list, verify estimated times, and track their turn dynamically from their phones.")}
              </p>
            </div>

            {/* QR Image Visual container */}
            <div className="relative inline-block bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-100 dark:border-slate-900/60 shadow-inner group">
              <div id="qr-code-element" className="relative z-10 p-2 bg-white rounded-xl">
                {shop?.slug ? (
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`${window.location.origin}/portal/${shop.slug}`)}&color=0f172a&bgcolor=ffffff&qzone=1`}
                    alt="Customer Portal QR Code"
                    className="w-40 h-40 object-contain mx-auto"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-40 h-40 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 text-[10px] font-bold">
                    {t("vend_loading_qr_slug", "Loading Slug...")}
                  </div>
                )}
              </div>
              <div className="absolute inset-0 bg-indigo-600/5 dark:bg-indigo-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>

            <div className="space-y-3">
              {/* Public Link Copy Input */}
              <div className="relative">
                <input 
                  type="text"
                  readOnly
                  value={shop?.slug ? `${window.location.origin}/portal/${shop.slug}` : ""}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300 px-4 py-3.5 pe-24 rounded-2xl text-[11px] font-black focus:outline-none focus:ring-0 truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="absolute end-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] px-3.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow"
                  id="btn-copy-link"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>{t("btn_copied", "Copied")}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>{t("btn_copy", "Copy Link")}</span>
                    </>
                  )}
                </button>
              </div>

              {/* QR Download Button */}
              <button
                onClick={handleDownloadQR}
                className="w-full border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-extrabold text-xs py-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                id="btn-download-qr"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>{t("vend_download_qr_btn", "Download QR Code Image")}</span>
              </button>
            </div>
          </div>

          {/* Quick Notice Card */}
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 p-5 rounded-3xl flex gap-3">
            <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h5 className="text-xs font-black text-slate-800 dark:text-white">
                {t("vend_qr_notice_title", "Custom Branding")}
              </h5>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {t("vend_qr_notice_body", "If you update your logo image or brand text inside settings, the customer onboarding portal will adapt immediately to match your style parameters.")}
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: General Settings Form & Timing Schedule */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleUpdateSettings} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-3xl shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>{t("vend_settings_form_title", "Shop Branding & Profile Setup")}</span>
              </h3>
              <button
                type="submit"
                disabled={settingsSaving}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow"
                id="btn-save-settings"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{t("btn_save_changes", "Save Changes")}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {t("vend_field_shop_name_label", "Shop / Business Name")}
                </label>
                <input 
                  type="text"
                  value={editShopName}
                  onChange={(e) => setEditShopName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {t("vend_field_logo_text_label", "Brand Logo Slogan / Text")}
                </label>
                <input 
                  type="text"
                  value={editShopLogoText}
                  onChange={(e) => setEditShopLogoText(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {t("vend_field_category_label", "Business Category")}
                </label>
                <select
                  value={editShopCategory}
                  onChange={(e) => setEditShopCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="barber">💇‍♂️ {t("cat_barber_salon", "Barber & Beauty Salon")}</option>
                  <option value="medical">🩺 {t("cat_medical_clinic", "Medical & Clinics")}</option>
                  <option value="government">🏛️ {t("cat_gov_offices", "Government & Offices")}</option>
                  <option value="telecom">📱 {t("cat_telecom_retail", "Telecom & Retail Stores")}</option>
                  <option value="food">🍔 {t("cat_food_beverage", "Restaurants & Cafés")}</option>
                  <option value="other">📦 {t("cat_other_services", "Other Support Services")}</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>{t("vend_field_ticket_color_label", "Ticket Visual Color")}</span>
                  <span className="text-[11px] font-mono font-black" style={{ color: editShopTicketColor }}>{editShopTicketColor}</span>
                </label>
                <div className="flex gap-2">
                  <input 
                    type="color"
                    value={editShopTicketColor}
                    onChange={(e) => setEditShopTicketColor(e.target.value)}
                    className="w-12 h-10 p-0.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"
                  />
                  <div className="grid grid-cols-5 gap-1.5 flex-1">
                    {["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e"].map((colorHex) => (
                      <button
                        key={colorHex}
                        type="button"
                        onClick={() => setEditShopTicketColor(colorHex)}
                        className="h-10 rounded-xl border border-transparent transition-transform hover:scale-105"
                        style={{ backgroundColor: colorHex }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Logo Uploading File drag-drop area */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                {t("vend_field_logo_url_label", "Shop Logo Image")}
              </label>
              
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all relative overflow-hidden ${
                  dragActive 
                    ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20" 
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                }`}
              >
                <input 
                  type="file"
                  id="logo-file-input"
                  onChange={handleFileChange}
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />

                {editShopLogoUrl ? (
                  <div className="flex items-center justify-center gap-4">
                    <img 
                      src={editShopLogoUrl}
                      alt="Brand Logo Preview"
                      className="w-16 h-16 rounded-2xl object-cover border border-slate-100 shadow-sm"
                    />
                    <div className="text-left space-y-1">
                      <p className="text-xs font-black text-slate-800 dark:text-white">
                        {t("vend_logo_preview_title", "Logo uploaded successfully!")}
                      </p>
                      <button 
                        type="button"
                        onClick={() => setEditShopLogoUrl("")}
                        className="text-[10px] text-rose-500 hover:text-rose-600 font-extrabold underline cursor-pointer"
                      >
                        {t("vend_btn_remove_logo", "Remove & Reset")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="text-xs">
                      <span className="font-black text-indigo-600 dark:text-indigo-400">
                        {t("vend_logo_upload_prompt", "Click to upload image")}
                      </span>{" "}
                      {t("vend_logo_upload_drag", "or drag & drop here")}
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {t("vend_logo_size_limit", "PNG, JPG up to 1MB")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Timing Working Hours Scheduling */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    {t("vend_working_hours_title", "Working Hours Schedule")}
                  </h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {t("vend_working_hours_desc", "Configure days and open ranges when customers can pull tickets. Beyond hours, requests are denied.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWorkingHoursEnabled(!workingHoursEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${
                    workingHoursEnabled ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
                  }`}
                >
                  <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm ${
                    workingHoursEnabled ? "start-6" : "start-1"
                  }`} />
                </button>
              </div>

              {workingHoursEnabled && (
                <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-3xl border border-slate-150 dark:border-slate-800/60 space-y-3">
                  {daysOfWeek.map(({ key, label }) => {
                    const dayConfig = workingHoursDays[key] || { enabled: false, open: "09:00", close: "22:00" };
                    return (
                      <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox"
                            checked={dayConfig.enabled}
                            onChange={() => handleWorkingHoursDayToggle(key)}
                            className="w-4 h-4 text-indigo-600 border-slate-200 rounded focus:ring-indigo-500"
                          />
                          <span className="text-xs font-black text-slate-800 dark:text-slate-300">{label}</span>
                        </div>

                        {dayConfig.enabled ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="time"
                              value={dayConfig.open}
                              onChange={(e) => handleWorkingHoursTimeChange(key, "open", e.target.value)}
                              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-slate-400 font-extrabold">{t("time_to_divider", "to")}</span>
                            <input 
                              type="time"
                              value={dayConfig.close}
                              onChange={(e) => handleWorkingHoursTimeChange(key, "close", e.target.value)}
                              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-extrabold italic uppercase">
                            {t("day_closed_status", "Closed / Day Off")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Audio Voice Announcements & Browser Alerts Controls */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-6">
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-slate-900 dark:text-white">
                  {t("vend_sound_settings_title", "Sound Chimes, Voices & Popups")}
                </h4>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {t("vend_sound_settings_desc", "Configure speech parameters, volume, turn approaching limits, and browser push notices to notify clerks of delays.")}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Audio chime toggle */}
                <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">{t("vend_sound_toggle_label", "Audio chime sound effects")}</span>
                    <p className="text-[10px] text-slate-400">{t("vend_sound_toggle_desc", "Play bell sound on ticket adds & calls")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 ${
                      soundEnabled ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  >
                    <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm ${
                      soundEnabled ? "start-6" : "start-1"
                    }`} />
                  </button>
                </div>

                {/* Voice Calling toggle */}
                <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">{t("vend_voice_toggle_label", "Voice announcement calling")}</span>
                    <p className="text-[10px] text-slate-400">{t("vend_voice_toggle_desc", "AI synthesis reads numbers aloud")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVoiceAnnouncementsEnabled(!voiceAnnouncementsEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 ${
                      voiceAnnouncementsEnabled ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  >
                    <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm ${
                      voiceAnnouncementsEnabled ? "start-6" : "start-1"
                    }`} />
                  </button>
                </div>
              </div>

              {voiceAnnouncementsEnabled && (
                <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-3xl border border-slate-150 dark:border-slate-800/60 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {t("vend_voice_lang_label", "Calling Announcement Language")}
                      </label>
                      <select
                        value={voiceLanguage}
                        onChange={(e) => setVoiceLanguage(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        <option value="both">🌐 {t("vend_voice_lang_both", "Bilingual (Arabic + English)")}</option>
                        <option value="ar">🇸🇦 {t("vend_voice_lang_ar", "Arabic Only")}</option>
                        <option value="en">🇺🇸 {t("vend_voice_lang_en", "English Only")}</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider flex justify-between">
                        <span>{t("vend_voice_speed_label", "Speech Speed (Rate)")}</span>
                        <span className="font-mono">{voiceRate}x</span>
                      </label>
                      <input 
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.05"
                        value={voiceRate}
                        onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                        className="w-full cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none accent-indigo-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Browser Push Popup Alerts Setup */}
              <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-3xl border border-slate-150 dark:border-slate-800/60 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">{t("vend_browser_notifs_title", "Browser Popup Notifications")}</span>
                    <p className="text-[10px] text-slate-400">{t("vend_browser_notifs_desc", "Sends instant dashboard slide alerts for new customer pull events.")}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {browserNotificationsEnabled && (
                      <button
                        type="button"
                        onClick={handleSendTestNotification}
                        className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:border-slate-700 font-bold text-[10px] py-1.5 px-3 rounded-lg cursor-pointer transition-colors"
                      >
                        {t("vend_test_push_btn", "Send Test Push")}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleToggleBrowserNotifications}
                      className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 ${
                        browserNotificationsEnabled ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
                      }`}
                    >
                      <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm ${
                        browserNotificationsEnabled ? "start-6" : "start-1"
                      }`} />
                    </button>
                  </div>
                </div>

                {browserNotificationsEnabled && (
                  <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-3.5 space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider flex justify-between">
                      <span>{t("vend_max_wait_alert_label", "Max Wait Limit Warning Alert")}</span>
                      <span className="font-mono text-amber-600 font-black">{maxWaitTimeAlertMinutes} {t("time_mins_plural", "minutes")}</span>
                    </label>
                    <input 
                      type="range"
                      min="5"
                      max="60"
                      step="5"
                      value={maxWaitTimeAlertMinutes}
                      onChange={(e) => setMaxWaitTimeAlertMinutes(Number(e.target.value))}
                      className="w-full cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none accent-indigo-600"
                    />
                    <p className="text-[9px] text-slate-400 leading-normal flex items-start gap-1">
                      <HelpCircle className="w-3.5 h-3.5 shrink-0 text-slate-400 mt-0.5" />
                      <span>{t("vend_wait_limit_explanation", "Triggers a browser desktop warning push notification if any waiting client has been waiting in queue longer than this range without being called by your windows.")}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
