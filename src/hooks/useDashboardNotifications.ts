import { useTranslation } from "react-i18next";
import { useVendorStore } from "../store/vendor/vendorStore";
import { vendorNotificationService } from "../services/vendorNotificationService";

interface UseDashboardNotificationsProps {
  shopId: string;
  shopLogoUrl: string | undefined;
  isRtl: boolean;
}

export function useDashboardNotifications({
  shopId,
  shopLogoUrl,
  isRtl,
}: UseDashboardNotificationsProps) {
  const { t } = useTranslation();

  // Selectors from Zustand store
  const soundEnabled = useVendorStore((state) => state.soundEnabled);
  const voiceAnnouncementsEnabled = useVendorStore((state) => state.voiceAnnouncementsEnabled);
  const voiceLanguage = useVendorStore((state) => state.voiceLanguage);
  const voiceRate = useVendorStore((state) => state.voiceRate);
  const browserNotificationsEnabled = useVendorStore((state) => state.browserNotificationsEnabled);
  const maxWaitTimeAlertMinutes = useVendorStore((state) => state.maxWaitTimeAlertMinutes);

  // Actions from Zustand store
  const setSoundEnabled = useVendorStore((state) => state.setSoundEnabled);
  const setVoiceAnnouncementsEnabled = useVendorStore(
    (state) => state.setVoiceAnnouncementsEnabled
  );
  const setVoiceLanguage = useVendorStore((state) => state.setVoiceLanguage);
  const setVoiceRate = useVendorStore((state) => state.setVoiceRate);
  const setBrowserNotificationsEnabled = useVendorStore(
    (state) => state.setBrowserNotificationsEnabled
  );
  const setMaxWaitTimeAlertMinutes = useVendorStore((state) => state.setMaxWaitTimeAlertMinutes);

  const announceCallingTicketStore = useVendorStore((state) => state.announceCallingTicket);
  const handleToggleBrowserNotificationsStore = useVendorStore(
    (state) => state.handleToggleBrowserNotifications
  );
  const handleSendTestNotification = useVendorStore((state) => state.handleSendTestNotification);

  const announceCallingTicket = (ticketNumber: string, counterNumber: string, serviceName: string) => {
    announceCallingTicketStore(ticketNumber, counterNumber, serviceName, isRtl);
  };

  const sendBrowserNotification = (title: string, body: string) => {
    vendorNotificationService.sendNotification(title, body, shopLogoUrl);
  };

  const handleToggleBrowserNotifications = async () => {
    try {
      await handleToggleBrowserNotificationsStore();
    } catch (err: any) {
      alert(err.message || t("vend_browser_notifications_permission_denied"));
    }
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
    handleSendTestNotification,
  };
}
