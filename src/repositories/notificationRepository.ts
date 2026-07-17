import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

/**
 * notificationRepository
 * 
 * Infrastructure repository encapsulating Firestore operations for notifications,
 * such as registering client device push tokens on active tickets.
 */
export const notificationRepository = {
  /**
   * Updates the Firebase Cloud Messaging registration token associated with a specific ticket.
   */
  async updateFcmToken(ticketId: string, fcmToken: string): Promise<void> {
    const ticketRef = doc(db, "tickets", ticketId);
    await updateDoc(ticketRef, { fcmToken });
  }
};
