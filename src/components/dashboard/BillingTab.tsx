import React from "react";
import { CreditCard, ShieldCheck, Loader2, FileText, CheckCircle2, ChevronRight, Ban } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Invoice, Shop } from "../../types";

interface BillingTabProps {
  shop: Shop | null;
  invoices: Invoice[];
  stripeLoading: boolean;
  stripeError: string | null;
  stripeVerifying: boolean;
  stripeVerifySuccess: boolean;
  stripeVerifyError: string | null;
  cardNumber: string;
  setCardNumber: (val: string) => void;
  cardExpiry: string;
  setCardExpiry: (val: string) => void;
  cardCvv: string;
  setCardCvv: (val: string) => void;
  cardName: string;
  setCardName: (val: string) => void;
  paymentProcessing: boolean;
  paymentSuccess: boolean;
  paymentError: string | null;
  handleCheckoutStripe: (planType: "pro") => void;
  handleMockUpgrade: (e: React.FormEvent) => void;
}

export function BillingTab({
  shop,
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
}: BillingTabProps) {
  const { t } = useTranslation();

  const isPro = shop?.plan === "pro";
  const proExpiresAt = shop?.planExpiresAt ? new Date(shop.planExpiresAt).toLocaleDateString() : "";

  return (
    <div className="space-y-6 animate-fade-in animate-duration-200" id="billing-tab">
      {/* Stripe checkout verifications messages banner */}
      {stripeVerifying && (
        <div className="bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-900 p-4 rounded-2xl flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
          <p className="text-xs text-blue-800 dark:text-blue-300 font-bold">
            {t("billing_verifying_payment", "Verifying payment with Stripe...")}
          </p>
        </div>
      )}

      {stripeVerifySuccess && (
        <div className="bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-800 dark:text-emerald-300 font-bold">
            {t("billing_verify_success", "Congratulations! Your payment has been processed and your account upgraded successfully. Welcome to Pro!")}
          </p>
        </div>
      )}

      {stripeVerifyError && (
        <div className="bg-rose-50 border border-rose-200 dark:bg-rose-950/20 dark:border-rose-900 p-4 rounded-2xl flex items-center gap-3">
          <Ban className="w-5 h-5 text-rose-600 shrink-0" />
          <p className="text-xs text-rose-800 dark:text-rose-300 font-bold">
            {t("billing_verify_failed", "Stripe payment verification failed: ") + stripeVerifyError}
          </p>
        </div>
      )}

      {/* Header info */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-3xl shadow-sm space-y-2">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <CreditCard className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-black text-slate-900 dark:text-white">
          {t("vend_billing_title", "Billing & Plan Subscription")}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
          {t("vend_billing_desc", "Manage your store plan tier, upgrade to remove limits and activate smart SMS / WhatsApp turn updates, and review historic payment invoice records.")}
        </p>
      </div>

      {/* Tiers and card forms */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left column: Pro plan details & checkout trigger */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-3xl shadow-sm space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-850 pb-5">
            <div className="space-y-1.5">
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black uppercase tracking-wider px-2.5 py-1 rounded-md border border-slate-200/60 dark:border-slate-700/60">
                {t("vend_billing_current_tier_label", "Current Active Plan:")}
              </span>
              <h4 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                {isPro ? (
                  <>
                    <span className="text-indigo-600 dark:text-indigo-400">Dork Pro Plan ⭐</span>
                  </>
                ) : (
                  <span className="text-slate-500">Free Tier License</span>
                )}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isPro 
                  ? t("vend_pro_expiry_label", "Your Pro plan subscription is active and will renew/expire on {{date}}.").replace("{{date}}", proExpiresAt)
                  : t("vend_free_limits_label", "You are currently using the Free tier. Upgrade to unlock all features, add unlimited wait services, and connect unlimited display screens.")}
              </p>
            </div>

            {isPro && (
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30 text-xs font-black rounded-full uppercase tracking-wider flex items-center gap-1 shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t("active_status_caps", "Active")}</span>
              </span>
            )}
          </div>

          <div className="space-y-5">
            <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              {t("vend_pro_features_title", "What is included in the Pro Plan?")}
            </h5>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: t("pro_feat1_title", "Smart SMS & Whatsapp"), desc: t("pro_feat1_desc", "Automatic notification alerts when turn is approaching.") },
                { title: t("pro_feat2_title", "Unlimited Services"), desc: t("pro_feat2_desc", "Define unlimited departments, branches, and queue paths.") },
                { title: t("pro_feat3_title", "Unlimited Displays"), desc: t("pro_feat3_desc", "Connect unlimited smart public screens and monitors.") },
                { title: t("pro_feat4_title", "Advanced Analytics"), desc: t("pro_feat4_desc", "Gemini AI diagnostic recommendations and CSV exports.") }
              ].map((feat, index) => (
                <div key={index} className="flex gap-2.5 items-start">
                  <div className="w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-black">✓</span>
                  </div>
                  <div className="space-y-0.5">
                    <h6 className="text-xs font-black text-slate-800 dark:text-white">{feat.title}</h6>
                    <p className="text-[10px] text-slate-500 leading-normal">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stripe checkout trigger */}
          {!isPro && (
            <div className="border-t border-slate-100 dark:border-slate-850 pt-5 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-150 dark:border-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-300">{t("pro_subscription_cost", "$19 / Month")}</span>
                  <p className="text-[10px] text-slate-500">{t("pro_sub_desc", "Cancel anytime. Instant automated activation.")}</p>
                </div>

                <button
                  onClick={() => handleCheckoutStripe("pro")}
                  disabled={stripeLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs py-3 px-5 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow shadow-indigo-100 dark:shadow-none"
                  id="btn-checkout-stripe"
                >
                  {stripeLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>{t("vend_upgrade_secure_stripe", "Upgrade Securely with Stripe")}</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {stripeError && (
                <p className="text-[10px] text-rose-500 font-bold">
                  {stripeError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right column: Card details or invoices list */}
        <div className="lg:col-span-5 space-y-6">
          {/* Mock credit card form - only show if not pro */}
          {!isPro && (
            <form onSubmit={handleMockUpgrade} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
              <h4 className="text-sm font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                {t("mock_cc_upgrade_title", "Direct Card Upgrade (Mock Sandbox)")}
              </h4>

              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("cc_field_holder", "Cardholder Name")}</label>
                <input 
                  type="text"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required={!isPro}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("cc_field_num", "Card Number")}</label>
                <input 
                  type="text"
                  maxLength={19}
                  value={cardNumber}
                  onChange={(e) => {
                    const formatted = e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();
                    setCardNumber(formatted);
                  }}
                  placeholder="4111 2222 3333 4444"
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  required={!isPro}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("cc_field_exp", "Expiry (MM/YY)")}</label>
                  <input 
                    type="text"
                    maxLength={5}
                    value={cardExpiry}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "");
                      if (v.length > 2) {
                        setCardExpiry(`${v.slice(0, 2)}/${v.slice(2, 4)}`);
                      } else {
                        setCardExpiry(v);
                      }
                    }}
                    placeholder="12/28"
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    required={!isPro}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("cc_field_cvv", "CVV")}</label>
                  <input 
                    type="password"
                    maxLength={3}
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ""))}
                    placeholder="123"
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    required={!isPro}
                  />
                </div>
              </div>

              {paymentError && (
                <p className="text-[10px] text-rose-500 font-black">
                  ⚠️ {paymentError}
                </p>
              )}

              {paymentSuccess && (
                <p className="text-[10px] text-emerald-600 font-black animate-bounce">
                  🎉 {t("vend_billing_payment_success", "Upgrade completed! Welcome to Pro Plan.")}
                </p>
              )}

              <button
                type="submit"
                disabled={paymentProcessing || !cardNumber.trim()}
                className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white font-black text-xs py-3.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                id="btn-mock-upgrade"
              >
                {paymentProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>{t("cc_pay_btn", "Submit Payment & Upgrade")}</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Historic invoices list */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
            <h4 className="text-sm font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>{t("vend_invoices_history_title", "Invoice & Payment History")}</span>
            </h4>

            <div className="space-y-3.5 max-h-[300px] overflow-y-auto pe-1">
              {invoices.length > 0 ? (
                invoices.map((inv) => (
                  <div 
                    key={inv.id}
                    className="flex items-center justify-between gap-3 text-xs border-b border-slate-100 dark:border-slate-800 pb-3"
                  >
                    <div className="space-y-1">
                      <p className="font-black text-slate-800 dark:text-slate-200">
                        {inv.invoiceNumber}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {inv.planName} • {new Date(inv.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="text-right space-y-1">
                      <p className="font-extrabold text-slate-900 dark:text-white">
                        {inv.amount}
                      </p>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">
                  {t("vend_no_invoices_found", "No payment invoices recorded yet.")}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
