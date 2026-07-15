import { Ticket } from "../types";

const DB_NAME = "dork-queue-db";
const DB_VERSION = 1;

export function initDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("cached_data")) {
        db.createObjectStore("cached_data", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("pending_tickets")) {
        db.createObjectStore("pending_tickets", { keyPath: "id" });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

export async function cacheData(key: string, data: any): Promise<void> {
  try {
    const db = await initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("cached_data", "readwrite");
      const store = transaction.objectStore("cached_data");
      const request = store.put({ key, value: data, timestamp: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to cache data in IndexedDB:", error);
  }
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const db = await initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("cached_data", "readonly");
      const store = transaction.objectStore("cached_data");
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result ? (request.result.value as T) : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to get cached data from IndexedDB:", error);
    return null;
  }
}

export async function addPendingTicket(ticket: Ticket): Promise<void> {
  try {
    const db = await initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("pending_tickets", "readwrite");
      const store = transaction.objectStore("pending_tickets");
      const request = store.put(ticket);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to add pending ticket to IndexedDB:", error);
  }
}

export async function getPendingTickets(): Promise<Ticket[]> {
  try {
    const db = await initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("pending_tickets", "readonly");
      const store = transaction.objectStore("pending_tickets");
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to get pending tickets from IndexedDB:", error);
    return [];
  }
}

export async function deletePendingTicket(id: string): Promise<void> {
  try {
    const db = await initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("pending_tickets", "readwrite");
      const store = transaction.objectStore("pending_tickets");
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to delete pending ticket from IndexedDB:", error);
  }
}
