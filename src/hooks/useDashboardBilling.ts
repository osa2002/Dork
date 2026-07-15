import React, { useState, useEffect } from "react";
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  where,
  setDoc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { Invoice, Shop } from "../types";
import { useTranslation } from "react-i18next";

interface UseDashboardBillingProps {
  shopId: string;
  shop: Shop | null;
}

export function useDashboardBilling({ shopId, shop }: UseDashboardBillingProps) {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [stripeVerifying, setStripeVerifying] = useState(false);
  const [stripeVerifySuccess, setStripeVerifySuccess] = useState(false);
  const [stripeVerifyError, setStripeVerifyError] = useState<string | null>(null);

  // Mock Billing card states
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Real-time listener for invoices
  useEffect(() => {
    if (!shopId) return;

    const invoicesQuery = query(collection(db, "shops", shopId, "invoices"));
    const unsubInvoices = onSnapshot(invoicesQuery, (snapshot) => {
      const invoicesList: Invoice[] = [];
      snapshot.forEach((docSnap) => {
        invoicesList.push(docSnap.data() as Invoice);
      });
      invoicesList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setInvoices(invoicesList);
    }, (error) => {
      console.error("Error listening to invoices:", error);
      handleFirestoreError(error, OperationType.GET, `shops/${shopId}/invoices`);
    });

    return () => unsubInvoices();
  }, [shopId]);

  // Handle Stripe callback checkers
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutSuccess = params.get("checkout_success");
    const sessionId = params.get("session_id");

    if (checkoutSuccess === "true" && sessionId) {
      const verifyStripePayment = async () => {
        setStripeVerifying(true);
        try {
          const response = await fetch(`/api/verify-checkout?session_id=${sessionId}`);
          if (!response.ok) {
            throw new Error(`API failed with status ${response.status}`);
          }
          const result = await response.json();
          if (result.success) {
            setStripeVerifySuccess(true);
            setTimeout(() => {
              window.history.replaceState({}, document.title, window.location.pathname);
            }, 3000);
          } else {
            setStripeVerifyError(result.error || "Payment verification failed");
          }
        } catch (err: any) {
          console.error("Error verifying Stripe payment:", err);
          setStripeVerifyError(err.message || "An error occurred during verification");
        } finally {
          setStripeVerifying(false);
        }
      };
      verifyStripePayment();
    }
  }, []);

  const handleCheckoutStripe = async (planType: "pro") => {
    setStripeLoading(true);
    setStripeError(null);
    try {
      const response = await fetch("/api/checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shopId,
          plan: planType,
          successUrl: `${window.location.origin}/vendor?checkout_success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/vendor?checkout_cancel=true`,
        }),
      });

      if (!response.ok) {
        throw new Error(`Checkout API failed with status ${response.status}`);
      }

      const session = await response.json();
      if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error("No redirect URL returned from checkout endpoint");
      }
    } catch (err: any) {
      console.error("Error redirecting to Stripe:", err);
      setStripeError(err.message || t("vend_stripe_redirect_failed_msg"));
      setStripeLoading(false);
    }
  };

  const handleMockUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cardNumber.replace(/\s/g, "").length < 16) {
      setPaymentError(t("vend_err_invalid_card"));
      return;
    }
    setPaymentProcessing(true);
    setPaymentError(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Upgrade shop plan
      const shopDocRef = doc(db, "shops", shopId);
      await setDoc(shopDocRef, {
        plan: "pro",
        planExpiresAt: expiresAt.toISOString()
      }, { merge: true });

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
        cardLast4: cardNumber.slice(-4),
        createdAt: new Date().toISOString()
      };
      await setDoc(newInvoiceRef, newInvoice);

      setPaymentSuccess(true);
      setCardNumber("");
      setCardExpiry("");
      setCardCvv("");
      setCardName("");
      setTimeout(() => setPaymentSuccess(false), 3000);
    } catch (err: any) {
      setPaymentError(err.message || t("vend_payment_error"));
    } finally {
      setPaymentProcessing(false);
    }
  };

  return {
    invoices,
    stripeLoading,
    stripeError,
    stripeVerifying,
    stripeVerifySuccess,
    stripeVerifyError,
    cardNumber,
    setCardNumber,
    cardExpiry,
    setCardExpiry,
    cardCvv,
    setCardCvv,
    cardName,
    setCardName,
    paymentProcessing,
    paymentSuccess,
    paymentError,
    handleCheckoutStripe,
    handleMockUpgrade
  };
}
