import { initializeApp } from "firebase/app";
import * as firestoreModule from "firebase/firestore";
import { initializeFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getMessaging, isSupported, onMessage } from "firebase/messaging";
import { getAnalytics, logEvent, isSupported as isAnalyticsSupported } from "firebase/analytics";
import config from "../../firebase-applet-config.json";

// Suppress internal verbose Firestore SDK connection retry logs
try {
  if (firestoreModule && typeof (firestoreModule as any).setLogLevel === "function") {
    (firestoreModule as any).setLogLevel("warn");
  }
} catch (_) {}

// Intercept transient Firestore SDK stream disconnect logs in browser environment
if (typeof window !== "undefined") {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const msg = args.map(a => (typeof a === "string" ? a : (a?.message || JSON.stringify(a)))).join(" ");
    if (msg.includes("@firebase/firestore") && (msg.includes("GrpcConnection") || msg.includes("RST_STREAM") || msg.includes("Listen"))) {
      console.warn("[Firestore Stream Reconnecting]:", ...args);
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || config?.apiKey || "",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || config?.authDomain || "",
  projectId: env.VITE_FIREBASE_PROJECT_ID || config?.projectId || "",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || config?.storageBucket || "",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || config?.messagingSenderId || "",
  appId: env.VITE_FIREBASE_APP_ID || config?.appId || ""
};

const firestoreDatabaseId = env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || config?.firestoreDatabaseId;

console.log("[Firebase Initialization] Validating Firebase configuration...", {
  hasApiKey: !!firebaseConfig.apiKey,
  hasAuthDomain: !!firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  firestoreDatabaseId: firestoreDatabaseId || "(default)",
  hasAppId: !!firebaseConfig.appId,
});

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("[Firebase Initialization Error] Missing required Firebase configuration fields (apiKey or projectId). Check firebase-applet-config.json or environment variables.");
}

const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom databaseId and long polling to handle iframe/proxy connection resets
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firestoreDatabaseId);

// Enable IndexedDB offline persistence for high reliability in offline/poor-network scenarios
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.warn("Firestore offline persistence failed-precondition (multiple tabs open).");
    } else if (err.code === "unimplemented") {
      // The current browser does not support all of the features required to enable persistence
      console.warn("Firestore offline persistence is unimplemented in this browser.");
    } else {
      console.warn("Firestore offline persistence initialization failed:", err);
    }
  });
}

const auth = getAuth(app);

let analytics: any = null;

// Detect if we are inside a sandboxed/preview iframe or dev mode to prevent "Failed to fetch" block errors
const isIframe = typeof window !== "undefined" && (
  window.self !== window.top ||
  (window.location?.hostname && window.location.hostname.includes("run.app")) ||
  (window.location?.hostname && window.location.hostname.includes("ai.studio"))
);
const isDev = typeof window !== "undefined" && (
  window.location?.hostname === "localhost" ||
  window.location?.hostname === "127.0.0.1"
);

// Only initialize Firebase Analytics if we are in a direct production domain (not inside sandbox iframe/dev)
if (typeof window !== "undefined" && !isIframe && !isDev) {
  isAnalyticsSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
      console.log("Firebase Analytics initialized successfully.");
    }
  }).catch((err) => {
    console.warn("Firebase Analytics support check failed or is not supported:", err);
  });
} else {
  console.log("Firebase Analytics initialization skipped in development/preview/iframe environment.");
}

/**
 * Logs a frontend error or event to the browser Console and Firebase Analytics (if supported)
 */
export function logFrontendError(eventName: string, params: Record<string, any>) {
  // 1. Log styled message to Console for shop owners/developers to inspect
  console.error(
    `%c[Dork Queue Logging - ${eventName.toUpperCase()}]`,
    "color: #e11d48; font-weight: bold; font-size: 13px;",
    params
  );

  // 2. Log to Firebase Analytics
  if (analytics) {
    try {
      logEvent(analytics, eventName, params);
    } catch (err) {
      console.warn("Failed to send event to Firebase Analytics:", err);
    }
  }
}

let messaging: any = null;

// Lazily initialize Firebase Messaging if supported on current browser/device
export async function getFirebaseMessaging() {
  if (messaging) return messaging;
  try {
    const supported = await isSupported();
    if (supported) {
      messaging = getMessaging(app);
      return messaging;
    }
  } catch (err) {
    console.warn("Firebase Messaging is not supported or failed to initialize on this device:", err);
  }
  return null;
}

/**
 * Attaches a foreground listener for incoming FCM Push notifications
 */
export async function listenToForegroundFcmMessages(callback: (payload: any) => void) {
  try {
    const msg = await getFirebaseMessaging();
    if (msg) {
      return onMessage(msg, (payload) => {
        console.log("[FCM Foreground Message Received]:", payload);
        callback(payload);
      });
    }
  } catch (err) {
    console.warn("[FCM] Failed to attach foreground message listener:", err);
  }
  return () => {};
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { app, db, auth };
