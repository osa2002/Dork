import { useState, useEffect } from "react";
import { 
  collection, 
  doc, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  query, 
  where
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { Display } from "../types";
import { useTranslation } from "react-i18next";

interface UseDashboardDisplaysProps {
  shopId: string;
  showConfirmation: (title: string, message: string, onConfirm: () => void) => void;
}

export function useDashboardDisplays({ shopId, showConfirmation }: UseDashboardDisplaysProps) {
  const { t } = useTranslation();
  const [displays, setDisplays] = useState<Display[]>([]);
  const [editingDisplayId, setEditingDisplayId] = useState<string | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState("");
  const [refreshingDisplayId, setRefreshingDisplayId] = useState<string | null>(null);

  // Real-time listener for Displays
  useEffect(() => {
    if (!shopId) return;

    const displaysQuery = query(collection(db, "displays"), where("shopId", "==", shopId));
    const unsubDisplays = onSnapshot(displaysQuery, (snapshot) => {
      const displaysList: Display[] = [];
      snapshot.forEach((docSnap) => {
        displaysList.push(docSnap.data() as Display);
      });
      setDisplays(displaysList);
    }, (error) => {
      console.error("Error listening to displays:", error);
      handleFirestoreError(error, OperationType.GET, `displays`);
    });

    return () => unsubDisplays();
  }, [shopId]);

  const handleUpdateDisplayName = async (displayId: string) => {
    if (!editingDisplayName.trim()) return;

    try {
      const displayDocRef = doc(db, "displays", displayId);
      await updateDoc(displayDocRef, {
        name: editingDisplayName.trim()
      });
      setEditingDisplayId(null);
      setEditingDisplayName("");
    } catch (err) {
      console.error("Error updating display name:", err);
      handleFirestoreError(err, OperationType.UPDATE, `displays/${displayId}`);
    }
  };

  const handleDeleteDisplay = async (displayId: string) => {
    showConfirmation(
      t("vend_delete_display_title", { defaultValue: "Remove Display Screen" }),
      t("vend_confirm_delete_display", { defaultValue: "Are you sure you want to delete this public display screen link?" }),
      async () => {
        try {
          const displayDocRef = doc(db, "displays", displayId);
          await deleteDoc(displayDocRef);
        } catch (err) {
          console.error("Error deleting display:", err);
          handleFirestoreError(err, OperationType.DELETE, `displays/${displayId}`);
        }
      }
    );
  };

  const handleRequestRefresh = async (displayId: string) => {
    setRefreshingDisplayId(displayId);
    try {
      const displayDocRef = doc(db, "displays", displayId);
      await updateDoc(displayDocRef, {
        refreshRequestedAt: new Date().toISOString()
      });
      setTimeout(() => setRefreshingDisplayId(null), 1000);
    } catch (err) {
      console.error("Error triggering display refresh:", err);
      setRefreshingDisplayId(null);
      handleFirestoreError(err, OperationType.UPDATE, `displays/${displayId}`);
    }
  };

  return {
    displays,
    editingDisplayId,
    setEditingDisplayId,
    editingDisplayName,
    setEditingDisplayName,
    refreshingDisplayId,
    handleUpdateDisplayName,
    handleDeleteDisplay,
    handleRequestRefresh
  };
}
