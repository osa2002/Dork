import { collection, doc, onSnapshot, query, where, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Display } from "../types";

/**
  * vendorDisplayRepository
  * 
  * Infrastructure repository encapsulating all Firestore-specific database queries,
  * listeners, and updates for public queue-calling display screens.
  */
export const vendorDisplayRepository = {
  /**
    * Subscribes to real-time public display screens associated with a specific shop.
    */
  subscribeToDisplays(
    shopId: string,
    onUpdate: (displays: Display[]) => void,
    onError: (err: any) => void
  ): () => void {
    const displaysQuery = query(
      collection(db, "displays"),
      where("shopId", "==", shopId)
    );

    return onSnapshot(
      displaysQuery,
      (snapshot) => {
        const displaysList: Display[] = [];
        snapshot.forEach((docSnap) => {
          displaysList.push(docSnap.data() as Display);
        });
        onUpdate(displaysList);
      },
      onError
    );
  },

  /**
    * Renames a public display screen.
    */
  async updateDisplayName(displayId: string, name: string): Promise<void> {
    const displayDocRef = doc(db, "displays", displayId);
    await updateDoc(displayDocRef, { name });
  },

  /**
    * Deletes a display screen link.
    */
  async deleteDisplay(displayId: string): Promise<void> {
    const displayDocRef = doc(db, "displays", displayId);
    await deleteDoc(displayDocRef);
  },

  /**
    * Triggers a remote refresh request for a display screen.
    */
  async requestDisplayRefresh(displayId: string): Promise<void> {
    const displayDocRef = doc(db, "displays", displayId);
    await updateDoc(displayDocRef, {
      refreshRequestedAt: new Date().toISOString(),
    });
  },
};
