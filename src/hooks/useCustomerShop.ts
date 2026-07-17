import { useState, useEffect } from "react";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Shop, Service } from "../types";
import { useShallow } from "zustand/react/shallow";
import { useShopStore } from "../store";

export function useCustomerShop(shopSlug: string) {
  const {
    shop,
    services,
    counterStatuses,
    loadingShop,
    setLoadingShop,
    selectedServiceId,
    setSelectedServiceId,
    subscribeToShop,
    subscribeToCounterStatuses,
  } = useShopStore(
    useShallow((state) => ({
      shop: state.shop,
      services: state.services,
      counterStatuses: state.counterStatuses,
      loadingShop: state.loadingShop,
      setLoadingShop: state.setLoadingShop,
      selectedServiceId: state.selectedServiceId,
      setSelectedServiceId: state.setSelectedServiceId,
      subscribeToShop: state.subscribeToShop,
      subscribeToCounterStatuses: state.subscribeToCounterStatuses,
    }))
  );

  const [historicalAvgDuration, setHistoricalAvgDuration] = useState<number | null>(null);

  // 1. Fetch historical average duration from past completed tickets for this shop
  useEffect(() => {
    if (!shop?.id) return;
    let isMounted = true;
    const fetchHistoricalAvg = async () => {
      try {
        const q = query(
          collection(db, "tickets"),
          where("shopId", "==", shop.id),
          where("status", "==", "completed"),
          limit(50)
        );
        const snap = await getDocs(q);
        const completedTickets = snap.docs
          .map(d => d.data())
          .filter((t: any) => t.completedAt && t.calledAt);
        if (completedTickets.length > 0 && isMounted) {
          const totalMin = completedTickets.reduce((acc, t: any) => {
            const diff = (new Date(t.completedAt).getTime() - new Date(t.calledAt).getTime()) / 60000;
            return acc + Math.max(1, diff);
          }, 0);
          setHistoricalAvgDuration(Math.round(totalMin / completedTickets.length));
        }
      } catch (err) {
        console.warn("Could not load historical avg duration:", err);
      }
    };
    fetchHistoricalAvg();
    return () => { isMounted = false; };
  }, [shop?.id]);

  // 2. Resolve Shop from Slug & fetch services via store subscription
  useEffect(() => {
    if (!shopSlug) return;
    const unsubscribe = subscribeToShop(shopSlug);
    return () => unsubscribe();
  }, [shopSlug, subscribeToShop]);

  // 3. Listen to Counter Statuses via store subscription
  useEffect(() => {
    if (!shop?.id) return;
    const unsubscribe = subscribeToCounterStatuses(shop.id);
    return () => unsubscribe();
  }, [shop?.id, subscribeToCounterStatuses]);

  return {
    shop,
    services,
    counterStatuses,
    loadingShop,
    setLoadingShop,
    selectedServiceId: selectedServiceId || "",
    setSelectedServiceId,
    historicalAvgDuration
  };
}

