/**
 * Service to encapsulate browser HTML5 Notification API.
 */
export const notificationService = {
  isSupported: (): boolean => {
    return typeof window !== "undefined" && "Notification" in window;
  },

  getPermission: (): NotificationPermission => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  },

  requestPermission: async (): Promise<NotificationPermission> => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        return await Notification.requestPermission();
      } catch (err) {
        console.warn("notificationService: Failed to request permission", err);
      }
    }
    return "default";
  },

  showNotification: (title: string, body: string, icon?: string): void => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: icon || "/favicon.ico",
        });
      } catch (err: any) {
        console.warn("notificationService: Could not instantiate Notification directly on this device:", err.message);
      }
    }
  },

  showTurnNotification: (isRtl: boolean, counterNumber: string | number | undefined, shopName: string): void => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(
          isRtl ? `حان دورك الآن! 🔔` : `It's your turn! 🔔`,
          {
            body: isRtl 
              ? (counterNumber 
                ? `تفضل بالتوجه إلى شباك / طاولة رقم ${counterNumber} في ${shopName} فوراً.`
                : `تفضل بالتوجه إلى كاونتر تقديم الخدمة في ${shopName} فوراً.`)
              : (counterNumber
                ? `Please proceed to window / table number ${counterNumber} at ${shopName} immediately.`
                : `Please proceed to the service counter at ${shopName} immediately.`),
            tag: "dork-turn-calling",
            requireInteraction: true
          }
        );
      } catch (err: any) {
        console.warn("notificationService: Could not instantiate Notification directly on this device:", err.message);
      }
    }
  }
};
