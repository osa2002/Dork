import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { TransactionStoreAdapter } from "../../server/chaos/reliability/TransactionCoordinator";

/**
 * FirestoreStoreAdapter
 * 
 * Adapts Firestore document operations to the enterprise TransactionStoreAdapter interface,
 * enabling TransactionCoordinator and TransactionEngine to execute atomic operations on Firestore collections.
 */
export class FirestoreStoreAdapter implements TransactionStoreAdapter {
  public async get(path: string): Promise<any> {
    try {
      const docRef = doc(db, path);
      const snap = await getDoc(docRef);
      return snap && typeof snap.exists === "function" && snap.exists() ? snap.data() : null;
    } catch (err) {
      return null;
    }
  }

  public async set(path: string, data: any): Promise<void> {
    const docRef = doc(db, path);
    await setDoc(docRef, data);
  }

  public async update(path: string, data: any): Promise<void> {
    const docRef = doc(db, path);
    await updateDoc(docRef, data);
  }

  public async delete(path: string): Promise<void> {
    const docRef = doc(db, path);
    await deleteDoc(docRef);
  }
}

export const firestoreStoreAdapter = new FirestoreStoreAdapter();
