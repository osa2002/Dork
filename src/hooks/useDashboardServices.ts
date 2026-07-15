import React, { useState, useEffect } from "react";
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { Service } from "../types";
import { useTranslation } from "react-i18next";

interface UseDashboardServicesProps {
  shopId: string;
  showConfirmation: (title: string, message: string, onConfirm: () => void) => void;
}

export function useDashboardServices({ shopId, showConfirmation }: UseDashboardServicesProps) {
  const { t } = useTranslation();
  const [services, setServices] = useState<Service[]>([]);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState(15);
  const [serviceActionLoading, setServiceActionLoading] = useState(false);

  // Real-time listener for Services
  useEffect(() => {
    if (!shopId) return;

    const servicesQuery = query(collection(db, "services"), where("shopId", "==", shopId));
    const unsubServices = onSnapshot(servicesQuery, (snapshot) => {
      const servicesList: Service[] = [];
      snapshot.forEach((docSnap) => {
        servicesList.push(docSnap.data() as Service);
      });
      setServices(servicesList);
    }, (error) => {
      console.error("Error listening to services:", error);
      handleFirestoreError(error, OperationType.GET, `services`);
    });

    return () => unsubServices();
  }, [shopId]);

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;

    setServiceActionLoading(true);
    try {
      const newServiceRef = doc(collection(db, "services"));
      const newService: Service = {
        id: newServiceRef.id,
        shopId: shopId,
        name: newServiceName.trim(),
        avgDurationMinutes: Number(newServiceDuration),
        isActive: true,
        createdAt: new Date().toISOString()
      };
      await setDoc(newServiceRef, newService);
      setNewServiceName("");
      setNewServiceDuration(15);
    } catch (err) {
      console.error("Error adding service:", err);
      handleFirestoreError(err, OperationType.WRITE, `services`);
    } finally {
      setServiceActionLoading(false);
    }
  };

  const handleToggleService = async (serviceId: string, currentStatus: boolean) => {
    try {
      const serviceDocRef = doc(db, "services", serviceId);
      await updateDoc(serviceDocRef, {
        isActive: !currentStatus
      });
    } catch (err) {
      console.error("Error toggling service status:", err);
      handleFirestoreError(err, OperationType.UPDATE, `services/${serviceId}`);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    showConfirmation(
      t("vend_delete_service_title", { defaultValue: "Delete Service" }),
      t("vend_confirm_delete_service", { defaultValue: "Are you sure you want to delete this service?" }),
      async () => {
        try {
          const serviceDocRef = doc(db, "services", serviceId);
          await deleteDoc(serviceDocRef);
        } catch (err) {
          console.error("Error deleting service:", err);
          handleFirestoreError(err, OperationType.DELETE, `services/${serviceId}`);
        }
      }
    );
  };

  return {
    services,
    newServiceName,
    setNewServiceName,
    newServiceDuration,
    setNewServiceDuration,
    serviceActionLoading,
    handleAddService,
    handleToggleService,
    handleDeleteService
  };
}
