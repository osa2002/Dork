import React, { useState, useEffect } from "react";
import { Lock, ArrowLeft, CreditCard, ShieldCheck, Loader2 } from "lucide-react";

interface StripeMockCheckoutProps {
  sessionId: string;
  shopId: string;
  lang: string;
  isDarkMode: boolean;
  onCancel: () => void;
}

export default function StripeMockCheckout({
  sessionId,
  shopId,
  lang,
  isDarkMode,
  onCancel
}: StripeMockCheckoutProps) {
  const isRtl = lang === "ar";
  const [email, setEmail] = useState("vendor@dorkq.com");
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvv, setCardCvv] = useState("123");
  const [cardName, setCardName] = useState("John Doe");
  const [processing, setProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setStatusText(
      isRtl
        ? "جاري الاتصال الآمن مع خوادم Stripe..."
        : "Establishing encrypted connection to Stripe..."
    );

    setTimeout(() => {
      setStatusText(
        isRtl
          ? "جاري تفويض البطاقة والموافقة على العملية..."
          : "Authorizing card & approving transaction..."
      );
      setTimeout(() => {
        setStatusText(
          isRtl
            ? "اكتمل الدفع! جاري التوجيه للوحة التحكم..."
            : "Payment complete! Redirecting to dashboard..."
        );
        setTimeout(() => {
          // Redirect back to dashboard with success query parameters
          const origin = window.location.origin;
          window.location.href = `${origin}/?page=dashboard&stripe_status=success&session_id=${sessionId}&shopId=${shopId}`;
        }, 1000);
      }, 1500);
    }, 1500);
  };

  const handleCancel = () => {
    const origin = window.location.origin;
    window.location.href = `${origin}/?page=dashboard&stripe_status=cancel&shopId=${shopId}`;
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"} flex items-center justify-center font-sans antialiased`}>
      {/* Container holding the responsive layout */}
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 shadow-2xl rounded-[32px] overflow-hidden border border-slate-100 dark:border-slate-800 m-4 md:m-8 grid grid-cols-1 md:grid-cols-2 relative min-h-[550px] transition-all">
        
        {/* Left Column: Product Summary & Info (Stripe style) */}
        <div className="bg-slate-50 dark:bg-slate-900/40 p-8 md:p-12 border-b md:border-b-0 md:border-r border-slate-200/50 dark:border-slate-800/80 flex flex-col justify-between">
          <div>
            {/* Back to Merchant Button */}
            <button
              onClick={handleCancel}
              className="group flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-all mb-8 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
              <span>{isRtl ? "العودة للوحة التحكم" : "Back to Dashboard"}</span>
            </button>

            {/* Merchant Identity */}
            <div className="flex items-center gap-2 mb-6">
              <span className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-sm shadow shadow-indigo-200">
                D
              </span>
              <span className="font-black text-sm uppercase tracking-widest text-slate-800 dark:text-slate-200">
                {isRtl ? "منصة دورك" : "DORK PLATFORM"}
              </span>
            </div>

            {/* Product Details */}
            <div className="space-y-4">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-600 dark:text-indigo-400">
                  {isRtl ? "الباقة الاحترافية" : "PREMIUM PLAN"}
                </span>
                <h1 className="text-xl md:text-2xl font-black text-slate-950 dark:text-white mt-1">
                  {isRtl ? "ترقية الباقة الاحترافية دورك PRO" : "Dork PRO Upgrade"}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  {isRtl
                    ? "تذاكر طابور غير محدودة يومياً، تخصيص الهوية والشعار بالكامل، وتقارير وإحصائيات متكاملة لـ 30 يوماً."
                    : "Unlimited daily queue tickets, full brand/logo customization, and detailed stats/analytics for 30 days."}
                </p>
              </div>

              {/* Sandbox indicator */}
              <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-2xl flex items-start gap-2 text-amber-700 dark:text-amber-400">
                <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="text-[10px] font-bold leading-normal">
                  <p className="uppercase tracking-wider">
                    {isRtl ? "بيئة تجريبية آمنة لـ Stripe" : "Secure Stripe Sandbox"}
                  </p>
                  <p className="font-medium mt-0.5 opacity-90">
                    {isRtl
                      ? "هذا اشتراك افتراضي يحاكي بوابة Stripe ليتيح لك تجربة الباقة بدون أي تكلفة حقيقية."
                      : "This is a virtual transaction simulating the Stripe Gateway. Test cards are supported with no actual charge."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="pt-8 border-t border-slate-200/50 dark:border-slate-800/50 mt-8 space-y-3">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{isRtl ? "اشتراك شهري" : "Monthly subscription"}</span>
              <span className="font-semibold">$20.00</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>{isRtl ? "ضريبة القيمة المضافة (0%)" : "Tax (0%)"}</span>
              <span className="font-semibold">$0.00</span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
              <span className="text-xs font-black text-slate-900 dark:text-white">
                {isRtl ? "المجموع المستحق اليوم" : "Total due today"}
              </span>
              <div className="text-right">
                <span className="text-2xl font-black text-slate-950 dark:text-white">
                  $20.00
                </span>
                <span className="block text-[9px] text-slate-400 font-bold uppercase">
                  USD
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Checkout Form */}
        <div className="p-8 md:p-12 flex flex-col justify-between relative">
          
          {/* Overlaid processing spinner */}
          {processing && (
            <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/98 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-8 text-center rounded-[32px] animate-fade-in">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                {isRtl ? "جاري معالجة الدفع..." : "Processing Payment..."}
              </h3>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 font-black animate-pulse">
                {statusText}
              </p>
              <div className="flex items-center gap-1.5 mt-12 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Stripe Verified</span>
              </div>
            </div>
          )}

          <form onSubmit={handlePay} className="space-y-6">
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              <span>{isRtl ? "تفاصيل الدفع الآمن" : "Secure Payment Details"}</span>
            </h2>

            {/* Email Input */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                {isRtl ? "البريد الإلكتروني للفوترة" : "Billing Email"}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Card Inputs */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                {isRtl ? "معلومات البطاقة" : "Card Information"}
              </label>
              <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-200/60 dark:divide-slate-700/60">
                <div className="relative">
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full bg-transparent text-slate-900 dark:text-white px-4 py-3 text-xs font-semibold focus:outline-none placeholder-slate-400"
                    placeholder="4242 4242 4242 4242"
                    required
                  />
                  <div className="absolute right-4 top-3 flex gap-1">
                    <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.5 rounded">
                      VISA
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-200/60 dark:divide-slate-700/60">
                  <input
                    type="text"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    className="w-full bg-transparent text-slate-900 dark:text-white px-4 py-3 text-xs font-semibold focus:outline-none text-center placeholder-slate-400"
                    placeholder="MM/YY"
                    required
                  />
                  <input
                    type="password"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    className="w-full bg-transparent text-slate-900 dark:text-white px-4 py-3 text-xs font-semibold focus:outline-none text-center placeholder-slate-400"
                    placeholder="CVC"
                    maxLength={4}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Cardholder Name */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                {isRtl ? "الاسم الكامل على البطاقة" : "Cardholder Name"}
              </label>
              <input
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="John Doe"
                required
              />
            </div>

            {/* Stripe Button */}
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-4 rounded-2xl transition-all cursor-pointer shadow-lg shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-1.5 mt-8"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>
                {isRtl
                  ? `دفع $20.00 وتفعيل الاشتراك`
                  : `Pay $20.00 and Upgrade`}
              </span>
            </button>
          </form>

          {/* Secure footer */}
          <div className="pt-8 border-t border-slate-100 dark:border-slate-800 mt-8 flex justify-between items-center text-[9px] text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-500" />
              <span>{isRtl ? "اتصال مشفر وآمن SSL" : "SSL Encrypted Connection"}</span>
            </span>
            <span>
              Powered by <span className="font-extrabold text-slate-500">stripe</span>
            </span>
          </div>
        </div>
        
      </div>
    </div>
  );
}
