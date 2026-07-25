import fs from "fs";
import path from "path";
import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, Firestore, FieldValue, Timestamp } from "firebase-admin/firestore";

let cachedDb: Firestore | null = null;

export function getAdminFirestoreDb(): Firestore {
  if (cachedDb) {
    return cachedDb;
  }

  try {
    let projectId: string | undefined;
    let databaseId: string | undefined;

    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      projectId = config.projectId;
      databaseId = config.firestoreDatabaseId;
    }

    const adminApps = getApps();
    let adminApp = adminApps.length > 0 ? adminApps[0] : null;

    if (!adminApp) {
      try {
        adminApp = initializeApp({
          projectId: projectId || process.env.VITE_FIREBASE_PROJECT_ID,
          credential: applicationDefault()
        });
      } catch {
        adminApp = initializeApp({
          projectId: projectId || process.env.VITE_FIREBASE_PROJECT_ID
        });
      }
    }

    cachedDb = getFirestore(adminApp, databaseId);
    return cachedDb;
  } catch (err: any) {
    console.error("[FirestoreClient] Failed to initialize Firestore Admin SDK:", err);
    throw err;
  }
}

export { FieldValue, Timestamp };
