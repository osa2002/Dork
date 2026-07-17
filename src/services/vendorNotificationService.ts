export const vendorNotificationService = {
  isSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window;
  },

  getPermission(): NotificationPermission {
    return this.isSupported() ? Notification.permission : "denied";
  },

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return "denied";
    return await Notification.requestPermission();
  },

  sendNotification(title: string, body: string, iconUrl?: string): void {
    if (!this.isSupported()) return;
    if (Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: iconUrl || "/logo.png"
        });
      } catch (err: any) {
        console.warn("Notification instantiation failed on this device:", err.message);
      }
    }
  }
};
