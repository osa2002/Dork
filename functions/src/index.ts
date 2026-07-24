import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

/**
 * Core business logic to archive and delete tickets created before today.
 * Keeping Firestore operations highly efficient by sweeping old tickets.
 */
async function performArchiveCleanup(): Promise<{ success: boolean; archivedCount: number; error?: string }> {
  const now = new Date();
  const startOfTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  
  console.log(`[Archive Cleanup] Querying active tickets created before: ${startOfTodayUTC}`);
  
  try {
    const ticketsQuery = db.collection("tickets").where("createdAt", "<", startOfTodayUTC);
    const snapshot = await ticketsQuery.get();
    
    if (snapshot.empty) {
      console.log("[Archive Cleanup] No legacy tickets found to clean up.");
      return { success: true, archivedCount: 0 };
    }
    
    console.log(`[Archive Cleanup] Found ${snapshot.size} tickets. Initiating batched migration to 'archived_tickets'...`);
    
    let batch = db.batch();
    let operationsInBatch = 0;
    let totalMigrated = 0;
    
    for (const doc of snapshot.docs) {
      const ticketData = doc.data();
      const archiveRef = db.collection("archived_tickets").doc(doc.id);
      
      // Move to archive collection
      batch.set(archiveRef, {
        ...ticketData,
        archivedAt: new Date().toISOString(),
        archiveSource: "cloud-function-scheduler"
      });
      
      // Delete from active tickets collection
      const ticketRef = db.collection("tickets").doc(doc.id);
      batch.delete(ticketRef);
      
      operationsInBatch += 2;
      totalMigrated++;
      
      // Firestore batch limit is 500 operations
      if (operationsInBatch >= 400) {
        await batch.commit();
        console.log(`[Archive Cleanup] Committed batch of ${operationsInBatch} operations.`);
        batch = db.batch();
        operationsInBatch = 0;
      }
    }
    
    if (operationsInBatch > 0) {
      await batch.commit();
      console.log(`[Archive Cleanup] Committed final batch of ${operationsInBatch} operations.`);
    }
    
    console.log(`[Archive Cleanup] Successfully archived and cleared ${totalMigrated} tickets.`);
    return { success: true, archivedCount: totalMigrated };
  } catch (err: any) {
    console.error("[Archive Cleanup] Fatal error during cleanup job execution:", err);
    return { success: false, archivedCount: 0, error: err.message };
  }
}

/**
 * 1. Scheduled Cloud Function (Option 1)
 * Runs automatically every night at 23:59 (11:59 PM) UTC to archive inactive tickets.
 */
export const archiveInactiveQueuesScheduled = onSchedule(
  {
    schedule: "59 23 * * *",
    timeZone: "UTC",
    memory: "256Mi",
    timeoutSeconds: 300,
  },
  async (event) => {
    console.log(`[Scheduler Triggered] Scheduled cleanup job started at: ${event.scheduleTime}`);
    const result = await performArchiveCleanup();
    console.log(`[Scheduler Completed] Status: ${result.success}. Archived total: ${result.archivedCount}`);
  }
);

/**
 * 2. HTTP Callable/OnRequest Cloud Function (Option 1 - Manual Override)
 * Allows administrators or authorized background systems to trigger cleanup immediately.
 */
export const triggerArchiveCleanupManual = onRequest(
  {
    cors: true,
    memory: "256Mi",
  },
  async (req, res) => {
    console.log("[HTTP Triggered] Manual cleanup request received.");
    
    // Optional secure authentication handshake
    const authHeader = req.headers.authorization;
    const SERVER_SECRET = process.env.STRIPE_VERIFICATION_TOKEN || "DORK_SERVER_SECRET_987654321_PRO_TOKEN";
    
    if (authHeader && authHeader !== `Bearer ${SERVER_SECRET}`) {
      res.status(401).json({ error: "Unauthorized. Invalid Bearer Token." });
      return;
    }
    
    const result = await performArchiveCleanup();
    if (result.success) {
      res.status(200).json({
        message: "Archiving and database optimization completed successfully.",
        archivedCount: result.archivedCount,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        message: "Failed to perform database archiving.",
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  }
);
