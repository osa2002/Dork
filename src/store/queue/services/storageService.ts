/**
 * Service to encapsulate browser localStorage and network status APIs.
 */
export const storageService = {
  getSavedTicketId: (shopId: string): string | null => {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        return localStorage.getItem(`dork_ticket_${shopId}`);
      } catch (err) {
        console.error("storageService: Error reading from localStorage", err);
      }
    }
    return null;
  },

  setSavedTicketId: (shopId: string, ticketId: string): void => {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        localStorage.setItem(`dork_ticket_${shopId}`, ticketId);
      } catch (err) {
        console.error("storageService: Error writing to localStorage", err);
      }
    }
  },

  removeSavedTicketId: (shopId: string): void => {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        localStorage.removeItem(`dork_ticket_${shopId}`);
      } catch (err) {
        console.error("storageService: Error removing from localStorage", err);
      }
    }
  },

  getOnlineStatus: (): boolean => {
    if (typeof navigator !== "undefined") {
      return navigator.onLine;
    }
    return true;
  },

  getSoundEnabled: (): boolean => {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        return localStorage.getItem("dork_sound_enabled") !== "false";
      } catch (err) {
        console.error("storageService: Error reading dork_sound_enabled from localStorage", err);
      }
    }
    return true;
  },

  setSoundEnabled: (enabled: boolean): void => {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        localStorage.setItem("dork_sound_enabled", String(enabled));
      } catch (err) {
        console.error("storageService: Error writing dork_sound_enabled to localStorage", err);
      }
    }
  }
};
