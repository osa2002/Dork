import { doc, onSnapshot, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Shop } from "../types";

/**
  * vendorShopRepository
  * 
  * Infrastructure repository encapsulating all Firestore-specific database queries,
  * listeners, and mutations for the Vendor Shop configuration.
  */
export const vendorShopRepository = {
  /**
    * Subscribes to real-time changes of a specific Shop document by its ID.
    */
  subscribeToShop(
    shopId: string,
    onUpdate: (shop: Shop) => void,
    onError: (err: any) => void
  ): () => void {
    const shopDocRef = doc(db, "shops", shopId);
    return onSnapshot(
      shopDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onUpdate(docSnap.data() as Shop);
        }
      },
      onError
    );
  },

  /**
    * Updates shop settings like name, category, logo, colors, and hours.
    */
  async updateShopSettings(shopId: string, updates: Partial<Shop>): Promise<void> {
    const shopDocRef = doc(db, "shops", shopId);
    await updateDoc(shopDocRef, updates);
  },

  /**
    * Updates the active status of a specific counter window (e.g. online, break, busy).
    */
  async updateCounterStatus(
    shopId: string,
    counterNumber: string,
    status: "online" | "busy" | "break" | "offline"
  ): Promise<void> {
    const docId = `${shopId}_${counterNumber}`;
    await setDoc(
      doc(db, "counter_statuses", docId),
      {
        shopId,
        counterNumber,
        status,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }
};
