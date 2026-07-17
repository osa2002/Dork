import fs from "fs";
import path from "path";
import { TelemetryService } from "../services/TelemetryService";
import { initializeApp as initializeAdminApp, applicationDefault, getApps as getAdminApps } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

import { initializeApp as initializeClientApp, getApps as getClientApps } from "firebase/app";
import {
  getFirestore as getClientFirestore,
  doc as clientDoc,
  getDoc as clientGetDoc,
  collection as clientCollection,
  query as clientQuery,
  where as clientWhere,
  getDocs as clientGetDocs,
  setDoc as clientSetDoc,
  deleteDoc as clientDeleteDoc,
  runTransaction as clientRunTransaction,
  writeBatch as clientWriteBatch,
} from "firebase/firestore";

export interface IDatabaseProvider {
  getShop(shopId: string): Promise<any | null>;
  getTodayTicketsMaxNumber(shopId: string, startOfToday: string): Promise<number>;
  incrementTicketNumberTransaction(
    shopId: string,
    dayKey: string,
    maxTicketNumInDb: number,
    planType: string,
    isDemoShop: boolean
  ): Promise<number>;
  saveTicket(ticketId: string, ticketData: any): Promise<void>;
  getTicketsCreatedBefore(timestamp: string): Promise<any[]>;
  archiveAndDeleteTickets(tickets: { id: string; data: any }[]): Promise<void>;
  upgradeShopToProWithInvoice(
    shopId: string,
    invoiceId: string,
    invoiceData: any,
    planExpiresAt: string
  ): Promise<void>;
}

// ---------------------------------------------------------------------------
// Client SDK Implementation (Development Safe Sandbox Fallback)
// ---------------------------------------------------------------------------
export class ClientDatabaseProvider implements IDatabaseProvider {
  private clientDb: any = null;

  constructor() {
    this.init();
  }

  private init() {
    try {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        const apps = getClientApps();
        const clientApp = apps.length > 0 ? apps[0] : initializeClientApp(config);
        this.clientDb = getClientFirestore(clientApp, config.firestoreDatabaseId);
        console.log("[DatabaseProvider] ClientDatabaseProvider initialized with direct API Key authentication.");
      } else {
        throw new Error("firebase-applet-config.json missing");
      }
    } catch (err: any) {
      console.error("[DatabaseProvider] Failed to initialize client Firestore SDK:", err.message);
      throw err;
    }
  }

  async getShop(shopId: string): Promise<any | null> {
    const span = TelemetryService.startSpan("firestore:getShop");
    span.setAttribute("shopId", shopId);
    try {
      const shopDocRef = clientDoc(this.clientDb, "shops", shopId);
      const shopDoc = await clientGetDoc(shopDocRef);
      span.setAttribute("count", 1);
      span.end();
      return shopDoc.exists() ? shopDoc.data() : null;
    } catch (err: any) {
      span.setAttribute("error", true);
      span.setAttribute("error.message", err.message);
      span.end();
      throw err;
    }
  }

  async getTodayTicketsMaxNumber(shopId: string, startOfToday: string): Promise<number> {
    const span = TelemetryService.startSpan("firestore:getTodayTicketsMaxNumber");
    span.setAttribute("shopId", shopId);
    let maxTicketNumInDb = 0;
    try {
      const ticketsQuery = clientQuery(
        clientCollection(this.clientDb, "tickets"),
        clientWhere("shopId", "==", shopId)
      );
      const ticketsSnap = await clientGetDocs(ticketsQuery);
      span.setAttribute("count", ticketsSnap.size);
      ticketsSnap.forEach((docSnap) => {
        const t = docSnap.data();
        if (t && t.createdAt >= startOfToday) {
          const num = Number(t.ticketNumber) || 0;
          if (num > maxTicketNumInDb) {
            maxTicketNumInDb = num;
          }
        }
      });
      span.end();
    } catch (err: any) {
      span.setAttribute("error", true);
      span.setAttribute("error.message", err.message);
      span.end();
      console.warn("[DatabaseProvider] Client max ticket fallback query warn:", err);
    }
    return maxTicketNumInDb;
  }

  async incrementTicketNumberTransaction(
    shopId: string,
    dayKey: string,
    maxTicketNumInDb: number,
    planType: string,
    isDemoShop: boolean
  ): Promise<number> {
    const span = TelemetryService.startSpan("firestore:incrementTicketNumberTransaction");
    span.setAttribute("shopId", shopId);
    let nextTicketNumber = 1;
    try {
      const shopDocRef = clientDoc(this.clientDb, "shops", shopId);

      await clientRunTransaction(this.clientDb, async (transaction: any) => {
        const shopSnap = await transaction.get(shopDocRef);
        if (!shopSnap.exists()) {
          throw new Error("Shop not found in transaction");
        }
        const shopData = shopSnap.data();
        const storedDate = shopData.date || "";

        let currentCount = 0;
        if (storedDate === dayKey) {
          currentCount = shopData.lastTicketNumber || 0;
        }

        const baseCount = Math.max(currentCount, maxTicketNumInDb);

        if (planType === "free" && baseCount >= 5 && !isDemoShop) {
          throw new Error("FREE_PLAN_LIMIT_REACHED");
        }

        nextTicketNumber = baseCount + 1;

        transaction.set(
          shopDocRef,
          { lastTicketNumber: nextTicketNumber, date: dayKey },
          { merge: true }
        );
      });
      span.setAttribute("count", 2);
      span.end();
    } catch (err: any) {
      span.setAttribute("error", true);
      span.setAttribute("error.message", err.message);
      span.end();
      throw err;
    }

    return nextTicketNumber;
  }

  async saveTicket(ticketId: string, ticketData: any): Promise<void> {
    const span = TelemetryService.startSpan("firestore:saveTicket");
    span.setAttribute("ticketId", ticketId);
    try {
      const ref = clientDoc(this.clientDb, "tickets", ticketId);
      await clientSetDoc(ref, ticketData);
      span.setAttribute("count", 1);
      span.end();
    } catch (err: any) {
      span.setAttribute("error", true);
      span.setAttribute("error.message", err.message);
      span.end();
      throw err;
    }
  }

  async getTicketsCreatedBefore(timestamp: string): Promise<any[]> {
    const span = TelemetryService.startSpan("firestore:getTicketsCreatedBefore");
    try {
      const ticketsQuery = clientQuery(
        clientCollection(this.clientDb, "tickets"),
        clientWhere("createdAt", "<", timestamp)
      );
      const snapshot = await clientGetDocs(ticketsQuery);
      span.setAttribute("count", snapshot.size);
      span.end();
      return snapshot.docs.map((d) => ({ id: d.id, data: d.data() }));
    } catch (err: any) {
      span.setAttribute("error", true);
      span.setAttribute("error.message", err.message);
      span.end();
      throw err;
    }
  }

  async archiveAndDeleteTickets(tickets: { id: string; data: any }[]): Promise<void> {
    const span = TelemetryService.startSpan("firestore:archiveAndDeleteTickets");
    span.setAttribute("ticketsCount", tickets.length);
    try {
      let batch = clientWriteBatch(this.clientDb);
      let operationsInBatch = 0;

      for (const ticket of tickets) {
        const archiveRef = clientDoc(this.clientDb, "archived_tickets", ticket.id);
        batch.set(archiveRef, {
          ...ticket.data,
          archivedAt: new Date().toISOString()
        });

        const ticketRef = clientDoc(this.clientDb, "tickets", ticket.id);
        batch.delete(ticketRef);

        operationsInBatch += 2;

        if (operationsInBatch >= 400) {
          await batch.commit();
          batch = clientWriteBatch(this.clientDb);
          operationsInBatch = 0;
        }
      }

      if (operationsInBatch > 0) {
        await batch.commit();
      }
      span.setAttribute("count", tickets.length * 2);
      span.end();
    } catch (err: any) {
      span.setAttribute("error", true);
      span.setAttribute("error.message", err.message);
      span.end();
      throw err;
    }
  }

  async upgradeShopToProWithInvoice(
    shopId: string,
    invoiceId: string,
    invoiceData: any,
    planExpiresAt: string
  ): Promise<void> {
    const span = TelemetryService.startSpan("firestore:upgradeShopToProWithInvoice");
    span.setAttribute("shopId", shopId);
    span.setAttribute("invoiceId", invoiceId);
    const SERVER_SECRET = process.env.STRIPE_VERIFICATION_TOKEN || "DORK_SERVER_SECRET_987654321_PRO_TOKEN";

    // 1. Create temporary verification handshake document
    const verificationDocRef = clientDoc(this.clientDb, "shops", shopId, "private", "verification");
    try {
      await clientSetDoc(verificationDocRef, {
        serverSecret: SERVER_SECRET,
        createdAt: new Date().toISOString()
      });

      // 2. Save Invoice
      const invoiceDocRef = clientDoc(this.clientDb, "shops", shopId, "invoices", invoiceId);
      await clientSetDoc(invoiceDocRef, invoiceData);

      // 3. Update Shop Active Plan to PRO
      const shopDocRef = clientDoc(this.clientDb, "shops", shopId);
      await clientSetDoc(shopDocRef, {
        plan: "pro",
        planExpiresAt: planExpiresAt
      }, { merge: true });
      span.setAttribute("count", 3);
      span.end();
    } catch (err: any) {
      span.setAttribute("error", true);
      span.setAttribute("error.message", err.message);
      span.end();
      throw err;
    } finally {
      // 4. Cleanup the temporary verification document
      await clientDeleteDoc(verificationDocRef);
    }
  }
}

// ---------------------------------------------------------------------------
// Admin SDK Implementation (Strict Production Mode)
// ---------------------------------------------------------------------------
export class AdminDatabaseProvider implements IDatabaseProvider {
  private adminDb: any = null;

  constructor() {
    this.init();
  }

  private init() {
    try {
      let projectId: string | undefined = undefined;
      let databaseId: string | undefined = undefined;

      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        projectId = config.projectId;
        databaseId = config.firestoreDatabaseId;
      }

      const adminApps = getAdminApps();
      let adminApp = adminApps.length > 0 ? adminApps[0] : null;

      if (!adminApp) {
        try {
          adminApp = initializeAdminApp({
            projectId: projectId,
            credential: applicationDefault()
          });
          console.log("[DatabaseProvider] Admin SDK initialized successfully with ADC.");
        } catch (adcErr: any) {
          console.warn("[DatabaseProvider] ADC authentication failed, falling back to basic projectId init:", adcErr.message);
          adminApp = initializeAdminApp({
            projectId: projectId
          });
        }
      }

      this.adminDb = getAdminFirestore(adminApp, databaseId);
      console.log("[DatabaseProvider] AdminDatabaseProvider fully initialized.");
    } catch (err: any) {
      console.error("[DatabaseProvider] Failed to initialize Admin database:", err.message);
      throw err;
    }
  }

  // Exposed for checking permissions in dev fallback
  getRawDb() {
    return this.adminDb;
  }

  async getShop(shopId: string): Promise<any | null> {
    const span = TelemetryService.startSpan("firestore:getShop");
    span.setAttribute("shopId", shopId);
    try {
      const docRef = this.adminDb.collection("shops").doc(shopId);
      const snap = await docRef.get();
      span.setAttribute("count", 1);
      span.end();
      return snap.exists ? snap.data() : null;
    } catch (err: any) {
      span.setAttribute("error", true);
      span.setAttribute("error.message", err.message);
      span.end();
      throw err;
    }
  }

  async getTodayTicketsMaxNumber(shopId: string, startOfToday: string): Promise<number> {
    const span = TelemetryService.startSpan("firestore:getTodayTicketsMaxNumber");
    span.setAttribute("shopId", shopId);
    let maxTicketNumInDb = 0;
    try {
      const snap = await this.adminDb.collection("tickets").where("shopId", "==", shopId).get();
      span.setAttribute("count", snap.size);
      snap.forEach((docSnap: any) => {
        const t = docSnap.data();
        if (t && t.createdAt >= startOfToday) {
          const num = Number(t.ticketNumber) || 0;
          if (num > maxTicketNumInDb) {
            maxTicketNumInDb = num;
          }
        }
      });
      span.end();
    } catch (err: any) {
      span.setAttribute("error", true);
      span.setAttribute("error.message", err.message);
      span.end();
      console.warn("[DatabaseProvider] Admin max ticket fallback query warn:", err);
    }
    return maxTicketNumInDb;
  }

  async incrementTicketNumberTransaction(
    shopId: string,
    dayKey: string,
    maxTicketNumInDb: number,
    planType: string,
    isDemoShop: boolean
  ): Promise<number> {
    const span = TelemetryService.startSpan("firestore:incrementTicketNumberTransaction");
    span.setAttribute("shopId", shopId);
    let nextTicketNumber = 1;
    const shopDocRef = this.adminDb.collection("shops").doc(shopId);

    try {
      await this.adminDb.runTransaction(async (transaction: any) => {
        const shopSnap = await transaction.get(shopDocRef);
        if (!shopSnap.exists) {
          throw new Error("Shop not found in transaction");
        }
        const shopData = shopSnap.data() || {};
        const storedDate = shopData.date || "";

        let currentCount = 0;
        if (storedDate === dayKey) {
          currentCount = shopData.lastTicketNumber || 0;
        }

        const baseCount = Math.max(currentCount, maxTicketNumInDb);

        if (planType === "free" && baseCount >= 5 && !isDemoShop) {
          throw new Error("FREE_PLAN_LIMIT_REACHED");
        }

        nextTicketNumber = baseCount + 1;

        transaction.set(
          shopDocRef,
          { lastTicketNumber: nextTicketNumber, date: dayKey },
          { merge: true }
        );
      });
      span.setAttribute("count", 2);
      span.end();
    } catch (err: any) {
      span.setAttribute("error", true);
      span.setAttribute("error.message", err.message);
      span.end();
      throw err;
    }

    return nextTicketNumber;
  }

  async saveTicket(ticketId: string, ticketData: any): Promise<void> {
    const span = TelemetryService.startSpan("firestore:saveTicket");
    span.setAttribute("ticketId", ticketId);
    try {
      const ref = this.adminDb.collection("tickets").doc(ticketId);
      await ref.set(ticketData);
      span.setAttribute("count", 1);
      span.end();
    } catch (err: any) {
      span.setAttribute("error", true);
      span.setAttribute("error.message", err.message);
      span.end();
      throw err;
    }
  }

  async getTicketsCreatedBefore(timestamp: string): Promise<any[]> {
    const span = TelemetryService.startSpan("firestore:getTicketsCreatedBefore");
    try {
      const snap = await this.adminDb.collection("tickets").where("createdAt", "<", timestamp).get();
      span.setAttribute("count", snap.size);
      span.end();
      return snap.docs.map((d: any) => ({ id: d.id, data: d.data() }));
    } catch (err: any) {
      span.setAttribute("error", true);
      span.setAttribute("error.message", err.message);
      span.end();
      throw err;
    }
  }

  async archiveAndDeleteTickets(tickets: { id: string; data: any }[]): Promise<void> {
    const span = TelemetryService.startSpan("firestore:archiveAndDeleteTickets");
    span.setAttribute("ticketsCount", tickets.length);
    try {
      let batch = this.adminDb.batch();
      let operationsInBatch = 0;

      for (const ticket of tickets) {
        const archiveRef = this.adminDb.collection("archived_tickets").doc(ticket.id);
        batch.set(archiveRef, {
          ...ticket.data,
          archivedAt: new Date().toISOString()
        });

        const ticketRef = this.adminDb.collection("tickets").doc(ticket.id);
        batch.delete(ticketRef);

        operationsInBatch += 2;

        if (operationsInBatch >= 400) {
          await batch.commit();
          batch = this.adminDb.batch();
          operationsInBatch = 0;
        }
      }

      if (operationsInBatch > 0) {
        await batch.commit();
      }
      span.setAttribute("count", tickets.length * 2);
      span.end();
    } catch (err: any) {
      span.setAttribute("error", true);
      span.setAttribute("error.message", err.message);
      span.end();
      throw err;
    }
  }

  async upgradeShopToProWithInvoice(
    shopId: string,
    invoiceId: string,
    invoiceData: any,
    planExpiresAt: string
  ): Promise<void> {
    const span = TelemetryService.startSpan("firestore:upgradeShopToProWithInvoice");
    span.setAttribute("shopId", shopId);
    span.setAttribute("invoiceId", invoiceId);
    try {
      const invoiceDocRef = this.adminDb.collection("shops").doc(shopId).collection("invoices").doc(invoiceId);
      await invoiceDocRef.set(invoiceData);

      const shopDocRef = this.adminDb.collection("shops").doc(shopId);
      await shopDocRef.set({
        plan: "pro",
        planExpiresAt: planExpiresAt
      }, { merge: true });
      span.setAttribute("count", 2);
      span.end();
    } catch (err: any) {
      span.setAttribute("error", true);
      span.setAttribute("error.message", err.message);
      span.end();
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Unified Factory & Selection Engine
// ---------------------------------------------------------------------------
let activeProvider: IDatabaseProvider | null = null;

export async function getDatabaseProvider(): Promise<IDatabaseProvider> {
  if (activeProvider) return activeProvider;

  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    console.log("[DatabaseProvider] Under PRODUCTION mode: Initializing AdminDatabaseProvider strictly (0 client SDK overhead).");
    activeProvider = new AdminDatabaseProvider();
    return activeProvider;
  }

  // DEVELOPMENT / SANDBOX environment: Auto-negotiate credentials gracefully
  try {
    console.log("[DatabaseProvider] Under DEVELOPMENT mode: Attempting to verify Admin SDK IAM permissions...");
    const adminProvider = new AdminDatabaseProvider();
    
    // Fast lightweight verification read to confirm service account / ADC IAM authorization
    const rawDb = adminProvider.getRawDb();
    await rawDb.collection("shops").limit(1).get();

    console.log("[DatabaseProvider] IAM check passed. Admin SDK has active Firestore permissions in this workspace. Selecting AdminDatabaseProvider.");
    activeProvider = adminProvider;
    return activeProvider;
  } catch (err: any) {
    if (err.message?.includes("PERMISSION_DENIED") || err.code === 7) {
      console.warn(
        "[DatabaseProvider] Admin SDK lacks IAM permissions to write Firestore inside development sandbox (Expected behaviour)." +
        " Transitioning to client-authenticated ClientDatabaseProvider fallback."
      );
    } else {
      console.warn("[DatabaseProvider] Admin SDK dry-run failed due to generic error. Falling back to client authenticated provider:", err.message);
    }
    
    activeProvider = new ClientDatabaseProvider();
    return activeProvider;
  }
}
