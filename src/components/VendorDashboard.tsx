import React, { useState, lazy, Suspense } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { useTranslation } from "react-i18next";
import { doc, updateDoc } from "firebase/firestore";
import { useUiStore } from "../store";

// Icons
import { 
  Users, Activity, Clock, QrCode as QrIcon, FileSpreadsheet, 
  Monitor, CreditCard, LogOut, Sun, Moon, Volume2, VolumeX, Loader2,
  Radio as WebhookIcon
} from "lucide-react";

// Components
import LanguageSwitcher from "./LanguageSwitcher";
import { ConfirmationModal } from "./dashboard/ConfirmationModal";
import { QueueTab } from "./dashboard/QueueTab";
import { ServicesTab } from "./dashboard/ServicesTab";
import { QrTab } from "./dashboard/QrTab";
import { DisplaysTab } from "./dashboard/DisplaysTab";
import { BillingTab } from "./dashboard/BillingTab";
import { WebhooksTab } from "./dashboard/WebhooksTab";

const ReportsTab = lazy(() => import("./dashboard/ReportsTab").then(module => ({ default: module.ReportsTab })));

// Hooks
import { useDashboardSettings } from "../hooks/useDashboardSettings";
import { useDashboardTickets } from "../hooks/useDashboardTickets";
import { useDashboardServices } from "../hooks/useDashboardServices";
import { useDashboardNotifications } from "../hooks/useDashboardNotifications";
import { useDashboardDisplays } from "../hooks/useDashboardDisplays";
import { useDashboardBilling } from "../hooks/useDashboardBilling";
import { useDashboardAnalytics } from "../hooks/useDashboardAnalytics";
import { useDashboardWebhooks } from "../hooks/useDashboardWebhooks";
import { webhookDispatcherService } from "../services/webhookDispatcherService";
import { getClientStartOfTodayInTimezone } from "../lib/shopUtils";


interface VendorDashboardProps {
  shopId: string;
  onSignOut: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
}

export default function VendorDashboard({ 
  shopId, 
  onSignOut, 
  isDarkMode: _propIsDarkMode, 
  setIsDarkMode: _propSetIsDarkMode 
}: VendorDashboardProps) {
  const { t, i18n } = useTranslation();
  const isRtl = (i18n.language || "ar").startsWith("ar");

  const isDarkMode = useUiStore((state) => state.isDarkMode);
  const setIsDarkMode = useUiStore((state) => state.setIsDarkMode);
  const activeTab = useUiStore((state) => state.activeDashboardTab);
  const setActiveTab = useUiStore((state) => state.setActiveDashboardTab);
  const confirmModal = useUiStore((state) => state.confirmModal);
  const setConfirmModal = useUiStore((state) => state.setConfirmModal);

  // Selected queue path filter
  const [selectedQueueServiceId, setSelectedQueueServiceId] = useState<string>("all");

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

  // State Management via Decoupled Hooks
  const settings = useDashboardSettings({ shopId });
  const shop = settings.shop;

  const notifications = useDashboardNotifications({ 
    shopId, 
    shopLogoUrl: shop?.logoUrl, 
    isRtl 
  });

  const tickets = useDashboardTickets({
    shopId,
    shop,
    activeCounterNumber: settings.activeCounterNumber,
    soundEnabled: notifications.soundEnabled,
    browserNotificationsEnabled: notifications.browserNotificationsEnabled,
    maxWaitTimeAlertMinutes: notifications.maxWaitTimeAlertMinutes,
    sendBrowserNotification: notifications.sendBrowserNotification,
    announceCallingTicket: notifications.announceCallingTicket,
    getClientStartOfTodayInTimezone,
    isRtl
  });

  const services = useDashboardServices({ 
    shopId, 
    showConfirmation 
  });

  const displays = useDashboardDisplays({ 
    shopId, 
    showConfirmation 
  });

  const billing = useDashboardBilling({ 
    shopId, 
    shop 
  });

  const analytics = useDashboardAnalytics({ 
    tickets: tickets.tickets, 
    allTickets: tickets.allTickets 
  });

  const webhooks = useDashboardWebhooks({
    shopId,
    showConfirmation
  });

  // Logout Click Handler
  const handleLogoutClick = () => {
    showConfirmation(
      t("logout_confirm_title", "Sign Out"),
      t("logout_confirm_body", "Are you sure you want to sign out from the queue management dashboard?"),
      async () => {
        try {
          await signOut(auth);
          onSignOut();
        } catch (err) {
          console.error("Error signing out:", err);
        }
      }
    );
  };

  // Render Loader if initial loading
  if (settings.loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-3">
        <Users className="w-10 h-10 text-indigo-600 animate-pulse" />
        <div className="text-xs font-black text-slate-500 animate-bounce">
          {t("vend_loading_profile", "Syncing queue configurations, please wait...")}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDarkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"} pb-16 ${isRtl ? "text-right dir-rtl" : "text-left dir-ltr"}`}>
      
      {/* Top Header Navigation */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-30 shadow-sm shadow-slate-100 dark:shadow-none">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 min-h-16 flex items-center justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-100 dark:shadow-none">
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xs sm:text-base font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                {shop?.name || t("vend_dashboard_fallback", "Queue Dashboard")}
              </h1>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-500 truncate">
                <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="truncate">{t("vend_admin_connected", "Admin Connected")}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1 sm:gap-2 shrink-0">
            {/* Pause/Resume Queue Toggle Switch */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-2xl px-2 py-1 sm:px-3 sm:py-1.5 select-none shadow-sm">
              <div className="hidden md:flex flex-col items-start md:items-end">
                <span className="text-[11px] font-black leading-none text-slate-900 dark:text-white mb-0.5">
                  {shop?.isPaused ? t("vend_paused", "Paused") : t("vend_active_status", "Active")}
                </span>
                <span className="text-[9px] text-slate-400 font-bold leading-none">
                  {t("vend_queue_intake", "Queue Intake")}
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
                  !shop?.isPaused ? "bg-emerald-500" : "bg-amber-500"
                }`}
                title={shop?.isPaused ? t("vend_resume_reservations", "Resume Intake") : t("vend_pause_reservations", "Pause Intake")}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    !shop?.isPaused ? (isRtl ? "-translate-x-5" : "translate-x-5") : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <LanguageSwitcher />

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 sm:p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              title={isDarkMode ? t("vend_enable_light_mode", "Enable Light Mode") : t("vend_enable_dark_mode", "Enable Dark Mode")}
            >
              {isDarkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            {/* Global Sound Alert Toggle */}
            <button
              onClick={() => notifications.setSoundEnabled(!notifications.soundEnabled)}
              className={`p-2 sm:p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                notifications.soundEnabled 
                  ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400" 
                  : "bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-800"
              }`}
              title={notifications.soundEnabled ? t("sound_settings_toggle", "Mute Audio") : t("sound_settings_toggle", "Unmute Audio")}
            >
              {notifications.soundEnabled ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            {/* Sign Out Trigger */}
            <button
              onClick={handleLogoutClick}
              className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
              title={t("logout", "Sign Out")}
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Sidebar Menu Panel */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-2 shadow-sm">
            <div className="text-xs font-black text-slate-400 px-3 pb-3 border-b border-slate-100 dark:border-slate-800 uppercase mb-2 text-start">
              {t("vend_sidebar_sections", "Dashboard Navigation")}
            </div>

            {/* Nav: Queue Tab */}
            <button
              onClick={() => setActiveTab("queue")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition-all duration-200 hover:scale-[1.01] cursor-pointer ${
                activeTab === "queue"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-100 dark:shadow-none"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:text-indigo-600 dark:hover:text-indigo-400"
              }`}
            >
              <Activity className="w-5 h-5 text-violet-500 shrink-0" />
              <span>{t("vend_active_queue", "Lobby Queues")}</span>
              {tickets.tickets.filter(tItem => tItem.status === "waiting").length > 0 && (
                <span className={`ms-auto px-2 py-0.5 rounded-full text-xs font-black transition-colors ${
                  activeTab === "queue" ? "bg-white/20 text-white" : "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border border-violet-100/50 dark:border-violet-900/30"
                }`}>
                  {tickets.tickets.filter(tItem => tItem.status === "waiting").length}
                </span>
              )}
            </button>

            {/* Nav: Services Tab */}
            <button
              onClick={() => setActiveTab("services")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition-all duration-200 hover:scale-[1.01] cursor-pointer ${
                activeTab === "services"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-100 dark:shadow-none"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:text-indigo-600 dark:hover:text-indigo-400"
              }`}
            >
              <Clock className="w-5 h-5 text-amber-500 shrink-0" />
              <span>{t("vend_sidebar_services", "Service Paths")}</span>
            </button>

            {/* Nav: QR & Settings Tab */}
            <button
              onClick={() => setActiveTab("qr")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition-all duration-200 hover:scale-[1.01] cursor-pointer ${
                activeTab === "qr"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-100 dark:shadow-none"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:text-indigo-600 dark:hover:text-indigo-400"
              }`}
            >
              <QrIcon className="w-5 h-5 text-indigo-500 shrink-0" />
              <span>{t("vend_qr_settings", "QR & Profile Settings")}</span>
            </button>

            {/* Nav: Reports Tab */}
            <button
              onClick={() => setActiveTab("reports")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition-all duration-200 hover:scale-[1.01] cursor-pointer ${
                activeTab === "reports"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-100 dark:shadow-none"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:text-indigo-600 dark:hover:text-indigo-400"
              }`}
            >
              <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>{t("vend_reports", "Reports & Advice")}</span>
            </button>

            {/* Nav: Screens Tab */}
            <button
              onClick={() => setActiveTab("displays")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition-all duration-200 hover:scale-[1.01] cursor-pointer ${
                activeTab === "displays"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-100 dark:shadow-none"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:text-indigo-600 dark:hover:text-indigo-400"
              }`}
            >
              <Monitor className="w-5 h-5 text-cyan-500 shrink-0" />
              <span>{t("vend_sidebar_displays", "Lobby Display Screens")}</span>
              {displays.displays.length > 0 && (
                <span className={`ms-auto px-2 py-0.5 rounded-full text-xs font-black transition-colors ${
                  activeTab === "displays" ? "bg-white/20 text-white" : "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border border-violet-100/50 dark:border-violet-900/30"
                }`}>
                  {displays.displays.length}
                </span>
              )}
            </button>

            {/* Nav: Billing Tab */}
            <button
              onClick={() => setActiveTab("billing")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition-all duration-200 hover:scale-[1.01] cursor-pointer ${
                activeTab === "billing"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-100 dark:shadow-none"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:text-indigo-600 dark:hover:text-indigo-400"
              }`}
            >
              <CreditCard className="w-5 h-5 text-rose-500 shrink-0" />
              <span>{t("vend_sidebar_billing", "Plan Subscription")}</span>
              {shop?.plan === "pro" && (
                <span className="ms-auto px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white animate-pulse">
                  PRO
                </span>
              )}
            </button>

            {/* Nav: Webhooks Tab */}
            <button
              onClick={() => setActiveTab("webhooks")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-extrabold transition-all duration-200 hover:scale-[1.01] cursor-pointer ${
                activeTab === "webhooks"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-100 dark:shadow-none"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:text-indigo-600 dark:hover:text-indigo-400"
              }`}
            >
              <WebhookIcon className="w-5 h-5 text-indigo-500 shrink-0" />
              <span>{t("vend_sidebar_webhooks", "Webhooks & Automation")}</span>
              {webhooks.webhooks.length > 0 && (
                <span className={`ms-auto px-2 py-0.5 rounded-full text-xs font-black transition-colors ${
                  activeTab === "webhooks" ? "bg-white/20 text-white" : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30"
                }`}>
                  {webhooks.webhooks.length}
                </span>
              )}
            </button>
          </div>

          {/* Dynamic Tab Panel Component Wrapper */}
          <div className="lg:col-span-9 space-y-6">
            
            {activeTab === "queue" && (
              <QueueTab
                tickets={tickets.tickets}
                services={services.services}
                activeCounterNumber={settings.activeCounterNumber}
                setActiveCounterNumber={settings.setActiveCounterNumber}
                counterStatus={settings.counterStatus}
                updateCounterStatus={settings.updateCounterStatus}
                selectedQueueServiceId={selectedQueueServiceId}
                setSelectedQueueServiceId={setSelectedQueueServiceId}
                handleCallNext={tickets.handleCallNext}
                handleCallTicket={tickets.handleCallTicket}
                handleUpdateTicketStatus={tickets.handleUpdateTicketStatus}
                handleTogglePriority={tickets.handleTogglePriority}
                isRtl={isRtl}
              />
            )}

            {activeTab === "services" && (
              <ServicesTab
                services={services.services}
                newServiceName={services.newServiceName}
                setNewServiceName={services.setNewServiceName}
                newServiceDuration={services.newServiceDuration}
                setNewServiceDuration={services.setNewServiceDuration}
                serviceActionLoading={services.serviceActionLoading}
                handleAddService={services.handleAddService}
                handleToggleService={services.handleToggleService}
                handleDeleteService={services.handleDeleteService}
              />
            )}

            {activeTab === "qr" && (
              <QrTab
                shop={shop}
                copied={settings.copied}
                handleCopyLink={settings.handleCopyLink}
                handleDownloadQR={settings.handleDownloadQR}
                editShopName={settings.editShopName}
                setEditShopName={settings.setEditShopName}
                editShopLogoText={settings.editShopLogoText}
                setEditShopLogoText={settings.setEditShopLogoText}
                editShopCategory={settings.editShopCategory}
                setEditShopCategory={settings.setEditShopCategory}
                editShopLogoUrl={settings.editShopLogoUrl}
                setEditShopLogoUrl={settings.setEditShopLogoUrl}
                editShopTicketColor={settings.editShopTicketColor}
                setEditShopTicketColor={settings.setEditShopTicketColor}
                settingsSaving={settings.settingsSaving}
                dragActive={settings.dragActive}
                workingHoursEnabled={settings.workingHoursEnabled}
                setWorkingHoursEnabled={settings.setWorkingHoursEnabled}
                workingHoursDays={settings.workingHoursDays}
                setWorkingHoursDays={settings.setWorkingHoursDays}
                handleUpdateSettings={settings.handleUpdateSettings}
                handleDrag={settings.handleDrag}
                handleDrop={settings.handleDrop}
                handleFileChange={settings.handleFileChange}
                soundEnabled={notifications.soundEnabled}
                setSoundEnabled={notifications.setSoundEnabled}
                voiceAnnouncementsEnabled={notifications.voiceAnnouncementsEnabled}
                setVoiceAnnouncementsEnabled={notifications.setVoiceAnnouncementsEnabled}
                voiceLanguage={notifications.voiceLanguage}
                setVoiceLanguage={notifications.setVoiceLanguage}
                voiceRate={notifications.voiceRate}
                setVoiceRate={notifications.setVoiceRate}
                browserNotificationsEnabled={notifications.browserNotificationsEnabled}
                maxWaitTimeAlertMinutes={notifications.maxWaitTimeAlertMinutes}
                setMaxWaitTimeAlertMinutes={notifications.setMaxWaitTimeAlertMinutes}
                handleToggleBrowserNotifications={notifications.handleToggleBrowserNotifications}
                handleSendTestNotification={notifications.handleSendTestNotification}
                isRtl={isRtl}
              />
            )}

            {activeTab === "reports" && (
              <Suspense
                fallback={
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("loading", { defaultValue: "Loading Reports..." })}</p>
                  </div>
                }
              >
                <ReportsTab
                  reportStartDate={analytics.reportStartDate}
                  setReportStartDate={analytics.setReportStartDate}
                  reportEndDate={analytics.reportEndDate}
                  setReportEndDate={analytics.setReportEndDate}
                  exportLoading={analytics.exportLoading}
                  reportError={analytics.reportError}
                  filteredReportTickets={analytics.filteredReportTickets}
                  totalReportCount={analytics.totalReportCount}
                  completedReportCount={analytics.completedReportCount}
                  cancelledReportCount={analytics.cancelledReportCount}
                  noShowReportCount={analytics.noShowReportCount}
                  averageReportWaitMinutes={analytics.averageReportWaitMinutes}
                  averageReportServiceMinutes={analytics.averageReportServiceMinutes}
                  satisfactionScore={analytics.satisfactionScore}
                  speedScore={analytics.speedScore}
                  qualityScore={analytics.qualityScore}
                  staffLeaderboard={analytics.staffLeaderboard}
                  dailyTrends={analytics.dailyTrends}
                  serviceDistribution={analytics.serviceDistribution}
                  handleExportCSV={analytics.handleExportCSV}
                  aiAnalysis={analytics.aiAnalysis}
                  aiLoading={analytics.aiLoading}
                  aiError={analytics.aiError}
                  handleAskAiDiagnostics={analytics.handleAskAiDiagnostics}
                  isRtl={isRtl}
                />
              </Suspense>
            )}

            {activeTab === "displays" && (
              <DisplaysTab
                displays={displays.displays}
                editingDisplayId={displays.editingDisplayId}
                setEditingDisplayId={displays.setEditingDisplayId}
                editingDisplayName={displays.editingDisplayName}
                setEditingDisplayName={displays.setEditingDisplayName}
                refreshingDisplayId={displays.refreshingDisplayId}
                handleUpdateDisplayName={displays.handleUpdateDisplayName}
                handleDeleteDisplay={displays.handleDeleteDisplay}
                handleRequestRefresh={displays.handleRequestRefresh}
                shopSlug={shop?.slug}
              />
            )}

            {activeTab === "billing" && (
              <BillingTab
                shop={shop}
                invoices={billing.invoices}
                stripeLoading={billing.stripeLoading}
                stripeError={billing.stripeError}
                stripeVerifying={billing.stripeVerifying}
                stripeVerifySuccess={billing.stripeVerifySuccess}
                stripeVerifyError={billing.stripeVerifyError}
                cardNumber={billing.cardNumber}
                setCardNumber={billing.setCardNumber}
                cardExpiry={billing.cardExpiry}
                setCardExpiry={billing.setCardExpiry}
                cardCvv={billing.cardCvv}
                setCardCvv={billing.setCardCvv}
                cardName={billing.cardName}
                setCardName={billing.setCardName}
                paymentProcessing={billing.paymentProcessing}
                paymentSuccess={billing.paymentSuccess}
                paymentError={billing.paymentError}
                handleCheckoutStripe={billing.handleCheckoutStripe}
                handleMockUpgrade={billing.handleMockUpgrade}
              />
            )}

            {activeTab === "webhooks" && (
              <WebhooksTab
                webhooks={webhooks.webhooks}
                logs={webhooks.logs}
                loading={webhooks.loading}
                actionLoading={webhooks.actionLoading}
                isModalOpen={webhooks.isModalOpen}
                openModal={webhooks.openModal}
                closeModal={webhooks.closeModal}
                editingWebhook={webhooks.editingWebhook}
                formName={webhooks.formName}
                setFormName={webhooks.setFormName}
                formUrl={webhooks.formUrl}
                setFormUrl={webhooks.setFormUrl}
                formSecret={webhooks.formSecret}
                setFormSecret={webhooks.setFormSecret}
                formEvents={webhooks.formEvents}
                toggleEventSelection={webhooks.toggleEventSelection}
                formHeaders={webhooks.formHeaders}
                handleAddHeader={webhooks.handleAddHeader}
                handleUpdateHeader={webhooks.handleUpdateHeader}
                handleRemoveHeader={webhooks.handleRemoveHeader}
                formError={webhooks.formError}
                handleSaveWebhook={webhooks.handleSaveWebhook}
                handleToggleActive={webhooks.handleToggleActive}
                handleDeleteWebhook={webhooks.handleDeleteWebhook}
                testingWebhook={webhooks.testingWebhook}
                openTestModal={webhooks.openTestModal}
                closeTestModal={webhooks.closeTestModal}
                testEvent={webhooks.testEvent}
                setTestEvent={webhooks.setTestEvent}
                isTesting={webhooks.isTesting}
                testResult={webhooks.testResult}
                handleRunTest={webhooks.handleRunTest}
                inspectingLog={webhooks.inspectingLog}
                setInspectingLog={webhooks.setInspectingLog}
                handleResendLog={webhooks.handleResendLog}
                isRtl={isRtl}
              />
            )}

          </div>

        </div>
      </div>

      {/* Global reusable confirmation action modal */}
      {confirmModal && (
        <ConfirmationModal
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

    </div>
  );
}
