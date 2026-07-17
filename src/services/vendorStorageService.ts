export const vendorStorageService = {
  getItem(key: string, defaultValue?: string): string | null {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? val : (defaultValue !== undefined ? defaultValue : null);
    } catch (e) {
      console.warn("localStorage.getItem failed", e);
      return defaultValue !== undefined ? defaultValue : null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("localStorage.setItem failed", e);
    }
  },

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("localStorage.removeItem failed", e);
    }
  }
};
