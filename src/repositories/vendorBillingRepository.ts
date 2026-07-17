import { collection, doc, onSnapshot, query, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Invoice } from "../types";
import { getAuthHeader } from "../lib/authUtils";

/**
  * vendorBillingRepository
  * 
  * Infrastructure repository encapsulating all Firestore operations, mock payments,
  * and Stripe checkout integrations for the Vendor billing panel.
  */
export const vendorBillingRepository = {
  /**
    * Subscribes to real-time invoices for a given shop.
    */
  subscribeToInvoices(
    shopId: string,
    onUpdate: (invoices: Invoice[]) => void,
    onError: (err: any) => void
  ): () => void {
    const invoicesQuery = query(collection(db, "shops", shopId, "invoices"));

    return onSnapshot(
      invoicesQuery,
      (snapshot) => {
        const invoicesList: Invoice[] = [];
        snapshot.forEach((docSnap) => {
          invoicesList.push(docSnap.data() as Invoice);
        });
        // Sort inside repository
        invoicesList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onUpdate(invoicesList);
      },
      onError
    );
  },

  /**
    * Triggers a mock local billing upgrade to the Pro plan, writing directly to the Shop
    * document and creating a new mock invoice in Firestore.
    */
  async mockUpgradeShop(shopId: string, cardLast4: string): Promise<Invoice> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Upgrade shop plan
    const shopDocRef = doc(db, "shops", shopId);
    await setDoc(
      shopDocRef,
      {
        plan: "pro",
        planExpiresAt: expiresAt.toISOString(),
      },
      { merge: true }
    );

    // Add Invoice Record
    const newInvoiceRef = doc(collection(db, "shops", shopId, "invoices"));
    const newInvoice: Invoice = {
      id: newInvoiceRef.id,
      shopId,
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      amount: "$19.00",
      planName: "Pro Plan (Monthly)",
      status: "paid",
      cardBrand: "Visa",
      cardLast4,
      createdAt: new Date().toISOString(),
    };
    await setDoc(newInvoiceRef, newInvoice);
    return newInvoice;
  },

  /**
    * Integrates with backend endpoint to verify a specific Stripe checkout session.
    */
  async verifyCheckout(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const headers: Record<string, string> = {};
    const authHeader = await getAuthHeader();
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const response = await fetch(`/api/verify-checkout?session_id=${sessionId}`, {
      headers
    });
    if (!response.ok) {
      throw new Error(`API failed with status ${response.status}`);
    }
    return response.json();
  },

  /**
    * Integrates with backend endpoint to create a Stripe checkout session.
    */
  async createCheckoutSession(params: {
    shopId: string;
    plan: "pro";
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url?: string }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const authHeader = await getAuthHeader();
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const response = await fetch("/api/checkout-session", {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Checkout API failed with status ${response.status}`);
    }
    return response.json();
  }
};
