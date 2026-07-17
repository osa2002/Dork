import { auth } from "./firebase";

/**
 * Retrieves the authorization bearer header (token or mock demo identifier)
 * depending on whether a standard Firebase user or a local mock user is active.
 */
export async function getAuthHeader(): Promise<string | null> {
  // Check if there is a local demo user in localStorage
  if (typeof window !== "undefined") {
    const localUserJson = localStorage.getItem("dorkq_local_user");
    if (localUserJson) {
      try {
        const localUser = JSON.parse(localUserJson);
        if (localUser && localUser.uid) {
          return `Bearer demo_${localUser.uid}`;
        }
      } catch (e) {
        console.error("Error parsing local user session:", e);
      }
    }
  }

  // Fallback to standard Firebase authentication token
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      return `Bearer ${token}`;
    } catch (err) {
      console.error("Error retrieving Firebase ID token:", err);
    }
  }

  return null;
}
