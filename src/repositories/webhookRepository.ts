import { 
  collection, doc, onSnapshot, query, where, setDoc, updateDoc, deleteDoc, orderBy, limit 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { WebhookConfig, WebhookLog, WebhookEvent, WebhookHeader } from "../types";

export const webhookRepository = {
  /**
   * Subscribes to real-time webhook configurations for a given shop.
   */
  subscribeToWebhooks(
    shopId: string,
    onUpdate: (webhooks: WebhookConfig[]) => void,
    onError?: (err: any) => void
  ): () => void {
    const q = query(
      collection(db, "webhooks"),
      where("shopId", "==", shopId)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const items: WebhookConfig[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as WebhookConfig);
        });
        onUpdate(items);
      },
      (err) => {
        console.error("Error subscribing to webhooks:", err);
        if (onError) onError(err);
        handleFirestoreError(err, OperationType.GET, "webhooks");
      }
    );
  },

  /**
   * Creates or adds a new webhook endpoint configuration.
   */
  async addWebhook(
    shopId: string,
    data: {
      name: string;
      url: string;
      events: WebhookEvent[];
      secret?: string;
      headers?: WebhookHeader[];
    }
  ): Promise<WebhookConfig> {
    try {
      const docRef = doc(collection(db, "webhooks"));
      const newWebhook: WebhookConfig = {
        id: docRef.id,
        shopId,
        name: data.name,
        url: data.url,
        events: data.events,
        secret: data.secret || "",
        headers: data.headers || [],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(docRef, newWebhook);
      return newWebhook;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "webhooks");
      throw err;
    }
  },

  /**
   * Updates an existing webhook endpoint configuration.
   */
  async updateWebhook(
    webhookId: string,
    data: Partial<WebhookConfig>
  ): Promise<void> {
    try {
      const docRef = doc(db, "webhooks", webhookId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `webhooks/${webhookId}`);
      throw err;
    }
  },

  /**
   * Toggles the active status of a webhook configuration.
   */
  async toggleWebhookActive(webhookId: string, isActive: boolean): Promise<void> {
    try {
      const docRef = doc(db, "webhooks", webhookId);
      await updateDoc(docRef, { 
        isActive,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `webhooks/${webhookId}`);
      throw err;
    }
  },

  /**
   * Deletes a webhook configuration.
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    try {
      const docRef = doc(db, "webhooks", webhookId);
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `webhooks/${webhookId}`);
      throw err;
    }
  },

  /**
   * Subscribes to recent webhook delivery logs for a given shop.
   */
  subscribeToWebhookLogs(
    shopId: string,
    onUpdate: (logs: WebhookLog[]) => void,
    limitCount: number = 30,
    onError?: (err: any) => void
  ): () => void {
    const q = query(
      collection(db, "webhook_logs"),
      where("shopId", "==", shopId)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const items: WebhookLog[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as WebhookLog);
        });
        // Sort in memory by createdAt descending
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onUpdate(items.slice(0, limitCount));
      },
      (err) => {
        console.error("Error subscribing to webhook logs:", err);
        if (onError) onError(err);
        handleFirestoreError(err, OperationType.GET, "webhook_logs");
      }
    );
  },

  /**
   * Logs a webhook execution attempt/result in Firestore.
   */
  async logDelivery(logData: Omit<WebhookLog, "id">): Promise<WebhookLog> {
    try {
      const docRef = doc(collection(db, "webhook_logs"));
      const newLog: WebhookLog = {
        id: docRef.id,
        ...logData,
      };
      await setDoc(docRef, newLog);
      return newLog;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "webhook_logs");
      throw err;
    }
  }
};
