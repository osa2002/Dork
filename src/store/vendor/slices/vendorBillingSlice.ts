import { StateCreator } from "zustand";
import { VendorState, VendorBillingSlice } from "../types";
import { handleFirestoreError, OperationType } from "../../../lib/firebase";
import { vendorBillingRepository } from "../../../repositories/vendorBillingRepository";
import { runStoreAction } from "../utils/storeActionHelper";
import { getAppOrigin } from "../../../lib/originUtils";

let invoicesUnsubscribe: (() => void) | null = null;

export const createVendorBillingSlice: StateCreator<
  VendorState,
  [],
  [],
  VendorBillingSlice
> = (set, get) => ({
  invoices: [],
  stripeLoading: false,
  stripeError: null,
  stripeVerifying: false,
  stripeVerifySuccess: false,
  stripeVerifyError: null,
  paymentLoading: false,
  paymentSuccess: false,
  paymentError: null,
  cardNumber: "",
  expiryDate: "",
  cvv: "",
  cardName: "",

  setInvoices: (invoices) => set({ invoices }),
  setStripeLoading: (stripeLoading) => set({ stripeLoading }),
  setStripeError: (stripeError) => set({ stripeError }),
  setStripeVerifying: (stripeVerifying) => set({ stripeVerifying }),
  setStripeVerifySuccess: (stripeVerifySuccess) => set({ stripeVerifySuccess }),
  setStripeVerifyError: (stripeVerifyError) => set({ stripeVerifyError }),
  setPaymentLoading: (paymentLoading) => set({ paymentLoading }),
  setPaymentSuccess: (paymentSuccess) => set({ paymentSuccess }),
  setPaymentError: (paymentError) => set({ paymentError }),
  setCardNumber: (cardNumber) => set({ cardNumber }),
  setExpiryDate: (expiryDate) => set({ expiryDate }),
  setCvv: (cvv) => set({ cvv }),
  setCardName: (cardName) => set({ cardName }),

  subscribeToInvoices: (shopId: string) => {
    if (invoicesUnsubscribe) {
      invoicesUnsubscribe();
      invoicesUnsubscribe = null;
    }

    invoicesUnsubscribe = vendorBillingRepository.subscribeToInvoices(
      shopId,
      (invoicesList) => {
        set({ invoices: invoicesList });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `shops/${shopId}/invoices`);
      }
    );

    return () => {
      if (invoicesUnsubscribe) {
        invoicesUnsubscribe();
        invoicesUnsubscribe = null;
      }
    };
  },

  handleUpgradePlan: async (shopId: string, planType: "pro") => {
    await runStoreAction(
      "handleUpgradePlan",
      set,
      "stripeLoading",
      "stripeError",
      async () => {
        const result = await vendorBillingRepository.createCheckoutSession({
          shopId,
          plan: planType,
          successUrl: `${getAppOrigin()}/vendor?checkout_success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${getAppOrigin()}/vendor?checkout_cancel=true`,
        });

        if (result.url) {
          window.location.href = result.url;
        } else {
          throw new Error("No redirect URL returned from checkout endpoint");
        }
      }
    );
  },

  handleMockPaymentSubmit: async (shopId: string, t: any, e?: any) => {
    if (e) e.preventDefault();
    const { cardNumber } = get();

    if (cardNumber.replace(/\s/g, "").length < 16) {
      set({ paymentError: t("vend_err_invalid_card", { defaultValue: "Invalid card number. Must be at least 16 digits." }) });
      return;
    }

    await runStoreAction(
      "handleMockPaymentSubmit",
      set,
      "paymentLoading",
      "paymentError",
      async () => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        await vendorBillingRepository.mockUpgradeShop(shopId, cardNumber.slice(-4));
        set({
          cardNumber: "",
          expiryDate: "",
          cvv: "",
          cardName: ""
        });
      },
      {
        successStateKey: "paymentSuccess",
        onSuccess: () => {
          setTimeout(() => {
            set({ paymentSuccess: false });
          }, 3000);
        }
      }
    );
  },

  verifyStripePayment: async (sessionId: string) => {
    await runStoreAction(
      "verifyStripePayment",
      set,
      "stripeVerifying",
      "stripeVerifyError",
      async () => {
        const result = await vendorBillingRepository.verifyCheckout(sessionId);
        if (result.success) {
          setTimeout(() => {
            window.history.replaceState({}, document.title, window.location.pathname);
          }, 3000);
        } else {
          throw new Error(result.error || "Payment verification failed");
        }
      },
      {
        successStateKey: "stripeVerifySuccess"
      }
    );
  }
});
