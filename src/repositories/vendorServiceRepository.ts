import { collection, doc, onSnapshot, query, where, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Service } from "../types";

/**
  * vendorServiceRepository
  * 
  * Infrastructure repository encapsulating all Firestore-specific database queries,
  * snapshot listeners, and mutations for Vendor departments / services.
  */
export const vendorServiceRepository = {
  /**
    * Subscribes to real-time changes of all services for a specific shop.
    */
  subscribeToServices(
    shopId: string,
    onUpdate: (services: Service[]) => void,
    onError: (err: any) => void
  ): () => void {
    const servicesQuery = query(
      collection(db, "services"),
      where("shopId", "==", shopId)
    );

    return onSnapshot(
      servicesQuery,
      (snapshot) => {
        const servicesList: Service[] = [];
        snapshot.forEach((docSnap) => {
          servicesList.push(docSnap.data() as Service);
        });
        onUpdate(servicesList);
      },
      onError
    );
  },

  /**
    * Dynamically adds a new Service for a specific shop.
    */
  async addService(
    shopId: string,
    name: string,
    avgDurationMinutes: number
  ): Promise<Service> {
    const newServiceRef = doc(collection(db, "services"));
    const newService: Service = {
      id: newServiceRef.id,
      shopId: shopId,
      name,
      avgDurationMinutes,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    await setDoc(newServiceRef, newService);
    return newService;
  },

  /**
    * Toggles active/inactive status of a service.
    */
  async toggleServiceStatus(serviceId: string, isActive: boolean): Promise<void> {
    const serviceDocRef = doc(db, "services", serviceId);
    await updateDoc(serviceDocRef, { isActive });
  },

  /**
    * Deletes a service entirely from the shop.
    */
  async deleteService(serviceId: string): Promise<void> {
    const serviceDocRef = doc(db, "services", serviceId);
    await deleteDoc(serviceDocRef);
  },
};
