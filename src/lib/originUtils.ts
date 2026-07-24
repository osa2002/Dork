export function getAppOrigin(): string {
  if (typeof window === "undefined") return "";

  // If we are running inside an iframe, check if there's any valid origin
  if (window.location.origin && window.location.origin !== "null") {
    return window.location.origin;
  }

  // Attempt to extract from window.location.href
  try {
    if (window.location.href && window.location.href !== "about:blank") {
      const parsed = new URL(window.location.href);
      if (parsed.origin && parsed.origin !== "null") {
        return parsed.origin;
      }
    }
  } catch (e) {
    // Ignore
  }

  // Attempt to extract from document.referrer
  try {
    if (document.referrer) {
      const parsed = new URL(document.referrer);
      if (parsed.origin && parsed.origin !== "null") {
        return parsed.origin;
      }
    }
  } catch (e) {
    // Ignore
  }

  // Fallback to the development/shared platform URL if available, otherwise window.location.origin
  return "https://ais-dev-65gxjwu37m3oq7zl65cayo-515197504824.europe-west2.run.app";
}
