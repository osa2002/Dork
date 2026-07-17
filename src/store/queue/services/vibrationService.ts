/**
 * Service to encapsulate browser vibration API.
 */
export const vibrationService = {
  vibrate: (pattern: number[] = [200, 100, 200, 100, 300]): void => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (err) {
        console.warn("vibrationService: Failed to trigger device vibration", err);
      }
    }
  }
};
