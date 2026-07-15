import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
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

// Initialize Firestore with custom databaseId
const db = getFirestore(app, config.firestoreDatabaseId);

const auth = getAuth(app);

let analytics: any = null;

// Lazily and safely check if Analytics is supported
if (typeof window !== "undefined") {
  isAnalyticsSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
      console.log("Firebase Analytics initialized successfully.");
    }
  }).catch((err) => {
    console.warn("Firebase Analytics support check failed or is not supported:", err);
  });
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
