import { create } from "zustand";
import { WebhookConfig, WebhookLog, WebhookEvent } from "../types";
import { webhookRepository } from "../repositories/webhookRepository";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface WebhookState {
  webhooks: WebhookConfig[];
  logs: WebhookLog[];
  loading: boolean;
  actionLoading: boolean;

  setWebhooks: (webhooks: WebhookConfig[]) => void;
  setLogs: (logs: WebhookLog[]) => void;
  setLoading: (loading: boolean) => void;
  setActionLoading: (actionLoading: boolean) => void;

  // Actions
  subscribeToShopWebhooks: (shopId: string) => () => void;
  addWebhook: (
    shopId: string, 
    data: Omit<WebhookConfig, "id" | "shopId" | "createdAt" | "isActive">
  ) => Promise<void>;
  updateWebhook: (
    shopId: string, 
    webhookId: string, 
    updates: Partial<WebhookConfig>
  ) => Promise<void>;
  toggleWebhookActive: (
    shopId: string, 
    webhookId: string, 
    isActive: boolean
  ) => Promise<void>;
  deleteWebhook: (shopId: string, webhookId: string) => Promise<void>;
}

export const useWebhookStore = create<WebhookState>((set, get) => ({
  webhooks: [],
  logs: [],
  loading: true,
  actionLoading: false,

  setWebhooks: (webhooks) => set({ webhooks }),
  setLogs: (logs) => set({ logs }),
  setLoading: (loading) => set({ loading }),
  setActionLoading: (actionLoading) => set({ actionLoading }),

  subscribeToShopWebhooks: (shopId: string) => {
    if (!shopId) return () => {};

    set({ loading: true });

    const unsubWebhooks = webhookRepository.subscribeToWebhooks(
      shopId,
      (items) => {
        set({ webhooks: items, loading: false });
      },
      () => set({ loading: false })
    );

    const unsubLogs = webhookRepository.subscribeToWebhookLogs(
      shopId,
      (logItems) => {
        set({ logs: logItems });
      }
    );

    return () => {
      unsubWebhooks();
      unsubLogs();
    };
  },

  addWebhook: async (shopId, data) => {
    set({ actionLoading: true });
    try {
      const created = await webhookRepository.addWebhook(shopId, data);
      
      // Update store state
      const currentWebhooks = get().webhooks;
      const updatedList = [created, ...currentWebhooks];
      set({ webhooks: updatedList });

      // Persist webhooks array directly to the 'shops' document in Firestore
      try {
        const shopRef = doc(db, "shops", shopId);
        await updateDoc(shopRef, { webhooks: updatedList });
      } catch (e) {
        console.warn("Could not sync webhooks array directly onto shops document:", e);
      }
    } finally {
      set({ actionLoading: false });
    }
  },

  updateWebhook: async (shopId, webhookId, updates) => {
    set({ actionLoading: true });
    try {
      await webhookRepository.updateWebhook(webhookId, updates);

      const updatedList = get().webhooks.map((w) =>
        w.id === webhookId ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w
      );
      set({ webhooks: updatedList });

      // Sync to shop document in Firestore
      try {
        const shopRef = doc(db, "shops", shopId);
        await updateDoc(shopRef, { webhooks: updatedList });
      } catch (e) {
        console.warn("Could not sync updated webhooks to shop doc:", e);
      }
    } finally {
      set({ actionLoading: false });
    }
  },

  toggleWebhookActive: async (shopId, webhookId, isActive) => {
    await webhookRepository.toggleWebhookActive(webhookId, isActive);

    const updatedList = get().webhooks.map((w) =>
      w.id === webhookId ? { ...w, isActive } : w
    );
    set({ webhooks: updatedList });

    try {
      const shopRef = doc(db, "shops", shopId);
      await updateDoc(shopRef, { webhooks: updatedList });
    } catch (e) {
      console.warn("Could not sync toggled webhooks to shop doc:", e);
    }
  },

  deleteWebhook: async (shopId, webhookId) => {
    await webhookRepository.deleteWebhook(webhookId);

    const updatedList = get().webhooks.filter((w) => w.id !== webhookId);
    set({ webhooks: updatedList });

    try {
      const shopRef = doc(db, "shops", shopId);
      await updateDoc(shopRef, { webhooks: updatedList });
    } catch (e) {
      console.warn("Could not sync deleted webhooks to shop doc:", e);
    }
  },
}));
