import { collection, query, where, onSnapshot, getDocs, doc, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Shop, Service, Ticket } from "../types";

/**
 * shopRepository
 * 
 * Infrastructure repository encapsulating all Firestore-specific database queries,
 * transactions, and snapshot listeners for Shops, Services, and Counter Statuses.
 */
export const shopRepository = {
  /**
   * Subscribes to changes of a specific Shop by its slug.
   */
  subscribeToShop(
    shopSlug: string,
    onUpdate: (shop: Shop | null) => void,
    onError: (err: any) => void
  ): () => void {
    const shopsRef = collection(db, "shops");
    const q = query(shopsRef, where("slug", "==", shopSlug));

    return onSnapshot(
      q,
      (querySnapshot) => {
        if (querySnapshot.empty) {
          onUpdate(null);
          return;
        }
        const shopDoc = querySnapshot.docs[0];
        const shopData = { id: shopDoc.id, ...shopDoc.data() } as Shop;
        onUpdate(shopData);
      },
      onError
    );
  },

  /**
   * Fetches the active services for a given shop once.
   */
  async fetchServices(shopId: string): Promise<Service[]> {
    const servicesQuery = query(
      collection(db, "services"),
      where("shopId", "==", shopId),
      where("isActive", "==", true)
    );
    const servSnap = await getDocs(servicesQuery);
    const servicesList: Service[] = [];
    servSnap.forEach((docSnap) => {
      servicesList.push(docSnap.data() as Service);
    });
    return servicesList;
  },

  /**
   * Subscribes to active services real-time updates.
   */
  subscribeToServices(
    shopId: string,
    onUpdate: (services: Service[]) => void,
    onError: (err: any) => void
  ): () => void {
    const servicesQuery = query(
      collection(db, "services"),
      where("shopId", "==", shopId),
      where("isActive", "==", true)
    );

    return onSnapshot(
      servicesQuery,
      (servSnap) => {
        const servicesList: Service[] = [];
        servSnap.forEach((docSnap) => {
          servicesList.push(docSnap.data() as Service);
        });
        onUpdate(servicesList);
      },
      onError
    );
  },

  /**
   * Subscribes to active counter statuses real-time updates.
   */
  subscribeToCounterStatuses(
    shopId: string,
    onUpdate: (statuses: any[]) => void,
    onError: (err: any) => void
  ): () => void {
    const statusesQuery = query(
      collection(db, "counter_statuses"),
      where("shopId", "==", shopId)
    );

    return onSnapshot(
      statusesQuery,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        // Sort numerically/alphabetically by counterNumber
        list.sort((a, b) =>
          String(a.counterNumber).localeCompare(String(b.counterNumber), undefined, {
            numeric: true,
            sensitivity: "base",
          })
        );
        onUpdate(list);
      },
      onError
    );
  },

  /**
   * Fetches historical average duration from completed tickets.
   */
  async getHistoricalAvgDuration(shopId: string): Promise<number | null> {
    const q = query(
      collection(db, "tickets"),
      where("shopId", "==", shopId),
      where("status", "==", "completed"),
      limit(50)
    );
    const snap = await getDocs(q);
    const completedTickets = snap.docs
      .map((d) => d.data() as Ticket)
      .filter((t) => t.completedAt && t.calledAt);

    if (completedTickets.length > 0) {
      const totalMin = completedTickets.reduce((acc, t) => {
        const diff = (new Date(t.completedAt!).getTime() - new Date(t.calledAt!).getTime()) / 60000;
        return acc + Math.max(1, diff);
      }, 0);
      return Math.round(totalMin / completedTickets.length);
    }
    return null;
  }
};
