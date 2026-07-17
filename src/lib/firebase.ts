import { initializeApp } from "firebase/app";
import { initializeFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getMessaging, isSupported } from "firebase/messaging";
import { getAnalytics, logEvent, isSupported as isAnalyticsSupported } from "firebase/analytics";
import config from "../../firebase-applet-config.json";

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom databaseId and long polling to bypass iframe/proxy connection blocks
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, config.firestoreDatabaseId);

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
