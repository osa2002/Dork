/**
 * Enterprise Platform Administration - Firebase Admin SDK Core Layer
 * Domain: Platform Administration (Isolated from Shop Dashboard)
 * Wraps Firebase Admin App, Auth, and Firestore with lazy initialization and error resilience.
 */

import fs from "fs";
import path from "path";
import {
  initializeApp as initializeAdminApp,
  getApps as getAdminApps,
  cert,
  App as AdminApp
} from "firebase-admin/app";
import { getAuth as getAdminAuth, Auth as AdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore, Firestore as AdminFirestore } from "firebase-admin/firestore";
import { AdminStructuredLogger } from "./AdminStructuredLogger";

export class AdminFirebaseSDK {
  private static instance: AdminFirebaseSDK | null = null;
  private app: AdminApp | null = null;
  private auth: AdminAuth | null = null;
  private firestore: AdminFirestore | null = null;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): AdminFirebaseSDK {
    if (!AdminFirebaseSDK.instance) {
      AdminFirebaseSDK.instance = new AdminFirebaseSDK();
    }
    return AdminFirebaseSDK.instance;
  }

  private initialize(): void {
    try {
      const existingApps = getAdminApps();
      if (existingApps.length > 0) {
        this.app = existingApps[0];
        AdminStructuredLogger.info("[AdminFirebaseSDK] Using pre-initialized Firebase Admin app.");
      } else {
        // Attempt Service Account path from env, or applet config fallback
        const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        const configPath = path.join(process.cwd(), "firebase-applet-config.json");

        if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
          const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
          this.app = initializeAdminApp({
            credential: cert(serviceAccount)
          });
          AdminStructuredLogger.info("[AdminFirebaseSDK] Initialized with Service Account file.");
        } else if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
          this.app = initializeAdminApp({
            projectId: config.projectId
          });
          AdminStructuredLogger.info("[AdminFirebaseSDK] Initialized with default project config.");
        } else {
          this.app = initializeAdminApp();
          AdminStructuredLogger.info("[AdminFirebaseSDK] Initialized with Application Default Credentials.");
        }
      }

      this.auth = getAdminAuth(this.app);

      // Initialize Firestore admin client with databaseId if present
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        if (config.firestoreDatabaseId) {
          this.firestore = getAdminFirestore(this.app, config.firestoreDatabaseId);
        } else {
          this.firestore = getAdminFirestore(this.app);
        }
      } else {
        this.firestore = getAdminFirestore(this.app);
      }
    } catch (err: any) {
      AdminStructuredLogger.error("[AdminFirebaseSDK] Firebase Admin SDK initialization failed", err);
    }
  }

  public getAuth(): AdminAuth {
    if (!this.auth) {
      this.initialize();
      if (!this.auth) {
        throw new Error("Firebase Admin Auth service is unavailable.");
      }
    }
    return this.auth;
  }

  public getFirestore(): AdminFirestore {
    if (!this.firestore) {
      this.initialize();
      if (!this.firestore) {
        throw new Error("Firebase Admin Firestore service is unavailable.");
      }
    }
    return this.firestore;
  }
}
