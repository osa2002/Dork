import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useVendorStore } from "../store/vendor/vendorStore";

interface UseDashboardBillingProps {
  shopId: string;
  shop?: any;
}

export function useDashboardBilling({ shopId }: UseDashboardBillingProps) {
  const { t } = useTranslation();

  // Atomic Zustand selectors for state
  const invoices = useVendorStore((state) => state.invoices);
  const stripeLoading = useVendorStore((state) => state.stripeLoading);
  const stripeError = useVendorStore((state) => state.stripeError);
  const stripeVerifying = useVendorStore((state) => state.stripeVerifying);
  const stripeVerifySuccess = useVendorStore((state) => state.stripeVerifySuccess);
  const stripeVerifyError = useVendorStore((state) => state.stripeVerifyError);

  const cardNumber = useVendorStore((state) => state.cardNumber);
  const cardExpiry = useVendorStore((state) => state.expiryDate);
  const cardCvv = useVendorStore((state) => state.cvv);
  const cardName = useVendorStore((state) => state.cardName);
  
  const paymentProcessing = useVendorStore((state) => state.paymentLoading);
  const paymentSuccess = useVendorStore((state) => state.paymentSuccess);
  const paymentError = useVendorStore((state) => state.paymentError);

  // Atomic Zustand actions
  const setCardNumber = useVendorStore((state) => state.setCardNumber);
  const setCardExpiry = useVendorStore((state) => state.setExpiryDate);
  const setCardCvv = useVendorStore((state) => state.setCvv);
  const setCardName = useVendorStore((state) => state.setCardName);

  const subscribeToInvoices = useVendorStore((state) => state.subscribeToInvoices);
  const handleUpgradePlan = useVendorStore((state) => state.handleUpgradePlan);
  const handleMockPaymentSubmit = useVendorStore((state) => state.handleMockPaymentSubmit);
  const verifyStripePayment = useVendorStore((state) => state.verifyStripePayment);

  // Real-time listener for invoices delegated to Zustand store
  useEffect(() => {
    if (!shopId) return;

    const unsubInvoices = subscribeToInvoices(shopId);
    return () => unsubInvoices();
  }, [shopId, subscribeToInvoices]);

  // Handle Stripe callback checks
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutSuccess = params.get("checkout_success");
    const sessionId = params.get("session_id");

    if (checkoutSuccess === "true" && sessionId) {
      verifyStripePayment(sessionId);
    }
  }, [verifyStripePayment]);

  const handleCheckoutStripe = async (planType: "pro") => {
    await handleUpgradePlan(shopId, planType);
  };

  const handleMockUpgrade = async (e: any) => {
    await handleMockPaymentSubmit(shopId, t, e);
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
