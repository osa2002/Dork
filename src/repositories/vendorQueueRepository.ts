import { collection, doc, onSnapshot, query, where, updateDoc, runTransaction } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Ticket } from "../types";

/**
  * vendorQueueRepository
  * 
  * Infrastructure repository encapsulating all Firestore-specific database queries,
  * listeners, updates, and atomicity transactions for the Vendor's ticket queues.
  */
export const vendorQueueRepository = {
  /**
    * Subscribes to real-time changes of all tickets associated with a specific shop.
    */
  subscribeToTickets(
    shopId: string,
    onUpdate: (
      tickets: Ticket[],
      changes: Array<{ type: "added" | "modified" | "removed"; ticket: Ticket }>
    ) => void,
    onError: (err: any) => void
  ): () => void {
    const ticketsQuery = query(
      collection(db, "tickets"),
      where("shopId", "==", shopId)
    );

    return onSnapshot(
      ticketsQuery,
      (snapshot) => {
        const ticketsList: Ticket[] = [];
        snapshot.forEach((docSnap) => {
          ticketsList.push(docSnap.data() as Ticket);
        });

        const changes = snapshot.docChanges().map((change) => ({
          type: change.type,
          ticket: change.doc.data() as Ticket,
        }));

        onUpdate(ticketsList, changes);
      },
      onError
    );
  },

  /**
    * Updates general fields (e.g. status, calledAt, completedAt, counterNumber, isPriority) on a Ticket.
    */
  async updateTicket(ticketId: string, updates: Partial<Ticket>): Promise<void> {
    const docRef = doc(db, "tickets", ticketId);
    await updateDoc(docRef, updates);
  },

  /**
    * Runs a transaction to atomically update emailNotified to true if not already notified.
    * Returns boolean indicating if the status was successfully marked as notified.
    */
  async markEmailAsNotifiedInTransaction(ticketId: string): Promise<boolean> {
    const ticketRef = doc(db, "tickets", ticketId);
    let didUpdate = false;
    await runTransaction(db, async (transaction) => {
      const freshSnap = await transaction.get(ticketRef);
      if (!freshSnap.exists()) return;
      const freshData = freshSnap.data() as Ticket;

      if (freshData.emailNotify && !freshData.emailNotified) {
        transaction.update(ticketRef, { emailNotified: true });
        didUpdate = true;
      }
    });
    return didUpdate;
  }
};
