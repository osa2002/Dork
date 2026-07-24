// ---------------------------------------------------------------------------
// Client-Side Browser Notifications (Singleton Instance)
// ---------------------------------------------------------------------------

class VendorNotificationService {
  isSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window;
  }

  getPermission(): NotificationPermission {
    if (!this.isSupported()) return "default";
    return Notification.permission;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return "default";
    return await Notification.requestPermission();
  }

  sendNotification(title: string, body: string, iconUrl?: string) {
    if (!this.isSupported() || this.getPermission() !== "granted") {
      return;
    }
    try {
      new Notification(title, {
        body,
        icon: iconUrl,
      });
    } catch (e) {
      console.error("Failed to send browser notification:", e);
    }
  }
}

export const vendorNotificationService = new VendorNotificationService();
